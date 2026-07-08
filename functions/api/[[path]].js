// functions/api/[[path]].js
// ============================================================
//  Email Extractor Pro - Cloudflare Pages API Router
//  With in-memory fallback when KV is not available.
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
  // If SECRETS_KV is not bound, use an in-memory store (for local dev)
  const kv = new KVMANAGER(env.SECRETS_KV || null);

  const auditLogger = new AuditLogger(kv);
  const rateLimiter = new RateLimiter(kv);

  // Environment variables
  const ADMIN_USERNAME = env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'admin123';
  const BREVO_API_KEY = env.BREVO_API_KEY || '';

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
    if (path === '/api/api-keys/stats' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const apiName = url.searchParams.get('apiName') || 'brevo';
      const limits = { abstract: 250, brevo: 300 };
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

    if (path === '/api/api-keys/save' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const body = await request.json().catch(() => ({}));
      const { apiName, apiKey } = body;
      if (!apiName || !apiKey) {
        return jsonResponse(
          { success: false, error: 'apiName and apiKey are required' },
          400
        );
      }
      const key = `api:key:${apiName}`;
      await kv.put(key, JSON.stringify({ key: apiKey, updatedAt: new Date().toISOString() }));
      await auditLogger.log('API_KEY_UPDATED', { username: auth.username, apiName });
      return jsonResponse({
        success: true,
        message: `${apiName} API key saved`,
      });
    }

    if (path === '/api/api-keys/list' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const apiNames = ['abstract', 'brevo'];
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

      // Cache Logic: Check if we already scraped this URL recently
      const cacheKey = `cache:scrape:${type}:${url}`;
      if (!force) {
        const cachedData = await kv.getJSON(cacheKey);
        if (cachedData) {
          // If cached, just return it without fetching again
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

      // Improved Fetch with better Headers to prevent blocking
      const fetchWithRetry = async (retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
              },
              // Adding timeout to prevent infinite spinning
              signal: AbortSignal.timeout(10000) 
            });
            
            if (response.status === 403) throw new Error(`Access Denied (403). The site might be blocking scrapers.`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
          } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, 1000 * (i + 1))); // wait before retry
          }
        }
      };

      try {
        const html = await fetchWithRetry();
        let results = [];

        if (type === 'emails') {
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const matches = html.match(emailRegex) || [];
          results = [...new Set(matches.map(e => e.toLowerCase()))];
        } else {
          const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
          const matches = html.match(phoneRegex) || [];
          results = [...new Set(
            matches.map(p => p.trim().replace(/[^\d+]/g, '')).filter(p => p.length >= 10)
          )];
        }

        // Apply Logic: Slice the array to respect the user's limit
        results = results.slice(0, parseInt(limit, 10));

        // Save to KV Storage
        await kv.pushToList(`contacts:${type}`, results);
        
        // Save to Cache for 24 hours (86400 seconds) so we don't scrape again soon
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

    if (path === '/api/scrape/phones' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const body = await request.json().catch(() => ({}));
      let { url } = body;
      if (!url) {
        return jsonResponse({ success: false, error: 'URL required' }, 400);
      }
      url = validateUrl(url);
      if (!url) {
        return jsonResponse({ success: false, error: 'Invalid URL' }, 400);
      }

      const fetchWithRetry = async (retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              timeout: 10000,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
          } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          }
        }
      };

      try {
        const html = await fetchWithRetry();
        const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
        const matches = html.match(phoneRegex) || [];
        const phones = [...new Set(
          matches.map(p => p.trim().replace(/[^\d+]/g, '')).filter(p => p.length >= 10)
        )];

        await kv.pushToList('contacts:phones', phones);
        await auditLogger.log('SCRAPE_PHONES', {
          username: auth.username,
          url,
          count: phones.length,
        });

        return jsonResponse({
          success: true,
          url,
          phoneCount: phones.length,
          phones,
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

    // ---------- CAMPAIGN ----------
    if (path === '/api/campaigns/send' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      const body = await request.json().catch(() => ({}));
      const { subject, htmlContent, recipientFilter } = body;
      if (!subject || !htmlContent || !recipientFilter) {
        return jsonResponse(
          { success: false, error: 'Subject, HTML content, and recipient filter required' },
          400
        );
      }

      let recipients = [];
      const allEmails = await kv.getList('contacts:emails') || [];
      if (recipientFilter === 'all') {
        recipients = allEmails;
      } else if (recipientFilter === 'b2b') {
        recipients = allEmails.filter(e => e.endsWith('.com'));
      } else if (recipientFilter === 'b2c') {
        recipients = allEmails.filter(e => !e.endsWith('.com'));
      } else if (recipientFilter === 'verified') {
        recipients = allEmails.slice(0, Math.floor(allEmails.length / 2));
      } else {
        return jsonResponse({ success: false, error: 'Invalid recipient filter' }, 400);
      }

      if (recipients.length === 0) {
        return jsonResponse(
          { success: false, error: 'No recipients found for the selected filter' },
          400
        );
      }

      const brevoKey = await kv.get('api:key:brevo').then(d => d ? JSON.parse(d).key : null);
      if (!brevoKey && !BREVO_API_KEY) {
        return jsonResponse(
          { success: false, error: 'Brevo API key not configured' },
          400
        );
      }
      const apiKey = brevoKey || BREVO_API_KEY;

      // Simulate sending
      const results = recipients.map(email => ({
        email,
        success: Math.random() > 0.1,
        messageId: `msg_${Math.random().toString(36).substr(2, 9)}`,
      }));
      const successCount = results.filter(r => r.success).length;

      await auditLogger.log('SEND_EMAILS', {
        username: auth.username,
        subject,
        recipientFilter,
        total: recipients.length,
        successCount,
      });

      const today = new Date().toISOString().split('T')[0];
      const usageKey = `api:usage:brevo:${today}`;
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
        list = list.filter(item => item.includes(search));
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
      const validItems = data.filter(item => {
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
      const scrapeLogs = await auditLogger.getLogsForDate(today);
      const todayEmails = scrapeLogs
        .filter(l => l.action === 'SCRAPE_EMAILS')
        .reduce((sum, l) => sum + (l.details?.count || 0), 0);
      const sendLogs = scrapeLogs.filter(l => l.action === 'SEND_EMAILS');
      const todaySent = sendLogs.reduce((sum, l) => sum + (l.details?.successCount || 0), 0);
      const brevoUsage = await kv.get(`api:usage:brevo:${today}`) || '0';
      const brevoLimit = 300;
      const remaining = Math.max(0, brevoLimit - parseInt(brevoUsage, 10));
      const emails = await kv.getList('contacts:emails') || [];
      const phones = await kv.getList('contacts:phones') || [];
      const totalContacts = emails.length + phones.length;

      return jsonResponse({
        success: true,
        stats: {
          emailsToday: todayEmails,
          emailsSentToday: todaySent,
          brevoRemaining: remaining,
          totalContacts,
        },
      });
    }

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
        const extracted = logs.filter(l => l.action === 'SCRAPE_EMAILS')
          .reduce((sum, l) => sum + (l.details?.count || 0), 0);
        const sent = logs.filter(l => l.action === 'SEND_EMAILS')
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
      const abstractKey = await kv.get('api:key:abstract');
      const settings = {
        adminUsername: ADMIN_USERNAME,
        brevoConfigured: !!(brevoKey || BREVO_API_KEY),
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
