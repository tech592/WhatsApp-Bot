require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FIREBASE_WEBHOOK_URL = process.env.FIREBASE_WEBHOOK_URL;

if (!FIREBASE_WEBHOOK_URL) {
  console.warn('WARNING: FIREBASE_WEBHOOK_URL is not set in .env. Incoming messages will not be forwarded.');
}

// 1. Initialize WhatsApp Client
// LocalAuth saves the session locally so you don't have to re-scan the QR code every time
console.log('[DEBUG] Creating WhatsApp Client...');
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-translate',
      '--disable-sync'
    ]
  }
});

// Debug: track all lifecycle events
client.on('qr', (qr) => {
  console.log('[DEBUG] QR event fired!');
  console.log('QR RECEIVED. Please scan it with your WhatsApp mobile app:');
  qrcode.generate(qr, { small: true });
});

client.on('loading_screen', (percent, message) => {
  console.log(`[DEBUG] Loading screen: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
  console.log('[DEBUG] Client authenticated successfully!');
});

client.on('auth_failure', (msg) => {
  console.error('[DEBUG] Authentication failure:', msg);
});

client.on('ready', () => {
  console.log('✅ WhatsApp Client is READY and connected!');
});

client.on('disconnected', (reason) => {
  console.log('[DEBUG] Client disconnected:', reason);
});

// 2. Intercept incoming messages and forward to Firebase
client.on('message', async (msg) => {
  if (!FIREBASE_WEBHOOK_URL) return;

  try {
    const chat = await msg.getChat();
    
    // We only process individual messages, not group messages for now
    // (Unless you want group messages, in which case you can remove this check)
    if (chat.isGroup) return;

    // whatsapp-web.js formats IDs like "1234567890@c.us"
    // We extract just the phone number string.
    const senderId = msg.from.split('@')[0];
    
    // Check if it's a reply to an existing message
    let isReply = msg.hasQuotedMsg;
    let replyToSenderId = null;
    let replyToMessageText = null;

    if (isReply) {
      const quotedMsg = await msg.getQuotedMessage();
      replyToSenderId = quotedMsg.from.split('@')[0];
      replyToMessageText = quotedMsg.body;
    }

    const payload = {
      senderId: `+${senderId}`, // Format as +1234567890
      messageText: msg.body,
      timestamp: new Date(msg.timestamp * 1000).toISOString(),
      isReply,
      replyToSenderId: replyToSenderId ? `+${replyToSenderId}` : undefined,
      replyToMessageText
    };

    console.log(`Forwarding message from ${payload.senderId} to Firebase...`);

    // Forward to Firebase Webhook
    await fetch(FIREBASE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

  } catch (error) {
    console.error('Error forwarding message to Firebase:', error.message);
  }
});

// 3. Expose Express API to send messages from Firebase
app.post('/send', async (req, res) => {
  try {
    const { to, text } = req.body;

    if (!to || !text) {
      return res.status(400).json({ error: 'Missing "to" or "text" in payload' });
    }

    // Convert standard phone number (e.g., +1234567890) to WhatsApp format (1234567890@c.us)
    const formattedNumber = to.replace('+', '') + '@c.us';

    await client.sendMessage(formattedNumber, text);
    console.log(`Message sent to ${to}`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error sending message via API:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start the Express server and the WhatsApp client
app.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`);
  console.log('[DEBUG] Initializing WhatsApp Client...');

  // Set a timeout to detect if initialization is hanging
  const initTimeout = setTimeout(() => {
    console.error('[DEBUG] ⚠️ WhatsApp Client initialization is taking too long (>60s). It may be hanging.');
    console.error('[DEBUG] This usually means Chrome cannot load WhatsApp Web properly.');
  }, 60000);

  client.initialize()
    .then(() => {
      clearTimeout(initTimeout);
      console.log('[DEBUG] client.initialize() promise resolved.');
    })
    .catch((err) => {
      clearTimeout(initTimeout);
      console.error('[DEBUG] client.initialize() FAILED:', err);
    });
});
