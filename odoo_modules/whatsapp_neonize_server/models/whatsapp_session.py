import os
import threading
import logging
import base64
import io
import time
import subprocess
import sys
import psycopg2.errors

from odoo import models, fields, api, _, SUPERUSER_ID
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


def _safe_db_write(pool, session_id, values, max_retries=3):
    """Write to session record with automatic retry on serialization failure."""
    retry_count = 0
    while retry_count < max_retries:
        try:
            with pool.cursor() as cr:
                env = api.Environment(cr, SUPERUSER_ID, {})
                env['whatsapp.session'].browse(session_id).write(values)
            return True
        except psycopg2.errors.SerializationFailure as e:
            retry_count += 1
            if retry_count < max_retries:
                wait_ms = 50 * (2 ** (retry_count - 1))
                _logger.warning(
                    "DB Serialization conflict (retry %d/%d), waiting %dms",
                    retry_count, max_retries, wait_ms,
                )
                time.sleep(wait_ms / 1000.0)
            else:
                _logger.error("DB write failed after %d retries: %s", max_retries, e)
                raise
    return False


# ============================================================
# Global state — survives across requests within same worker
# ============================================================
_wa_clients = {}       # session_id -> neonize NewClient (legacy)
_wa_qr_data = {}       # session_id -> raw QR string
_wa_qr_image = {}      # session_id -> base64 PNG
_wa_status = {}        # session_id -> status string
_wa_threads = {}       # session_id -> subprocess.Popen (renamed meaning)
_wa_locks = {}         # session_id -> threading.Lock


def _ensure_session_dir():
    """Create session storage directory."""
    env_path = os.environ.get('ODOO_WA_SESSION_DIR')
    if env_path:
        os.makedirs(env_path, exist_ok=True)
        return env_path

    standard_path = '/var/lib/odoo/whatsapp_sessions'
    try:
        os.makedirs(standard_path, exist_ok=True)
        test_file = os.path.join(standard_path, '.write_test')
        with open(test_file, 'w') as f:
            f.write('ok')
        os.remove(test_file)
        return standard_path
    except (PermissionError, OSError):
        pass

    module_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(module_dir, 'sessions')
    try:
        os.makedirs(path, exist_ok=True)
        return path
    except (PermissionError, OSError):
        pass

    tmp_path = '/tmp/odoo_whatsapp_sessions'
    os.makedirs(tmp_path, exist_ok=True)
    _logger.warning(
        "WhatsApp sessions stored in /tmp — they will not survive a reboot. "
        "Set ODOO_WA_SESSION_DIR env variable to a persistent writable path."
    )
    return tmp_path


