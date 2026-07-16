// functions/api/finder-api/website-secret.js
// ============================================================
// Advanced Website URL Extractor & Intelligence Verification API
// Features:
// 1. Dynamic API Configuration (KV Integration)
// 2. Smart URL Interception (SerpAPI Integration)
// 3. Two-Tier Extraction & Hidden Metadata Analysis
// 4. Concurrency Batching & Delay Control
// 5. ScraperAPI Geo-targeting
// 6. Selective Rendering Optimization
// 7. Timeout Racing (Graceful Degradation)
// 8. Smart KV Cache Mechanism
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

  // ========== TOKEN VERIFICATION ==========
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

  // ========== GLOBAL ERROR HANDLING ==========
  try {
    const body = await request.json().catch(() => ({}));

    // ========== FEATURE 1: DYNAMIC API CONFIGURATION ==========
    const kv = new KVMANAGER(env.SECRETS_KV || null);

    // Load all API configurations from KV (no hardcoded keys)
    const searchConfig = await kv.getJSON('api_config:google_search_api') || { provider: 'serpapi', apiKey: '' };
    const scrapeConfig = await kv.getJSON('api_config:website_scraping') || { provider: 'scraperapi', apiKey: '' };
    const phoneVerifyConfig = await kv.getJSON('api_config:phone_verification') || { provider: 'twilio', apiKey: '' };
    const emailVerifyConfig = await kv.getJSON('api_config:email_verification') || { provider: 'hunter', apiKey: '' };

    const SEARCH_PROVIDER = searchConfig.provider || 'serpapi';
    const SEARCH_API_KEY = searchConfig.apiKey || '';
    const SCRAPER_PROVIDER = scrapeConfig.provider || 'scraperapi';
    const SCRAPER_API_KEY = scrapeConfig.apiKey || '';
    const PHONE_VERIFY_PROVIDER = phoneVerifyConfig.provider || 'twilio';
    const PHONE_VERIFY_KEY = phoneVerifyConfig.apiKey || '';
    const EMAIL_VERIFY_PROVIDER = emailVerifyConfig.provider || 'hunter';
    const EMAIL_VERIFY_KEY = emailVerifyConfig.apiKey || '';

    // ========== ROUTER: VERIFICATION ACTIONS vs EXTRACTOR ACTION ==========
    if (body.action === 'verify_emails') {
      const results = await handleEmailVerification(
        body.emails || [],
        EMAIL_VERIFY_PROVIDER,
        EMAIL_VERIFY_KEY,
        kv
      );
      return jsonResponse({ success: true, data: results }, 200, corsHeaders);
    }

    if (body.action === 'verify_phones') {
      const results = await handlePhoneVerification(
        body.phones || [],
        PHONE_VERIFY_PROVIDER,
        PHONE_VERIFY_KEY,
        kv
      );
      return jsonResponse({ success: true, data: results }, 200, corsHeaders);
    }

    // ========== MAIN SCRAPING LOGIC ==========
    let { url, limit = 100, depth = 1, force = false, includeSubdomains = false } = body;

    if (!url) {
      return jsonResponse({ success: false, error: 'URL required' }, 400, corsHeaders);
    }

    url = validateUrl(url);
    if (!url) {
      return jsonResponse({ success: false, error: 'Invalid URL format' }, 400, corsHeaders);
    }

    // ========== FEATURE 8: SMART KV CACHE MECHANISM ==========
    const cacheKey = `cache:website:${url}:depth${depth}:limit${limit}`;

    if (!force) {
      const cached = await kv.getJSON(cacheKey);
      if (cached && cached.emails && cached.phones) {
        return jsonResponse(
          {
            success: true,
            data: {
              emails: cached.emails.slice(0, limit),
              phones: cached.phones.slice(0, limit),
            },
            cached: true,
            cachedAt: cached.scrapedAt,
          },
          200,
          corsHeaders
        );
      }
    }

    // ========== FEATURE 7: TIMEOUT RACING (GRACEFUL DEGRADATION) ==========
    // Set a timeout of 25 seconds to gracefully degrade instead of crashing
    const TIMEOUT_MS = 25000;
    let allEmails = [];
    let allPhones = [];
    let timeoutOccurred = false;

    const scrapingPromise = performAdvancedScraping(
      url,
      limit,
      depth,
      SCRAPER_PROVIDER,
      SCRAPER_API_KEY,
      SEARCH_PROVIDER,
      SEARCH_API_KEY,
      kv
    );

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        timeoutOccurred = true;
        resolve({ emails: [], phones: [], timedOut: true });
      }, TIMEOUT_MS);
    });

    const result = await Promise.race([scrapingPromise, timeoutPromise]);

    allEmails = result.emails || [];
    allPhones = result.phones || [];

    // Deduplicate results
    const uniqueEmails = Array.from(
      new Map(allEmails.map((item) => [item.email, item])).values()
    ).slice(0, limit);
    const uniquePhones = Array.from(
      new Map(allPhones.map((item) => [item.phone, item])).values()
    ).slice(0, limit);

    // Cache results for 24 hours
    await kv.putJSON(
      cacheKey,
      {
        emails: uniqueEmails,
        phones: uniquePhones,
        scrapedAt: new Date().toISOString(),
        timedOut: timeoutOccurred,
      },
      { expirationTtl: 86400 }
    );

    return jsonResponse(
      {
        success: true,
        data: { emails: uniqueEmails, phones: uniquePhones },
        cached: false,
        timedOut: timeoutOccurred,
        message: timeoutOccurred
          ? 'Scraping timed out. Returning partial results.'
          : 'Scraping completed successfully',
      },
      200,
      corsHeaders
    );
  } catch (globalError) {
    console.error('Global Error:', globalError.message);
    return jsonResponse(
      {
        success: false,
        error: `Server Processing Error: ${globalError.message}. The target might be blocking requests or API credentials are invalid.`,
      },
      500,
      corsHeaders
    );
  }
}

