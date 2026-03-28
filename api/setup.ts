import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/setup?url=https://your-domain.vercel.app/api/telegram
 * 
 * Registers the Telegram webhook so Telegram sends updates to your Vercel function.
 * Call this ONCE after deploying.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });
  }
  
  // Get webhook URL from query param or construct from host
  const webhookUrl = req.query.url as string || `https://${req.headers.host}/api/telegram`;
  
  try {
    // Set webhook
    const setResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message'],
          drop_pending_updates: true,
        }),
      }
    );
    const setResult = await setResponse.json();
    
    // Get webhook info to verify
    const infoResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`
    );
    const infoResult = await infoResponse.json();
    
    return res.status(200).json({
      message: 'Webhook setup complete',
      setWebhook: setResult,
      webhookInfo: infoResult,
      webhookUrl,
    });
  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({ error: 'Failed to set webhook', details: String(error) });
  }
}
