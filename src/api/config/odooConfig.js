// Odoo Connection Configuration
// Change these values to match your Odoo server

export const ODOO_CONFIG = {
  // Your PC IP on the LAN (where Odoo is running)
  HOST: "192.168.29.78",
  PORT: 8069,
  DATABASE: "testing1",
  PROTOCOL: "http",
};

export const ODOO_URL = `${ODOO_CONFIG.PROTOCOL}://${ODOO_CONFIG.HOST}:${ODOO_CONFIG.PORT}`;
export const JSONRPC_URL = `${ODOO_URL}/jsonrpc`;
export const WEB_URL = `${ODOO_URL}/web`;
