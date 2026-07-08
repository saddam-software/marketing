// functions/api/secret.js
// ============================================================
//  Email Extractor Pro - Backend API (Cloudflare Pages Functions)
//  Features: Authentication, Brevo API, Web Scraping, Dynamic API Management
// ============================================================

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD_HASH = 'admin123'; // ⚠️ NOTE: পরবর্তীতে সিকিউর হ্যাশিং করতে হবে
const BREVO_API_KEY = 'YOUR_BREVO_API_KEY'; // Environment variable থেকে আসবে
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 মিনিট
const MAX_LOGIN_ATTEMPTS = 5;

// ============================================================
//  HELPER FUNCTIONS
// ============================================================

/**
 * Simple MD5-like hash (for demo) - Production-এ bcrypt/argon2 ব্যবহার করুন
 */
function hashPassword(password) {
  return btoa(password); // Base64 (শুধু demo-র জন্য)
}

/**
 * Verify password
 */
function verifyPassword(inputPassword, hash) {
  return btoa(inputPassword) === hash;
}

/**
 * Generate JWT-like token (demo)
 */
function generateToken(username) {
  const payload = {
    username,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 ঘণ্টা
  };
  return btoa(JSON.stringify(payload));
}

/**
 * Verify token
 */
function verifyToken(token) {
  try {
    const payload = JSON.parse(atob(token));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * সাধারণ JSON Response
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * সাধারণ Error Response
 */
function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

/**
 * Request থেকে Authorization token বের করা
 */
function getAuthToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/**
 * Request validation
 */
async function validateAuthToken(request) {
  const token = getAuthToken(request);
  if (!token) return { valid: false };

  const payload = verifyToken(token);
  if (!payload) return { valid: false };

  return { valid: true, username: payload.username };
}

// ============================================================
//  CLOUDFLARE KV: API Management
// ============================================================

/**
 * API Key save করা (KV-তে)
 */
async function saveApiKey(env, apiName, apiKey) {
  const kvKey = `api_${apiName}`;
  await env.SECRETS_KV.put(kvKey, JSON.stringify({
    key: apiKey,
    updatedAt: new Date().toISOString(),
  }));
  return { success: true, message: `${apiName} API key updated` };
}

/**
 * API Key retrieve করা
 */
async function getApiKey(env, apiName) {
  const kvKey = `api_${apiName}`;
  const data = await env.SECRETS_KV.get(kvKey);
  if (!data) return null;
  return JSON.parse(data);
}

/**
 * API Usage tracking (KV-তে)
 */
async function trackApiUsage(env, apiName, usedCount) {
  const kvKey = `api_usage_${apiName}`;
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `${kvKey}_${today}`;

  let currentUsage = 0;
  const data = await env.SECRETS_KV.get(usageKey);
  if (data) {
    currentUsage = JSON.parse(data).used || 0;
  }

  currentUsage += usedCount;
  await env.SECRETS_KV.put(usageKey, JSON.stringify({
    date: today,
    used: currentUsage,
  }), { expirationTtl: 86400 * 30 }); // 30 দিনের জন্য রাখুন

  return currentUsage;
}

/**
 * API Usage limit get করা
 */
async function getApiUsageStats(env, apiName) {
  const kvKey = `api_usage_${apiName}`;
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `${kvKey}_${today}`;

  let used = 0;
  const data = await env.SECRETS_KV.get(usageKey);
  if (data) {
    used = JSON.parse(data).used || 0;
  }

  // এখানে API-র নির্ধারিত লিমিট হার্ডকোড করা আছে
  const limits = {
    abstract: 250,
    brevo: 300,
  };

  const limit = limits[apiName] || 100;
  const remaining = Math.max(0, limit - used);

  return {
    apiName,
    limit,
    used,
    remaining,
    date: today,
  };
}

// ============================================================
//  AUTHENTICATION ENDPOINTS
// ============================================================

/**
 * POST /api/auth/login
 * Request body: { username, password }
 */
async function handleLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;

  if (!username || !password) {
    return errorResponse('Username এবং password প্রয়োজন', 400);
  }

  // Rate limiting (KV-তে)
  const rateLimitKey = `login_attempts_${username}`;
  const attempts = await env.SECRETS_KV.get(rateLimitKey);
  if (attempts) {
    const parsed = JSON.parse(attempts);
    if (parsed.count >= MAX_LOGIN_ATTEMPTS) {
      const timeLeft = Math.ceil((parsed.expiresAt - Date.now()) / 1000);
      return errorResponse(`খুব বেশি চেষ্টা করেছেন। ${timeLeft} সেকেন্ড পর আবার চেষ্টা করুন।`, 429);
    }
  }

  // Password verification
  const adminPasswordHash = hashPassword(ADMIN_PASSWORD_HASH);
  const inputHash = hashPassword(password);

  if (username !== ADMIN_USERNAME || inputHash !== adminPasswordHash) {
    const newAttempts = attempts ? JSON.parse(attempts) : { count: 0, expiresAt: Date.now() + RATE_LIMIT_WINDOW };
    newAttempts.count += 1;
    newAttempts.expiresAt = Date.now() + RATE_LIMIT_WINDOW;

    await env.SECRETS_KV.put(
      rateLimitKey,
      JSON.stringify(newAttempts),
      { expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000) }
    );

    return errorResponse('ভুল username অথবা password', 401);
  }

  // Clear rate limit on successful login
  await env.SECRETS_KV.delete(rateLimitKey);

  // Generate token
  const token = generateToken(username);

  // Audit log (KV-তে)
  const auditLogKey = `audit_log_${new Date().toISOString().split('T')[0]}`;
  const auditLogs = await env.SECRETS_KV.get(auditLogKey);
  const logs = auditLogs ? JSON.parse(auditLogs) : [];
  logs.push({
    timestamp: new Date().toISOString(),
    action: 'LOGIN',
    username,
  });
  await env.SECRETS_KV.put(auditLogKey, JSON.stringify(logs));

  return jsonResponse({
    success: true,
    token,
    username,
    message: 'সফলভাবে লগইন করেছেন',
  });
}

