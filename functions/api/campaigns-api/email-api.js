// functions/api/campaigns-api/email-api.js
// ============================================================
//  Email Campaign API
//  Sends emails via configured provider (Brevo, SendGrid, Mailgun, SMTP)
//  Uses API keys stored in KV.
// ============================================================

import { KVMANAGER } from '../../helpers/kv-manager.js';

/**
 * POST handler for email campaign.
 * Expects JSON: { contacts: [], subject, htmlContent, sender, provider, filter }
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
  const { contacts, subject, htmlContent, sender, provider = 'default', filter = 'all' } = body;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return jsonResponse({ success: false, error: 'Contacts array required' }, 400, corsHeaders);
  }
  if (!subject) {
    return jsonResponse({ success: false, error: 'Subject required' }, 400, corsHeaders);
  }
  if (!htmlContent) {
    return jsonResponse({ success: false, error: 'HTML content required' }, 400, corsHeaders);
  }
  if (!sender || !sender.includes('@')) {
    return jsonResponse({ success: false, error: 'Valid sender email required' }, 400, corsHeaders);
  }

  // Initialize KV
  const kv = new KVMANAGER(env.SECRETS_KV || null);

  // Retrieve email API configuration
  const emailConfig = await kv.getJSON('api:key:brevo');
  let apiKey = emailConfig?.key || env.BREVO_API_KEY || null;
  if (!apiKey) {
    return jsonResponse({ success: false, error: 'Email API not configured. Please set up in API Settings.' }, 400, corsHeaders);
  }

  const providerType = provider === 'default' ? 'brevo' : provider; // fallback to brevo

  // Process contacts in batches with throttling
  const batchSize = 50;
  const delay = 1000; // ms between batches
  const results = [];
  let successCount = 0;

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const batchPromises = batch.map(async (email) => {
      try {
        let response;
        if (providerType === 'brevo') {
          // Brevo (Sendinblue) API
          response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'api-key': apiKey,
            },
            body: JSON.stringify({
              sender: { name: sender.split('@')[0] || 'Marketing', email: sender },
              to: [{ email }],
              subject: subject,
              htmlContent: htmlContent,
            }),
          });
        } else if (providerType === 'sendgrid') {
          // SendGrid API
          response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              personalizations: [{ to: [{ email }] }],
              from: { email: sender },
              subject: subject,
              content: [{ type: 'text/html', value: htmlContent }],
            }),
          });
        } else if (providerType === 'mailgun') {
          // Mailgun API (requires domain and api key)
          const domain = env.MAILGUN_DOMAIN || 'sandbox.mailgun.org';
          const mailgunKey = env.MAILGUN_API_KEY || apiKey;
          const form = new URLSearchParams();
          form.append('from', sender);
          form.append('to', email);
          form.append('subject', subject);
          form.append('html', htmlContent);
          response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`api:${mailgunKey}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form,
          });
        } else if (providerType === 'smtp') {
          // SMTP via a third-party API (e.g., using a SMTP relay service)
          // For demo, we'll simulate SMTP
          const smtpUrl = env.SMTP_API_URL || 'https://api.smtp2go.com/v3/email/send';
          const smtpKey = env.SMTP_API_KEY || apiKey;
          response = await fetch(smtpUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Smtp2go-Api-Key': smtpKey,
            },
            body: JSON.stringify({
              to: [email],
              sender: sender,
              subject: subject,
              html_body: htmlContent,
            }),
          });
        } else {
          // Default: simulate (for testing)
          await new Promise(r => setTimeout(r, 50));
          return {
            email,
            success: true,
            messageId: 'sim_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            timestamp: new Date().toISOString(),
          };
        }

        const data = await response.json();
        if (response.ok) {
          return {
            email,
            success: true,
            messageId: data.messageId || data.id || 'ok',
            timestamp: new Date().toISOString(),
          };
        } else {
          throw new Error(data.message || data.error || 'Provider error');
        }
      } catch (err) {
        return {
          email,
          success: false,
          error: err.message,
          status: 'failed',
          timestamp: new Date().toISOString(),
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Update progress (optional)
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
  const usageKey = `api:usage:brevo:${today}`;
  const currentUsage = parseInt(await kv.get(usageKey) || '0', 10);
  await kv.put(usageKey, String(currentUsage + contacts.length));

  // Log audit
  // const auditLogger = new AuditLogger(kv);
  // await auditLogger.log('SEND_EMAILS', {
  //   username: payload.username,
  //   total: contacts.length,
  //   successCount,
  //   subject,
  //   filter,
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
