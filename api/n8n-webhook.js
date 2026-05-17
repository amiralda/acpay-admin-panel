// Vercel serverless function: proxies admin panel calls to n8n webhooks
// Removes CORS issues by making the call server-to-server.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event, payload } = req.body;

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