/**
 * POST /api/auth/logout
 */
async function handleLogout(request, env) {
  const auth = await validateAuthToken(request);
  if (!auth.valid) {
    return errorResponse('অপ্রমাণিত', 401);
  }

  // Audit log
  const auditLogKey = `audit_log_${new Date().toISOString().split('T')[0]}`;
  const auditLogs = await env.SECRETS_KV.get(auditLogKey);
  const logs = auditLogs ? JSON.parse(auditLogs) : [];
  logs.push({
    timestamp: new Date().toISOString(),
    action: 'LOGOUT',
    username: auth.username,
  });
  await env.SECRETS_KV.put(auditLogKey, JSON.stringify(logs));

  return jsonResponse({ success: true, message: 'লগআউট সফল' });
}

/**
 * GET /api/auth/verify
 */
async function handleVerifyToken(request, env) {
  const auth = await validateAuthToken(request);
  if (!auth.valid) {
    return errorResponse('অপ্রমাণিত', 401);
  }

  return jsonResponse({
    success: true,
    username: auth.username,
    message: 'টোকেন বৈধ',
  });
}

// ============================================================
//  API KEY MANAGEMENT ENDPOINTS
// ============================================================

/**
 * POST /api/api-keys/save
 * Body: { apiName, apiKey }
 */
async function handleSaveApiKey(request, env) {
  const auth = await validateAuthToken(request);
  if (!auth.valid) {
    return errorResponse('অপ্রমাণিত', 401);
  }

  const body = await request.json().catch(() => ({}));
  const { apiName, apiKey } = body;

  if (!apiName || !apiKey) {
    return errorResponse('apiName এবং apiKey প্রয়োজন', 400);
  }

  const result = await saveApiKey(env, apiName, apiKey);

  // Audit log
  const auditLogKey = `audit_log_${new Date().toISOString().split('T')[0]}`;
  const auditLogs = await env.SECRETS_KV.get(auditLogKey);
  const logs = auditLogs ? JSON.parse(auditLogs) : [];
  logs.push({
    timestamp: new Date().toISOString(),
    action: 'API_KEY_UPDATED',
    username: auth.username,
    apiName,
  });
  await env.SECRETS_KV.put(auditLogKey, JSON.stringify(logs));

  return jsonResponse(result);
}

/**
 * GET /api/api-keys/stats?apiName=abstract
 */
async function handleGetApiStats(request, env) {
  const auth = await validateAuthToken(request);
  if (!auth.valid) {
    return errorResponse('অপ্রমাণিত', 401);
  }

  const url = new URL(request.url);
  const apiName = url.searchParams.get('apiName') || 'abstract';

  const stats = await getApiUsageStats(env, apiName);
  return jsonResponse({ success: true, data: stats });
}

// ============================================================
//  WEB SCRAPING ENDPOINTS
// ============================================================

/**
 * পাঁচটি রিট্রাই সহ ওয়েবসাইট ফেচ করা
 */
async function fetchWithRetry(url, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000, // 10 সেকেন্ড
      });

      if (response.ok) return response;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
      }
    } catch (error) {
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  return null;
}

/**
 * HTML থেকে সমস্ত ইমেইল এক্সট্র্যাক্ট করা
 */
function extractEmails(html) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = html.match(emailRegex) || [];
  return [...new Set(matches.map(e => e.toLowerCase()))]; // Unique emails
}

/**
 * HTML থেকে সমস্ত ফোন নম্বর এক্সট্র্যাক্ট করা (International format)
 */
