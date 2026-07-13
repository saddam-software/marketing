// functions/api/finder-api/website-secret.js
// ============================================================
//  Website URL Extractor API (Updated for Google URL formats)
// ============================================================

import { KVMANAGER } from '../../helpers/kv-manager.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authentication
  function getAuthToken(req) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
  }

  function verifyToken(token) {
    try {
      const payload = JSON.parse(atob(token));
      if (payload.exp < Date.now()) return null;
      return payload;
    } catch { return null; }
  }

  const token = getAuthToken(request);
  if (!token) {
    return jsonResponse({ success: false, error: 'Missing authentication token' }, 401, corsHeaders);
  }
  
  const payload = verifyToken(token);
  if (!payload) {
    return jsonResponse({ success: false, error: 'Invalid or expired token' }, 401, corsHeaders);
  }

  const body = await request.json().catch(() => ({}));
  let { url, limit = 100, depth = 1, force = false, includeSubdomains = false } = body;

  if (!url) return jsonResponse({ success: false, error: 'URL required' }, 400, corsHeaders);
  url = validateUrl(url);
  if (!url) return jsonResponse({ success: false, error: 'Invalid URL' }, 400, corsHeaders);

  const kv = new KVMANAGER(env.SECRETS_KV || null);
  const cacheKey = `cache:website:${url}:depth${depth}:limit${limit}`;

  if (!force) {
    const cached = await kv.getJSON(cacheKey);
    if (cached && cached.emails && cached.phones) {
      return jsonResponse({
        success: true,
        emails: cached.emails.slice(0, limit),
        phones: cached.phones.slice(0, limit),
        cached: true,
      }, 200, corsHeaders);
    }
  }

  let allEmails = [];
  let allPhones = [];
  let errorMsg = null;
  const visited = new Set();
  
  const isGoogleSearch = url.includes('google.com/search');
  const targetDepth = isGoogleSearch ? 2 : depth; // Force depth 2 for Google

  async function scrapePage(pageUrl, currentDepth) {
    if (currentDepth > targetDepth) return;
    if (visited.has(pageUrl)) return;
    visited.add(pageUrl);

    if (allEmails.length >= limit && allPhones.length >= limit) return;

    try {
      const html = await fetchWithRetry(pageUrl);
      const isCurrentPageGoogle = pageUrl.includes('google.com');

      if (isCurrentPageGoogle) {
        // গুগলের পেজ থেকে ওয়েবসাইট লিংকগুলো বের করা
        let extractedLinks = [];
        
        // ১. গুগলের /url?q= ফরম্যাট খোঁজা
        const googleLinkRegex = /href="\/url\?q=([^"&]+)/gi;
        let match;
        while ((match = googleLinkRegex.exec(html)) !== null) {
          try {
            const decodedUrl = decodeURIComponent(match[1]);
            if (!decodedUrl.includes('google.com') && !decodedUrl.includes('youtube.com')) {
              extractedLinks.push(decodedUrl);
            }
          } catch (e) {}
        }

        // ২. সরাসরি লিংক খোঁজা (যদি থাকে)
        const directLinkRegex = /href="(https?:\/\/[^"]+)"/gi;
        while ((match = directLinkRegex.exec(html)) !== null) {
          try {
            if (!match[1].includes('google.com') && !match[1].includes('youtube.com')) {
              extractedLinks.push(match[1]);
            }
          } catch (e) {}
        }

        extractedLinks = [...new Set(extractedLinks)]; // ডুপ্লিকেট লিংক রিমুভ

        // পাওয়া লিংকগুলোতে প্রবেশ করে ইমেইল/ফোন স্ক্র্যাপ করা
        for (const link of extractedLinks) {
          if (allEmails.length >= limit && allPhones.length >= limit) break;
          await scrapePage(link, currentDepth + 1);
        }
      } else {
        // থার্ড-পার্টি ওয়েবসাইট থেকে ডেটা এক্সট্রাক্ট করা
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = (html.match(emailRegex) || []).map(e => e.toLowerCase());
        
        const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
        const rawPhones = html.match(phoneRegex) || [];
        const phones = rawPhones.map(p => p.trim().replace(/[^\d+]/g, '')).filter(p => p.length >= 10);

        allEmails.push(...emails);
        allPhones.push(...phones);
      }
    } catch (err) {
      console.error(`Failed to scrape ${pageUrl}:`, err.message);
      if (isGoogleSearch && currentDepth === 1) {
        errorMsg = "Google blocked the request. Try a direct website link instead.";
      }
    }
  }

  await scrapePage(url, 1);

  allEmails = [...new Set(allEmails)].slice(0, limit);
  allPhones = [...new Set(allPhones)].slice(0, limit);

  // যদি গুগলের ব্লকের কারণে কোনো ডেটা না পাওয়া যায়
  if (isGoogleSearch && allEmails.length === 0 && allPhones.length === 0 && errorMsg) {
     return jsonResponse({ success: false, error: errorMsg }, 403, corsHeaders);
  }

  await kv.putJSON(cacheKey, {
    emails: allEmails,
    phones: allPhones,
    scrapedAt: new Date().toISOString(),
  }, { expirationTtl: 86400 });

  return jsonResponse({
    success: true,
    emails: allEmails,
    phones: allPhones,
    cached: false,
  }, 200, corsHeaders);
}

// ========== Helpers ==========

function validateUrl(url) {
  if (typeof url !== 'string') return null;
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch { return null; }
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 403 || response.status === 429) throw new Error('Blocked by anti-bot');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
