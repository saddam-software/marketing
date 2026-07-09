// functions/api/finder-api/text-secret.js
// ============================================================
//  Bulk Text Extractor API
//  Receives text (or file content) and extracts emails & phones
//  using advanced regex. Returns JSON with arrays.
// ============================================================

/**
 * POST handler for text extraction.
 * Expects JSON: { text: "..." } or multipart/form-data with file field.
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authentication (reuse from main project)
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

  // Determine content type
  const contentType = request.headers.get('Content-Type') || '';
  let text = '';

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    text = body.text || '';
  } else if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (file && file instanceof File) {
      text = await file.text();
    } else {
      return jsonResponse({ success: false, error: 'No file uploaded' }, 400, corsHeaders);
    }
  } else {
    return jsonResponse({ success: false, error: 'Unsupported content type' }, 400, corsHeaders);
  }

  if (!text || text.length === 0) {
    return jsonResponse({ success: false, error: 'No text content provided' }, 400, corsHeaders);
  }

  // ========== ADVANCED REGEX ENGINE ==========
  // Email: standard + obfuscated (name [at] domain [dot] com)
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const obfuscatedEmailRegex = /([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)\s*\[dot\]\s*([a-zA-Z]{2,})/gi;

  // Phone: international format with country codes, spaces, dashes, parentheses
  const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;

  let emails = [];
  let phones = [];

  // Extract standard emails
  const standardEmails = text.match(emailRegex) || [];
  emails = standardEmails.map(e => e.toLowerCase());

  // Extract obfuscated emails and convert
  let obfuscatedMatches;
  while ((obfuscatedMatches = obfuscatedEmailRegex.exec(text)) !== null) {
    const full = obfuscatedMatches[0];
    const local = obfuscatedMatches[1];
    const domain = obfuscatedMatches[2];
    const tld = obfuscatedMatches[3];
    const clean = `${local}@${domain}.${tld}`.toLowerCase();
    emails.push(clean);
  }

  // Extract phones
  const rawPhones = text.match(phoneRegex) || [];
  phones = rawPhones.map(p => p.trim().replace(/[^\d+]/g, '')).filter(p => p.length >= 10);

  // Remove duplicates
  emails = [...new Set(emails)];
  phones = [...new Set(phones)];

  // ========== LOGGING (optional) ==========
  // You can log to audit logger if available
  // const auditLogger = new AuditLogger(new KVMANAGER(env.SECRETS_KV));
  // await auditLogger.log('TEXT_EXTRACT', { username: payload.username, emailCount: emails.length, phoneCount: phones.length });

  return jsonResponse({
    success: true,
    emails,
    phones,
    total: emails.length + phones.length,
  }, 200, corsHeaders);
}

// Helper to send JSON response
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
  });
}
