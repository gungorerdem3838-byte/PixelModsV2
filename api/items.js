import { kv } from '@vercel/kv';
import { randomUUID } from 'crypto';

const ITEMS_KEY = 'modrock-items';
const CATS = ["Mod", "Texture Pack", "Animasyon", "Hologram/Şematik", "Shader", "Data Pack", "Harita", "Eklenti"];
const PLATFORMS = ["Java", "Bedrock"];
const MAX_NAME = 80;
const MAX_DESC = 500;
const MAX_MCVER = 40;

function isValidUrl(u) {
  try { new URL(u); return true; } catch (e) { return false; }
}

async function getSessionEmail(token) {
  const t = String(token || '').trim();
  if (!t) return null;
  const email = await kv.get('session:' + t);
  return email || null;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const items = (await kv.get(ITEMS_KEY)) || [];
      res.status(200).json({ items });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const email = await getSessionEmail(body.token);
      if (!email) {
        res.status(401).json({ error: 'İçerik eklemek için giriş yapmalısın.' });
        return;
      }

      const name = String(body.name || '').trim().slice(0, MAX_NAME);
      const description = String(body.description || '').trim().slice(0, MAX_DESC);
      const category = CATS.includes(body.category) ? body.category : 'Mod';
      const platform = PLATFORMS.includes(body.platform) ? body.platform : 'Java';
      const mcVersion = platform === 'Bedrock' ? '' : String(body.mcVersion || '').trim().slice(0, MAX_MCVER);
      const versionCount = Math.max(1, parseInt(body.versionCount, 10) || 1);
      const url = String(body.url || '').trim();
      const videoUrl = body.videoUrl ? String(body.videoUrl).trim() : null;
      const icon = body.icon ? String(body.icon).trim() : null;

      if (!name || !description || !url) {
        res.status(400).json({ error: 'Zorunlu alanlar eksik.' });
        return;
      }
      if (!isValidUrl(url)) {
        res.status(400).json({ error: 'İndirme linki geçersiz bir adres.' });
        return;
      }
      if (videoUrl && !isValidUrl(videoUrl)) {
        res.status(400).json({ error: 'Kurulum videosu linki geçersiz bir adres.' });
        return;
      }
      if (icon && !isValidUrl(icon)) {
        res.status(400).json({ error: 'Simge görseli geçersiz.' });
        return;
      }

      const items = (await kv.get(ITEMS_KEY)) || [];
      const newItem = {
        id: randomUUID(),
        name, description, category, platform, mcVersion, versionCount,
        url, icon, videoUrl,
        downloads: 0,
        createdAt: Date.now(),
        ownerId: email,
      };
      items.unshift(newItem);
      await kv.set(ITEMS_KEY, items);
      res.status(200).json({ item: newItem, items });
      return;
    }

    if (req.method === 'PATCH') {
      const { id, action } = req.body || {};
      if (!id || action !== 'download') {
        res.status(400).json({ error: 'Geçersiz istek.' });
        return;
      }
      const items = (await kv.get(ITEMS_KEY)) || [];
      const idx = items.findIndex((m) => m.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'İçerik bulunamadı.' });
        return;
      }
      items[idx].downloads = (items[idx].downloads || 0) + 1;
      await kv.set(ITEMS_KEY, items);
      res.status(200).json({ items });
      return;
    }

    if (req.method === 'DELETE') {
      const { id, token } = req.body || {};
      const email = await getSessionEmail(token);
      if (!email) {
        res.status(401).json({ error: 'Bu işlem için giriş yapmalısın.' });
        return;
      }
      if (!id) {
        res.status(400).json({ error: 'Geçersiz istek.' });
        return;
      }
      const items = (await kv.get(ITEMS_KEY)) || [];
      const target = items.find((m) => m.id === id);
      if (!target) {
        res.status(404).json({ error: 'İçerik bulunamadı.' });
        return;
      }
      // Sahiplik kontrolü artık hesap e-postasına dayanır (gerçek kimlik doğrulama).
      if (!target.ownerId || target.ownerId !== email) {
        res.status(403).json({ error: 'Bu içeriği kaldırma yetkin yok.' });
        return;
      }
      const filtered = items.filter((m) => m.id !== id);
      await kv.set(ITEMS_KEY, filtered);
      res.status(200).json({ items: filtered });
      return;
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + (err && err.message ? err.message : 'bilinmeyen hata') });
  }
}
