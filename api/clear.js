import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: process.env.SUPABASE_SCHEMA || 'public' } }
);
const TABLE_PRODUCTS = process.env.SUPABASE_TABLE || 'shop_products';
const TABLE_SNAPSHOTS = process.env.SUPABASE_SNAPSHOTS_TABLE || 'product_snapshots';
const TABLE_LOGS = process.env.SUPABASE_LOGS_TABLE || 'scraping_logs';

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-secret');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' }); return; }
  const token = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'] || req.headers['x-Admin-Secret'];
  if (!process.env.ADMIN_SECRET || String(token) !== String(process.env.ADMIN_SECRET)) { res.status(401).json({ success: false, error: 'UNAUTHORIZED' }); return; }
  try {
    const a = await supabase.from(TABLE_SNAPSHOTS).delete().not('id', 'is', null);
    if (a.error) { res.status(500).json({ success: false, error: a.error.message }); return; }
    const b = await supabase.from(TABLE_LOGS).delete().not('id', 'is', null);
    if (b.error) { res.status(500).json({ success: false, error: b.error.message }); return; }
    const c = await supabase.from(TABLE_PRODUCTS).delete().not('product_id', 'is', null);
    if (c.error) { res.status(500).json({ success: false, error: c.error.message }); return; }
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e) });
  }
}
