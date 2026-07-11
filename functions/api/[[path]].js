// functions/api/[[path]].js
// ============================================================
//  Email & SMS Marketing Pro - Cloudflare Pages API Router (Secure Version)
//  Handles authentication, API keys, dashboard, audit logs, contacts, and settings.
// ============================================================

import { KVMANAGER } from '../helpers/kv-manager.js';
import { validateEmail, validatePhone, validateUrl } from '../helpers/validators.js';
import { AuditLogger } from '../helpers/audit-logger.js';
import { RateLimiter } from '../helpers/rate-limiter.js';

// ============================================================
// 🛡️ NATIVE WEB CRYPTO JWT HELPERS (নতুন সিকিউরিটি ইঞ্জিন)
// ============================================================
function bufferToBase64Url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBuffer(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function generateJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encoder = new TextEncoder();
  const encodedHeader = bufferToBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = bufferToBase64Url(encoder.encode(JSON.stringify(payload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(dataToSign));
  const encodedSignature = bufferToBase64Url(signature);
  return `${dataToSign}.${encodedSignature}`;
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'Malformed token structure' };
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    
    const signatureBuffer = base64UrlToBuffer(encodedSignature);
    const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBuffer, encoder.encode(dataToSign));
    
    if (!isValid) return { valid: false, error: 'Cryptographic signature verification failed.' };
    
    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(base64UrlToBuffer(encodedPayload)));
    
    if (payload.exp && (Date.now() / 1000) > payload.exp) {
      return { valid: false, error: 'Token has expired.' };
    }
    return { valid: true, username: payload.username };
  } catch (err) {
    return { valid: false, error: 'Invalid Token.' };
  }
}

