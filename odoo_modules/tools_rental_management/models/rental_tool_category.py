from odoo import models, fields, api, _


class RentalToolCategory(models.Model):
    _name = 'rental.tool.category'
    _description = 'Rental Tool Category'
    _order = 'name'

    def init(self):
        """Remove categories with 0 tools (cleanup unwanted synced categories)."""
        self.env.cr.execute("""
            DELETE FROM rental_tool_category
            WHERE id NOT IN (
                SELECT DISTINCT category_id FROM rental_tool WHERE category_id IS NOT NULL
            )
        """)

    name = fields.Char(string='Category Name', required=True)
    code = fields.Char(string='Code')
    parent_id = fields.Many2one('rental.tool.category', string='Parent Category')
    child_ids = fields.One2many('rental.tool.category', 'parent_id', string='Sub Categories')
    description = fields.Text(string='Description')
    tool_count = fields.Integer(string='Tools', compute='_compute_tool_count')
    child_count = fields.Integer(string='Sub Categories', compute='_compute_child_count')
    active = fields.Boolean(default=True)

    @api.depends('name')
    def _compute_tool_count(self):
        for rec in self:
            rec.tool_count = self.env['rental.tool'].search_count([
                ('category_id', '=', rec.id)
            ])

    @api.depends('child_ids')
    def _compute_child_count(self):
        for rec in self:
            rec.child_count = len(rec.child_ids)

    def action_view_tools(self):
        """Open the tools list filtered by this category."""
        return {
            'type': 'ir.actions.act_window',
            'name': _('Tools – %s', self.name),
            'res_model': 'rental.tool',
            'view_mode': 'kanban,list,form',
            'domain': [('category_id', '=', self.id)],
            'context': {},
        }

