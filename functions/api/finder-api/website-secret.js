// functions/api/finder-api/website-secret.js
// ============================================================ 
//  Website URL Extractor & Intelligence Verification API
// ============================================================

import { KVMANAGER } from '../../helpers/kv-manager.js';

// ============================================================
// 1. STRATEGIC PROVIDER CONFIGURATION (প্লাগেবল আর্কিটেকচার)
// ============================================================
// ভবিষ্যতে প্রোভাইডার পরিবর্তন করতে চাইলে শুধু এখানে 'current' এবং সংশ্লিষ্ট 'keys' আপডেট করুন।
const PROVIDER_CONFIG = {
  email: {
    current: 'hunter', // বিকল্প হতে পারে: 'zero_bounce', 'abstract', ইত্যাদি
    keys: {
      hunter: 'YOUR_HUNTER_IO_API_KEY', // আপনার Hunter.io API Key এখানে দিন
      zero_bounce: 'YOUR_ZERO_BOUNCE_API_KEY' // ভবিষ্যতের জন্য উদাহরণ
    }
  },
  phone: {
    current: 'twilio', // বিকল্প হতে পারে: 'numverify', 'infobip', ইত্যাদি
    keys: {
      twilio: {
        accountSid: 'YOUR_TWILIO_ACCOUNT_SID', // আপনার Twilio Account SID
        authToken: 'YOUR_TWILIO_AUTH_TOKEN'    // আপনার Twilio Auth Token
      },
      numverify: 'YOUR_NUMVERIFY_API_KEY' // ভবিষ্যতের জন্য উদাহরণ
    }
  }
};

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

  // Token Verification (পূর্বের সিকিউরিটি লজিক বজায় রাখা হয়েছে)
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
  // ROUTER: VERIFICATION ACTIONS vs EXTRACTOR ACTION
  // ============================================================
  
  // কলাম-লেভেল ইমেইল ভেরিফিকেশন অ্যাকশন
  if (body.action === 'verify_emails') {
    const results = await handleEmailVerification(body.emails || []);
    return jsonResponse({ success: true, data: results }, 200, corsHeaders);
  }

  // কলাম-লেভেল ফোন ভেরিফিকেশন অ্যাকশন
  if (body.action === 'verify_phones') {
    const results = await handlePhoneVerification(body.phones || []);
    return jsonResponse({ success: true, data: results }, 200, corsHeaders);
  }

  // ডিফল্ট স্ক্র্যাপিং ও পার্সিং লজিক (ইন্টেলিজেন্ট হিলিং ও পার্সিং ইঞ্জিন সহ)
  let targetUrl = body.url;
  if (!targetUrl) return jsonResponse({ success: false, error: 'URL is required' }, 400, corsHeaders);

  try {
    targetUrl = cleanUrl(targetUrl);
    if (!targetUrl) return jsonResponse({ success: false, error: 'Invalid URL format' }, 400, corsHeaders);

    const domainName = new URL(targetUrl).hostname.replace('www.', '');
    const tld = domainName.split('.').pop(); // TLD এক্সট্রাকশন (যেমন: bd, uk, com)

    // পেজ কনটেন্ট ফেচ করা
    const htmlContent = await fetchPageContent(targetUrl, env.SCRAPER_API_KEY);
    
    // ২. এডভান্সড ইমেইল ইন্টেলিজেন্স (Obfuscation Healing)
    const healedContent = autoHealObfuscation(htmlContent);
    
    // ইমেইল এবং র-ফোন নম্বর এক্সট্রাকশন
    const rawEmails = extractEmails(healedContent);
    const rawPhones = extractPhones(healedContent);

    // ৩. গ্লোবাল ফোন ইন্টেলিজেন্স ও স্ট্র্যাটেজিক পার্সিং
    const processedPhones = rawPhones.map(phone => {
      return normalizeAndDetectCountry(phone, { tld: tld, text: healedContent });
    });

    // ফ্রন্টএন্ডে সহজে কলাম রেন্ডার করার জন্য স্ট্রাকচার্ড ডেটা তৈরি
    const structuredEmails = rawEmails.map(email => {
      const domain = email.split('@')[1] || 'unknown.com';
      return { email: email, domain: `@${domain}` };
    });

    return jsonResponse({
      success: true,
      data: {
        emails: structuredEmails, // [{email: '...', domain: '...'}]
        phones: processedPhones   // [{phone: '...', country: '...'}]
      }
    }, 200, corsHeaders);

  } catch (err) {
    return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
  }
}

// ============================================================
// STRATEGIC HELPER FUNCTIONS
// ============================================================

