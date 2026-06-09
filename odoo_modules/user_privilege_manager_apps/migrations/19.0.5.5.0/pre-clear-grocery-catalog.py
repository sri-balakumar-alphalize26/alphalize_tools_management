import logging

_logger = logging.getLogger(__name__)


def _table_exists(cr, table):
    cr.execute(
        "SELECT 1 FROM information_schema.tables WHERE table_name = %s",
        (table,),
    )
    return bool(cr.fetchone())


def migrate(cr, version):
    """Force-delete the legacy (grocery) app.feature.app catalog on upgrade.

    Must use raw SQL, NOT the ORM: this is a ``pre`` migration and
    ``app.feature.app`` is defined in THIS module, so its model class is not
    yet imported into the registry at this stage (``load_openerp_module`` runs
    after the pre migrations). Using ``env['app.feature.app']`` here raises
    ``KeyError: 'app.feature.app'`` and rolls back the whole upgrade.

    The old grocery records were loaded with noupdate="1", which Odoo's orphan
    cleanup does NOT reliably remove, so they would otherwise keep showing in
    the admin "Hide Apps Privilege" dropdown.

    Deleting the catalog rows cascades to both hide tables
    (app.feature.visibility.app and role.app.feature.visibility.app), which
    declare ON DELETE CASCADE foreign keys on feature_id.
    """
    if not _table_exists(cr, 'app_feature_app'):
        # Fresh install — nothing to clear.
        return

    # Remove stale ir.model.data rows for the old (noupdate="1") records so
    # they don't linger or get re-orphaned.
    cr.execute("DELETE FROM ir_model_data WHERE model = 'app.feature.app'")

    # Deleting the catalog rows cascades to both hide tables via their
    # ON DELETE CASCADE foreign keys on feature_id. Delete children first too,
    # defensively, in case constraints are not enforced.
    for child in ('app_feature_visibility_app', 'role_app_feature_visibility_app'):
        if _table_exists(cr, child):
            cr.execute("DELETE FROM %s" % child)  # table name is a literal, not user input

    cr.execute("DELETE FROM app_feature_app")
    _logger.info(
        '[FeatureSync migration %s] cleared legacy app.feature.app catalog; '
        'catalog will be re-created from data XML.', version,
    )
