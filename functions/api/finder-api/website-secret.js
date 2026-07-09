// functions/api/finder-api/website-secret.js
// ============================================================
//  Website URL Extractor API
//  Scrapes a given URL for emails and phone numbers,
//  with cache support using KV, anti-bot headers, and depth.
// ============================================================

import { KVMANAGER } from '../../helpers/kv-manager.js';

/**
 * POST handler for website scraping.
 * Expects JSON: { url, limit, depth, force, includeSubdomains }
 */
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

  // Validate and sanitize URL
  url = validateUrl(url);
  if (!url) {
    return jsonResponse({ success: false, error: 'Invalid URL' }, 400, corsHeaders);
  }

  // Initialize KV
  const kv = new KVMANAGER(env.SECRETS_KV || null);
  const cacheKey = `cache:website:${url}:depth${depth}:limit${limit}`;

  // Check cache
  if (!force) {
    const cached = await kv.getJSON(cacheKey);
    if (cached && cached.emails && cached.phones) {
      return jsonResponse({
        success: true,
        emails: cached.emails.slice(0, limit),
        phones: cached.phones.slice(0, limit),
        cached: true,
        scrapedAt: cached.scrapedAt || new Date().toISOString(),
      }, 200, corsHeaders);
    }
  }

  // ========== Scraping Logic ==========
  let allEmails = [];
  let allPhones = [];
  const visited = new Set();

  async function scrapePage(pageUrl, currentDepth) {
    if (currentDepth > depth) return;
    if (visited.has(pageUrl)) return;
    visited.add(pageUrl);

    try {
      const html = await fetchWithRetry(pageUrl);
      // Extract emails
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = (html.match(emailRegex) || []).map(e => e.toLowerCase());
      // Extract phones (international format)
      const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
      const rawPhones = html.match(phoneRegex) || [];
      const phones = rawPhones.map(p => p.trim().replace(/[^\d+]/g, '')).filter(p => p.length >= 10);

      allEmails.push(...emails);
      allPhones.push(...phones);

      // If depth > 1, extract links and follow them
      if (depth > 1 && currentDepth < depth) {
        const linkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
        let match;
        const baseUrl = new URL(pageUrl);
        while ((match = linkRegex.exec(html)) !== null) {
          let href = match[1];
          try {
            const absolute = new URL(href, baseUrl).href;
            // Only follow if same domain (or subdomain if allowed)
            if (includeSubdomains) {
              // Allow any subdomain of the main domain
              const mainHost = baseUrl.hostname.replace(/^www\./, '');
              if (new URL(absolute).hostname.endsWith(mainHost)) {
                await scrapePage(absolute, currentDepth + 1);
              }
            } else {
              if (new URL(absolute).hostname === baseUrl.hostname) {
                await scrapePage(absolute, currentDepth + 1);
              }
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }
    } catch (err) {
      console.error(`Failed to scrape ${pageUrl}:`, err.message);
    }
  }

  // Start scraping from the initial URL
  await scrapePage(url, 1);

  // Remove duplicates and limit
  allEmails = [...new Set(allEmails)].slice(0, limit);
  allPhones = [...new Set(allPhones)].slice(0, limit);

  // Store in cache (expire after 24 hours)
  await kv.putJSON(cacheKey, {
    emails: allEmails,
    phones: allPhones,
    scrapedAt: new Date().toISOString(),
  }, { expirationTtl: 86400 });

  // Log audit
  // const auditLogger = new AuditLogger(kv);
  // await auditLogger.log('SCRAPE_WEBSITE', { username: payload.username, url, emailCount: allEmails.length, phoneCount: allPhones.length });

  return jsonResponse({
    success: true,
    emails: allEmails,
    phones: allPhones,
    cached: false,
    scrapedAt: new Date().toISOString(),
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 403) throw new Error('Access Denied (403) – site may be blocking scrapers.');
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
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}