function extractPhoneNumbers(html) {
  // সাধারণ International format: +1234567890, +44 123 456 7890 ইত্যাদি
  const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
  const matches = html.match(phoneRegex) || [];

  // Clean এবং normalize
  return [...new Set(
    matches
      .map(p => p.trim().replace(/[^\d+]/g, '')) // শুধু সংখ্যা এবং +
      .filter(p => p.length >= 10) // কমপক্ষে 10 সংখ্যা
  )];
}

/**
 * POST /api/scrape/emails
 * Body: { url }
 */
async function handleScrapeEmails(request, env) {
  const auth = await validateAuthToken(request);
  if (!auth.valid) {
    return errorResponse('অপ্রমাণিত', 401);
  }

  const body = await request.json().catch(() => ({}));
  let { url } = body;

  if (!url) {
    return errorResponse('URL প্রয়োজন', 400);
  }

  // URL validation
  if (!url.startsWith('http')) url = 'https://' + url;

  try {
    const response = await fetchWithRetry(url);
    if (!response) {
      return errorResponse('ওয়েবসাইট অ্যাক্সেস করতে ব্যর্থ', 503);
    }

    const html = await response.text();
    const emails = extractEmails(html);

    // Track usage
    await trackApiUsage(env, 'abstract', emails.length);

    // Audit log
    const auditLogKey = `audit_log_${new Date().toISOString().split('T')[0]}`;
    const auditLogs = await env.SECRETS_KV.get(auditLogKey);
    const logs = auditLogs ? JSON.parse(auditLogs) : [];
    logs.push({
      timestamp: new Date().toISOString(),
      action: 'SCRAPE_EMAILS',
      username: auth.username,
      url,
      emailCount: emails.length,
    });
    await env.SECRETS_KV.put(auditLogKey, JSON.stringify(logs));

    return jsonResponse({
      success: true,
      url,
      emailCount: emails.length,
      emails,
      scrapedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(`স্ক্র্যাপিং ত্রুটি: ${error.message}`, 500);
  }
}

/**
 * POST /api/scrape/phones
 * Body: { url }
 */
async function handleScrapePhones(request, env) {
  const auth = await validateAuthToken(request);
  if (!auth.valid) {
    return errorResponse('অপ্রমাণিত', 401);
  }

  const body = await request.json().catch(() => ({}));
  let { url } = body;

  if (!url) {
    return errorResponse('URL প্রয়োজন', 400);
  }

  if (!url.startsWith('http')) url = 'https://' + url;

  try {
    const response = await fetchWithRetry(url);
    if (!response) {
      return errorResponse('ওয়েবসাইট অ্যাক্সেস করতে ব্যর্থ', 503);
    }

    const html = await response.text();
    const phones = extractPhoneNumbers(html);

    // Audit log
    const auditLogKey = `audit_log_${new Date().toISOString().split('T')[0]}`;
    const auditLogs = await env.SECRETS_KV.get(auditLogKey);
    const logs = auditLogs ? JSON.parse(auditLogs) : [];
    logs.push({
      timestamp: new Date().toISOString(),
      action: 'SCRAPE_PHONES',
      username: auth.username,
      url,
      phoneCount: phones.length,
    });
    await env.SECRETS_KV.put(auditLogKey, JSON.stringify(logs));

    return jsonResponse({
      success: true,
      url,
      phoneCount: phones.length,
      phones,
      scrapedAt: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(`স্ক্র্যাপিং ত্রুটি: ${error.message}`, 500);
  }
}

// ============================================================
//  BREVO EMAIL SENDING
// ============================================================

/**
 * Brevo API-এর মাধ্যমে ইমেইল পাঠানো
 */
async function sendEmailViaBrevo(recipientEmail, subject, htmlContent, apiKey) {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        to: [{ email: recipientEmail }],
        sender: { email: 'noreply@yourdomain.com', name: 'Email Extractor Pro' },
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Brevo API error' };
    }

    return { success: true, messageId: (await response.json()).messageId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * POST /api/email/send
 * Body: { recipients, subject, htmlContent }
 */
async function handleSendEmails(request, env) {
  const auth = await validateAuthToken(request);
  if (!auth.valid) {
    return errorResponse('অপ্রমাণিত', 401);
  }

  const body = await request.json().catch(() => ({}));
  const { recipients, subject, htmlContent } = body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return errorResponse('বৈধ recipients array প্রয়োজন', 400);
  }

  if (!subject || !htmlContent) {
    return errorResponse('Subject এবং htmlContent প্রয়োজন', 400);
  }

  // Brevo API key get করা
  const brevoData = await getApiKey(env, 'brevo');
  if (!brevoData) {
    return errorResponse('Brevo API key কনফিগার করা নেই', 400);
  }

  const results = [];
  for (const email of recipients) {
    const result = await sendEmailViaBrevo(email, subject, htmlContent, brevoData.key);
    results.push({
      email,
      success: result.success,
      messageId: result.success ? result.messageId : null,
      error: !result.success ? result.error : null,
    });
  }

  // Usage tracking
  const successCount = results.filter(r => r.success).length;
  await trackApiUsage(env, 'brevo', successCount);

  // Audit log
  const auditLogKey = `audit_log_${new Date().toISOString().split('T')[0]}`;
  const auditLogs = await env.SECRETS_KV.get(auditLogKey);
  const logs = auditLogs ? JSON.parse(auditLogs) : [];
  logs.push({
    timestamp: new Date().toISOString(),
    action: 'SEND_EMAILS',
    username: auth.username,
    recipientCount: recipients.length,
    successCount,
  });
  await env.SECRETS_KV.put(auditLogKey, JSON.stringify(logs));

  return jsonResponse({
    success: true,
    sent: successCount,
    failed: recipients.length - successCount,
    results,
  });
}

// ============================================================
//  WEBHOOK: Email Delivery Tracking
// ============================================================

/**
 * POST /api/webhook/brevo
 * Brevo থেকে webhook events পাওয়ার জন্য
 */
async function handleBrevoWebhook(request, env) {
  try {
    const event = await request.json();

    // Audit log (webhook events)
    const auditLogKey = `webhook_log_${new Date().toISOString().split('T')[0]}`;
    const webhookLogs = await env.SECRETS_KV.get(auditLogKey);
    const logs = webhookLogs ? JSON.parse(webhookLogs) : [];
    logs.push({
      timestamp: new Date().toISOString(),
      eventType: event.event,
      email: event.email,
      messageId: event.messageId,
    });
    await env.SECRETS_KV.put(auditLogKey, JSON.stringify(logs));

    // Handler বিভিন্ন event-এর জন্য
    if (event.event === 'bounced') {
      // Bounced email: mark as inactive in D1
      console.log(`Email bounced: ${event.email}`);
      // TODO: D1 update কোড এখানে আসবে
    } else if (event.event === 'unsubscribed') {
      // Unsubscribed: mark as inactive
      console.log(`Email unsubscribed: ${event.email}`);
      // TODO: D1 update কোড এখানে আসবে
    } else if (event.event === 'delivered') {
      // Delivered: update status
      console.log(`Email delivered: ${event.email}`);
      // TODO: D1 update কোড এখানে আসবে
    }

    return jsonResponse({ success: true, message: 'Webhook processed' });
  } catch (error) {
    return errorResponse(`Webhook error: ${error.message}`, 500);
  }
}

// ============================================================
//  AUDIT LOG ENDPOINTS
// ============================================================

/**
 * GET /api/audit-logs?date=2024-01-15
 */
async function handleGetAuditLogs(request, env) {
  const auth = await validateAuthToken(request);
  if (!auth.valid) {
    return errorResponse('অপ্রমাণিত', 401);
  }

  const url = new URL(request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const auditLogKey = `audit_log_${date}`;
  const data = await env.SECRETS_KV.get(auditLogKey);
  const logs = data ? JSON.parse(data) : [];

  return jsonResponse({
    success: true,
    date,
    totalEvents: logs.length,
    events: logs.slice(-100), // সর্বশেষ 100টি ইভেন্ট
  });
}

// ============================================================
//  MAIN ROUTER
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route matching
    try {
      if (path === '/api/auth/login' && method === 'POST') {
        const response = await handleLogin(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      if (path === '/api/auth/logout' && method === 'POST') {
        const response = await handleLogout(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      if (path === '/api/auth/verify' && method === 'GET') {
        const response = await handleVerifyToken(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      if (path === '/api/api-keys/save' && method === 'POST') {
        const response = await handleSaveApiKey(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      if (path === '/api/api-keys/stats' && method === 'GET') {
        const response = await handleGetApiStats(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      if (path === '/api/scrape/emails' && method === 'POST') {
        const response = await handleScrapeEmails(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      if (path === '/api/scrape/phones' && method === 'POST') {
        const response = await handleScrapePhones(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      if (path === '/api/email/send' && method === 'POST') {
        const response = await handleSendEmails(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      if (path === '/api/webhook/brevo' && method === 'POST') {
        const response = await handleBrevoWebhook(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      if (path === '/api/audit-logs' && method === 'GET') {
        const response = await handleGetAuditLogs(request, env);
        response.headers.set('Access-Control-Allow-Origin', '*');
        return response;
      }

      // 404 - Route not found
      return errorResponse('এই route টি পাওয়া যায়নি', 404);
    } catch (error) {
      console.error('API Error:', error);
      return errorResponse(`সার্ভার ত্রুটি: ${error.message}`, 500);
    }
  },
};