function jsonResponse(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

function cleanUrl(url) {
  try {
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
    const parsed = new URL(target);
    return parsed.toString();
  } catch { return null; }
}

async function fetchPageContent(url, apiKey = "") {
  let fetchUrl = url;
  if (url.includes('google.com') && apiKey) {
    fetchUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
  }
  const response = await fetch(fetchUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Failed to fetch page content');
  return await response.text();
}

// Advanced Email Intelligence: Obfuscation Healing Engine
function autoHealObfuscation(text) {
  if (!text) return '';
  return text
    .replace(/\s*[\[\(\{]at[\]\)\}]\s*/gi, '@')   // info [at] domain.com -> info@domain.com
    .replace(/\s*_\s*at\s*_\s*/gi, '@')           // info_at_domain.com -> info@domain.com
    .replace(/\s*[\[\(\{]dot[\]\)\}]\s*/gi, '.')  // domain [dot] com -> domain.com
    .replace(/\s*_\s*dot\s*_\s*/gi, '.');
}

function extractEmails(text) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return Array.from(new Set(text.match(emailRegex) || []));
}

function extractPhones(text) {
  // রিল্যাক্সড ফোন প্যাটার্ন যা বিভিন্ন দেশের লোকাল ও আন্তর্জাতিক ফরম্যাট ক্যাপচার করে
  const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
  return Array.from(new Set(text.match(phoneRegex) || []));
}

// Global Phone Intelligence & Strategic Parsing Engine
function normalizeAndDetectCountry(phoneStr, context) {
  // সব ধরনের স্পেস, হাইফেন, ব্র্যাকেট ক্লিন করে শুধু সংখ্যা ও প্লাস রাখা
  let cleaned = phoneStr.replace(/[\s\-\(\)\.]/g, '');
  
  // যদি অলরেডি আন্তর্জাতিক E.164 ফরম্যাটে থাকে (+)
  if (cleaned.startsWith('+')) {
    return { phone: cleaned, country: 'International Recognized' };
  }

  const tld = context.tld.toLowerCase();
  const pageText = context.text;

  // কনটেক্সট অ্যানালাইসিস এবং কনফিডেন্স স্কোর নির্ধারণ লজিক
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

  // পর্যাপ্ত কনফিডেন্স না থাকলে রিভিউ মোডে পাঠানো হবে
  return { phone: phoneStr, country: 'Unknown / Manual Review Required' };
}

// ============================================================
// MODULAR VERIFICATION CORE LOGIC
// ============================================================

// প্লাগেবল ইমেইল ভেরিফায়ার গেটওয়ে
async function handleEmailVerification(emails) {
  const provider = PROVIDER_CONFIG.email.current;
  const credentials = PROVIDER_CONFIG.email.keys[provider];
  
  const tasks = emails.map(async (email) => {
    try {
      if (provider === 'hunter') {
        const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${credentials}`;
        const res = await fetch(url);
        const resData = await res.json();
        
        return {
          email: email,
          status: resData.data?.result === 'deliverable' ? 'Verified' : 'Undeliverable',
          meta: resData.data?.score ? `Confidence: ${resData.data.score}%` : 'Hunter.io API'
        };
      }
      
      // ভবিষ্যতে অন্য প্রোভাইডার যুক্ত করার ব্লক (যেমন ZeroBounce)
      if (provider === 'zero_bounce') {
        // এখানে ZeroBounce এর API ইন্টিগ্রেশন লজিক বসবে
      }

      return { email: email, status: 'Unverified', meta: 'Provider Not Configured' };
    } catch (e) {
      return { email: email, status: 'Error', meta: e.message };
    }
  });

  return Promise.all(tasks);
}

// প্লাগেবল ফোন ভেরিফায়ার গেটওয়ে
async function handlePhoneVerification(phones) {
  const provider = PROVIDER_CONFIG.phone.current;
  const credentials = PROVIDER_CONFIG.phone.keys[provider];

  const tasks = phones.map(async (phone) => {
    try {
      if (provider === 'twilio') {
        const accountSid = credentials.accountSid;
        const authToken = credentials.authToken;
        
        // Twilio v2 Lookup API ইন্টিগ্রেশন (HLR/Carrier Check এর জন্য)
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

      // ভবিষ্যতে অন্য কোনো ফোন ভেরিফিকেশন API অ্যাড করার জায়গা
      if (provider === 'numverify') {
        // Numverify লজিক
      }

      return { phone: phone, status: 'Unverified', meta: 'Provider Not Configured' };
    } catch (e) {
      return { phone: phone, status: 'Error', meta: e.message };
    }
  });

  return Promise.all(tasks);
}
