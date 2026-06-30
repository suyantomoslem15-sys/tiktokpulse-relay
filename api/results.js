import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') { res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' }); return; }
  try {
    const { search = '', limit = '20', offset = '0', ids = '' } = req.query || {};
    let lim = Math.max(1, Math.min(200, parseInt(limit, 10) || 20));
    let off = Math.max(0, parseInt(offset, 10) || 0);

    let q = supabase.from('shop_products').select('*', { count: 'exact' });

    if (ids) {
      const arr = String(ids).split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length > 0) q = q.in('product_id', arr);
    } else if (search) {
      const s = `%${String(search)}%`;
      q = q.or(`name.ilike.${s},product_url.ilike.${s},canonical_product_url.ilike.${s},seller_name.ilike.${s}`);
    }

    q = q.order('last_updated_at', { ascending: false }).range(off, off + lim - 1);

    const { data, error, count } = await q;
    if (error) { res.status(500).json({ success: false, error: error.message }); return; }
    res.status(200).json({ success: true, count, items: data || [] });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e) });
  }
}