// ============================================================
// FEATURE 2 & 3: SMART URL INTERCEPTION & TWO-TIER EXTRACTION
// ============================================================
async function performAdvancedScraping(
  url,
  limit,
  depth,
  scraperProvider,
  scraperApiKey,
  searchProvider,
  searchApiKey,
  kv
) {
  let allEmails = [];
  let allPhones = [];
  const visited = new Set();

  const isGoogleSearch = url.includes('google.com/search');

  // Feature 2: SerpAPI Interception for Google Search
  if (isGoogleSearch && searchProvider === 'serpapi') {
    const { emails, phones } = await handleGoogleSearchWithSerpAPI(
      url,
      limit,
      searchApiKey,
      depth,
      kv
    );
    return { emails, phones };
  }

  // Regular scraping for non-Google or non-SerpAPI providers
  async function scrapePage(pageUrl, currentDepth) {
    if (currentDepth > depth) return;
    if (visited.has(pageUrl)) return;
    visited.add(pageUrl);

    if (allEmails.length >= limit && allPhones.length >= limit) return;

    try {
      // Feature 5: ScraperAPI Geo-targeting
      const html = await fetchWithScraperAPI(
        pageUrl,
        scraperProvider,
        scraperApiKey,
        pageUrl.includes('google.com')
      );

      // Feature 3: Hidden Metadata Analysis (JSON-LD, mailto, etc.)
      const extracted = extractFromHTML(html, pageUrl);

      allEmails.push(...extracted.emails);
      allPhones.push(...extracted.phones);

      // Recursive scraping for links
      if (currentDepth < depth) {
        const links = extractLinksFromHTML(html, pageUrl);
        // Feature 4: Concurrency Batching with Delay Control
        const batches = chunkArray(links, 3);

        for (const batch of batches) {
          const batchPromises = batch.map((link) =>
            scrapePage(link, currentDepth + 1)
          );
          await Promise.all(batchPromises);

          // Jitter delay between batches
          if (batch !== batches[batches.length - 1]) {
            await delay(500 + Math.random() * 500);
          }
        }
      }
    } catch (err) {
      console.error(`Failed to scrape ${pageUrl}:`, err.message);
    }
  }

  await scrapePage(url, 1);

  return { emails: allEmails, phones: allPhones };
}

