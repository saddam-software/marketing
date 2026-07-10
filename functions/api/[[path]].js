// functions/api/[[path]].js
// ============================================================
//  Email & SMS Marketing Pro - Cloudflare Pages API Router
//  Handles authentication, API key management, dashboard stats,
//  audit logs, contacts, health, and settings.
//  NOTE: Scraping and Campaign sending are now handled by
//  dedicated API files in /finder-api/ and /campaigns-api/
// ============================================================

import { KVMANAGER } from '../helpers/kv-manager.js';
import { validateEmail, validatePhone, validateUrl } from '../helpers/validators.js';
import { AuditLogger } from '../helpers/audit-logger.js';
import { RateLimiter } from '../helpers/rate-limiter.js';

/**
 * Main request handler for all API routes.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ---------- Initialize KV with fallback ----------
  const kv = new KVMANAGER(env.SECRETS_KV || null);
  const auditLogger = new AuditLogger(kv);
  const rateLimiter = new RateLimiter(kv);

  // Environment variables
  const ADMIN_USERNAME = env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'admin123';
  const BREVO_API_KEY = env.BREVO_API_KEY || ''; // fallback for email

  // ==================== AUTHENTICATION HELPERS ====================

  function generateToken(username) {
    const payload = {
      username,
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };
    return btoa(JSON.stringify(payload));
  }

  function verifyToken(token) {
    try {
      const payload = JSON.parse(atob(token));
      if (payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  function getAuthToken(req) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
  }

  async function requireAuth(req) {
    const token = getAuthToken(req);
    if (!token) {
      return { valid: false, error: 'Missing authentication token' };
    }
    const payload = verifyToken(token);
    if (!payload) {
      return { valid: false, error: 'Invalid or expired token' };
    }
    return { valid: true, username: payload.username };
  }

  try {
    // ==================== AUTHENTICATION ====================

    if (path === '/api/auth/login' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { username, password } = body;
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rateKey = `login:${clientIp}`;
      const allowed = await rateLimiter.check(rateKey, 5, 15 * 60);
      if (!allowed) {
        return jsonResponse(
          { success: false, error: 'Too many login attempts. Try again later.' },
          429
        );
      }
      if (!username || !password) {
        return jsonResponse(
          { success: false, error: 'Username and password required' },
          400
        );
      }
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateToken(username);
        await auditLogger.log('LOGIN_SUCCESS', { username, ip: clientIp });
        return jsonResponse({
          success: true,
          token,
          username,
          message: 'Login successful',
        });
      } else {
        await auditLogger.log('LOGIN_FAILED', { username, ip: clientIp });
        return jsonResponse(
          { success: false, error: 'Invalid username or password' },
          401
        );
      }
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      await auditLogger.log('LOGOUT', { username: auth.username });
      return jsonResponse({ success: true, message: 'Logout successful' });
    }

    if (path === '/api/auth/verify' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      return jsonResponse({
        success: true,
        username: auth.username,
        message: 'Token valid',
      });
    }

    // ==================== API KEY MANAGEMENT ====================

    // GET stats for a specific API (email/brevo or sms)
    if (path === '/api/api-keys/stats' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const apiName = url.searchParams.get('apiName') || 'brevo';
      const limits = {
        brevo: 300,
        sms: 100,
        abstract: 250,
      };
      const limit = limits[apiName] || 100;
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `api:usage:${apiName}:${today}`;
      const used = parseInt(await kv.get(usageKey) || '0', 10);
      return jsonResponse({
        success: true,
        data: {
          apiName,
          limit,
          used,
          remaining: Math.max(0, limit - used),
          date: today,
        },
      });
    }

    // Save API key (for email or sms)
    if (path === '/api/api-keys/save' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const body = await request.json().catch(() => ({}));
      const { apiName, apiKey, provider, baseUrl, defaultSender } = body;
      if (!apiName || !apiKey) {
        return jsonResponse(
          { success: false, error: 'apiName and apiKey are required' },
          400
        );
      }
 // 🔄 পরিবর্তন করে যা বসাবেন (নতুন সব API-এর এক্সট্রা সেটিংসের জন্য):
const key = `api:key:${apiName}`;
const config = { key: apiKey, updatedAt: new Date().toISOString() };

// যদি রিকোয়েস্টে অন্য কোনো এক্সট্রা সেটিংস (যেমন Base URL বা Sender ID) পাঠানো হয়, তাও সেভ হবে
if (provider) config.provider = provider;
if (baseUrl) config.baseUrl = baseUrl;
if (defaultSender) config.defaultSender = defaultSender;

await kv.put(key, JSON.stringify(config));



      
      await auditLogger.log('API_KEY_UPDATED', {
        username: auth.username,
        apiName,
        provider: provider || 'default',
      });
      return jsonResponse({
        success: true,
        message: `${apiName} API configuration saved`,
      });
    }

    // List API keys (optional)
    if (path === '/api/api-keys/list' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const apiNames = ['brevo', 'sms', 'abstract'];
      const result = {};
      for (const name of apiNames) {
        const data = await kv.get(`api:key:${name}`);
        if (data) {
          result[name] = JSON.parse(data);
        }
      }
      return jsonResponse({ success: true, data: result });
    }

    // ==================== AUDIT LOGS ====================

    if (path === '/api/audit-logs' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const logs = await auditLogger.getLogsForDate(date, limit);
      return jsonResponse({
        success: true,
        date,
        totalEvents: logs.length,
        events: logs,
      });
    }

    // ==================== CONTACTS ====================

    if (path === '/api/contacts/list' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const type = url.searchParams.get('type') || 'emails';
      const search = url.searchParams.get('search') || '';
      let list = await kv.getList(`contacts:${type}`) || [];
      if (search) {
        list = list.filter((item) => item.includes(search));
      }
      const paginated = list.slice(0, 100);
      return jsonResponse({
        success: true,
        type,
        total: list.length,
        contacts: paginated,
      });
    }

    if (path === '/api/contacts/import' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const body = await request.json().catch(() => ({}));
      const { type, data } = body;
      if (!type || !Array.isArray(data) || data.length === 0) {
        return jsonResponse(
          { success: false, error: 'type and non-empty data array required' },
          400
        );
      }
      const validItems = data.filter((item) => {
        if (type === 'emails') return validateEmail(item);
        if (type === 'phones') return validatePhone(item);
        return false;
      });
      if (validItems.length === 0) {
        return jsonResponse(
          { success: false, error: 'No valid items found to import' },
          400
        );
      }
      await kv.pushToList(`contacts:${type}`, validItems);
      await auditLogger.log('CONTACTS_IMPORT', {
        username: auth.username,
        type,
        count: validItems.length,
      });
      return jsonResponse({
        success: true,
        imported: validItems.length,
        type,
      });
    }

    if (path === '/api/contacts/export' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const body = await request.json().catch(() => ({}));
      const { type } = body;
      if (!type) {
        return jsonResponse({ success: false, error: 'type required' }, 400);
      }
      const list = await kv.getList(`contacts:${type}`) || [];
      return jsonResponse({
        success: true,
        type,
        data: list,
      });
    }

    // ==================== DASHBOARD ====================

    if (path === '/api/dashboard/stats' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const today = new Date().toISOString().split('T')[0];
      const logs = await auditLogger.getLogsForDate(today);

      // Emails extracted today (from old scraper logs, but keep for backward compatibility)
      const todayEmails = logs
        .filter((l) => l.action === 'SCRAPE_EMAILS')
        .reduce((sum, l) => sum + (l.details?.count || 0), 0);

      // Emails sent today
      const emailSendLogs = logs.filter((l) => l.action === 'SEND_EMAILS');
      const todaySent = emailSendLogs.reduce((sum, l) => sum + (l.details?.successCount || 0), 0);

      // SMS sent today
      const smsSendLogs = logs.filter((l) => l.action === 'SEND_SMS');
      const todaySms = smsSendLogs.reduce((sum, l) => sum + (l.details?.successCount || 0), 0);

      // Brevo remaining
      const brevoUsage = await kv.get(`api:usage:brevo:${today}`) || '0';
      const brevoLimit = 300;
      const brevoRemaining = Math.max(0, brevoLimit - parseInt(brevoUsage, 10));

      // Total contacts
      const emails = await kv.getList('contacts:emails') || [];
      const phones = await kv.getList('contacts:phones') || [];
      const totalContacts = emails.length + phones.length;

      return jsonResponse({
        success: true,
        stats: {
          emailsToday: todayEmails,
          emailsSentToday: todaySent,
          smsSentToday: todaySms,
          brevoRemaining,
          brevoLimit,
          totalContacts,
        },
      });
    }

    // Charts (7-day activity)
    if (path === '/api/dashboard/charts' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const logs = await auditLogger.getLogsForDate(dateStr);
        const extracted = logs.filter((l) => l.action === 'SCRAPE_EMAILS')
          .reduce((sum, l) => sum + (l.details?.count || 0), 0);
        const sent = logs.filter((l) => l.action === 'SEND_EMAILS')
          .reduce((sum, l) => sum + (l.details?.successCount || 0), 0);
        chartData.push({ date: dateStr, extracted, sent });
      }
      return jsonResponse({
        success: true,
        data: chartData,
      });
    }

    // ==================== HEALTH CHECK ====================

    if (path === '/api/health/status' && method === 'GET') {
      let kvStatus = 'ok';
      try {
        await kv.get('health:test');
      } catch {
        kvStatus = 'error';
      }
      return jsonResponse({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: { kv: kvStatus },
      });
    }

    // ==================== SETTINGS ====================

    if (path === '/api/settings' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }


      
    // 🔄 পরিবর্তন করে যা বসাবেন (নতুন ৪টি API-এর স্ট্যাটাসসহ):
const brevoKey = await kv.get('api:key:brevo');
const smsKey = await kv.get('api:key:sms');
const abstractKey = await kv.get('api:key:abstract');
const callKey = await kv.get('api:key:call');
const textKey = await kv.get('api:key:text');
const websiteKey = await kv.get('api:key:website');
const locationKey = await kv.get('api:key:location');

const settings = {
  adminUsername: ADMIN_USERNAME,
  brevoConfigured: !!(brevoKey || BREVO_API_KEY),
  smsConfigured: !!smsKey,
  abstractConfigured: !!abstractKey,
  callConfigured: !!callKey,
  textConfigured: !!textKey,
  websiteConfigured: !!websiteKey,
  locationConfigured: !!locationKey,
  rateLimitLogin: '5 per 15 minutes',
  retentionDays: 90,
};


      
      return jsonResponse({ success: true, settings });
    }

    // ==================== 404 ====================
    return jsonResponse({ success: false, error: 'Endpoint not found' }, 404);

  } catch (error) {
    console.error('[API ERROR]', error);
    return jsonResponse(
      { success: false, error: `Server error: ${error.message}` },
      500
    );
  }
}
