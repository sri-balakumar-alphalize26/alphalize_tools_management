# -*- coding: utf-8 -*-
from odoo import models, fields, api


class RentalInvoiceSettings(models.Model):
    _name = 'rental.invoice.settings'
    _description = 'Rental Invoice Branding Settings'
    _rec_name = 'company_name'

    company_id = fields.Many2one(
        'res.company', string='Company', required=True,
        default=lambda self: self.env.company)

    # Header branding text (defaults seeded from the values that used to be
    # hardcoded in the invoice templates, so output is unchanged until edited).
    company_name = fields.Char(string='Company Name', default='SMART VISION')
    company_subname = fields.Char(
        string='Company Subname', default='INTERNATIONAL L.L.C')
    cr_address = fields.Char(
        string='C.R / Address Line',
        default='C.R No: 1199264 P.O:534, PC.:111, Sultanate of oman')
    phone_numbers = fields.Char(
        string='Phone / GSM', default='GSM: 97117880, 99047066')
    branch_email = fields.Char(
        string='Branch / Email',
        default='Branch: AI Mawaleh  smartvisionllc1313@gmail.com')
    vat_number = fields.Char(string='VAT Number', default='VAT No: OM110025049X')

    # Arabic header branding text (right-side RTL block). Defaults seeded from
    # the values that used to be hardcoded in the invoice templates.
    company_name_ar = fields.Char(
        string='Company Name (Arabic)', default='الرؤية الذكية')
    company_subname_ar = fields.Char(
        string='Company Subname (Arabic)', default='الدولية ش.م.م')
    cr_address_ar = fields.Char(
        string='C.R / Address Line (Arabic)',
        default='س.ت: ١١٩٩٢٦٤ ص.ب:٥٣٤، ر.ب:١١١، سلطنة عمان')
    phone_numbers_ar = fields.Char(
        string='Phone (Arabic)', default='هاتف: ٩٧١١٧٨٨٠، ٩٩٠٤٧٠٦٦')
    branch_email_ar = fields.Char(
        string='Branch / Email (Arabic)',
        default='فرع: الموالح  smartvisionllc1313@gmail.com')

    # Logos
    center_logo = fields.Binary(string='Center Logo')
    right_logo = fields.Binary(string='Right-Side Logo')

    # Invoice headings (per document type)
    heading_checkin = fields.Char(
        string='Check-In Heading', default='CHECK-IN INVOICE')
    heading_checkout = fields.Char(
        string='Check-Out Heading', default='CHECKOUT INVOICE')
    heading_partial_return = fields.Char(
        string='Partial Return Heading', default='PARTIAL RETURN INVOICE')

    _sql_constraints = [
        ('company_uniq', 'unique(company_id)',
         'Invoice branding settings already exist for this company.'),
    ]

    @api.model
    def get_for_company(self, company):
        """Return (creating if needed) the invoice settings for a company.

        Invoice templates call this so they always receive a usable record
        carrying the default branding/headings, even before an admin has
        configured one.
        """
        company = company or self.env.company
        settings = self.sudo().search(
            [('company_id', '=', company.id)], limit=1)
        if not settings:
            settings = self.sudo().create({'company_id': company.id})
        return settings