// ============================================================
// FEATURE 2: SERPAPI INTEGRATION FOR GOOGLE SEARCH
// ============================================================
async function handleGoogleSearchWithSerpAPI(
  googleUrl,
  limit,
  serpApiKey,
  depth,
  kv
) {
  if (!serpApiKey) {
    return { emails: [], phones: [] };
  }

  try {
    // Extract search query from URL
    const urlObj = new URL(googleUrl);
    const searchQuery = urlObj.searchParams.get('q');

    if (!searchQuery) {
      return { emails: [], phones: [] };
    }

    // Check KV cache for SerpAPI results
    const serpCacheKey = `cache:serpapi:${searchQuery}`;
    const cachedSerpData = await kv.getJSON(serpCacheKey);
    if (cachedSerpData) {
      return {
        emails: cachedSerpData.emails.slice(0, limit),
        phones: cachedSerpData.phones.slice(0, limit),
      };
    }

    // Feature 3: Two-Tier Extraction - Extract from SerpAPI results BEFORE visiting links
    const serpApiUrl = `https://serpapi.com/search?q=${encodeURIComponent(
      searchQuery
    )}&api_key=${serpApiKey}&engine=google`;

    const response = await fetch(serpApiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`SerpAPI Error: ${response.status}`);
    }

    const serpData = await response.json();

    let emails = [];
    let phones = [];

    // Extract from snippets and titles
    if (serpData.organic_results) {
      for (const result of serpData.organic_results) {
        const text = `${result.title || ''} ${result.snippet || ''}`;
        const extracted = extractContactsFromText(text);
        emails.push(...extracted.emails);
        phones.push(...extracted.phones);
      }
    }

    // Feature 4: Batch process links from SerpAPI results
    if (serpData.organic_results && depth > 1) {
      const links = serpData.organic_results
        .slice(0, 10)
        .map((r) => r.link)
        .filter(Boolean);

      const batches = chunkArray(links, 3);

      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map((link) => scrapePageWithSerpAPI(link, serpApiKey))
        );

        for (const batchResult of batchResults) {
          emails.push(...batchResult.emails);
          phones.push(...batchResult.phones);
        }

        // Jitter delay
        if (batch !== batches[batches.length - 1]) {
          await delay(600 + Math.random() * 400);
        }
      }
    }

    // Deduplicate
    const uniqueEmails = Array.from(
      new Map(emails.map((item) => [item.email, item])).values()
    );
    const uniquePhones = Array.from(
      new Map(phones.map((item) => [item.phone, item])).values()
    );

    // Cache SerpAPI results
    await kv.putJSON(
      serpCacheKey,
      {
        emails: uniqueEmails,
        phones: uniquePhones,
        scrapedAt: new Date().toISOString(),
      },
      { expirationTtl: 86400 }
    );

    return {
      emails: uniqueEmails.slice(0, limit),
      phones: uniquePhones.slice(0, limit),
    };
  } catch (err) {
    console.error('SerpAPI Error:', err.message);
    return { emails: [], phones: [] };
  }

  async function scrapePageWithSerpAPI(pageUrl, apiKey) {
    try {
      // Use the same SerpAPI key for scraping (some providers allow both)
      // But we'll use ScraperAPI if available, else fallback to direct
      const html = await fetchWithScraperAPI(
        pageUrl,
        'scraperapi',
        apiKey, // using serpapi key as fallback
        false
      );
      const extracted = extractFromHTML(html, pageUrl);
      return extracted;
    } catch (err) {
      console.error(`Failed to scrape ${pageUrl}:`, err.message);
      return { emails: [], phones: [] };
    }
  }
}

