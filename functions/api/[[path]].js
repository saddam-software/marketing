// functions/api/[[path]].js
// ============================================================
//  Email Extractor Pro - Cloudflare Pages API Router
//  All endpoints, authentication, KV storage, rate limiting,
//  audit logging, and external API integrations.
// ============================================================

import { KVMANAGER } from '../helpers/kv-manager.js';
import { validateEmail, validatePhone, validateUrl, sanitizeInput } from '../helpers/validators.js';
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

  // CORS headers (allow all for demo)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Helper for JSON responses
  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Initialize helpers
  const kv = new KVMANAGER(env.SECRETS_KV);
  const auditLogger = new AuditLogger(kv);
  const rateLimiter = new RateLimiter(kv);

  // Environment variables
  const ADMIN_USERNAME = env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'admin123';
  const BREVO_API_KEY = env.BREVO_API_KEY || '';

  // ==================== AUTHENTICATION ====================

  // Generate JWT-like token (simple base64 payload)
  function generateToken(username) {
    const payload = {
      username,
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24h
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

  // Middleware to check authentication
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

  // ==================== ROUTE HANDLERS ====================

  try {
    // ---------- AUTH ----------
    // POST /api/auth/login
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { username, password } = body;

      // Rate limit by IP
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      const rateKey = `login:${clientIp}`;
      const allowed = await rateLimiter.check(rateKey, 5, 15 * 60); // 5 attempts per 15 min
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

      // Verify credentials
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateToken(username);
        // Log successful login
        await auditLogger.log('LOGIN_SUCCESS', { username, ip: clientIp });

        return jsonResponse({
          success: true,
          token,
          username,
          message: 'Login successful',
        });
      } else {
        // Log failed attempt
        await auditLogger.log('LOGIN_FAILED', { username, ip: clientIp });
        return jsonResponse(
          { success: false, error: 'Invalid username or password' },
          401
        );
      }
    }

    // POST /api/auth/logout
    if (path === '/api/auth/logout' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }
      await auditLogger.log('LOGOUT', { username: auth.username });
      return jsonResponse({ success: true, message: 'Logout successful' });
    }

    // GET /api/auth/verify
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
    // GET /api/api-keys/stats?apiName=abstract|brevo
    if (path === '/api/api-keys/stats' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }

      const apiName = url.searchParams.get('apiName') || 'brevo';
      const limits = { abstract: 250, brevo: 300 };
      const limit = limits[apiName] || 100;

      // Get today's usage
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

    // POST /api/api-keys/save
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

      // Store API key in KV
      const key = `api:key:${apiName}`;
      await kv.put(key, JSON.stringify({ key: apiKey, updatedAt: new Date().toISOString() }));

      await auditLogger.log('API_KEY_UPDATED', { username: auth.username, apiName });

      return jsonResponse({
        success: true,
        message: `${apiName} API key saved`,
      });
    }

    // GET /api/api-keys/list (optional, for management)
    if (path === '/api/api-keys/list' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }

      // We can list keys by prefix, but KV doesn't support listing easily without a list.
      // We'll return the known API names with their update timestamp if present.
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
    // POST /api/scrape/emails
    if (path === '/api/scrape/emails' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }

      const body = await request.json().catch(() => ({}));
      let { url } = body;
      if (!url) {
        return jsonResponse({ success: false, error: 'URL required' }, 400);
      }

      // Validate and sanitize URL
      url = validateUrl(url);
      if (!url) {
        return jsonResponse({ success: false, error: 'Invalid URL' }, 400);
      }

      // Scrape with retry
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
            await new Promise(r => setTimeout(r, 1000 * (i + 1))); // exponential backoff
          }
        }
      };

      try {
        const html = await fetchWithRetry();
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = html.match(emailRegex) || [];
        const emails = [...new Set(matches.map(e => e.toLowerCase()))];

        // Save to contacts
        await kv.pushToList('contacts:emails', emails);

        // Log
        await auditLogger.log('SCRAPE_EMAILS', {
          username: auth.username,
          url,
          count: emails.length,
        });

        return jsonResponse({
          success: true,
          url,
          emailCount: emails.length,
          emails,
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

    // POST /api/scrape/phones
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

    // ---------- EMAIL CAMPAIGN (via Brevo) ----------
    // POST /api/campaigns/send
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

      // Get recipients from contacts based on filter
      let recipients = [];
      const allEmails = await kv.getList('contacts:emails') || [];
      if (recipientFilter === 'all') {
        recipients = allEmails;
      } else if (recipientFilter === 'b2b') {
        // Mock: assume emails ending with .com are B2B
        recipients = allEmails.filter(e => e.endsWith('.com'));
      } else if (recipientFilter === 'b2c') {
        recipients = allEmails.filter(e => !e.endsWith('.com'));
      } else if (recipientFilter === 'verified') {
        // Mock: assume first 50% are verified
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

      // Check Brevo API key
      const brevoKey = await kv.get('api:key:brevo').then(d => d ? JSON.parse(d).key : null);
      if (!brevoKey && !BREVO_API_KEY) {
        return jsonResponse(
          { success: false, error: 'Brevo API key not configured' },
          400
        );
      }
      const apiKey = brevoKey || BREVO_API_KEY;

      // Simulate sending (in production, call Brevo API)
      // For demo, we'll simulate success/failure randomly
      const results = recipients.map(email => ({
        email,
        success: Math.random() > 0.1,
        messageId: `msg_${Math.random().toString(36).substr(2, 9)}`,
      }));

      const successCount = results.filter(r => r.success).length;

      // Log campaign
      await auditLogger.log('SEND_EMAILS', {
        username: auth.username,
        subject,
        recipientFilter,
        total: recipients.length,
        successCount,
      });

      // Update usage
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
    // GET /api/audit-logs?date=YYYY-MM-DD&limit=50
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

    // ---------- CONTACTS MANAGEMENT ----------
    // GET /api/contacts/list?type=emails|phones&search=
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
      // Return limited list for performance
      const paginated = list.slice(0, 100);
      return jsonResponse({
        success: true,
        type,
        total: list.length,
        contacts: paginated,
      });
    }

    // POST /api/contacts/import - import from JSON array
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

      // Validate each item
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

    // POST /api/contacts/export - export as JSON
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

    // ---------- DASHBOARD STATS ----------
    // GET /api/dashboard/stats
    if (path === '/api/dashboard/stats' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }

      const today = new Date().toISOString().split('T')[0];

      // Get today's extracted emails (from scrape logs)
      const scrapeLogs = await auditLogger.getLogsForDate(today);
      const todayEmails = scrapeLogs
        .filter(l => l.action === 'SCRAPE_EMAILS')
        .reduce((sum, l) => sum + (l.details?.count || 0), 0);

      // Today's sent emails
      const sendLogs = scrapeLogs.filter(l => l.action === 'SEND_EMAILS');
      const todaySent = sendLogs.reduce((sum, l) => sum + (l.details?.successCount || 0), 0);

      // Brevo remaining
      const brevoUsage = await kv.get(`api:usage:brevo:${today}`) || '0';
      const brevoLimit = 300;
      const remaining = Math.max(0, brevoLimit - parseInt(brevoUsage, 10));

      // Total contacts
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

    // GET /api/dashboard/charts - mock data
    if (path === '/api/dashboard/charts' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }

      // Generate mock chart data for last 7 days
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

    // ---------- SYSTEM HEALTH ----------
    // GET /api/health/status
    if (path === '/api/health/status' && method === 'GET') {
      // Check KV connectivity
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
        components: {
          kv: kvStatus,
          // Could add more checks (Brevo API, etc.)
        },
      });
    }

    // ---------- SETTINGS (placeholder) ----------
    // GET /api/settings
    if (path === '/api/settings' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }

      // Return current settings (from env/KV)
      const settings = {
        adminUsername: ADMIN_USERNAME,
        brevoConfigured: !!(await kv.get('api:key:brevo') || BREVO_API_KEY),
        abstractConfigured: !!(await kv.get('api:key:abstract')),
        rateLimitLogin: '5 per 15 minutes',
        retentionDays: 90,
      };
      return jsonResponse({ success: true, settings });
    }

    // POST /api/settings/backup - placeholder
    if (path === '/api/settings/backup' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }

      // In a real scenario, we'd backup all KV data to a file or external storage.
      return jsonResponse({
        success: true,
        message: 'Backup initiated (placeholder)',
        timestamp: new Date().toISOString(),
      });
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
