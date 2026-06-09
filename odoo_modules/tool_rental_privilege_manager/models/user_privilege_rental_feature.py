import logging

from odoo import models, fields, api

_logger = logging.getLogger(__name__)


class AppFeature(models.Model):
    """Catalog of app-side UI elements that can be hidden per user or role.

    Each record defines one gateable element. The React Native app fetches the
    set of `feature_key` strings hidden for the current user at login and
    renders any matching <FeatureGate> as null.
    """
    _name = 'app.feature.rental'
    _description = 'App Feature (gateable from Odoo) - Apps'
    _order = 'sequence, name'
    _rec_name = 'name'

    feature_key = fields.Char(
        string='Feature Key',
        required=True,
        index=True,
        help="String identifier the React Native app uses, e.g. 'home.banner'. "
             "Must match the featureKey prop on the corresponding <FeatureGate>.",
    )
    name = fields.Char(
        string='Display Name',
        required=True,
        help='Human-readable label shown to admins in the privilege UI.',
    )
    description = fields.Text(
        string='Description',
        help='Optional notes describing what this feature controls in the app.',
    )
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    parent_id = fields.Many2one(
        'app.feature.rental',
        string='Parent Feature',
        ondelete='set null',
        index=True,
        help="Optional parent in the App Features admin tree.",
    )

    _sql_constraints = [
        ('feature_key_unique', 'UNIQUE(feature_key)',
         'Feature key must be unique.'),
    ]

    # ------------------------------------------------------------------
    # API: called by the React Native app at startup/login to register its
    # own gateable elements. The app is the single source of truth for the
    # catalog — this makes the module app-agnostic (no hardcoded XML seed).
    # Whatever app connects to this DB pushes its own feature list here, and
    # the admin "Hide Apps Privilege" dropdown then reflects that app.
    # ------------------------------------------------------------------
    @api.model
    def sync_feature_catalog(self, features):
        """Upsert the catalog from an app-supplied manifest.

        :param features: list of dicts, each:
            {
              'key':         'rental.confirm',      # required, unique
              'name':        'Confirm Order',       # required, label for admins
              'description': '...',                 # optional
              'parent_key':  'home.tile.rental_orders',  # optional, nests row
              'sequence':    120,                   # optional ordering
            }
        Behaviour:
          * create rows for keys not yet present,
          * update name/description/sequence/parent on existing rows,
          * reactivate rows whose key returned,
          * archive (active=False) any active row whose key is NOT in the
            incoming list (auto-retires another app's stale keys, e.g. the
            old grocery records — archive, not delete, so existing per-user
            hide rows survive if the key ever comes back).
        Returns a summary dict for logging.
        """
        if not isinstance(features, (list, tuple)):
            _logger.warning('[FeatureSync] ignored non-list payload: %r', type(features))
            return {'created': 0, 'updated': 0, 'archived': 0, 'error': 'payload must be a list'}

        Feature = self.sudo().with_context(active_test=False)

        # Normalise + dedupe incoming entries by key (last one wins).
        incoming = {}
        for f in features:
            if not isinstance(f, dict):
                continue
            key = (f.get('key') or '').strip()
            name = (f.get('name') or '').strip()
            if not key or not name:
                continue
            incoming[key] = {
                'feature_key': key,
                'name': name,
                'description': f.get('description') or False,
                'sequence': int(f.get('sequence') or 10),
                'parent_key': (f.get('parent_key') or '').strip() or None,
            }

        if not incoming:
            _logger.warning('[FeatureSync] payload had no valid {key,name} entries; skipping')
            return {'created': 0, 'updated': 0, 'archived': 0}

        existing = {r.feature_key: r for r in Feature.search([])}

        created = updated = 0
        # Pass 1: upsert rows (without resolving parent links yet).
        for key, vals in incoming.items():
            row = existing.get(key)
            write_vals = {
                'name': vals['name'],
                'description': vals['description'],
                'sequence': vals['sequence'],
                'active': True,
            }
            if row:
                changed = (
                    row.name != write_vals['name']
                    or (row.description or False) != (write_vals['description'] or False)
                    or row.sequence != write_vals['sequence']
                    or not row.active
                )
                if changed:
                    row.write(write_vals)
                    updated += 1
            else:
                new_row = Feature.create({'feature_key': key, **write_vals})
                existing[key] = new_row
                created += 1

        # Pass 2: resolve parent_key -> parent_id now that every row exists.
        for key, vals in incoming.items():
            row = existing.get(key)
            parent_key = vals['parent_key']
            desired_parent = existing.get(parent_key) if parent_key else None
            desired_id = desired_parent.id if desired_parent else False
            if row.parent_id.id != desired_id:
                row.write({'parent_id': desired_id})

        # Archive any currently-active row whose key the app no longer declares.
        incoming_keys = set(incoming.keys())
        stale = Feature.search([('active', '=', True)]).filtered(
            lambda r: r.feature_key not in incoming_keys
        )
        archived = len(stale)
        if stale:
            stale.write({'active': False})

        summary = {'created': created, 'updated': updated, 'archived': archived}
        _logger.info('[FeatureSync] uid=%s synced %s features → %s',
                     self.env.uid, len(incoming), summary)
        return summary
