# -*- coding: utf-8 -*-
from odoo import models, fields, api


# The 8 Terms & Conditions that used to be hardcoded in the invoice templates,
# as (English, Arabic) pairs. Used to seed a new/empty settings record so the
# printed T&C stays identical until an admin edits them.
DEFAULT_TERMS = [
    ('All tools and equipment are delivered in good working condition.',
     'جميع الأدوات والمعدات تُسلَّم في حالة عمل جيدة.'),
    ('The customer must return the equipment in the same condition, except for normal wear and tear.',
     'يجب على العميل إعادة المعدات بنفس الحالة، باستثناء الاستهلاك الطبيعي.'),
    ('The customer is fully responsible for any damage, loss, or missing parts during the rental period.',
     'العميل مسؤول مسؤولية كاملة عن أي ضرر أو فقدان أو أجزاء مفقودة خلال فترة الإيجار.'),
    ('Any damage or loss will be charged to the customer for repair or replacement.',
     'سيتم تحميل العميل تكاليف إصلاح أو استبدال أي ضرر أو خسارة.'),
    ('Equipment must be returned on the agreed date; late returns may incur additional rental charges.',
     'يجب إعادة المعدات في التاريخ المتفق عليه؛ التأخير قد يستوجب رسوم إيجار إضافية.'),
    ('Equipment must not be sub-rented or transferred to another party without permission.',
     'لا يجوز تأجير المعدات من الباطن أو نقلها إلى طرف آخر دون إذن.'),
    ('The supplier is not responsible for accidents or injuries caused by improper use of the equipment.',
     'المورد غير مسؤول عن الحوادث أو الإصابات الناجمة عن الاستخدام غير السليم للمعدات.'),
    ('Any dispute shall be subject to the laws of the Sultanate of Oman.',
     'يخضع أي نزاع لقوانين سلطنة عُمان.'),
]


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

    # Bilingual Terms & Conditions (shown on Checkout & Partial Return invoices)
    terms_line_ids = fields.One2many(
        'rental.invoice.terms.line', 'settings_id',
        string='Terms & Conditions')

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
        # Backfill the default Terms & Conditions for records that have none yet
        # (covers brand-new records and settings created before T&C existed), so
        # the printed terms never go blank.
        if not settings.terms_line_ids:
            self.env['rental.invoice.terms.line'].sudo().create([
                {
                    'settings_id': settings.id,
                    'sequence': (idx + 1) * 10,
                    'text_en': en,
                    'text_ar': ar,
                }
                for idx, (en, ar) in enumerate(DEFAULT_TERMS)
            ])
        return settings


class RentalInvoiceTermsLine(models.Model):
    _name = 'rental.invoice.terms.line'
    _description = 'Rental Invoice Terms & Conditions Line'
    _order = 'sequence, id'

    settings_id = fields.Many2one(
        'rental.invoice.settings', string='Invoice Settings',
        ondelete='cascade', required=True)
    sequence = fields.Integer(default=10)
    text_en = fields.Char(string='Term (English)')
    text_ar = fields.Char(string='Term (Arabic)')