class WhatsAppSession(models.Model):
    _name = 'whatsapp.session'
    _description = 'WhatsApp Session'
    _rec_name = 'name'

    name = fields.Char(
        'Session Name', required=True, default='Default',
        help='A friendly name for this WhatsApp session',
    )
    status = fields.Selection([
        ('disconnected', 'Disconnected'),
        ('waiting_qr', 'Scan QR Code'),
        ('connected', 'Connected'),
        ('error', 'Error'),
    ], string='Status', default='disconnected', readonly=True)
    phone_number = fields.Char('Connected Phone', readonly=True)
    qr_image = fields.Binary('QR Code', readonly=True, attachment=False)
    qr_last_update = fields.Datetime('QR Last Updated', readonly=True)
    db_path = fields.Char('Session DB Path', readonly=True)
    active = fields.Boolean(default=True)
    auto_reconnect = fields.Boolean(
        'Auto Reconnect', default=False,
        help='Automatically reconnect when Odoo restarts (disabled by default)',
    )
    message_ids = fields.One2many(
        'whatsapp.message', 'session_id', string='Messages',
    )
    company_id = fields.Many2one(
        'res.company', string='Company',
        default=lambda self: self.env.company,
    )
    message_count = fields.Integer(
        compute='_compute_message_count', string='Messages',
    )
    error_message = fields.Text('Last Error', readonly=True)

    # ----------------------------------------------------------
    # Computed
    # ----------------------------------------------------------
    def _compute_message_count(self):
        for rec in self:
            rec.message_count = self.env['whatsapp.message'].search_count([
                ('session_id', '=', rec.id)
            ])

    # ----------------------------------------------------------
    # Actions
    # ----------------------------------------------------------
    def action_connect(self):
        """
        Start WhatsApp connection by spawning the standalone wa_qr_worker.py
        as a subprocess. Returns IMMEDIATELY without polling. The JS polling
        (or user clicking Refresh Status) picks up the QR when the worker
        writes it to disk.
        """
        self.ensure_one()

        session_id = self.id
        db_name = self.env.cr.dbname
        session_dir = _ensure_session_dir()
        db_path = os.path.join(session_dir, f"{db_name}_session_{session_id}.db")

        module_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        # Use Selenium-based worker (bypasses neonize entirely)
        worker_script = os.path.join(module_dir, 'bin', 'wa_selenium_worker.py')

        if not os.path.exists(worker_script):
            raise UserError(_(
                "wa_selenium_worker.py not found at: %s"
            ) % worker_script)

        _logger.info(
            "WhatsApp subprocess connect: session=%s, db_path=%s",
            session_id, db_path,
        )

        self._stop_client()

        pool = self.pool

        # Clean stale marker files
        for suffix in ('.qr.png', '.qr.ready', '.connected', '.error'):
            stale = db_path + suffix
            if os.path.exists(stale):
                try:
                    os.remove(stale)
                except Exception as e:
                    _logger.warning("Could not remove stale %s: %s", stale, e)

        # Reset DB state on the current record (in current tx)
        self.write({
            'db_path': db_path,
            'status': 'waiting_qr',
            'error_message': False,
            'qr_image': False,
        })
        _wa_status[session_id] = 'waiting_qr'

        # Spawn subprocess WITHOUT blocking
        try:
            python_exe = sys.executable or 'python'
            log_path = db_path + '.worker.log'
            log_fp = open(log_path, 'ab')
            proc = subprocess.Popen(
                [python_exe, worker_script, db_path],
                stdout=log_fp,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                close_fds=True,
            )
            _wa_threads[session_id] = proc
            _logger.info(
                "Spawned wa_qr_worker.py PID=%s session=%s log=%s",
                proc.pid, session_id, log_path,
            )
        except Exception as e:
            _logger.error("Failed to spawn wa_qr_worker.py: %s", e, exc_info=True)
            self.write({
                'status': 'error',
                'error_message': f"Failed to start QR worker: {e}",
            })
            raise UserError(_("Failed to start QR worker subprocess: %s") % str(e))

        # Poll for up to 45 seconds for the QR file to appear.
        # Chrome takes 10-25s to launch on first run (downloads chromedriver,
        # creates profile, loads WhatsApp Web). 45s gives plenty of margin.
        qr_ready_path = db_path + '.qr.ready'
        qr_png_path = db_path + '.qr.png'
        error_path = db_path + '.error'

        poll_start = time.time()
        while time.time() - poll_start < 45:
            # Subprocess died?
            if proc.poll() is not None:
                _logger.warning(
                    "wa_qr_worker.py exited early (code=%s) for session %s",
                    proc.returncode, session_id,
                )
                break

            if os.path.exists(error_path):
                try:
                    with open(error_path, 'r') as f:
                        err_msg = f.read()[:500]
                    _logger.error("Worker error for session %s: %s", session_id, err_msg)
                    self.write({
                        'status': 'error',
                        'error_message': err_msg,
                    })
                    self.env.cr.commit()
                    raise UserError(_(
                        "QR worker error:\n\n%s\n\n"
                        "Check the log: %s"
                    ) % (err_msg, log_path))
                except UserError:
                    raise
                except Exception:
                    pass

            if os.path.exists(qr_ready_path) and os.path.exists(qr_png_path):
                # QR is ready — load it and reload the form
                try:
                    with open(qr_png_path, 'rb') as f:
                        png_bytes = f.read()
                    qr_b64 = base64.b64encode(png_bytes).decode('utf-8')
                    _wa_qr_image[session_id] = qr_b64

                    self.write({
                        'qr_image': qr_b64,
                        'status': 'waiting_qr',
                        'qr_last_update': fields.Datetime.now(),
                    })
                    self.env.cr.commit()

                    _logger.info(
                        "QR loaded for session %s (%d bytes PNG) — reloading form",
                        session_id, len(png_bytes),
                    )
                    return {
                        'type': 'ir.actions.client',
                        'tag': 'reload',
                    }
                except Exception as e:
                    _logger.error("Failed to load QR PNG: %s", e, exc_info=True)
                    break

            time.sleep(0.5)

        # Timeout — tell the user to check the worker log
        _logger.warning(
            "QR not ready after 20s for session %s. Check worker log: %s",
            session_id, log_path,
        )
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('QR still generating...'),
                'message': _(
                    'Worker is running but no QR yet. '
                    'Click "Refresh Status" in a few seconds. '
                    'If it still fails, check the worker log at: %s'
                ) % log_path,
                'type': 'warning',
                'sticky': True,
            },
        }

    def action_disconnect(self):
        """Disconnect the WhatsApp session."""
        self.ensure_one()
        self._stop_client()
        self.write({
            'status': 'disconnected',
            'qr_image': False,
            'error_message': False,
        })

    def action_refresh_status(self):
        """
        Refresh status by checking the worker's marker files on disk.
        This is what actually loads the QR into the record.
        """
        self.ensure_one()
        sid = self.id
        vals = {}

        if self.db_path:
            connected_marker = self.db_path + '.connected'
            qr_png = self.db_path + '.qr.png'
            qr_ready = self.db_path + '.qr.ready'
            error_file = self.db_path + '.error'

            if os.path.exists(connected_marker):
                vals['status'] = 'connected'
                vals['qr_image'] = False
                _wa_status[sid] = 'connected'
                _logger.info("Session %s is connected (marker found)", sid)
            elif os.path.exists(error_file):
                try:
                    with open(error_file, 'r') as f:
                        err = f.read()
                    vals['status'] = 'error'
                    vals['error_message'] = err[:500]
                    _wa_status[sid] = 'error'
                    _logger.warning("Session %s error: %s", sid, err[:200])
                except Exception:
                    pass
            elif os.path.exists(qr_ready) and os.path.exists(qr_png):
                try:
                    with open(qr_png, 'rb') as f:
                        qr_b64 = base64.b64encode(f.read()).decode('utf-8')
                    vals['status'] = 'waiting_qr'
                    vals['qr_image'] = qr_b64
                    vals['qr_last_update'] = fields.Datetime.now()
                    _wa_qr_image[sid] = qr_b64
                    _wa_status[sid] = 'waiting_qr'
                    _logger.info(
                        "Loaded QR PNG for session %s (%d b64 chars)",
                        sid, len(qr_b64),
                    )
                except Exception as e:
                    _logger.error("Failed to read QR PNG: %s", e)

        if not vals:
            mem_status = _wa_status.get(sid, self.status or 'disconnected')
            vals['status'] = mem_status

        self.write(vals)
        self.env.cr.commit()
        return {
            'type': 'ir.actions.client',
            'tag': 'reload',
        }

    def action_view_messages(self):
        """Open message list for this session."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('WhatsApp Messages'),
            'res_model': 'whatsapp.message',
            'view_mode': 'list,form',
            'domain': [('session_id', '=', self.id)],
            'context': {'default_session_id': self.id},
        }

    def action_send_message_wizard(self):
        """Open Send Message wizard for this session."""
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Send WhatsApp Message'),
            'res_model': 'whatsapp.send.message.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {'default_session_id': self.id},
        }

    # ----------------------------------------------------------
    # Send Methods
    # ----------------------------------------------------------
    def _get_connected_client(self):
        """Return the neonize client or raise."""
        self.ensure_one()
        client = _wa_clients.get(self.id)
        if not client or _wa_status.get(self.id) != 'connected':
            raise UserError(_(
                "WhatsApp is not connected for session '%(name)s'.\n"
                "Please scan the QR code first.",
                name=self.name,
            ))
        return client

    @staticmethod
    def _clean_phone(phone):
        """Remove formatting from phone number."""
        if not phone:
            return ''
        for ch in ('+', ' ', '-', '(', ')'):
            phone = phone.replace(ch, '')
        return phone

    def send_message(self, phone, message):
        """Send a text message via WhatsApp."""
        self.ensure_one()
        client = self._get_connected_client()
        from neonize.utils import build_jid

        phone_clean = self._clean_phone(phone)
        if not phone_clean:
            raise UserError(_("No phone number provided."))

        jid = build_jid(phone_clean)

        try:
            client.send_message(jid, message)
            self.env['whatsapp.message'].sudo().create({
                'session_id': self.id,
                'phone': phone_clean,
                'message': message,
                'direction': 'outgoing',
                'status': 'sent',
            })
            _logger.info("WhatsApp message sent to %s", phone_clean)
            return True
        except Exception as e:
            _logger.error("Send message error: %s", e)
            self.env['whatsapp.message'].sudo().create({
                'session_id': self.id,
                'phone': phone_clean,
                'message': message,
                'direction': 'outgoing',
                'status': 'failed',
            })
            raise UserError(_("Failed to send message: %s") % str(e))

    def send_image(self, phone, image_data, caption=''):
        """Send an image via WhatsApp."""
        self.ensure_one()
        client = self._get_connected_client()
        from neonize.utils import build_jid

        phone_clean = self._clean_phone(phone)
        jid = build_jid(phone_clean)

        try:
            if isinstance(image_data, str):
                image_data = base64.b64decode(image_data)

            img_msg = client.build_image_message(image_data, caption=caption)
            client.send_message(jid, message=img_msg)

            self.env['whatsapp.message'].sudo().create({
                'session_id': self.id,
                'phone': phone_clean,
                'message': f"Image: {caption}" if caption else "Image",
                'direction': 'outgoing',
                'status': 'sent',
            })
            return True
        except Exception as e:
            raise UserError(_("Failed to send image: %s") % str(e))

    def send_document(self, phone, file_data, filename,
                      caption='', mimetype='application/pdf'):
        """Send a document via WhatsApp."""
        self.ensure_one()
        client = self._get_connected_client()
        from neonize.utils import build_jid

        phone_clean = self._clean_phone(phone)
        jid = build_jid(phone_clean)

        try:
            if isinstance(file_data, str):
                file_data = base64.b64decode(file_data)

            doc_msg = client.build_document_message(
                file_data,
                caption=caption,
                filename=filename,
                mimetype=mimetype,
            )
            client.send_message(jid, message=doc_msg)

            self.env['whatsapp.message'].sudo().create({
                'session_id': self.id,
                'phone': phone_clean,
                'message': f"{filename}" + (
                    f" - {caption}" if caption else ""
                ),
                'direction': 'outgoing',
                'status': 'sent',
            })
            return True
        except Exception as e:
            raise UserError(_("Failed to send document: %s") % str(e))

    def send_odoo_report(self, phone, report_xmlid, record, caption=''):
        """Generate an Odoo QWeb PDF report and send via WhatsApp."""
        self.ensure_one()
        try:
            pdf_content, content_type = self.env[
                'ir.actions.report'
            ]._render_qweb_pdf(report_xmlid, record.ids)
        except Exception as e:
            raise UserError(_("Failed to generate report: %s") % str(e))

        filename = f"{record.display_name or 'document'}.pdf"
        return self.send_document(phone, pdf_content, filename, caption)

    # ----------------------------------------------------------
    # Private Helpers
    # ----------------------------------------------------------
    def _stop_client(self):
        """Stop the running QR worker subprocess and clean up state."""
        sid = self.id

        if sid in _wa_clients:
            try:
                _wa_clients[sid].disconnect()
            except Exception:
                pass
            _wa_clients.pop(sid, None)

        proc = _wa_threads.get(sid)
        if proc is not None and hasattr(proc, 'terminate'):
            try:
                if proc.poll() is None:
                    proc.terminate()
                    try:
                        proc.wait(timeout=3)
                    except Exception:
                        proc.kill()
                    _logger.info("Terminated QR worker subprocess for session %s", sid)
            except Exception as e:
                _logger.warning("Error terminating QR worker for session %s: %s", sid, e)

        _wa_status.pop(sid, None)
        _wa_qr_data.pop(sid, None)
        _wa_qr_image.pop(sid, None)
        _wa_threads.pop(sid, None)
        _wa_locks.pop(sid, None)

    # ----------------------------------------------------------
    # Cron: Auto-reconnect — DISABLED to prevent hangs
    # ----------------------------------------------------------
    @api.model
    def _cron_auto_reconnect(self):
        """
        Auto-reconnect is disabled. The previous implementation called
        action_connect() from cron, which spawned subprocesses and hung
        the cron thread. Users must manually click Connect WhatsApp.
        """
        _logger.debug("Auto-reconnect cron is disabled (no-op)")
        return True

    @api.model
    def _cron_health_check(self):
        """Periodic health check — sync marker files to DB status."""
        sessions = self.search([('active', '=', True), ('db_path', '!=', False)])
        for session in sessions:
            try:
                if session.db_path and os.path.exists(session.db_path + '.connected'):
                    if session.status != 'connected':
                        session.write({'status': 'connected', 'qr_image': False})
                        _wa_status[session.id] = 'connected'
            except Exception as e:
                _logger.warning("Health check error for session %s: %s", session.id, e)

    # ----------------------------------------------------------
    # Unlink
    # ----------------------------------------------------------
    def unlink(self):
        for session in self:
            session._stop_client()
        return super().unlink()

    # ----------------------------------------------------------
    # Auto-reconnect on server startup — DISABLED
    # ----------------------------------------------------------
    def _register_hook(self):
        """
        Startup auto-reconnect is disabled. Users must manually click
        Connect WhatsApp after Odoo starts.
        """
        super()._register_hook()
        _logger.info("WhatsApp startup auto-reconnect is disabled")