// ============================================================
// 🚀 MAIN ROUTER HANDLER
// ============================================================
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const kv = new KVMANAGER(env.SECRETS_KV || null);
  const auditLogger = new AuditLogger(kv);
  const rateLimiter = new RateLimiter(kv);

  const ADMIN_USERNAME = env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'admin123';
  const JWT_SECRET = env.JWT_SECRET || 'LocalDevelopmentSecretKey123!@#';

  async function requireAuth(req) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, error: 'Missing authentication token' };
    }
    const token = authHeader.slice(7);
    return await verifyJWT(token, JWT_SECRET);
  }

  try {
    // ==================== 1. AUTHENTICATION ====================
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { username, password } = body;
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      
      const allowed = await rateLimiter.check(`login:${clientIp}`, 5, 15 * 60);
      if (!allowed) return jsonResponse({ success: false, error: 'Too many login attempts.' }, 429);
      
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const expireTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 Hours
        const token = await generateJWT({ username, exp: expireTime }, JWT_SECRET);
        await auditLogger.log('LOGIN_SUCCESS', { username, ip: clientIp });
        return jsonResponse({ success: true, token, username, message: 'Login successful' });
      } else {
        await auditLogger.log('LOGIN_FAILED', { username, ip: clientIp });
        return jsonResponse({ success: false, error: 'Invalid username or password' }, 401);
      }
    }

    if (path === '/api/auth/logout' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);
      await auditLogger.log('LOGOUT', { username: auth.username });
      return jsonResponse({ success: true, message: 'Logout successful' });
    }

    if (path === '/api/auth/verify' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);
      return jsonResponse({ success: true, username: auth.username, message: 'Token valid' });
    }

    // ==================== 2. API KEY MANAGEMENT ====================
    if (path === '/api/api-keys/stats' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);
      const apiName = url.searchParams.get('apiName') || 'brevo';
      const limits = { brevo: 300, sms: 100, abstract: 250, call: 100 };
      const limit = limits[apiName] || 100;
      const today = new Date().toISOString().split('T')[0];
      const used = parseInt(await kv.get(`api:usage:${apiName}:${today}`) || '0', 10);
      return jsonResponse({
        success: true, data: { apiName, limit, used, remaining: Math.max(0, limit - used), date: today },
      });
    }

    if (path === '/api/api-keys/save' && method === 'POST') {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);
      const body = await request.json().catch(() => ({}));
      const { apiName, apiKey, provider, baseUrl, defaultSender } = body;
      
      const config = { key: apiKey, updatedAt: new Date().toISOString() };
      if (provider) config.provider = provider;
      if (baseUrl) config.baseUrl = baseUrl;
      if (defaultSender) config.defaultSender = defaultSender;
      
      await kv.put(`api:key:${apiName}`, JSON.stringify(config));
      await auditLogger.log('API_KEY_UPDATED', { username: auth.username, apiName });
      return jsonResponse({ success: true, message: `${apiName} API configuration saved` });
    }

    if (path === '/api/api-keys/list' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);
      const apiNames = ['brevo', 'sms', 'abstract', 'call', 'text', 'website', 'location'];
      const result = {};
      for (const name of apiNames) {
        const data = await kv.get(`api:key:${name}`);
        if (data) result[name] = JSON.parse(data);
      }
      return jsonResponse({ success: true, data: result });
    }

    // ==================== 3. AUDIT LOGS ====================
    if (path === '/api/audit-logs' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const logs = await auditLogger.getLogsForDate(date, limit);
      return jsonResponse({ success: true, date, totalEvents: logs.length, events: logs });
    }

    // ==================== 4. CONTACTS ====================
    if (path.startsWith('/api/contacts/')) {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);
      
      if (path === '/api/contacts/list' && method === 'GET') {
        const type = url.searchParams.get('type') || 'emails';
        let list = await kv.getList(`contacts:${type}`) || [];
        return jsonResponse({ success: true, type, total: list.length, contacts: list.slice(0, 100) });
      }
      // Export & Import logic could go here similar to the old file
    }

    // ==================== 5. DASHBOARD ====================
    if (path === '/api/dashboard/stats' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);
      
      const today = new Date().toISOString().split('T')[0];
      const logs = await auditLogger.getLogsForDate(today);
      const brevoUsage = parseInt(await kv.get(`api:usage:brevo:${today}`) || '0', 10);
      const brevoLimit = 300;

      return jsonResponse({
        success: true,
        stats: {
          emailsToday: logs.filter(l => l.action === 'SCRAPE_EMAILS').reduce((s, l) => s + (l.details?.count || 0), 0),
          emailsSentToday: logs.filter(l => l.action === 'SEND_EMAILS').reduce((s, l) => s + (l.details?.successCount || 0), 0),
          smsSentToday: logs.filter(l => l.action === 'SEND_SMS').reduce((s, l) => s + (l.details?.successCount || 0), 0),
          brevoRemaining: Math.max(0, brevoLimit - brevoUsage),
          brevoLimit,
          totalContacts: 0 // Fetch from KV in full implementation
        },
      });
    }

    if (path === '/api/dashboard/charts' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);
      // Dummy data for charts to prevent 404
      return jsonResponse({ success: true, data: [] });
    }

    // ==================== 6. HEALTH CHECK ====================
    if (path === '/api/health/status' && method === 'GET') {
      return jsonResponse({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
    }

    // ==================== 7. SETTINGS ====================
    if (path === '/api/settings' && method === 'GET') {
      const auth = await requireAuth(request);
      if (!auth.valid) return jsonResponse({ success: false, error: auth.error }, 401);

      return jsonResponse({
        success: true,
        settings: {
          adminUsername: ADMIN_USERNAME,
          brevoConfigured: !!(await kv.get('api:key:brevo')),
          smsConfigured: !!(await kv.get('api:key:sms')),
          abstractConfigured: !!(await kv.get('api:key:abstract')),
          callConfigured: !!(await kv.get('api:key:call')),
          textConfigured: !!(await kv.get('api:key:text')),
          websiteConfigured: !!(await kv.get('api:key:website')),
          locationConfigured: !!(await kv.get('api:key:location')),
        }
      });
    }

    // 404 Fallback
    return jsonResponse({ success: false, error: 'Endpoint not found' }, 404);

  } catch (error) {
    console.error('[API ERROR]', error);
    return jsonResponse({ success: false, error: `Server error: ${error.message}` }, 500);
  }
}
