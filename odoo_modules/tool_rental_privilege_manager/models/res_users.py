from odoo import models, fields, api


class ResUsers(models.Model):
    _inherit = 'res.users'

    privilege_rental_ids = fields.One2many(
        'user.privilege.rental',
        'user_id',
        string='User Privileges',
    )
    privilege_app_count = fields.Integer(
        string='Privilege Count',
        compute='_compute_privilege_app_count',
    )
    module_privilege_rental_ids = fields.One2many(
        'module.privilege.rental',
        'user_id',
        string='Module Privileges',
    )
    module_privilege_rental_count = fields.Integer(
        string='Module Privilege Count',
        compute='_compute_module_privilege_rental_count',
    )
    menu_privilege_rental_ids = fields.One2many(
        'menu.privilege.rental',
        'user_id',
        string='Menu Privileges',
    )
    menu_privilege_rental_count = fields.Integer(
        string='Menu Privilege Count',
        compute='_compute_menu_privilege_rental_count',
    )
    module_visibility_rental_ids = fields.One2many(
        'module.visibility.rental',
        'user_id',
        string='Module (App) Visibility',
    )
    module_visibility_rental_count = fields.Integer(
        string='Module Visibility Count',
        compute='_compute_module_visibility_rental_count',
    )
    role_app_count = fields.Integer(
        string='Group Count',
        compute='_compute_role_app_count',
    )

    @api.depends('privilege_rental_ids')
    def _compute_privilege_app_count(self):
        for user in self:
            user.privilege_app_count = len(user.privilege_rental_ids)

    @api.depends('module_privilege_rental_ids')
    def _compute_module_privilege_rental_count(self):
        for user in self:
            user.module_privilege_rental_count = len(user.module_privilege_rental_ids)

    @api.depends('menu_privilege_rental_ids')
    def _compute_menu_privilege_rental_count(self):
        for user in self:
            user.menu_privilege_rental_count = len(user.menu_privilege_rental_ids)

    @api.depends('module_visibility_rental_ids')
    def _compute_module_visibility_rental_count(self):
        for user in self:
            user.module_visibility_rental_count = len(user.module_visibility_rental_ids)

    def _compute_role_app_count(self):
        for user in self:
            if not user._origin.id:
                user.role_app_count = 0
                continue
            user.role_app_count = self.env['privilege.role.rental'].sudo().search_count([
                ('user_ids', 'in', [user._origin.id]),
                ('active', '=', True),
            ])

    def action_view_privileges_app(self):
        self.ensure_one()
        return {
            'name': f'Privileges - {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'user.privilege.rental',
            'view_mode': 'list,form',
            'domain': [('user_id', '=', self.id)],
            'context': {'default_user_id': self.id},
        }

    def action_view_module_privileges_app(self):
        self.ensure_one()
        return {
            'name': f'Module Privileges - {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'module.privilege.rental',
            'view_mode': 'list,form',
            'domain': [('user_id', '=', self.id)],
            'context': {'default_user_id': self.id},
        }

    def action_view_menu_privileges_app(self):
        self.ensure_one()
        return {
            'name': f'Menu Privileges - {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'menu.privilege.rental',
            'view_mode': 'list,form',
            'domain': [('user_id', '=', self.id)],
            'context': {'default_user_id': self.id},
        }

    def action_view_roles_app(self):
        self.ensure_one()
        return {
            'name': f'Groups - {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'privilege.role.rental',
            'view_mode': 'list,form',
            'domain': [('user_ids', 'in', [self.id])],
        }

    def action_view_module_visibility_rental(self):
        self.ensure_one()
        return {
            'name': f'Module Visibility - {self.name}',
            'type': 'ir.actions.act_window',
            'res_model': 'module.visibility.rental',
            'view_mode': 'list,form',
            'domain': [('user_id', '=', self.id)],
            'context': {'default_user_id': self.id},
        }


import threading
_group_check_bypass_app = threading.local()

class ResUsersGroupOverride(models.Model):
    """Override has_group so role-granted Odoo groups are honored."""
    _inherit = 'res.users'

    def _get_role_app_group_xmlids(self):
        """Return set of group xml_ids that this user has via their privilege groups."""
        if getattr(_group_check_bypass_app, 'active', False):
            return set()
        try:
            _group_check_bypass_app.active = True
            uid = self.id or self.env.uid
            cr = self.env.cr
            cr.execute("""
                SELECT DISTINCT grp_id FROM (
                    -- manually mapped odoo groups
                    SELECT prg.group_id AS grp_id
                    FROM privilege_role_rental_odoo_groups_rel prg
                    JOIN privilege_role_rental_users_rel pru ON pru.role_id = prg.role_id
                    JOIN privilege_role_rental pr ON pr.id = prg.role_id
                    WHERE pru.user_id = %s AND pr.active = true
                    UNION ALL
                    -- auto-created group for each role
                    SELECT pr.auto_odoo_group_id AS grp_id
                    FROM privilege_role_rental pr
                    JOIN privilege_role_rental_users_rel pru ON pru.role_id = pr.id
                    WHERE pru.user_id = %s
                      AND pr.active = true
                      AND pr.auto_odoo_group_id IS NOT NULL
                ) sub WHERE grp_id IS NOT NULL
            """, (uid, uid))
            group_ids = {row[0] for row in cr.fetchall()}
            if not group_ids:
                return set()
            cr.execute("""
                SELECT imd.module || '.' || imd.name
                FROM ir_model_data imd
                WHERE imd.model = 'res.groups'
                  AND imd.res_id = ANY(%s)
            """, (list(group_ids),))
            return {row[0] for row in cr.fetchall()}
        except Exception:
            return set()
        finally:
            _group_check_bypass_app.active = False

    def has_group(self, group_ext_id):
        """Override has_group to include groups granted via privilege groups."""
        result = super().has_group(group_ext_id)
        if result:
            return True
        try:
            role_groups = self._get_role_app_group_xmlids()
            if group_ext_id in role_groups:
                return True
        except Exception:
            pass
        return False
