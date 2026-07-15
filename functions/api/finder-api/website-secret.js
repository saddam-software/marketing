// functions/api/finder-api/website-secret.js
// ============================================================ 
//  Website URL Extractor & Intelligence Verification API
//  Fully Dynamic Configuration - Now reads from Dashboard
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

  // Token Verification
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
  if (!token) return jsonResponse({ success: false, error: 'Missing authentication token' }, 401, corsHeaders);
  
  const payload = verifyToken(token);
  if (!payload) return jsonResponse({ success: false, error: 'Invalid or expired token' }, 401, corsHeaders);

  const body = await request.json().catch(() => ({}));
  
  // ============================================================
  // INIT KV & LOAD DYNAMIC CONFIGS
  // ============================================================
  const kv = new KVMANAGER(env.SECRETS_KV || null);
  
  // 🔴 Load Scraper API Key dynamically from database
  const scrapeConfig = await kv.getJSON('api_config:website_scraping') || { provider: 'scraperapi', apiKey: '' };
  const SCRAPER_API_KEY = scrapeConfig.apiKey || '';
  
  // ============================================================
  // ROUTER: VERIFICATION ACTIONS vs EXTRACTOR ACTION
  // ============================================================
  
  // কলাম-লেভেল ইমেইল ভেরিফিকেশন অ্যাকশন (KV পাস করা হয়েছে)
  if (body.action === 'verify_emails') {
    const results = await handleEmailVerification(body.emails || [], kv);
    return jsonResponse({ success: true, data: results }, 200, corsHeaders);
  }

  // peri-level ফোন ভেরিফিকেশন অ্যাকশন (KV পাস করা হয়েছে)
  if (body.action === 'verify_phones') {
    const results = await handlePhoneVerification(body.phones || [], kv);
    return jsonResponse({ success: true, data: results }, 200, corsHeaders);
  }

  // ============================================================
  // DEEP SCRAPING ENGINE (WITH GOOGLE BYPASS LOGIC)
  // ============================================================
  let { url, limit = 100, depth = 1, force = false } = body;
  if (!url) return jsonResponse({ success: false, error: 'URL required' }, 400, corsHeaders);
  
  url = validateUrl(url);
  if (!url) return jsonResponse({ success: false, error: 'Invalid URL format' }, 400, corsHeaders);

  const cacheKey = `cache:website:${url}:depth${depth}:limit${limit}`;

  // ক্যাশ চেক
  if (!force) {
    const cached = await kv.getJSON(cacheKey);
    if (cached && cached.emails && cached.phones) {
      return jsonResponse({
        success: true,
        data: {
          emails: cached.emails.slice(0, limit),
          phones: cached.phones.slice(0, limit),
        },
        cached: true,
      }, 200, corsHeaders);
    }
  }

  let allEmails = [];
  let allPhones = [];
  let errorMsg = null;
  const visited = new Set();
  
  const isGoogleSearch = url.includes('google.com/search');
  const targetDepth = isGoogleSearch ? 2 : depth;

  // রিকার্সিভ স্ক্র্যাপিং ফাংশন
  async function scrapePage(pageUrl, currentDepth) {
    if (currentDepth > targetDepth) return;
    if (visited.has(pageUrl)) return;
    visited.add(pageUrl);

    if (allEmails.length >= limit && allPhones.length >= limit) return;

    try {
      const html = await fetchWithRetry(pageUrl, SCRAPER_API_KEY);
      
      // এডভান্সড ইমেইল ইন্টেলিজেন্স (Obfuscation Healing Engine applied on HTML)
      const healedHtml = autoHealObfuscation(html);
      const isCurrentPageGoogle = pageUrl.includes('google.com');

      if (isCurrentPageGoogle) {
        // গুগল সার্চ পেজ থেকে রেজাল্ট লিঙ্কগুলো বের করার লজিক
        let extractedLinks = [];
        const googleLinkRegex = /href="\/url\?q=([^"&]+)/gi;
        let match;
        while ((match = googleLinkRegex.exec(healedHtml)) !== null) {
          try {
            const decodedUrl = decodeURIComponent(match[1]);
            if (!decodedUrl.includes('google.com') && !decodedUrl.includes('youtube.com')) {
              extractedLinks.push(decodedUrl);
            }
          } catch (e) {}
        }

        const directLinkRegex = /href="(https?:\/\/[^"]+)"/gi;
        while ((match = directLinkRegex.exec(healedHtml)) !== null) {
          try {
            if (!match[1].includes('google.com') && !match[1].includes('youtube.com')) {
              extractedLinks.push(match[1]);
            }
          } catch (e) {}
        }

        extractedLinks = [...new Set(extractedLinks)];

        // সার্চ রেজাল্টের লিঙ্কগুলোর ভেতরে ঢুকে ডেটা স্ক্র্যাপ করা (Depth 2 Action)
        for (const link of extractedLinks) {
          if (allEmails.length >= limit && allPhones.length >= limit) break;
          await scrapePage(link, currentDepth + 1);
        }
      } else {
        // সাধারণ পৃষ্ঠা থেকে ইমেইল এবং ফোন এক্সট্রাক্ট করা
        const domainName = new URL(pageUrl).hostname.replace('www.', '');
        const tld = domainName.split('.').pop() || 'com';

        // ইমেইল এক্সট্রাকশন এবং ডোমেইন ক্যাটাগরি তৈরি
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = (healedHtml.match(emailRegex) || []).map(e => e.toLowerCase());
        emails.forEach(email => {
          const dom = email.split('@')[1] || 'unknown.com';
          allEmails.push({ email: email, domain: `@${dom}` });
        });
        
        // গ্লোবাল ফোন ইন্টেলিজেন্স ও স্ট্র্যাটেজিক পার্সিং
        const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
        const rawPhones = healedHtml.match(phoneRegex) || [];
        rawPhones.forEach(phoneStr => {
          const processed = normalizeAndDetectCountry(phoneStr, { tld: tld, text: healedHtml });
          if (processed.phone.replace(/[^\d]/g, '').length >= 10) {
            allPhones.push(processed);
          }
        });
      }
    } catch (err) {
      console.error(`Failed to scrape ${pageUrl}:`, err.message);
      if (isGoogleSearch && currentDepth === 1) {
        errorMsg = "Google blocked the request. ScraperAPI Proxy failed or key expired.";
      }
    }
  }

  // স্ক্র্যাপিং প্রসেস শুরু
  await scrapePage(url, 1);

  // ইউনিক ফিল্টারিং (অবজেক্ট ভিত্তিক ডি-ডুপ্লিকেশন)
  const uniqueEmails = Array.from(new Map(allEmails.map(item => [item.email, item])).values()).slice(0, limit);
  const uniquePhones = Array.from(new Map(allPhones.map(item => [item.phone, item])).values()).slice(0, limit);

  if (isGoogleSearch && uniqueEmails.length === 0 && uniquePhones.length === 0 && errorMsg) {
     return jsonResponse({ success: false, error: errorMsg }, 403, corsHeaders);
  }

  // নতুন স্ট্রাকচার্ড ফরম্যাটে KV ক্যাশ সেভ করা
  await kv.putJSON(cacheKey, {
    emails: uniqueEmails,
    phones: uniquePhones,
    scrapedAt: new Date().toISOString(),
  }, { expirationTtl: 86400 });

  // ফ্রন্টএন্ডের script.js এর প্রত্যাশিত ফরম্যাটে রেসপন্স পাঠানো
  return jsonResponse({
    success: true,
    data: {
      emails: uniqueEmails,
      phones: uniquePhones
    },
    cached: false,
  }, 200, corsHeaders);
}

