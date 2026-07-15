import { KVMANAGER } from '../../../helpers/kv-manager.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  // ১. Auth Token ভেরিফিকেশন
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { apiName, provider, apiKey } = body;

    if (!apiName || !apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400 });
    }

    const kv = new KVMANAGER(env.SECRETS_KV || null);

    // ২. KV ডাটাবেসে API Config সেভ করা
    const configKey = `api_config:${apiName}`;
    await kv.putJSON(configKey, {
      provider: provider,
      apiKey: apiKey,
      updatedAt: new Date().toISOString()
    });

    return new Response(JSON.stringify({ success: true, message: 'API Key saved successfully' }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
}
