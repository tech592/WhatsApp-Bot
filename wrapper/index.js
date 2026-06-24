import 'dotenv/config';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import express from 'express';
import cors from 'cors';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FIREBASE_WEBHOOK_URL = process.env.FIREBASE_WEBHOOK_URL;

if (!FIREBASE_WEBHOOK_URL) {
  console.warn('WARNING: FIREBASE_WEBHOOK_URL is not set. Incoming messages will not be forwarded.');
}

// State
let latestQR = null;
let clientReady = false;
let sock = null;

async function connectToWhatsApp() {
  // Load/create auth state from persistent disk
  const { state, saveCreds } = await useMultiFileAuthState('.wwebjs_auth');

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // We handle QR ourselves
  });

  // Save credentials whenever they update
  sock.ev.on('creds.update', saveCreds);

  // Handle connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      clientReady = false;
      console.log('[DEBUG] QR code received! Scan at: https://whatsapp-wrapper-9c6j.onrender.com/qr');
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'close') {
      clientReady = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[DEBUG] Connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`);
      
      if (shouldReconnect) {
        setTimeout(() => connectToWhatsApp(), 3000);
      } else {
        console.log('[DEBUG] Logged out. Please scan QR code again.');
      }
    } else if (connection === 'open') {
      clientReady = true;
      latestQR = null;
      console.log('✅ WhatsApp Client is READY and connected!');
    }
  });

  // Handle incoming messages and forward to Firebase
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (!FIREBASE_WEBHOOK_URL) return;
    if (type !== 'notify') return; // Only process new messages, not history sync

    for (const msg of messages) {
      try {
        // Skip messages sent by us
        if (msg.key.fromMe) continue;
        
        // Extract sender phone number
        let senderId = null;
        let groupId = null;
        if (msg.key.remoteJid?.endsWith('@g.us')) {
          senderId = msg.key.participant?.split('@')[0];
          groupId = msg.key.remoteJid;
        } else {
          senderId = msg.key.remoteJid?.split('@')[0];
        }
        if (!senderId) continue;

        // Extract message text
        const messageText = msg.message?.conversation 
          || msg.message?.extendedTextMessage?.text 
          || '';
        
        if (!messageText) continue;

        // Check if it's a reply
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
        const isReply = !!contextInfo?.quotedMessage;
        let replyToSenderId = null;
        let replyToMessageText = null;

        if (isReply) {
          replyToSenderId = contextInfo.participant?.split('@')[0] 
            || contextInfo.remoteJid?.split('@')[0];
          replyToMessageText = contextInfo.quotedMessage?.conversation 
            || contextInfo.quotedMessage?.extendedTextMessage?.text 
            || '';
        }

        const payload = {
          senderId: `+${senderId}`,
          groupId, // Will be null for direct messages
          messageText,
          timestamp: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString(),
          isReply,
          replyToSenderId: replyToSenderId ? `+${replyToSenderId}` : undefined,
          replyToMessageText
        };

        addLog(`Forwarding message from ${payload.senderId} to Firebase...`);

        const response = await fetch(FIREBASE_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        addLog(`Firebase response status: ${response.status}`);

      } catch (error) {
        addLog(`ERROR forwarding message to Firebase: ${error.message}`);
      }
    }
  });
}

// QR code web page for easy scanning
app.get('/qr', async (req, res) => {
  if (clientReady) {
    return res.send('<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:#0f0;font-family:monospace;font-size:2em">✅ WhatsApp is already connected!</body></html>');
  }
  if (!latestQR) {
    return res.send('<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;color:#ff0;font-family:monospace;font-size:1.5em"><div style="text-align:center">⏳ Waiting for QR code...<br><small>Refresh in a few seconds</small></div></body></html>');
  }
  try {
    const qrImageDataUrl = await QRCode.toDataURL(latestQR, { width: 400, margin: 2 });
    res.send(`<html><body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background:#111;color:#fff;font-family:monospace">
      <h2>📱 Scan this QR code with WhatsApp</h2>
      <img src="${qrImageDataUrl}" style="border:8px solid #fff;border-radius:12px" />
      <p style="color:#aaa;margin-top:16px">Open WhatsApp → Settings → Linked Devices → Link a Device</p>
      <script>setTimeout(()=>location.reload(), 20000)</script>
    </body></html>`);
  } catch (err) {
    res.status(500).send('Error generating QR: ' + err.message);
  }
});

// Send message API
app.post('/send', async (req, res) => {
  try {
    const { to, text } = req.body;

    if (!to || !text) {
      return res.status(400).json({ error: 'Missing "to" or "text" in payload' });
    }

    if (!sock || !clientReady) {
      return res.status(503).json({ error: 'WhatsApp client is not connected yet' });
    }

    // Convert +1234567890 to 1234567890@s.whatsapp.net
    // If 'to' already contains an @ (like a group JID @g.us), leave it as is
    const jid = to.includes('@') 
      ? to 
      : to.replace('+', '') + '@s.whatsapp.net';

    // Extract mentions from the text if any
    const mentions = [];
    const mentionRegex = /@(\d+)/g;
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1] + '@s.whatsapp.net');
    }

    await sock.sendMessage(jid, { text, mentions });
    console.log(`Message sent to ${to}`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error sending message via API:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Debug tools
const recentLogs = [];
function addLog(msg) {
  const logStr = `[${new Date().toISOString()}] ${msg}`;
  console.log(logStr);
  recentLogs.unshift(logStr);
  if (recentLogs.length > 50) recentLogs.pop();
}

// Health check
app.get('/', (req, res) => {
  res.json({ status: clientReady ? 'connected' : 'disconnected' });
});

// View internal logs remotely
app.get('/logs', (req, res) => {
  res.send('<html><body style="background:#111;color:#0f0;font-family:monospace;white-space:pre-wrap;padding:20px">' + 
    '<h3>Wrapper Internal Logs (Last 50)</h3>\n' + 
    recentLogs.join('\n') + 
    '</body></html>');
});

// Keep-alive self-ping to prevent Render from sleeping on the free tier
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://whatsapp-wrapper-9c6j.onrender.com';
setInterval(() => {
  console.log('[DEBUG] Sending keep-alive ping to prevent sleep...');
  fetch(RENDER_URL).catch(err => console.error('Keep-alive ping failed:', err.message));
}, 14 * 60 * 1000); // 14 minutes

// Start server then connect WhatsApp
app.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`);
  console.log('[DEBUG] Connecting to WhatsApp via Baileys (no Chrome needed!)...');
  connectToWhatsApp();
});
