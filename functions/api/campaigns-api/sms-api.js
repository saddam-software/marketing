// functions/api/campaigns-api/sms-api.js
// ============================================================
//  SMS Campaign API
//  Sends SMS messages via configured provider (Twilio, Vonage, etc.)
//  Uses API keys stored in KV.
// ============================================================

import { KVMANAGER } from '../../helpers/kv-manager.js';

/**
 * POST handler for SMS campaign.
 * Expects JSON: { contacts: [], message, sender, provider }
 */
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

  // Authentication
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
  if (!token) {
    return jsonResponse({ success: false, error: 'Missing authentication token' }, 401, corsHeaders);
  }
  const payload = verifyToken(token);
  if (!payload) {
    return jsonResponse({ success: false, error: 'Invalid or expired token' }, 401, corsHeaders);
  }

  // Parse request body
  const body = await request.json().catch(() => ({}));
  const { contacts, message, sender, provider = 'default' } = body;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return jsonResponse({ success: false, error: 'Contacts array required' }, 400, corsHeaders);
  }
  if (!message) {
    return jsonResponse({ success: false, error: 'Message required' }, 400, corsHeaders);
  }
  // Validate sender ID (alphanumeric, max 11)
  if (sender && !/^[a-zA-Z0-9]{1,11}$/.test(sender)) {
    return jsonResponse({ success: false, error: 'Sender ID must be alphanumeric, max 11 chars' }, 400, corsHeaders);
  }

  // Initialize KV
  const kv = new KVMANAGER(env.SECRETS_KV || null);

  // Retrieve SMS API configuration
  const smsConfig = await kv.getJSON('api:key:sms');
  if (!smsConfig || !smsConfig.key) {
    return jsonResponse({ success: false, error: 'SMS API not configured. Please set up in API Settings.' }, 400, corsHeaders);
  }

  const apiKey = smsConfig.key;
  const providerType = provider === 'default' ? smsConfig.provider || 'twilio' : provider;
  const baseUrl = smsConfig.baseUrl || '';
  const defaultSender = smsConfig.defaultSender || 'Marketing';

  // Choose which provider to use
  const results = [];
  let successCount = 0;

  // Process contacts in batches with throttling
  const batchSize = 10;
  const delay = 500; // ms between batches

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const batchPromises = batch.map(async (phone) => {
      try {
        let response;
        if (providerType === 'twilio') {
          // Example Twilio integration
          // Note: In production, you'd use Twilio's Node library, but here we use fetch.
          // You need to set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in env.
          const accountSid = env.TWILIO_ACCOUNT_SID;
          const authToken = env.TWILIO_AUTH_TOKEN;
          if (!accountSid || !authToken) {
            throw new Error('Twilio credentials not set in environment');
          }
          const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
          const form = new URLSearchParams();
          form.append('To', phone);
          form.append('From', sender || defaultSender);
          form.append('Body', message);
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            },
            body: form,
          });
        } else if (providerType === 'vonage') {
          // Vonage (Nexmo) example
          const apiKeyVonage = env.VONAGE_API_KEY || apiKey; // fallback
          const apiSecret = env.VONAGE_API_SECRET;
          if (!apiKeyVonage || !apiSecret) {
            throw new Error('Vonage credentials not set');
          }
          const url = 'https://api.nexmo.com/v0.1/messages';
          const payload = {
            from: { type: 'sms', number: sender || defaultSender },
            to: { type: 'sms', number: phone },
            message: { content: { type: 'text', text: message } },
          };
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + btoa(`${apiKeyVonage}:${apiSecret}`),
            },
            body: JSON.stringify(payload),
          });
        } else if (providerType === 'africastalking') {
          // Africa's Talking example
          const apiKeyAfrica = env.AFRICA_TALKING_API_KEY || apiKey;
          const username = env.AFRICA_TALKING_USERNAME || 'sandbox';
          if (!apiKeyAfrica) {
            throw new Error('Africa\'s Talking API key not set');
          }
          const url = 'https://api.africastalking.com/version1/messaging';
          const form = new URLSearchParams();
          form.append('username', username);
          form.append('to', phone);
          form.append('from', sender || defaultSender);
          form.append('message', message);
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'apiKey': apiKeyAfrica,
            },
            body: form,
          });
        } else if (providerType === 'custom') {
          // Custom HTTP provider
          if (!baseUrl) {
            throw new Error('Custom provider requires base URL');
          }
          const payload = {
            to: phone,
            from: sender || defaultSender,
            text: message,
          };
          response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          });
        } else {
          // Default: simulate (for testing)
          // In production, you'd fallback to a default provider
          await new Promise(r => setTimeout(r, 100));
          return {
            phone,
            success: true,
            messageId: 'sim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            timestamp: new Date().toISOString(),
          };
        }

        // Process response
        const data = await response.json();
        if (response.ok) {
          return {
            phone,
            success: true,
            messageId: data.sid || data.messageId || 'ok',
            timestamp: new Date().toISOString(),
          };
        } else {
          throw new Error(data.message || data.error || 'Provider error');
        }
      } catch (err) {
        return {
          phone,
          success: false,
          error: err.message,
          timestamp: new Date().toISOString(),
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Update progress
    const progress = Math.round(((i + batch.length) / contacts.length) * 100);

    // Throttle between batches
    if (i + batchSize < contacts.length) {
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Tally success
  successCount = results.filter(r => r.success).length;

  // Update usage statistics
  const today = new Date().toISOString().split('T')[0];
  const usageKey = `api:usage:sms:${today}`;
  const currentUsage = parseInt(await kv.get(usageKey) || '0', 10);
  await kv.put(usageKey, String(currentUsage + contacts.length));

  // Log audit
  // const auditLogger = new AuditLogger(kv);
  // await auditLogger.log('SEND_SMS', {
  //   username: payload.username,
  //   total: contacts.length,
  //   successCount,
  //   sender: sender || defaultSender,
  // });

  return jsonResponse({
    success: true,
    total: contacts.length,
    successCount,
    results,
  }, 200, corsHeaders);
}

// Helper
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}
