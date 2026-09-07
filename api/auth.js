import { kv } from '@vercel/kv';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 gün

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@gmail\.com$/.test(email);
}

function hashPassword(password, saltHex) {
  return scryptSync(password, saltHex, 64).toString('hex');
}

function safeEqualHex(aHex, bHex) {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function createSession(email) {
  const token = randomUUID();
  await kv.set('session:' + token, email, { ex: SESSION_TTL_SECONDS });
  return token;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const token = String(req.query.token || '').trim();
      if (!token) {
        res.status(400).json({ error: 'Token eksik.' });
        return;
      }
      const email = await kv.get('session:' + token);
      if (!email) {
        res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
        return;
      }
      res.status(200).json({ email });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = body.action;

      if (action === 'register') {
        const email = normalizeEmail(body.email);
        const password = String(body.password || '');

        if (!isValidEmail(email)) {
          res.status(400).json({ error: 'Yalnızca @gmail.com uzantılı bir e-posta adresiyle kayıt olabilirsin.' });
          return;
        }
        if (password.length < 6) {
          res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
          return;
        }

        const existing = await kv.get('account:' + email);
        if (existing) {
          res.status(409).json({ error: 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.' });
          return;
        }

        const salt = randomBytes(16).toString('hex');
        const hash = hashPassword(password, salt);
        await kv.set('account:' + email, { email, salt, hash, createdAt: Date.now() });

        const token = await createSession(email);
        res.status(200).json({ token, email });
        return;
      }

      if (action === 'login') {
        const email = normalizeEmail(body.email);
        const password = String(body.password || '');

        const account = await kv.get('account:' + email);
        if (!account) {
          res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
          return;
        }
        const hash = hashPassword(password, account.salt);
        if (!safeEqualHex(hash, account.hash)) {
          res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
          return;
        }

        const token = await createSession(email);
        res.status(200).json({ token, email });
        return;
      }

      if (action === 'logout') {
        const token = String(body.token || '').trim();
        if (token) await kv.del('session:' + token);
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Geçersiz istek.' });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + (err && err.message ? err.message : 'bilinmeyen hata') });
  }
}
