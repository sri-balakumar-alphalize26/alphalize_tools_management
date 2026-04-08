from odoo import models, fields, api, _


class CustomerRatingWizard(models.TransientModel):
    _name = 'customer.rating.wizard'
    _description = 'Customer Rating Wizard'

    order_id = fields.Many2one(
        'rental.order', string='Rental Order',
        required=True, ondelete='cascade')
    partner_id = fields.Many2one(
        related='order_id.partner_id', string='Customer', readonly=True)
    rating = fields.Selection([
        ('perfect', 'Perfect'),
        ('very_good', 'Very Good'),
        ('good', 'Good'),
        ('fair', 'Fair'),
        ('poor', 'Poor'),
    ], string='Customer Rating', default='good')
    notes = fields.Text(string='Notes')

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        order_id = self.env.context.get('default_order_id')
        if order_id:
            order = self.env['rental.order'].browse(order_id)
            if order.partner_id.customer_rating and order.partner_id.customer_rating != 'skipped':
                res['rating'] = order.partner_id.customer_rating
            if order.partner_id.customer_rating_notes:
                res['notes'] = order.partner_id.customer_rating_notes
        return res

    def _write_rating(self, rating_value):
        """Save rating to BOTH the order and the customer (res.partner)."""
        self.ensure_one()
        now = fields.Datetime.now()
        vals = {
            'customer_rating': rating_value,
            'customer_rating_notes': self.notes or False,
            'customer_rating_date': now,
        }
        self.order_id.write(vals)
        if self.order_id.partner_id:
            self.order_id.partner_id.write(vals)

    # One-click rating actions (called from the colored buttons in the view)
    def action_rate_perfect(self):
        self.ensure_one()
        self._write_rating('perfect')
        return {'type': 'ir.actions.act_window_close'}

    def action_rate_very_good(self):
        self.ensure_one()
        self._write_rating('very_good')
        return {'type': 'ir.actions.act_window_close'}

    def action_rate_good(self):
        self.ensure_one()
        self._write_rating('good')
        return {'type': 'ir.actions.act_window_close'}

    def action_rate_fair(self):
        self.ensure_one()
        self._write_rating('fair')
        return {'type': 'ir.actions.act_window_close'}

    def action_rate_poor(self):
        self.ensure_one()
        self._write_rating('poor')
        return {'type': 'ir.actions.act_window_close'}

    def action_skip(self):
        self.ensure_one()
        self._write_rating('skipped')
        return {'type': 'ir.actions.act_window_close'}
