// Vercel serverless function: proxies admin panel calls to n8n webhooks
// Removes CORS issues by making the call server-to-server.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { event, payload } = req.body;

  // Map event names to n8n webhook paths
  const webhookMap = {
    'member-added': 'sol2-member-added',
    // Future events can be added here:
    // 'member-updated': 'sol2-member-updated',
    // 'member-deleted': 'sol2-member-deleted',
    // 'cycle-advanced': 'sol2-cycle-advanced',
    // 'dispute-resolved': 'sol2-dispute-resolved',
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
