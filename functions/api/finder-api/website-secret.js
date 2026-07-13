// functions/api/finder-api/website-secret.js
// ============================================================
//  Website URL Extractor API (Updated for Google Search)
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

  // Parse request body
  const body = await request.json().catch(() => ({}));
  let { url, limit = 100, depth = 1, force = false, includeSubdomains = false } = body;

  if (!url) {
    return jsonResponse({ success: false, error: 'URL required' }, 400, corsHeaders);
  }

  url = validateUrl(url);
  if (!url) {
    return jsonResponse({ success: false, error: 'Invalid URL' }, 400, corsHeaders);
  }

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

  // ========== Scraping Logic ==========
  let allEmails = [];
  let allPhones = [];
  const visited = new Set();
  
  // চেক করা হচ্ছে ইনপুট লিংকটি গুগলের সার্চ লিংক কি না
  const isGoogleSearch = url.includes('google.com/search');
  // গুগল লিংক হলে ডিপথ অটোমেটিকভাবে একটু বাড়িয়ে দেওয়া হচ্ছে, যাতে সে ভেতরের সাইটগুলোতে ঢুকতে পারে
  const targetDepth = isGoogleSearch ? 2 : depth;

  async function scrapePage(pageUrl, currentDepth) {
    if (currentDepth > targetDepth) return;
    if (visited.has(pageUrl)) return;
    visited.add(pageUrl);

    // লিমিট ক্রস করলে আর স্ক্র্যাপ করার দরকার নেই
    if (allEmails.length >= limit && allPhones.length >= limit) return;

    try {
      const html = await fetchWithRetry(pageUrl);
      const isCurrentPageGoogle = pageUrl.includes('google.com');

      if (isCurrentPageGoogle) {
        // যদি পেজটি গুগলের হয়, তবে ইমেইল/ফোন না খুঁজে এক্সটার্নাল লিংক খুঁজবে
        const linkRegex = /href="(https?:\/\/[^"]+)"/gi;
        let match;
        let extractedLinks = [];

        while ((match = linkRegex.exec(html)) !== null) {
          try {
            const absoluteLink = new URL(match[1]).href;
            // গুগলের নিজস্ব লিংকগুলো বাদ দিয়ে অন্যান্য ওয়েবসাইটের লিংকগুলো কালেক্ট করা হচ্ছে
            if (!absoluteLink.includes('google.com')) {
              extractedLinks.push(absoluteLink);
            }
          } catch (e) {}
        }

        // ডুপ্লিকেট লিংক রিমুভ করা
        extractedLinks = [...new Set(extractedLinks)];

        // এক্সট্রাক্ট করা লিংকগুলোতে ভিজিট করা (Depth + 1)
        for (const link of extractedLinks) {
          if (allEmails.length >= limit && allPhones.length >= limit) break;
          await scrapePage(link, currentDepth + 1);
        }
      } else {
        // পেজটি থার্ড-পার্টি ওয়েবসাইট হলে ইমেইল ও ফোন নাম্বার এক্সট্রাক্ট করবে
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = (html.match(emailRegex) || []).map(e => e.toLowerCase());
        
        const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
        const rawPhones = html.match(phoneRegex) || [];
        const phones = rawPhones.map(p => p.trim().replace(/[^\d+]/g, '')).filter(p => p.length >= 10);

        allEmails.push(...emails);
        allPhones.push(...phones);

        // সাধারণ ওয়েবসাইটের ক্ষেত্রে ডিপথ স্ক্র্যাপিং (যদি ইউজার ডিপথ > ১ সিলেক্ট করে)
        if (!isGoogleSearch && currentDepth < targetDepth) {
          const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
          let match;
          const baseUrl = new URL(pageUrl);
          while ((match = linkRegex.exec(html)) !== null) {
             let href = match[1];
             try {
                const absolute = new URL(href, baseUrl).href;
                if (includeSubdomains) {
                  const mainHost = baseUrl.hostname.replace(/^www\./, '');
                  if (new URL(absolute).hostname.endsWith(mainHost)) {
                    await scrapePage(absolute, currentDepth + 1);
                  }
                } else {
                  if (new URL(absolute).hostname === baseUrl.hostname) {
                    await scrapePage(absolute, currentDepth + 1);
                  }
                }
             } catch {}
          }
        }
      }
    } catch (err) {
      console.error(`Failed to scrape ${pageUrl}:`, err.message);
    }
  }

  // স্ক্র্যাপিং শুরু
  await scrapePage(url, 1);

  // ডুপ্লিকেট ডেটা মুছে ফেলা এবং লিমিট অনুযায়ী ডেটা রাখা
  allEmails = [...new Set(allEmails)].slice(0, limit);
  allPhones = [...new Set(allPhones)].slice(0, limit);

  // ক্যাশে সেভ করা
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
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          // Google কে বোঝানোর চেষ্টা যে এটি একটি সাধারণ ব্রাউজার
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(15000), // টাইমআউট একটু বাড়ানো হয়েছে
      });
      if (response.status === 403) throw new Error('Access Denied (403)');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // ফেইল করলে ১ সেকেন্ড পর আবার ট্রাই করবে
    }
  }
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
