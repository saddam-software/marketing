// functions/api/[[path]].js
// ============================================================
//  Email Extractor Pro - Cloudflare Pages Functions
//  Single entry point for all API routes
// ============================================================

export async function onRequest(context) {
  const request = context.request;
  const env = context.env;
  
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

  // Helper function for JSON response
  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get environment variables
  const ADMIN_USERNAME = env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'admin123';
  const BREVO_API_KEY = env.BREVO_API_KEY || '';

  // Helper: Token generation
  function generateToken(username) {
    const payload = {
      username,
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000,
    };
    return btoa(JSON.stringify(payload));
  }

  // Helper: Token verification
  function verifyToken(token) {
    try {
      const payload = JSON.parse(atob(token));
      if (payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  // Helper: Get auth token from request
  function getAuthToken(req) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
  }

  try {
    // ========== LOGIN ENDPOINT ==========
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await request.json();
      const { username, password } = body;

      console.log(`[AUTH] Login attempt: ${username}`);

      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        const token = generateToken(username);
        console.log(`[AUTH] Login successful: ${username}`);

        return jsonResponse({
          success: true,
          token,
          username,
          message: 'লগইন সফল',
        });
      } else {
        console.log(`[AUTH] Login failed: ${username}`);
        return jsonResponse(
          { success: false, error: 'ভুল username অথবা password' },
          401
        );
      }
    }

    // ========== LOGOUT ENDPOINT ==========
    if (path === '/api/auth/logout' && method === 'POST') {
      return jsonResponse({ success: true, message: 'লগআউট সফল' });
    }

    // ========== VERIFY TOKEN ENDPOINT ==========
    if (path === '/api/auth/verify' && method === 'GET') {
      const token = getAuthToken(request);
      if (!token) {
        return jsonResponse(
          { success: false, error: 'Token নেই' },
          401
        );
      }

      const payload = verifyToken(token);
      if (!payload) {
        return jsonResponse(
          { success: false, error: 'Token invalid বা expired' },
          401
        );
      }

      return jsonResponse({
        success: true,
        username: payload.username,
        message: 'টোকেন বৈধ',
      });
    }

    // ========== API STATS ENDPOINT ==========
    if (path === '/api/api-keys/stats' && method === 'GET') {
      const token = getAuthToken(request);
      if (!token) {
        return jsonResponse(
          { success: false, error: 'অপ্রমাণিত' },
          401
        );
      }

      const apiName = url.searchParams.get('apiName') || 'brevo';

      const limits = {
        abstract: 250,
        brevo: 300,
      };

      const limit = limits[apiName] || 100;

      return jsonResponse({
        success: true,
        data: {
          apiName,
          limit,
          used: 0,
          remaining: limit,
          date: new Date().toISOString().split('T')[0],
        },
      });
    }

    // ========== SAVE API KEY ENDPOINT ==========
    if (path === '/api/api-keys/save' && method === 'POST') {
      const token = getAuthToken(request);
      if (!token) {
        return jsonResponse(
          { success: false, error: 'অপ্রমাণিত' },
          401
        );
      }

      const body = await request.json();
      const { apiName, apiKey } = body;

      if (!apiName || !apiKey) {
        return jsonResponse(
          { success: false, error: 'apiName এবং apiKey প্রয়োজন' },
          400
        );
      }

      console.log(`[API] Saved ${apiName} API key`);

      // TODO: সংরক্ষণ করুন KV-তে
      if (env.SECRETS_KV) {
        const kvKey = `api_${apiName}`;
        await env.SECRETS_KV.put(
          kvKey,
          JSON.stringify({
            key: apiKey,
            updatedAt: new Date().toISOString(),
          })
        );
      }

      return jsonResponse({
        success: true,
        message: `${apiName} API key updated`,
      });
    }

    // ========== SCRAPE EMAILS ENDPOINT ==========
    if (path === '/api/scrape/emails' && method === 'POST') {
      const token = getAuthToken(request);
      if (!token) {
        return jsonResponse(
          { success: false, error: 'অপ্রমাণিত' },
          401
        );
      }

      const body = await request.json();
      let { url } = body;

      if (!url) {
        return jsonResponse(
          { success: false, error: 'URL প্রয়োজন' },
          400
        );
      }

      if (!url.startsWith('http')) url = 'https://' + url;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!response.ok) {
          return jsonResponse(
            { success: false, error: 'ওয়েবসাইট অ্যাক্সেস করতে ব্যর্থ' },
            503
          );
        }

        const html = await response.text();
        const emailRegex =
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = html.match(emailRegex) || [];
        const emails = [...new Set(matches.map((e) => e.toLowerCase()))];

        console.log(`[SCRAPE] Extracted ${emails.length} emails from ${url}`);

        return jsonResponse({
          success: true,
          url,
          emailCount: emails.length,
          emails,
          scrapedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[SCRAPE ERROR]', error);
        return jsonResponse(
          { success: false, error: `স্ক্র্যাপিং ত্রুটি: ${error.message}` },
          500
        );
      }
    }

    // ========== SCRAPE PHONES ENDPOINT ==========
    if (path === '/api/scrape/phones' && method === 'POST') {
      const token = getAuthToken(request);
      if (!token) {
        return jsonResponse(
          { success: false, error: 'অপ্রমাণিত' },
          401
        );
      }

      const body = await request.json();
      let { url } = body;

      if (!url) {
        return jsonResponse(
          { success: false, error: 'URL প্রয়োজন' },
          400
        );
      }

      if (!url.startsWith('http')) url = 'https://' + url;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!response.ok) {
          return jsonResponse(
            { success: false, error: 'ওয়েবসাইট অ্যাক্সেস করতে ব্যর্থ' },
            503
          );
        }

        const html = await response.text();
        const phoneRegex =
          /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
        const matches = html.match(phoneRegex) || [];
        const phones = [
          ...new Set(
            matches
              .map((p) => p.trim().replace(/[^\d+]/g, ''))
              .filter((p) => p.length >= 10)
          ),
        ];

        console.log(`[SCRAPE] Extracted ${phones.length} phones from ${url}`);

        return jsonResponse({
          success: true,
          url,
          phoneCount: phones.length,
          phones,
          scrapedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[SCRAPE ERROR]', error);
        return jsonResponse(
          { success: false, error: `স্ক্র্যাপিং ত্রুটি: ${error.message}` },
          500
        );
      }
    }

    // ========== AUDIT LOGS ENDPOINT ==========
    if (path === '/api/audit-logs' && method === 'GET') {
      const token = getAuthToken(request);
      if (!token) {
        return jsonResponse(
          { success: false, error: 'অপ্রমাণিত' },
          401
        );
      }

      const date = url.searchParams.get('date') || new Date()
        .toISOString()
        .split('T')[0];

      // TODO: KV থেকে logs পড়ুন
      const logs = [];

      return jsonResponse({
        success: true,
        date,
        totalEvents: logs.length,
        events: logs,
      });
    }

    // ========== 404 - NOT FOUND ==========
    return jsonResponse(
      { success: false, error: 'এই route টি পাওয়া যায়নি' },
      404
    );
  } catch (error) {
    console.error('[API ERROR]', error);
    return jsonResponse(
      { success: false, error: `সার্ভার ত্রুটি: ${error.message}` },
      500
    );
  }
}
