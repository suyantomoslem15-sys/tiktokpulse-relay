import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: process.env.SUPABASE_SCHEMA || 'public' } }
);
const TABLE = process.env.SUPABASE_TABLE || 'shop_products';

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
    const d = parseInt(String((req.query && req.query.days) || '2'), 10);
    const days = Number.isFinite(d) ? Math.max(1, Math.min(365, d)) : 2;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // 1) Preview which product_ids will be deleted based on any timestamp older than cutoff
    const preview = await supabase
      .from(TABLE)
      .select('product_id', { count: 'exact' })
      .or(`last_updated_at.lt.${cutoff},scraped_at.lt.${cutoff},release_date.lt.${cutoff},last_scraped_at.lt.${cutoff}`);
    if (preview.error) { res.status(500).json({ success: false, error: preview.error.message }); return; }
    const ids = (preview.data || []).map(r => r.product_id).filter(Boolean);
    if (ids.length === 0) { res.status(200).json({ success: true, deleted: 0, days, cutoff }); return; }

    // 2) Delete in chunks to avoid payload limits
    let deleted = 0; const CHUNK = 500;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const del = await supabase.from(TABLE).delete().in('product_id', chunk);
      if (del.error) { res.status(500).json({ success: false, error: del.error.message, partial_deleted: deleted }); return; }
      deleted += chunk.length;
    }
    res.status(200).json({ success: true, deleted, days, cutoff });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e) });
  }
}
