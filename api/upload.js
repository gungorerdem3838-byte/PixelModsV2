import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB sunucu tarafı sınırı

async function getSessionEmail(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const email = await kv.get('session:' + t);
  return email || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { fileName, fileType, dataBase64, token } = req.body || {};

    const email = await getSessionEmail(token);
    if (!email) {
      res.status(401).json({ error: 'Görsel yüklemek için giriş yapmalısın.' });
      return;
    }

    if (!dataBase64 || !fileType) {
      res.status(400).json({ error: 'Dosya verisi eksik.' });
      return;
    }
    if (fileType !== 'image/png' && fileType !== 'image/jpeg') {
      res.status(400).json({ error: 'Sadece PNG veya JPEG kabul edilir.' });
      return;
    }

    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length > MAX_BYTES) {
      res.status(400).json({ error: 'Görsel çok büyük (en fazla 2MB).' });
      return;
    }

    const ext = fileType === 'image/png' ? 'png' : 'jpg';
    const safeBase = (fileName || 'icon').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'icon';
    const path = 'icons/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '-' + safeBase + '.' + ext;

    const blob = await put(path, buffer, {
      access: 'public',
      contentType: fileType,
    });

    res.status(200).json({ url: blob.url });
  } catch (err) {
    res.status(500).json({ error: 'Yükleme hatası: ' + (err && err.message ? err.message : 'bilinmeyen hata') });
  }
}
