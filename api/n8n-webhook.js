// Vercel serverless function: proxies admin panel calls to n8n webhooks
// Removes CORS issues by making the call server-to-server.

// ─── Meta direct-send (bypasses n8n for template messages) ───────────────────
async function sendMetaTemplate({ phone_number, template_name, language_code, components }) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token   = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    return { ok: false, error: 'Meta credentials not configured' };
  }

  const url  = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to:                phone_number,
    type:              'template',
    template: {
      name:       template_name,
      language:   { code: language_code },
      components: components || [],
    },
  };

  try {
    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Meta API error:', data);
      return { ok: false, error: data.error?.message || 'Meta API failed', status: response.status };
    }
    return { ok: true, data };
  } catch (err) {
    console.error('Meta direct call error:', err);
    return { ok: false, error: err.message };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event, payload } = req.body;

  // Direct Meta API path — handled before webhookMap, does not touch n8n
  if (event === 'send-welcome') {
    const { phone_number, full_name, group_name, contribution_amount, preferred_language } = payload;
    const lang = ['ht', 'fr', 'en'].includes(preferred_language) ? preferred_language : 'en';

    const result = await sendMetaTemplate({
      phone_number,
      template_name: 'welcome_member',
      language_code: lang,
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: full_name          || 'Member' },
          { type: 'text', text: group_name         || 'AcPay'  },
          { type: 'text', text: String(contribution_amount || 0) },
        ],
      }],
    });

    return res.status(result.ok ? 200 : 502).json(result);
  }

  // Map event names to n8n webhook paths
  const webhookMap = {
    // Triggered when a new member is added in admin panel → starts onboarding flow
    'member-added': 'sol2-onboarding',

    // Triggered when a member confirms payment (future use)
    'payment-confirmation': 'sol2-confirmation',

    // Triggered when admin sends a message to a member (future use)
    'query': 'sol2-query',

    // Triggered to verify Meta webhook on initial setup
    'verify': 'acpay-verify',

    // Inbound WhatsApp messages from Meta (handled by Meta directly, not from admin)
    'inbound': 'acpay-inbound',
  };

  const webhookPath = webhookMap[event];
  if (!webhookPath) {
    return res.status(400).json({ error: `Unknown event: ${event}` });
  }

  const baseUrl = process.env.N8N_BASE_URL;
  if (!baseUrl) {
    return res.status(500).json({ error: 'N8N_BASE_URL not configured' });
  }

  const n8nUrl = `${baseUrl}/webhook/${webhookPath}`;

  try {
    const response = await fetch(n8nUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`n8n webhook failed: ${response.status} ${text}`);
      return res.status(502).json({ error: 'Upstream webhook failed' });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: 'Internal proxy error' });
  }
}
