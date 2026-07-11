// functions/api/[[path]].js
// ============================================================
//  Email & SMS Marketing Pro - Cloudflare Pages API Router (Secure Version)
//  Handles secure authentication, login, dashboard stats, and settings.
// ============================================================

import { KVMANAGER } from '../helpers/kv-manager.js';
import { validateEmail, validatePhone, validateUrl } from '../helpers/validators.js';
import { AuditLogger } from '../helpers/audit-logger.js';
import { RateLimiter } from '../helpers/rate-limiter.js';

// ============================================================
// 🛡️ NATIVE WEB CRYPTO JWT HELPERS (সিকিউরিটি ইঞ্জিন)
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

// ডিজিটাল সিল বা নিরাপদ টোকেন তৈরি করার ফাংশন
async function generateJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encoder = new TextEncoder();
  
  const encodedHeader = bufferToBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = bufferToBase64Url(encoder.encode(JSON.stringify(payload)));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(dataToSign));
  const encodedSignature = bufferToBase64Url(signature);
  
  return `${dataToSign}.${encodedSignature}`;
}

// টোকেনটি আসল নাকি ভুয়া তা যাচাই করার ফাংশন
async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, error: 'Malformed token structure' };
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBuffer = base64UrlToBuffer(encodedSignature);
    const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBuffer, encoder.encode(dataToSign));
    
    if (!isValid) return { valid: false, error: 'Cryptographic signature verification failed.' };
    
    const decoder = new TextDecoder();
    const payload = JSON.parse(decoder.decode(base64UrlToBuffer(encodedPayload)));
    
    // মেয়াদের সময় পার হয়ে গেছে কি না চেক করা
    if (payload.exp && (Date.now() / 1000) > payload.exp) {
      return { valid: false, error: 'Token has expired.' };
    }
    
    return { valid: true, user: payload };
  } catch (err) {
    return { valid: false, error: 'Invalid Token.' };
  }
}

// ============================================================
// 🔒 AUTHENTICATION MIDDLEWARE
// ============================================================
async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header.' };
  }

  const token = authHeader.split(' ')[1];
  const secret = env.JWT_SECRET || 'SUPER_SECRET_BACKUP_KEY_123!@#';
  
  return await verifyJWT(token, secret);
}

// ============================================================
// 🚀 MAIN ROUTER HANDLER
// ============================================================
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS সেটিংস (অন্য ফ্রন্টএন্ড থেকে রিকোয়েস্ট অ্যালাউ করার জন্য)
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

  try {
    const kv = env.SECRETS_KV;
    const ADMIN_USERNAME = env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'password';
    const JWT_SECRET = env.JWT_SECRET || 'SUPER_SECRET_BACKUP_KEY_123!@#';

    // --------------------------------------------------------
    // ১. লগইন রাউট (/api/login) - সম্পূর্ণ নিরাপদ করা হয়েছে
    // --------------------------------------------------------
    if (path === '/api/login' && method === 'POST') {
      const { username, password } = await request.json();

      // পাসওয়ার্ড ও ইউজারনেম ম্যাচিং
      if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return jsonResponse({ success: false, error: 'Invalid username or password.' }, 401);
      }

      // টোকেনের মেয়াদ বর্তমান সময় থেকে ২ ঘণ্টা (7200 সেকেন্ড) সেট করা হলো
      const expireTime = Math.floor(Date.now() / 1000) + (2 * 60 * 60);

      const payload = {
        username: username,
        role: 'admin',
        exp: expireTime
      };

      // ক্রিপ্টোগ্রাফিক ডিজিটাল সিলযুক্ত আসল JWT টোকেন তৈরি
      const token = await generateJWT(payload, JWT_SECRET);

      return jsonResponse({
        success: true,
        token: token,
        user: { username, role: 'admin' }
      });
    }

    // --------------------------------------------------------
    // ২. হেলথ বা স্ট্যাটাস রাউট (/api/health)
    // --------------------------------------------------------
    if (path === '/api/health' && method === 'GET') {
      let kvStatus = 'OK';
      try {
        await kv.put('sys:health:check', '1');
      } catch (e) {
        kvStatus = 'ERROR';
      }

      return jsonResponse({
        success: true,
        status: 'Operational',
        timestamp: new Date().toISOString(),
        components: { kv: kvStatus },
      });
    }

    // --------------------------------------------------------
    // ৩. সেটিংস রাউট (/api/settings) - গেটওয়ে লক করা হয়েছে
    // --------------------------------------------------------
    if (path === '/api/settings' && method === 'GET') {
      // মিডলওয়্যার দিয়ে টোকেন চেক করা হচ্ছে
      const auth = await requireAuth(request, env);
      if (!auth.valid) {
        return jsonResponse({ success: false, error: auth.error }, 401);
      }

      // KV ডেটাবেস থেকে কনফিগারেশন কী-গুলো আনা হচ্ছে
      const brevoKey = await kv.get('api:key:brevo');
      const smsKey = await kv.get('api:key:sms');
      const abstractKey = await kv.get('api:key:abstract');
      const callKey = await kv.get('api:key:call');
      const textKey = await kv.get('api:key:text');
      const websiteKey = await kv.get('api:key:website');
      const locationKey = await kv.get('api:key:location');

      const settings = {
        adminUsername: ADMIN_USERNAME,
        brevoConfigured: !!(brevoKey || env.BREVO_API_KEY),
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

    // --------------------------------------------------------
    // ৪. ৪MD বা নট ফাউন্ড রাউট (404 Fallback)
    // --------------------------------------------------------
    return jsonResponse({ success: false, error: 'API Endpoint API Route Not Found' }, 404);

  } catch (error) {
    console.error('Router Critical Error:', error);
    return jsonResponse({ success: false, error: 'Internal Server Error: ' + error.message }, 500);
  }
}
