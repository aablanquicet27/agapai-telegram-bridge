import { Bot, webhookCallback, Context } from 'grammy';
import { Client } from '@notionhq/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --- Config ---
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ALLOWED_TELEGRAM_USER_ID = process.env.ALLOWED_TELEGRAM_USER_ID;
const NOTION_API_KEY = process.env.NOTION_API_KEY!;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID!;
const NOTION_DISCUSSION_ID = process.env.NOTION_DISCUSSION_ID!;

// --- Clients ---
const bot = new Bot(TELEGRAM_BOT_TOKEN);
const notion = new Client({ auth: NOTION_API_KEY });

// --- Helpers ---

/**
 * Get the latest comment count so we know when Alanna replies
 */
async function getLatestComments(): Promise<any[]> {
  const response = await notion.comments.list({
    block_id: NOTION_PAGE_ID,
    page_size: 100,
  });
  return response.results;
}

/**
 * Create a comment in the Notion discussion mentioning Alanna
 */
async function sendToAlanna(message: string): Promise<string> {
  const timestamp = new Date().toISOString();
  
  await notion.comments.create({
    discussion_id: NOTION_DISCUSSION_ID,
    rich_text: [
      {
        type: 'text',
        text: { content: `[Telegram] ${message}` },
      },
    ],
  } as any);
  
  return timestamp;
}

/**
 * Poll for Alanna's reply after our comment
 */
async function waitForAlannaReply(
  commentCountBefore: number,
  maxWait = 45000
): Promise<string | null> {
  const start = Date.now();
  const pollInterval = 3000; // 3 seconds between polls
  
  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    
    try {
      const comments = await getLatestComments();
      
      // Look for new comments from a bot (not a user)
      if (comments.length > commentCountBefore) {
        const newComments = comments.slice(commentCountBefore);
        const botReply = newComments.find(
          (c: any) => c.created_by?.type === 'bot' || !c.created_by?.person
        );
        
        if (botReply) {
          const text = (botReply as any).rich_text
            ?.map((rt: any) => rt.plain_text)
            .join('');
          return text || '(respuesta vacía)';
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }
  
  return null;
}

// --- Security middleware ---
bot.use(async (ctx: Context, next) => {
  if (ALLOWED_TELEGRAM_USER_ID) {
    const userId = ctx.from?.id?.toString();
    if (userId !== ALLOWED_TELEGRAM_USER_ID) {
      await ctx.reply('⛔ No tienes permiso para usar este bot.');
      return;
    }
  }
  await next();
});

// --- Commands ---
bot.command('start', async (ctx) => {
  await ctx.reply(
    '🦞 ¡Hola! Soy el puente a Alanna (Notion Agent).\n\n' +
    'Escríbeme cualquier mensaje y se lo paso a Alanna vía Notion. ' +
    'Ella responde y te traigo su respuesta aquí.\n\n' +
    'Comandos:\n' +
    '/start - Este mensaje\n' +
    '/ping - Verificar que el bot está activo'
  );
});

bot.command('ping', async (ctx) => {
  await ctx.reply('🏓 ¡Pong! El bot está activo y conectado.');
});

// --- Main message handler ---
bot.on('message:text', async (ctx) => {
  const userMessage = ctx.message.text;
  
  // Send typing indicator
  await ctx.replyWithChatAction('typing');
  
  try {
    // Get current comment count
    const commentsBefore = await getLatestComments();
    const countBefore = commentsBefore.length;
    
    // Send message to Notion
    await sendToAlanna(userMessage);
    
    // Notify user we're waiting
    const waitMsg = await ctx.reply('⏳ Enviado a Alanna, esperando respuesta...');
    
    // Poll for Alanna's reply
    const reply = await waitForAlannaReply(countBefore);
    
    // Delete the waiting message
    try {
      await ctx.api.deleteMessage(ctx.chat.id, waitMsg.message_id);
    } catch (e) {
      // Ignore if can't delete
    }
    
    if (reply) {
      // Trim long responses for Telegram (max 4096 chars)
      const trimmedReply = reply.length > 4000
        ? reply.substring(0, 4000) + '\n\n... (respuesta truncada)'
        : reply;
      await ctx.reply(`🦞 ${trimmedReply}`);
    } else {
      await ctx.reply(
        '⏰ Alanna no respondió a tiempo (45s). ' +
        'Puede que esté procesando algo pesado. Intenta de nuevo.'
      );
    }
  } catch (error) {
    console.error('Error:', error);
    await ctx.reply(
      '❌ Error al comunicarme con Notion. Verifica que las variables de entorno estén bien configuradas.'
    );
  }
});

// --- Vercel handler ---
const handler = webhookCallback(bot, 'std/http');

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    // Convert Vercel req/res to standard Request/Response
    const url = `https://${req.headers.host}${req.url}`;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as any,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    
    const response = await handler(request);
    
    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    const body = await response.text();
    res.send(body);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(200).json({ ok: true });
  }
}
