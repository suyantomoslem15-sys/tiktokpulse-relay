import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-secret');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const allowed = new Set([
  'product_id','name','price','original_price','currency','seller_id','seller_name','seller_rating','product_url','image_url','description','category','tags','sales_count','rating','review_count','in_stock','scraped_at','external_product_id','original_image_url','canonical_product_url','release_date','avg_sales_per_hour','avg_sales_per_day','competitors','viral_score','spike_percentage','video_id','seller_address','seller_total_products','seller_total_sales','seller_review_count','seller_status','seller_location','seller_joined_date','historical_sales','growth_rate','peak_sales_time','video_views','video_likes','video_shares','video_comments','conversion_rate','confidence','slug','subcategory','emerging_score','engagement_ratio','first_seen_at','last_scraped_at','last_updated_at','velocity_sales','velocity_comments','acceleration','maturity_penalty','recency_weight','price_text','gallery_urls','tiktok_shop_url','current_sales','current_comments','current_likes'
]);

function filterRow(obj) {
  const out = {};
  for (const k in obj) {
    if (allowed.has(k)) out[k] = obj[k];
  }
  if (out.product_id == null && obj.id) out.product_id = String(obj.id);
  if (!out.last_updated_at) out.last_updated_at = new Date().toISOString();
  return out;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' }); return; }
  try {
    const body = await readJson(req);
    const items = Array.isArray(body) ? body : (body && body.items && Array.isArray(body.items) ? body.items : [body]);
    const rows = items.map(filterRow).filter(r => r.product_id);
    if (rows.length === 0) { res.status(400).json({ success: false, error: 'EMPTY' }); return; }
    const { data, error } = await supabase.from('shop_products').upsert(rows, { onConflict: 'product_id' }).select('product_id');
    if (error) { res.status(500).json({ success: false, error: error.message }); return; }
    res.status(200).json({ success: true, count: data ? data.length : 0 });
  } catch (e) {
    res.status(500).json({ success: false, error: String(e) });
  }
}