// ============================================================
// STRATEGIC HELPER FUNCTIONS
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
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch { return null; }
}

async function fetchWithRetry(url, apiKey = "", retries = 2) {
  let fetchUrl = url;
  // যদি গুগলের লিংক হয়, তবে রিকোয়েস্টটি ScraperAPI প্রক্সির মাধ্যমে ঘুরিয়ে পাঠানো হবে
  if (url.includes('google.com') && apiKey !== "") {
    fetchUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(20000),
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

// Advanced Email Intelligence: Obfuscation Healing Engine
function autoHealObfuscation(text) {
  if (!text) return '';
  return text
    .replace(/\s*[\[\(\{]at[\]\)\}]\s*/gi, '@')   
    .replace(/\s*_\s*at\s*_\s*/gi, '@')           
    .replace(/\s*[\[\(\{]dot[\]\)\}]\s*/gi, '.')  
    .replace(/\s*_\s*dot\s*_\s*/gi, '.');
}

// Global Phone Intelligence & Strategic Parsing Engine
function normalizeAndDetectCountry(phoneStr, context) {
  let cleaned = phoneStr.replace(/[\s\-\(\)\.]/g, '');
  
  if (cleaned.startsWith('+')) {
    return { phone: cleaned, country: 'International Recognized' };
  }

  const tld = context.tld.toLowerCase();
  const pageText = context.text;

  // ১. Bangladesh Context
  if (tld === 'bd' || pageText.includes('Bangladesh') || pageText.includes('বাংলাদেশ')) {
    if (cleaned.startsWith('01') && cleaned.length === 11) {
      return { phone: '+88' + cleaned, country: 'Bangladesh' };
    } else if (cleaned.startsWith('1') && cleaned.length === 10) {
      return { phone: '+880' + cleaned, country: 'Bangladesh' };
    }
  }

  // ২. UK Context
  if (tld === 'uk' || pageText.includes('United Kingdom') || pageText.includes('London')) {
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      return { phone: '+44' + cleaned.slice(1), country: 'United Kingdom' };
    }
  }

  // ৩. USA Context
  if (tld === 'us' || tld === 'com' || pageText.includes('United States') || pageText.includes('USA')) {
    if (cleaned.length === 10) {
      return { phone: '+1' + cleaned, country: 'USA' };
    }
  }

  return { phone: phoneStr, country: 'Unknown / Manual Review Required' };
}

// ============================================================
// DYNAMIC VERIFICATION FUNCTIONS (Read from KV)
// ============================================================

// প্লাগেবল ইমেইল ভেরিফায়ার গেটওয়ে (ডাইনামিক কনফিগ)
async function handleEmailVerification(emails, kv) {
  // ডাটাবেস থেকে ডাইনামিক API লোড করা
  const config = await kv.getJSON('api_config:email_verification') || { provider: 'hunter', apiKey: '' };
  const provider = config.provider || 'hunter';
  const credentials = config.apiKey || '';
  
  const tasks = emails.map(async (email) => {
    try {
      if (provider === 'hunter' && credentials) {
        const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${credentials}`;
        const res = await fetch(url);
        const resData = await res.json();
        
        return {
          email: email,
          status: resData.data?.result === 'deliverable' ? 'Verified' : 'Undeliverable',
          meta: resData.data?.score ? `Confidence: ${resData.data.score}%` : 'Hunter.io API'
        };
      }
      return { email: email, status: 'Unverified', meta: 'Provider Not Configured or Key Missing' };
    } catch (e) {
      return { email: email, status: 'Error', meta: e.message };
    }
  });

  return Promise.all(tasks);
}

// প্লাগেবল ফোন ভেরিফায়ার গেটওয়ে (ডাইনামিক কনফিগ)
async function handlePhoneVerification(phones, kv) {
  // ডাটাবেস থেকে ডাইনামিক API লোড করা
  const config = await kv.getJSON('api_config:phone_verification') || { provider: 'twilio', apiKey: '' };
  const provider = config.provider || 'twilio';
  const credentials = config.apiKey || '';
  
  // Twilio এর ক্ষেত্রে API Key তে SID এবং Token সাধারণত 'SID:TOKEN' ফরম্যাটে সেভ করতে হবে ড্যাশবোর্ড থেকে
  const credParts = credentials.split(':');
  const accountSid = credParts[0] || '';
  const authToken = credParts[1] || '';
  
  const tasks = phones.map(async (phone) => {
    try {
      if (provider === 'twilio' && accountSid && authToken) {
        const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`;
        const basicAuth = btoa(`${accountSid}:${authToken}`);
        
        const res = await fetch(url, {
          headers: { 'Authorization': `Basic ${basicAuth}` }
        });
        const resData = await res.json();

        if (res.status === 200 && resData.valid) {
          const carrier = resData.line_type_intelligence?.carrier_name || 'Active';
          const type = resData.line_type_intelligence?.type || 'Unknown';
          return {
            phone: phone,
            status: 'Valid',
            meta: `${carrier} (${type})`
          };
        } else {
          return { phone: phone, status: 'Invalid', meta: 'Twilio Blocked/Invalid' };
        }
      }
      return { phone: phone, status: 'Unverified', meta: 'Provider Not Configured or Key Missing' };
    } catch (e) {
      return { phone: phone, status: 'Error', meta: e.message };
    }
  });

  return Promise.all(tasks);
}
