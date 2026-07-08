// functions/api/[[path]].js
// ============================================================
//  Email & SMS Marketing Pro - Cloudflare Pages API Router
//  Handles authentication, scraping, email & SMS campaigns,
//  API key management (Email + SMS), dashboard stats, and audit logs.
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

  // ==================== AUTHENTICATION ====================

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
    // ---------- AUTH ----------
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

    // ---------- API KEY MANAGEMENT ----------
    // GET stats for a specific API (email/brevo or sms)
    if (path === '/api/api-keys/stats' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const apiName = url.searchParams.get('apiName') || 'brevo';
      const limits = {
        brevo: 300,
        sms: 100, // default SMS daily limit, can be overridden by config
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
      const key = `api:key:${apiName}`;
      const config = { key: apiKey, updatedAt: new Date().toISOString() };
      if (apiName === 'sms') {
        // Additional SMS config
        config.provider = provider || 'custom';
        config.baseUrl = baseUrl || '';
        config.defaultSender = defaultSender || '';
      }
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

    // ---------- SCRAPING ----------
    if ((path === '/api/scrape/emails' || path === '/api/scrape/phones') && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }

      const body = await request.json().catch(() => ({}));
      let { url, limit = 50, force = false } = body;
      const type = path.includes('emails') ? 'emails' : 'phones';

      if (!url) {
        return jsonResponse({ success: false, error: 'URL required' }, 400);
      }
      url = validateUrl(url);
      if (!url) {
        return jsonResponse({ success: false, error: 'Invalid URL' }, 400);
      }

      const cacheKey = `cache:scrape:${type}:${url}`;
      if (!force) {
        const cachedData = await kv.getJSON(cacheKey);
        if (cachedData) {
          return jsonResponse({
            success: true,
            url,
            [`${type === 'emails' ? 'email' : 'phone'}Count`]: cachedData.length,
            [type]: cachedData,
            cached: true,
            scrapedAt: new Date().toISOString(),
          });
        }
      }

      const fetchWithRetry = async (retries = 2) => {
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
            if (response.status === 403) throw new Error(`Access Denied (403). The site might be blocking scrapers.`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
          } catch (err) {
            if (i === retries) throw err;
            await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
          }
        }
      };

      try {
        const html = await fetchWithRetry();
        let results = [];

        if (type === 'emails') {
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const matches = html.match(emailRegex) || [];
          results = [...new Set(matches.map((e) => e.toLowerCase()))];
        } else {
          const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
          const matches = html.match(phoneRegex) || [];
          results = [...new Set(
            matches.map((p) => p.trim().replace(/[^\d+]/g, '')).filter((p) => p.length >= 10)
          )];
        }

        results = results.slice(0, parseInt(limit, 10));

        await kv.pushToList(`contacts:${type}`, results);
        if (results.length > 0) {
          await kv.putJSON(cacheKey, results, { expirationTtl: 86400 });
        }

        await auditLogger.log(`SCRAPE_${type.toUpperCase()}`, {
          username: auth.username,
          url,
          count: results.length,
        });

        return jsonResponse({
          success: true,
          url,
          [`${type === 'emails' ? 'email' : 'phone'}Count`]: results.length,
          [type]: results,
          cached: false,
          scrapedAt: new Date().toISOString(),
        });
      } catch (error) {
        await auditLogger.log('SCRAPE_ERROR', {
          username: auth.username,
          url,
          error: error.message,
        });
        return jsonResponse(
          { success: false, error: `Scraping failed: ${error.message}` },
          500
        );
      }
    }

    // ---------- CAMPAIGN SEND (Email & SMS) ----------
    if (path === '/api/campaigns/send' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const body = await request.json().catch(() => ({}));
      const { type, recipientFilter, subject, htmlContent, message, sender } = body;

      if (!recipientFilter) {
        return jsonResponse(
          { success: false, error: 'Recipient filter is required' },
          400
        );
      }

      // Determine which contacts to use
      let recipients = [];
      const allEmails = await kv.getList('contacts:emails') || [];
      const allPhones = await kv.getList('contacts:phones') || [];

      // For email campaigns, use emails; for SMS, use phones
      const contactList = type === 'sms' ? allPhones : allEmails;
      if (recipientFilter === 'all') {
        recipients = contactList;
      } else if (recipientFilter === 'b2b') {
        recipients = contactList.filter((c) => c.endsWith('.com'));
      } else if (recipientFilter === 'b2c') {
        recipients = contactList.filter((c) => !c.endsWith('.com'));
      } else if (recipientFilter === 'verified') {
        recipients = contactList.slice(0, Math.floor(contactList.length / 2));
      } else {
        return jsonResponse(
          { success: false, error: 'Invalid recipient filter' },
          400
        );
      }

      if (recipients.length === 0) {
        return jsonResponse(
          { success: false, error: 'No recipients found for the selected filter' },
          400
        );
      }

      // Validate campaign data
      if (type === 'email') {
        if (!subject || !htmlContent) {
          return jsonResponse(
            { success: false, error: 'Subject and HTML content required for email' },
            400
          );
        }
      } else if (type === 'sms') {
        if (!message) {
          return jsonResponse(
            { success: false, error: 'Message content required for SMS' },
            400
          );
        }
      } else {
        return jsonResponse(
          { success: false, error: 'Invalid campaign type. Use "email" or "sms"' },
          400
        );
      }

      // Retrieve API keys
      const apiKeyData = await kv.getJSON(`api:key:${type === 'email' ? 'brevo' : 'sms'}`);
      let apiKey = apiKeyData?.key || (type === 'email' ? BREVO_API_KEY : null);
      if (!apiKey) {
        return jsonResponse(
          { success: false, error: `${type} API key not configured` },
          400
        );
      }

      // For SMS, we might need additional config
      let smsConfig = {};
      if (type === 'sms') {
        smsConfig = {
          provider: apiKeyData?.provider || 'custom',
          baseUrl: apiKeyData?.baseUrl || '',
          defaultSender: apiKeyData?.defaultSender || sender || 'Marketing',
        };
      }

      // Simulate sending (in production, integrate with actual API)
      const results = recipients.map((contact) => {
        const success = Math.random() > 0.1; // 90% success rate
        return {
          [type === 'email' ? 'email' : 'phone']: contact,
          success,
          messageId: success ? `msg_${Math.random().toString(36).substr(2, 9)}` : null,
          error: success ? null : 'Simulated failure',
        };
      });

      const successCount = results.filter((r) => r.success).length;

      // Log the campaign
      const action = type === 'email' ? 'SEND_EMAILS' : 'SEND_SMS';
      await auditLogger.log(action, {
        username: auth.username,
        subject: subject || 'SMS Campaign',
        recipientFilter,
        total: recipients.length,
        successCount,
      });

      // Update usage stats
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `api:usage:${type === 'email' ? 'brevo' : 'sms'}:${today}`;
      const currentUsage = parseInt(await kv.get(usageKey) || '0', 10);
      await kv.put(usageKey, String(currentUsage + recipients.length));

      return jsonResponse({
        success: true,
        total: recipients.length,
        successCount,
        results,
        sentAt: new Date().toISOString(),
      });
    }

    // ---------- AUDIT LOGS ----------
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

    // ---------- CONTACTS ----------
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

    // ---------- DASHBOARD ----------
    if (path === '/api/dashboard/stats' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const today = new Date().toISOString().split('T')[0];
      const logs = await auditLogger.getLogsForDate(today);

      // Emails extracted today
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

    // ---------- HEALTH ----------
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

    // ---------- SETTINGS ----------
    if (path === '/api/settings' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const brevoKey = await kv.get('api:key:brevo');
      const smsKey = await kv.get('api:key:sms');
      const abstractKey = await kv.get('api:key:abstract');
      const settings = {
        adminUsername: ADMIN_USERNAME,
        brevoConfigured: !!(brevoKey || BREVO_API_KEY),
        smsConfigured: !!smsKey,
        abstractConfigured: !!abstractKey,
        rateLimitLogin: '5 per 15 minutes',
        retentionDays: 90,
      };
      return jsonResponse({ success: true, settings });
    }

    // ---------- 404 ----------
    return jsonResponse({ success: false, error: 'Endpoint not found' }, 404);
  } catch (error) {
    console.error('[API ERROR]', error);
    return jsonResponse(
      { success: false, error: `Server error: ${error.message}` },
      500
    );
  }
}
