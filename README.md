# 🦞 Agapai Telegram Bridge

Bot puente entre Telegram y Notion para chatear con **Alanna** (Notion Agent) desde Telegram.

## Arquitectura

```
Telegram → Vercel (webhook) → Notion API (comment con @Alanna) → Alanna responde → Notion API (polling) → Vercel → Telegram
```

## Setup

### 1. Crear bot en Telegram
1. Abre Telegram y busca `@BotFather`
2. Envía `/newbot`
3. Dale un nombre (ej: `Alanna Bridge`)
4. Dale un username (ej: `alanna_agapai_bot`)
5. Copia el **token** que te da BotFather

### 2. Crear integración en Notion
1. Ve a [developers.notion.com](https://developers.notion.com)
2. Crea una nueva integración
3. Activa las capabilities: **Read comments**, **Insert comments**, **Read content**
4. Copia el **API key**
5. Ve a tu página "Chat con Alanna" en Notion → ⋯ → Connections → Conecta tu integración

### 3. Obtener IDs de Notion
- **NOTION_PAGE_ID**: El ID de tu página (está en la URL de la página, los 32 caracteres después del último `-`)
- **NOTION_DISCUSSION_ID**: Haz un GET request a `https://api.notion.com/v1/comments?block_id=TU_PAGE_ID` con tu API key y busca el campo `discussion_id` del primer comentario

### 4. Obtener tu Telegram User ID
- Busca `@userinfobot` en Telegram y envíale cualquier mensaje
- Te responderá con tu User ID

### 5. Deploy en Vercel
1. Importa este repo en Vercel
2. Configura las variables de entorno:
   - `TELEGRAM_BOT_TOKEN` — Token de BotFather
   - `NOTION_API_KEY` — API key de tu integración
   - `NOTION_PAGE_ID` — ID de la página
   - `NOTION_DISCUSSION_ID` — ID del hilo de comentarios
   - `ALLOWED_TELEGRAM_USER_ID` — Tu Telegram User ID (seguridad)
3. Deploy!

### 6. Registrar webhook
Después del deploy, visita:
```
https://tu-dominio.vercel.app/api/setup
```
Esto registra el webhook de Telegram para que los mensajes lleguen a tu función.

### 7. ¡Probar!
Abre tu bot en Telegram y envíale un mensaje. Debería:
1. Crear un comentario en Notion con tu mensaje
2. Alanna responde automáticamente
3. El bot lee la respuesta y te la envía en Telegram

## Comandos del bot
- `/start` — Mensaje de bienvenida
- `/ping` — Verificar que el bot está activo

## Variables de entorno

| Variable | Descripción |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot de BotFather |
| `NOTION_API_KEY` | API key de tu integración de Notion |
| `NOTION_PAGE_ID` | ID de la página "Chat con Alanna" |
| `NOTION_DISCUSSION_ID` | ID del hilo de comentarios |
| `ALLOWED_TELEGRAM_USER_ID` | Tu Telegram User ID (opcional, para seguridad) |

## Consideraciones
- **Latencia**: ~5-15s entre enviar mensaje y recibir respuesta (polling cada 3s)
- **Timeout**: Vercel free tier = 10s timeout. Necesitas Pro (60s) para el polling. Alternativa: reducir `maxWait`
- **Rate limits**: Notion API = 3 req/s. El polling cada 3s está dentro del límite
