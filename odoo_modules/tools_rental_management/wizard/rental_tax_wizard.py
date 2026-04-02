from odoo import models, fields, api, _
from odoo.exceptions import UserError


class RentalTaxWizard(models.TransientModel):
    _name = 'rental.tax.wizard'
    _description = 'Apply Tax to Rental Order'

    order_id = fields.Many2one(
        'rental.order', string='Rental Order', required=True)
    currency_id = fields.Many2one(
        'res.currency', default=lambda self: self.env.company.currency_id)
    line_ids = fields.One2many(
        'rental.tax.wizard.line', 'wizard_id', string='Lines')
    total_tax = fields.Monetary(
        string='Total Tax',
        compute='_compute_total_tax',
        currency_field='currency_id')
    tax_method = fields.Selection([
        ('total', 'Total Tax'),
        ('per_product', 'Per Product'),
    ], string='Tax Method', default='total')
    total_tax_percentage = fields.Float(
        string='Tax % (All Products)', default=0)

    @api.depends('line_ids.tax_amount')
    def _compute_total_tax(self):
        for wiz in self:
            wiz.total_tax = sum(wiz.line_ids.mapped('tax_amount'))

    @api.onchange('total_tax_percentage')
    def _onchange_total_tax_percentage(self):
        if self.tax_method == 'total' and self.total_tax_percentage >= 0:
            for line in self.line_ids:
                line.tax_percentage = self.total_tax_percentage

    @api.onchange('tax_method')
    def _onchange_tax_method(self):
        self.total_tax_percentage = 0
        for line in self.line_ids:
            line.tax_percentage = 0

    def action_apply_tax(self):
        """Apply tax values to order lines."""
        self.ensure_one()
        for wiz_line in self.line_ids:
            if wiz_line.order_line_id:
                wiz_line.order_line_id.write({
                    'tax_percentage': wiz_line.tax_percentage,
                    'tax_amount': wiz_line.tax_amount,
                    'price_before_tax': wiz_line.rental_cost,
                })
        # Log in timesheet
        tax_details = ', '.join(
            f"{l.tool_id.name}: {l.tax_percentage}%"
            for l in self.line_ids if l.tax_percentage > 0
        )
        if tax_details:
            self.env['rental.timesheet'].create({
                'order_id': self.order_id.id,
                'action': 'note',
                'date': fields.Date.today(),
                'user_id': self.env.user.id,
                'notes': f'Tax applied: {tax_details}',
            })
        return {'type': 'ir.actions.act_window_close'}


class RentalTaxWizardLine(models.TransientModel):
    _name = 'rental.tax.wizard.line'
    _description = 'Tax Wizard Line'

    wizard_id = fields.Many2one(
        'rental.tax.wizard', ondelete='cascade')
    order_line_id = fields.Many2one(
        'rental.order.line', string='Order Line')
    tool_id = fields.Many2one(
        'rental.tool', string='Tool', readonly=True)
    serial_number = fields.Char(
        related='tool_id.serial_number', string='Serial No.', readonly=True)
    currency_id = fields.Many2one(
        related='wizard_id.currency_id')
    rental_cost = fields.Monetary(
        string='Rental Cost', currency_field='currency_id', readonly=True)
    tax_percentage = fields.Float(
        string='Tax %', default=0,
        help='Tax percentage to apply on rental cost.')
    tax_amount = fields.Monetary(
        string='Tax Amount',
        compute='_compute_tax_amount',
        currency_field='currency_id')
    final_amount = fields.Monetary(
        string='Final Amount',
        compute='_compute_tax_amount',
        currency_field='currency_id')

    @api.depends('rental_cost', 'tax_percentage')
    def _compute_tax_amount(self):
        for line in self:
            if line.tax_percentage > 0 and line.rental_cost:
                line.tax_amount = line.rental_cost * line.tax_percentage / 100
                line.final_amount = line.rental_cost + line.tax_amount
            else:
                line.tax_amount = 0.0
                line.final_amount = line.rental_cost

    @api.onchange('tax_percentage')
    def _onchange_tax_percentage(self):
        if self.tax_percentage < 0:
            self.tax_percentage = 0
            return {'warning': {
                'title': _('Invalid Value'),
                'message': _('Tax percentage cannot be negative.'),
            }}
        if self.tax_percentage > 100:
            self.tax_percentage = 100
            return {'warning': {
                'title': _('Invalid Value'),
                'message': _('Tax percentage cannot exceed 100%.'),
            }}
