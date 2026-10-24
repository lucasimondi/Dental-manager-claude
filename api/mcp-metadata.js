import { connectorConfig, protectedMetadata } from '../server/connectorMcp.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  try { return res.status(200).json(protectedMetadata(connectorConfig(process.env))); }
  catch { return res.status(503).json({ error: 'Connettore non ancora configurato.' }); }
}
