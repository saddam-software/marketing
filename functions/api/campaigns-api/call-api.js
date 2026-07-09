// functions/api/campaigns-api/call-api.js
// ============================================================
//  Voice Call Campaign API
//  Initiates automated voice calls using Twilio or custom HTTP
//  Supports script-to-speech or uploaded audio files.
// ============================================================

/**
 * POST handler for voice call campaign.
 * Accepts multipart/form-data with:
 * - contacts: JSON array of phone numbers
 * - script: text for TTS
 * - audio: audio file (optional)
 * - callerId: caller ID number
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

  // Parse form data
  const formData = await request.formData();
  const contactsRaw = formData.get('contacts');
  const script = formData.get('script') || '';
  const audioFile = formData.get('audio'); // File object or null
  const callerId = formData.get('callerId') || '';

  if (!contactsRaw) {
    return jsonResponse({ success: false, error: 'Contacts list required' }, 400, corsHeaders);
  }

  let contacts;
  try {
    contacts = JSON.parse(contactsRaw);
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new Error('Invalid contacts array');
    }
  } catch {
    return jsonResponse({ success: false, error: 'Invalid contacts format' }, 400, corsHeaders);
  }

  // Validate caller ID (simple E.164 check)
  if (!callerId || !/^\+?[1-9]\d{9,14}$/.test(callerId.replace(/\s/g, ''))) {
    return jsonResponse({ success: false, error: 'Invalid caller ID format (use E.164)' }, 400, corsHeaders);
  }

  // Prepare audio if uploaded
  let audioUrl = null;
  if (audioFile && audioFile instanceof File) {
    // In production, you'd upload to R2 or a public bucket
    // For demo, we'll just note that audio was uploaded
    audioUrl = `audio_${Date.now()}_${audioFile.name}`;
    // In real implementation, store the file and return a URL
    // For now, we'll simulate using script even if audio is provided
  }

  // ========== SIMULATED CALL LOGIC (for demo) ==========
  // In production, integrate with Twilio Voice API:
  // const twilio = require('twilio');
  // const client = twilio(accountSid, authToken);
  // For each contact: client.calls.create({ ... })

  const results = [];
  let successCount = 0;

  for (let i = 0; i < contacts.length; i++) {
    const phone = contacts[i].trim();
    if (!phone || phone.length < 10) continue;

    // Simulate call with random delay and status
    const delay = 200 + Math.random() * 300;
    await new Promise(r => setTimeout(r, delay));

    const statuses = ['completed', 'completed', 'failed', 'busy', 'no-answer'];
    // Weighted: 60% completed, 20% failed, 10% busy, 10% no-answer
    const rand = Math.random();
    let status;
    if (rand < 0.6) status = 'completed';
    else if (rand < 0.8) status = 'failed';
    else if (rand < 0.9) status = 'busy';
    else status = 'no-answer';

    const duration = status === 'completed' ? Math.floor(10 + Math.random() * 40) : 0;

    results.push({
      phone,
      status,
      duration,
      timestamp: new Date().toISOString(),
    });

    if (status === 'completed') successCount++;
  }

  // ========== Log to audit ==========
  // const auditLogger = new AuditLogger(new KVMANAGER(env.SECRETS_KV));
  // await auditLogger.log('CALL_CAMPAIGN', {
  //   username: payload.username,
  //   total: contacts.length,
  //   successCount,
  //   scriptLength: script.length,
  //   audioUsed: !!audioUrl,
  // });

  // ========== Update daily usage ==========
  // You can track API usage similarly to email/sms

  return jsonResponse({
    success: true,
    total: contacts.length,
    successCount,
    results,
    audioUrl,
    scriptUsed: script || (audioUrl ? 'audio file' : 'none'),
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
