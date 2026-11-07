// Vercel serverless function: admin panel → n8n / Meta.
//
// Security (7 Doors audit 2026-11-07):
//  - Door 5/6: every call needs a valid Supabase session (Authorization:
//    Bearer <access_token>) from an email listed in ADMIN_EMAILS.
//    Fails closed when ADMIN_EMAILS or the Supabase env vars are missing.
//  - Door 4: the member is read from the database WITH THE CALLER'S TOKEN,
//    so RLS (sol_groups.created_by = auth.uid()) proves ownership. The phone
//    number, name and group come from the DB, never from the request body.
//  - Door 7: only admin events are relayed. Payment confirmations and inbound
//    WhatsApp messages must go straight to n8n with their own signature
//    check, never through this proxy. Calls to n8n carry the shared secret
//    N8N_WEBHOOK_SECRET in the X-AcPay-Webhook-Secret header (match it with
//    a Header Auth credential on each n8n Webhook node).

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Per-instance limiter: a second line of defence only (serverless instances
// do not share memory). The real gate is the admin allowlist above.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 60;
const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function getCaller(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const user = await r.json();
  return user?.id ? { id: user.id, email: (user.email || '').toLowerCase(), token } : null;
}

// Reads the member as the caller. RLS returns nothing for a member whose
// group the caller does not own, so a foreign member_id gives 404.
async function getOwnedMember(memberId, token) {
  if (!/^[0-9a-f-]{36}$/i.test(String(memberId || ''))) return null;
  const select =
    'id,full_name,phone_number,preferred_language,p2p_platform,p2p_handle,rotation_position,' +
    'group:sol_groups(id,name,contribution_amount,frequency,total_cycles,created_by)';
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/sol_members?id=eq.${memberId}&select=${encodeURIComponent(select)}`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

// ─── Meta direct-send (bypasses n8n for template messages) ───────────────────
async function sendMetaTemplate({ phone_number, template_name, language_code, components }) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) return { ok: false, error: 'Meta credentials not configured' };

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone_number,
        type: 'template',
        template: { name: template_name, language: { code: language_code }, components: components || [] },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Meta API error:', data?.error?.code, data?.error?.message);
      return { ok: false, error: 'Meta API failed', status: response.status };
    }
    return { ok: true };
  } catch (err) {
    console.error('Meta direct call error:', err?.message);
    return { ok: false, error: 'Meta call failed' };
  }
}

// Only events the admin panel itself triggers. Payment confirmations and
// inbound WhatsApp traffic are intentionally NOT relayed here.
const WEBHOOK_MAP = {
  'member-added': 'sol2-onboarding',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Fail closed when the server is not configured.
  const allow = adminEmails();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || allow.length === 0) {
    return res.status(503).json({ error: 'Server not configured' });
  }

  const caller = await getCaller(req).catch(() => null);
  if (!caller) return res.status(401).json({ error: 'Authentication required' });
  if (!allow.includes(caller.email)) return res.status(403).json({ error: 'Not an AcPay admin' });
  if (rateLimited(caller.id)) return res.status(429).json({ error: 'Too many requests' });

  const { event, payload } = req.body || {};
  if (event !== 'send-welcome' && !WEBHOOK_MAP[event]) {
    return res.status(400).json({ error: 'Unknown event' });
  }

  const member = await getOwnedMember(payload?.member_id, caller.token).catch(() => null);
  if (!member || !member.group || member.group.created_by !== caller.id) {
    return res.status(404).json({ error: 'Member not found' });
  }
  const group = member.group;
  const lang = ['ht', 'fr', 'en'].includes(member.preferred_language) ? member.preferred_language : 'en';

  if (event === 'send-welcome') {
    const result = await sendMetaTemplate({
      phone_number: member.phone_number,
      template_name: 'welcome_member',
      language_code: lang,
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: member.full_name || 'Member' },
          { type: 'text', text: group.name || 'AcPay' },
          { type: 'text', text: String(group.contribution_amount || 0) },
        ],
      }],
    });
    return res.status(result.ok ? 200 : 502).json(result.ok ? { ok: true } : { ok: false, error: result.error });
  }

  const baseUrl = process.env.N8N_BASE_URL;
  if (!baseUrl) return res.status(500).json({ error: 'N8N_BASE_URL not configured' });

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.N8N_WEBHOOK_SECRET) headers['X-AcPay-Webhook-Secret'] = process.env.N8N_WEBHOOK_SECRET;

  try {
    const response = await fetch(`${baseUrl}/webhook/${WEBHOOK_MAP[event]}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        member_id: member.id,
        phone_number: member.phone_number,
        full_name: member.full_name,
        preferred_language: lang,
        p2p_platform: member.p2p_platform,
        p2p_handle: member.p2p_handle,
        rotation_position: member.rotation_position,
        group_name: group.name,
        contribution_amount: group.contribution_amount,
        frequency: group.frequency,
        total_cycles: group.total_cycles,
        terms_url: 'https://acpay.net/terms',
      }),
    });
    if (!response.ok) {
      console.error(`n8n webhook failed: ${response.status}`);
      return res.status(502).json({ error: 'Upstream webhook failed' });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Proxy error:', err?.message);
    return res.status(500).json({ error: 'Internal proxy error' });
  }
}