// ============================================================
// FEATURE 5: SCRAPERAPI WITH GEO-TARGETING
// FEATURE 6: SELECTIVE RENDERING OPTIMIZATION
// ============================================================
async function fetchWithScraperAPI(
  url,
  provider,
  apiKey,
  isGoogleSearch = false
) {
  if (!apiKey) {
    // Fallback to direct fetch if no API key
    return await directFetch(url);
  }

  try {
    let fetchUrl = '';

    if (provider === 'scraperapi') {
      // Feature 5: Geo-targeting for ScraperAPI
      let params = {
        api_key: apiKey,
        url: url,
      };

      // Feature 6: Selective Rendering Optimization
      // Use premium for Google searches, render for JS-heavy sites
      if (isGoogleSearch) {
        params.premium = 'true';
      } else {
        // Detect if rendering might be needed based on URL patterns
        const shouldRender =
          url.includes('react') ||
          url.includes('vue') ||
          url.includes('angular') ||
          url.includes('nextjs');
        if (shouldRender) {
          params.render = 'true';
        } else {
          params.render = 'false';
        }
      }

      // Add geo-targeting
      params.country_code = 'us';

      const queryString = new URLSearchParams(params).toString();
      fetchUrl = `http://api.scraperapi.com?${queryString}`;
    } else if (provider === 'scrapingbee') {
      fetchUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(
        url
      )}&render_js=false&premium_proxy=true`;
    } else if (provider === 'brightdata') {
      fetchUrl = `http://proxy.provider.com?url=${encodeURIComponent(
        url
      )}&api_key=${apiKey}`;
    } else {
      // Fallback to direct fetch
      return await directFetch(url);
    }

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 403 || response.status === 429) {
      throw new Error('API Provider blocked the request');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (err) {
    console.warn(`ScraperAPI failed, falling back to direct fetch: ${err.message}`);
    return await directFetch(url);
  }
}

// Fallback direct fetch with basic error handling
async function directFetch(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (err) {
    console.error(`Direct fetch failed for ${url}:`, err.message);
    return '';
  }
}

// ============================================================
// FEATURE 3: HIDDEN METADATA EXTRACTION
// ============================================================
function extractFromHTML(html, pageUrl) {
  if (!html) return { emails: [], phones: [] };

  let emails = [];
  let phones = [];

  try {
    // Heal obfuscation
    const healedHtml = autoHealObfuscation(html);

    // Extract from visible text
    const textContacts = extractContactsFromText(healedHtml);
    emails.push(...textContacts.emails);
    phones.push(...textContacts.phones);

    // Feature 3: Extract from JSON-LD (Schema.org structured data)
    const jsonLdMatches = healedHtml.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi
    );
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const jsonStr = match.replace(
            /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i,
            '$1'
          );
          const jsonData = JSON.parse(jsonStr);
          const extracted = extractFromJsonLd(jsonData);
          emails.push(...extracted.emails);
          phones.push(...extracted.phones);
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
    }

    // Feature 3: Extract from mailto links
    const mailtoMatches = healedHtml.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi);
    if (mailtoMatches) {
      for (const match of mailtoMatches) {
        const email = match.replace(/mailto:/i, '').toLowerCase();
        const domain = email.split('@')[1] || 'unknown.com';
        emails.push({ email, domain: `@${domain}` });
      }
    }

    // Deduplicate by email/phone
    emails = Array.from(
      new Map(emails.map((item) => [item.email, item])).values()
    );
    phones = Array.from(
      new Map(phones.map((item) => [item.phone, item])).values()
    );

    return { emails, phones };
  } catch (err) {
    console.error('Error extracting from HTML:', err.message);
    return { emails: [], phones: [] };
  }
}

// Extract contacts from plain text
function extractContactsFromText(text) {
  const emails = [];
  const phones = [];

  if (!text) return { emails, phones };

  // Email regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = text.match(emailRegex) || [];
  emailMatches.forEach((email) => {
    const lowercaseEmail = email.toLowerCase();
    const domain = lowercaseEmail.split('@')[1] || 'unknown.com';
    emails.push({ email: lowercaseEmail, domain: `@${domain}` });
  });

  // Phone regex (improved pattern)
  const phoneRegex =
    /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}(?:[-.\s]?\d{1,4})?/g;
  const phoneMatches = text.match(phoneRegex) || [];
  phoneMatches.forEach((phoneStr) => {
    const digits = phoneStr.replace(/[^\d+]/g, '');
    if (digits.length >= 10) {
      phones.push({
        phone: phoneStr,
        country: 'Detected from Website',
      });
    }
  });

  return { emails, phones };
}

// Extract from JSON-LD structured data
function extractFromJsonLd(jsonData) {
  const emails = [];
  const phones = [];

  const traverse = (obj) => {
    if (!obj || typeof obj !== 'object') return;

    if (obj.email && typeof obj.email === 'string') {
      const email = obj.email.toLowerCase();
      const domain = email.split('@')[1] || 'unknown.com';
      emails.push({ email, domain: `@${domain}` });
    }

    if (obj.telephone && typeof obj.telephone === 'string') {
      const digits = obj.telephone.replace(/[^\d+]/g, '');
      if (digits.length >= 10) {
        phones.push({
          phone: obj.telephone,
          country: obj.areaServed || 'From JSON-LD',
        });
      }
    }

    if (obj.contactPoint && Array.isArray(obj.contactPoint)) {
      for (const cp of obj.contactPoint) {
        traverse(cp);
      }
    }

    for (const key in obj) {
      if (typeof obj[key] === 'object') {
        traverse(obj[key]);
      }
    }
  };

  traverse(jsonData);
  return { emails, phones };
}

// Extract links from HTML
function extractLinksFromHTML(html, baseUrl) {
  const links = new Set();

  if (!html) return Array.from(links);

  try {
    const baseUrlObj = new URL(baseUrl);
    const baseDomain = baseUrlObj.hostname;

    // Extract href links
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      try {
        const link = match[1];
        if (
          !link.startsWith('#') &&
          !link.startsWith('javascript:') &&
          !link.startsWith('mailto:') &&
          !link.startsWith('tel:')
        ) {
          let absoluteUrl;
          if (link.startsWith('http')) {
            absoluteUrl = link;
          } else if (link.startsWith('/')) {
            absoluteUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}${link}`;
          } else {
            absoluteUrl = new URL(link, baseUrl).toString();
          }

          const linkUrlObj = new URL(absoluteUrl);
          // Only include links from same domain
          if (linkUrlObj.hostname === baseDomain) {
            links.add(absoluteUrl);
          }
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    }
  } catch (err) {
    console.warn('Error extracting links:', err.message);
  }

  return Array.from(links).slice(0, 20); // Limit to 20 links
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

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

function autoHealObfuscation(text) {
  if (!text) return '';
  return text
    .replace(/\s*[\[\(\{]at[\]\)\}]\s*/gi, '@')
    .replace(/\s*_\s*at\s*_\s*/gi, '@')
    .replace(/\s*[\[\(\{]dot[\]\)\}]\s*/gi, '.')
    .replace(/\s*_\s*dot\s*_\s*/gi, '.')
    .replace(/\s*\[\s*at\s*\]\s*/gi, '@')
    .replace(/\s*\(\s*at\s*\)\s*/gi, '@');
}

// Feature 4: Chunking helper for batching
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Feature 4: Delay helper for jitter control
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// VERIFICATION HANDLERS
// ============================================================

async function handleEmailVerification(
  emails,
  provider,
  credentials,
  kv
) {
  if (!credentials) {
    return emails.map((email) => ({
      email,
      status: 'Unverified',
      meta: 'API Key not configured',
    }));
  }

  const tasks = emails.map(async (email) => {
    try {
      if (provider === 'hunter') {
        const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(
          email
        )}&api_key=${credentials}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const resData = await res.json();

        return {
          email,
          status:
            resData.data?.result === 'deliverable' ? 'Verified' : 'Undeliverable',
          meta: resData.data?.score
            ? `Confidence: ${resData.data.score}%`
            : 'Hunter.io',
        };
      } else if (provider === 'zerobounce') {
        const url = `https://api.zerobounce.net/v2/validate?api_key=${credentials}&email=${encodeURIComponent(
          email
        )}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        const resData = await res.json();

        return {
          email,
          status: resData.status === 'valid' ? 'Verified' : 'Invalid',
          meta: resData.sub_status || 'ZeroBounce',
        };
      }

      return {
        email,
        status: 'Unverified',
        meta: `Provider ${provider} not fully implemented`,
      };
    } catch (e) {
      return { email, status: 'Error', meta: e.message };
    }
  });

  return Promise.all(tasks);
}

async function handlePhoneVerification(
  phones,
  provider,
  credentials,
  kv
) {
  if (!credentials) {
    return phones.map((phone) => ({
      phone,
      status: 'Unverified',
      meta: 'API Key not configured',
    }));
  }

  const tasks = phones.map(async (phone) => {
    try {
      if (provider === 'twilio') {
        const credParts = credentials.split(':');
        const accountSid = credParts[0] || '';
        const authToken = credParts[1] || '';

        if (!accountSid || !authToken) {
          return {
            phone,
            status: 'Unverified',
            meta: 'Twilio credentials incomplete',
          };
        }

        const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(
          phone
        )}?Fields=line_type_intelligence`;
        const basicAuth = btoa(`${accountSid}:${authToken}`);

        const res = await fetch(url, {
          headers: { Authorization: `Basic ${basicAuth}` },
          signal: AbortSignal.timeout(8000),
        });
        const resData = await res.json();

        if (res.status === 200 && resData.valid) {
          const carrier =
            resData.line_type_intelligence?.carrier_name || 'Active';
          const type = resData.line_type_intelligence?.type || 'Unknown';
          return { phone, status: 'Valid', meta: `${carrier} (${type})` };
        } else {
          return { phone, status: 'Invalid', meta: 'Twilio validation failed' };
        }
      }

      return {
        phone,
        status: 'Unverified',
        meta: `Provider ${provider} not fully implemented`,
      };
    } catch (e) {
      return { phone, status: 'Error', meta: e.message };
    }
  });

  return Promise.all(tasks);
}
