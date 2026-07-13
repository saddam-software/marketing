/**
 * Smart Contact Finder – Core API (Simplified)
 * শুধুমাত্র wrangler.toml-এর কীগুলো ব্যবহার করে।
 * লোকেশন API বাদ, শুধু ইমেইল/ফোন এনরিচমেন্ট API সক্রিয়।
 */

// ==================== JWT ভেরিফিকেশন ====================
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
    if (payload.exp && (Date.now() / 1000) > payload.exp) {
      return { valid: false, error: 'Token has expired.' };
    }
    return { valid: true, user: payload };
  } catch (_) {
    return { valid: false, error: 'Invalid Token.' };
  }
}

// ==================== জিও রেজিস্ট্রি (শুধু ম্যাপিংয়ের জন্য) ====================
const ENTERPRISE_GEO_REGISTRY = {
  countries: {
    'bangladesh': { name: 'Bangladesh', code: 'BD' },
    'india': { name: 'India', code: 'IN' },
    'uae': { name: 'United Arab Emirates', code: 'AE' },
    'thailand': { name: 'Thailand', code: 'TH' },
    'niger': { name: 'Niger', code: 'NE' },
    'argentina': { name: 'Argentina', code: 'AR' },
    'ireland': { name: 'Ireland', code: 'IE' },
    'malta': { name: 'Malta', code: 'MT' },
    'brazil': { name: 'Brazil', code: 'BR' }
  },
  divisions: {
    'dhaka': { country: 'bangladesh', name: 'Dhaka', aliases: ['dhaka', 'ঢাকা'] },
    'chattogram': { country: 'bangladesh', name: 'Chattogram', aliases: ['chattogram', 'chittagong', 'চট্টগ্রাম'] },
    'sylhet': { country: 'bangladesh', name: 'Sylhet', aliases: ['sylhet', 'সিলেট'] },
    'maharashtra': { country: 'india', name: 'Maharashtra', aliases: ['maharashtra'] },
    'karnataka': { country: 'india', name: 'Karnataka', aliases: ['karnataka'] },
    'tamil_nadu': { country: 'india', name: 'Tamil Nadu', aliases: ['tamil nadu'] },
    'dubai': { country: 'uae', name: 'Dubai', aliases: ['dubai'] },
    'abu_dhabi': { country: 'uae', name: 'Abu Dhabi', aliases: ['abu dhabi'] },
    'sharjah': { country: 'uae', name: 'Sharjah', aliases: ['sharjah'] },
    'bangkok_metropolitan': { country: 'thailand', name: 'Bangkok Metropolitan', aliases: ['bangkok'] },
    'chonburi': { country: 'thailand', name: 'Chonburi', aliases: ['chonburi'] },
    'chiang_mai': { country: 'thailand', name: 'Chiang Mai', aliases: ['chiang mai'] },
    'niamey': { country: 'niger', name: 'Niamey', aliases: ['niamey'] },
    'tillaberi': { country: 'niger', name: 'Tillaberi', aliases: ['tillaberi'] },
    'dosso': { country: 'niger', name: 'Dosso', aliases: ['dosso'] },
    'buenos_aires': { country: 'argentina', name: 'Buenos Aires', aliases: ['buenos aires'] },
    'cordoba': { country: 'argentina', name: 'Cordoba', aliases: ['cordoba'] },
    'mendoza': { country: 'argentina', name: 'Mendoza', aliases: ['mendoza'] },
    'leinster': { country: 'ireland', name: 'Leinster', aliases: ['leinster'] },
    'munster': { country: 'ireland', name: 'Munster', aliases: ['munster'] },
    'connacht': { country: 'ireland', name: 'Connacht', aliases: ['connacht'] },
    'south_eastern': { country: 'malta', name: 'South Eastern', aliases: ['south eastern'] },
    'northern': { country: 'malta', name: 'Northern', aliases: ['northern'] },
    'port': { country: 'malta', name: 'Port', aliases: ['port'] },
    'sao_paulo': { country: 'brazil', name: 'São Paulo', aliases: ['sao paulo'] },
    'rio_de_janeiro': { country: 'brazil', name: 'Rio de Janeiro', aliases: ['rio de janeiro'] },
    'minas_gerais': { country: 'brazil', name: 'Minas Gerais', aliases: ['minas gerais'] }
  },
  districts: {
    'dhaka': { division: 'dhaka', name: 'Dhaka' },
    'gazipur': { division: 'dhaka', name: 'Gazipur' },
    'narayanganj': { division: 'dhaka', name: 'Narayanganj' },
    'chattogram': { division: 'chattogram', name: 'Chattogram' },
    'cox_bazar': { division: 'chattogram', name: "Cox's Bazar" },
    'sylhet': { division: 'sylhet', name: 'Sylhet' },
    'mumbai': { division: 'maharashtra', name: 'Mumbai' },
    'pune': { division: 'maharashtra', name: 'Pune' },
    'bangalore': { division: 'karnataka', name: 'Bangalore' },
    'chennai': { division: 'tamil_nadu', name: 'Chennai' },
    'dubai_city': { division: 'dubai', name: 'Dubai City' },
    'abu_dhabi_city': { division: 'abu_dhabi', name: 'Abu Dhabi City' },
    'sharjah_city': { division: 'sharjah', name: 'Sharjah City' },
    'bangkok_city': { division: 'bangkok_metropolitan', name: 'Bangkok City' },
    'pattaya': { division: 'chonburi', name: 'Pattaya' },
    'chiang_mai_city': { division: 'chiang_mai', name: 'Chiang Mai City' },
    'niamey_city': { division: 'niamey', name: 'Niamey City' },
    'tillaberi_city': { division: 'tillaberi', name: 'Tillaberi City' },
    'dosso_city': { division: 'dosso', name: 'Dosso City' },
    'buenos_aires_city': { division: 'buenos_aires', name: 'Buenos Aires City' },
    'cordoba_city': { division: 'cordoba', name: 'Cordoba City' },
    'mendoza_city': { division: 'mendoza', name: 'Mendoza City' },
    'dublin': { division: 'leinster', name: 'Dublin' },
    'cork': { division: 'munster', name: 'Cork' },
    'galway': { division: 'connacht', name: 'Galway' },
    'valletta': { division: 'south_eastern', name: 'Valletta' },
    'mosta': { division: 'northern', name: 'Mosta' },
    'birgu': { division: 'port', name: 'Birgu' },
    'sao_paulo_city': { division: 'sao_paulo', name: 'São Paulo City' },
    'rio_city': { division: 'rio_de_janeiro', name: 'Rio City' },
    'belo_horizonte': { division: 'minas_gerais', name: 'Belo Horizonte' }
  }
};

// ==================== জিও ইন্টেলিজেন্স (ঠিকানা থেকে বিভাগ/জেলা বের করতে) ====================
class GeoIntelligenceEngine {
  static extractDivisionFromAddress(address, country) {
    if (!address) return '';
    const lower = address.toLowerCase();
    const divisions = Object.entries(ENTERPRISE_GEO_REGISTRY.divisions);
    for (const [key, node] of divisions) {
      if (node.country === country && (lower.includes(key) || (node.aliases && node.aliases.some(a => lower.includes(a))))) {
        return key;
      }
    }
    return '';
  }

  static extractDistrictFromAddress(address, country) {
    if (!address) return '';
    const lower = address.toLowerCase();
    const districts = Object.entries(ENTERPRISE_GEO_REGISTRY.districts);
    for (const [key, node] of districts) {
      const division = ENTERPRISE_GEO_REGISTRY.divisions[node.division];
      if (division && division.country === country && (lower.includes(key) || lower.includes(node.name.toLowerCase()))) {
        return key;
      }
    }
    return '';
  }
}

// ==================== এনরিচমেন্ট API কনফিগারেশন (শুধু wrangler.toml-এর কী) ====================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const API_CONFIG = {
  hunter: {
    name: 'Hunter.io',
    active: true,
    fetch: async (query, env) => {
      const key = env.HUNTER_API_KEY;
      if (!key || key === 'YOUR_HUNTER_API_KEY') return [];
      try {
        // query হতে ডোমেইন বের করার চেষ্টা (যদি ইমেইল বা ডোমেইন দেওয়া থাকে)
        let domain = query.trim().toLowerCase();
        if (domain.includes('@')) domain = domain.split('@')[1];
        if (!domain.includes('.')) return [];
        const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.data?.emails) return [];
        return data.data.emails.slice(0, 10).map(e => ({
          source: 'hunter',
          id: `hnt_${e.value}`,
          name: e.first_name ? `${e.first_name} ${e.last_name || ''}`.trim() : e.value,
          address: e.domain || '',
          lat: 0, lng: 0,
          email: e.value,
          phone: '',
          website: e.domain || '',
          types: ['email'],
          confidence: 80
        }));
      } catch (e) { return []; }
    }
  },
  clearbit: {
    name: 'Clearbit',
    active: true,
    fetch: async (query, env) => {
      const key = env.CLEARBIT_API_KEY;
      if (!key || key === 'YOUR_CLEARBIT_API_KEY') return [];
      try {
        const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!Array.isArray(data)) return [];
        return data.slice(0, 10).map(c => ({
          source: 'clearbit',
          id: `clb_${c.domain}`,
          name: c.name || query,
          address: c.location || '',
          lat: 0, lng: 0,
          email: '',
          phone: '',
          website: c.domain || '',
          types: ['business'],
          confidence: 75
        }));
      } catch (e) { return []; }
    }
  },
  apollo: {
    name: 'Apollo.io',
    active: true,
    fetch: async (query, env) => {
      const key = env.APOLLO_API_KEY;
      if (!key || key === 'YOUR_APOLLO_API_KEY') return [];
      try {
        const url = `https://api.apollo.io/v1/mixed_people/search?q=${encodeURIComponent(query)}&api_key=${key}&page=1&per_page=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.people) return [];
        return data.people.slice(0, 10).map(p => ({
          source: 'apollo',
          id: `apollo_${p.id}`,
          name: p.name || 'Unknown',
          address: p.location || '',
          lat: 0, lng: 0,
          email: p.email || '',
          phone: p.phone || '',
          website: p.website || '',
          types: ['business'],
          confidence: 75
        }));
      } catch (e) { return []; }
    }
  },
  zoominfo: {
    name: 'ZoomInfo',
    active: true,
    fetch: async (query, env) => {
      const key = env.ZOOMINFO_API_KEY;
      if (!key || key === 'YOUR_ZOOMINFO_API_KEY') return [];
      try {
        const url = `https://api.zoominfo.com/v1/companies/search?q=${encodeURIComponent(query)}&page=1&pageSize=10`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.companies) return [];
        return data.companies.slice(0, 10).map(c => ({
          source: 'zoominfo',
          id: `zi_${c.id}`,
          name: c.name || query,
          address: c.location || '',
          lat: 0, lng: 0,
          email: '',
          phone: c.phone || '',
          website: c.website || '',
          types: ['b2b'],
          confidence: 80
        }));
      } catch (e) { return []; }
    }
  },
  uplead: {
    name: 'UpLead',
    active: true,
    fetch: async (query, env) => {
      const key = env.UPLEAD_API_KEY;
      if (!key || key === 'YOUR_UPLEAD_API_KEY') return [];
      try {
        const url = `https://api.uplead.com/v1/search?query=${encodeURIComponent(query)}&page=1&limit=10`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 10).map(r => ({
          source: 'uplead',
          id: `up_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0, lng: 0,
          email: r.email || '',
          phone: r.phone || '',
          website: r.website || '',
          types: ['b2b'],
          confidence: 80
        }));
      } catch (e) { return []; }
    }
  },
  salesintel: {
    name: 'SalesIntel',
    active: true,
    fetch: async (query, env) => {
      const key = env.SALESINTEL_API_KEY;
      if (!key || key === 'YOUR_SALESINTEL_API_KEY') return [];
      try {
        const url = `https://api.salesintel.io/v1/search?query=${encodeURIComponent(query)}&limit=10`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 10).map(r => ({
          source: 'salesintel',
          id: `si_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0, lng: 0,
          email: r.email || '',
          phone: r.phone || '',
          website: r.website || '',
          types: ['b2b'],
          confidence: 80
        }));
      } catch (e) { return []; }
    }
  },
  pdl: {
    name: 'People Data Labs',
    active: true,
    fetch: async (query, env) => {
      const key = env.PDL_API_KEY;
      if (!key || key === 'YOUR_PDL_API_KEY') return [];
      try {
        const url = `https://api.peopledatalabs.com/v5/person/search?q=${encodeURIComponent(query)}&page=1&size=10`;
        const resp = await fetch(url, { headers: { 'X-Api-Key': key } });
        const data = await resp.json();
        if (!data.data) return [];
        return data.data.slice(0, 10).map(p => ({
          source: 'pdl',
          id: `pdl_${p.id}`,
          name: p.full_name || query,
          address: p.location || '',
          lat: 0, lng: 0,
          email: p.email || '',
          phone: p.phone || '',
          website: p.company_website || '',
          types: ['profile'],
          confidence: 70
        }));
      } catch (e) { return []; }
    }
  },
  proxycurl: {
    name: 'Proxycurl',
    active: true,
    fetch: async (query, env) => {
      const key = env.PROXYCURL_API_KEY;
      if (!key || key === 'YOUR_PROXYCURL_API_KEY') return [];
      try {
        const url = `https://nubela.co/proxycurl/api/search/person?query=${encodeURIComponent(query)}&page_size=10`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 10).map(r => ({
          source: 'proxycurl',
          id: `pc_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0, lng: 0,
          email: r.email || '',
          phone: r.phone || '',
          website: r.website || '',
          types: ['linkedin'],
          confidence: 70
        }));
      } catch (e) { return []; }
    }
  },
  rocketreach: {
    name: 'RocketReach',
    active: true,
    fetch: async (query, env) => {
      const key = env.ROCKETREACH_API_KEY;
      if (!key || key === 'YOUR_ROCKETREACH_API_KEY') return [];
      try {
        const url = `https://api.rocketreach.co/v1/search/people?q=${encodeURIComponent(query)}&page=1&pageSize=10`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.people) return [];
        return data.people.slice(0, 10).map(p => ({
          source: 'rocketreach',
          id: `rr_${p.id}`,
          name: p.name || query,
          address: p.location || '',
          lat: 0, lng: 0,
          email: p.email || '',
          phone: p.phone || '',
          website: p.website || '',
          types: ['b2b'],
          confidence: 70
        }));
      } catch (e) { return []; }
    }
  },
  lusha: {
    name: 'Lusha',
    active: true,
    fetch: async (query, env) => {
      const key = env.LUSHA_API_KEY;
      if (!key || key === 'YOUR_LUSHA_API_KEY') return [];
      try {
        const url = `https://api.lusha.com/v1/search?query=${encodeURIComponent(query)}&page=1&size=10`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 10).map(r => ({
          source: 'lusha',
          id: `lu_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0, lng: 0,
          email: r.email || '',
          phone: r.phone || '',
          website: r.company || '',
          types: ['b2b'],
          confidence: 75
        }));
      } catch (e) { return []; }
    }
  },
  kaspr: {
    name: 'Kaspr',
    active: true,
    fetch: async (query, env) => {
      const key = env.KASPR_API_KEY;
      if (!key || key === 'YOUR_KASPR_API_KEY') return [];
      try {
        const url = `https://api.kaspr.io/v1/search?query=${encodeURIComponent(query)}&page=1&size=10`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 10).map(r => ({
          source: 'kaspr',
          id: `kp_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0, lng: 0,
          email: r.email || '',
          phone: r.phone || '',
          website: r.company || '',
          types: ['linkedin'],
          confidence: 70
        }));
      } catch (e) { return []; }
    }
  }
};

// ==================== সব API থেকে ডেটা ফেচ ====================
async function fetchFromAllAPIs(query, env) {
  const activeAPIs = Object.values(API_CONFIG).filter(api => api.active);
  const results = [];
  for (const api of activeAPIs) {
    try {
      const items = await api.fetch(query, env);
      if (items && items.length) results.push(...items);
      await sleep(200);
    } catch (e) { /* ignore */ }
  }
  return results;
}

// ==================== ডেটাবেসে ইনসার্ট (থানা বাদ) ====================
async function normalizeAndInsertProfiles(rawItems, env, country) {
  let inserted = 0;
  let skipped = 0;
  for (const item of rawItems) {
    if (!item.name) {
      skipped++;
      continue;
    }
    const division = GeoIntelligenceEngine.extractDivisionFromAddress(item.address, country) || '';
    const district = GeoIntelligenceEngine.extractDistrictFromAddress(item.address, country) || '';
    const entityType = (item.types && item.types.some(t => ['restaurant', 'hotel', 'spa', 'tourism', 'food', 'cafe', 'gym'].includes(t))) ? 'SERVICE' : 'BUSINESS';

    const query = `
      INSERT OR IGNORE INTO profiles 
      (id, name, entityType, country, division, district, thana, lat, lng, email, phone, whatsapp, social, confidenceScore, verificationStatus)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE name = ? AND email = ? AND phone = ?
      )
    `;
    const params = [
      item.id,
      item.name.substring(0, 100),
      entityType,
      country,
      division || '',
      district || '',
      '', // thana খালি
      item.lat || 0,
      item.lng || 0,
      item.email || '',
      item.phone || '',
      '',
      item.website || '',
      item.confidence || 60,
      'UNVERIFIED',
      item.name.substring(0, 100),
      item.email || '',
      item.phone || ''
    ];
    try {
      const result = await env.DB.prepare(query).bind(...params).run();
      if (result.meta?.changes > 0) inserted++;
    } catch (e) { /* skip duplicates */ }
  }
  return inserted;
}

// ==================== ক্লাউডফ্লেয়ার ওয়ার্কার হ্যান্ডলার ====================
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const action = searchParams.get('action');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- অথেনটিকেশন (JWT) ---
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
  }
  const token = authHeader.split(' ')[1];
  const secret = env.JWT_SECRET || 'LocalDevelopmentSecretKey123!@#';
  const authResult = await verifyJWT(token, secret);
  if (!authResult.valid) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
  }

  try {
    // ----- getCountries -----
    if (action === 'getCountries') {
      const data = Object.entries(ENTERPRISE_GEO_REGISTRY.countries).map(([key, item]) => ({ id: key, name: item.name }));
      return jsonResponse({ success: true, countries: data }, 200, corsHeaders);
    }

    // ----- getDivisions -----
    if (action === 'getDivisions') {
      const country = searchParams.get('country') || 'bangladesh';
      const filtered = Object.entries(ENTERPRISE_GEO_REGISTRY.divisions)
        .filter(([_, val]) => val.country === country)
        .map(([key, val]) => ({ id: key, name: val.name }));
      return jsonResponse({ success: true, divisions: filtered }, 200, corsHeaders);
    }

    // ----- getDistricts -----
    if (action === 'getDistricts') {
      const division = searchParams.get('division');
      if (!division) return jsonResponse({ success: false, error: 'Missing division' }, 400, corsHeaders);
      const filtered = Object.entries(ENTERPRISE_GEO_REGISTRY.districts)
        .filter(([_, val]) => val.division === division)
        .map(([key, val]) => ({ id: key, name: val.name }));
      return jsonResponse({ success: true, districts: filtered }, 200, corsHeaders);
    }

    // ----- search (মূল ফিচার) -----
    if (action === 'search') {
      if (!env.DB) return jsonResponse({ success: false, error: 'Database binding not found' }, 500, corsHeaders);

      const queryTerm = searchParams.get('query') || '';
      const country = searchParams.get('country') || 'bangladesh';
      const division = searchParams.get('division') || '';
      const district = searchParams.get('district') || '';
      const hasEmail = searchParams.get('hasEmail') === 'true';
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '25', 10);
      const offset = (page - 1) * limit;
      const mode = searchParams.get('mode') || 'live';

      const conditions = [];
      const params = [];
      if (country) { conditions.push(`country = ?`); params.push(country); }
      if (queryTerm) { conditions.push(`(name LIKE ? OR entityType LIKE ?)`); const q = `%${queryTerm}%`; params.push(q, q); }
      if (division) { conditions.push(`division = ?`); params.push(division); }
      if (district) { conditions.push(`district = ?`); params.push(district); }
      if (hasEmail) { conditions.push(`email IS NOT NULL AND email != ''`); }

      let whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countQuery = `SELECT COUNT(*) as total FROM profiles ${whereClause}`;
      const countResult = await env.DB.prepare(countQuery).bind(...params).first();
      let totalRecords = countResult ? countResult.total : 0;

      // যদি live mode হয় এবং রেকর্ড কম থাকে এবং queryTerm থাকে, তাহলে API থেকে ডেটা এনে সেভ করি
      if (mode !== 'db' && totalRecords < 10 && country && queryTerm && queryTerm.trim().length > 0) {
        const locationParts = [district, division, country].filter(Boolean);
        const targetedQuery = `${queryTerm} in ${locationParts.join(', ')}`;
        const rawItems = await fetchFromAllAPIs(targetedQuery, env);
        if (rawItems.length) {
          await normalizeAndInsertProfiles(rawItems, env, country);
          // পুনরায় কাউন্ট করি
          const newCount = await env.DB.prepare(countQuery).bind(...params).first();
          totalRecords = newCount ? newCount.total : 0;
        }
      }

      const dataQuery = `
        SELECT id, name, entityType, country, division, district, thana, lat, lng,
               email, phone, whatsapp, social, confidenceScore, verificationStatus,
               '' as source, '' as address, '' as website
        FROM profiles
        ${whereClause}
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, limit, offset];
      const dataResult = await env.DB.prepare(dataQuery).bind(...dataParams).all();
      let results = dataResult.results || [];

      const contacts = results.map(p => ({
        id: p.id,
        name: p.name,
        entityType: p.entityType,
        country: p.country,
        division: p.division,
        district: p.district,
        thana: p.thana,
        lat: p.lat,
        lng: p.lng,
        email: p.email || '',
        phone: p.phone || '',
        whatsapp: p.whatsapp || '',
        social: p.social || '',
        confidenceScore: p.confidenceScore,
        verificationStatus: p.verificationStatus,
        source: p.source || 'database',
        address: p.address || '',
        website: p.website || ''
      }));

      return jsonResponse({
        success: true,
        meta: { totalRecords, page, limit, totalPages: Math.ceil(totalRecords / limit) },
        contacts
      }, 200, corsHeaders);
    }

    // ----- অন্যান্য অ্যাকশন (cronFetch, batchFetchAll, verifyProfile) নিষ্ক্রিয় -----
    if (['cronFetch', 'batchFetchAll', 'verifyProfile'].includes(action)) {
      return jsonResponse({ success: false, error: 'This action is disabled in the simplified version.' }, 400, corsHeaders);
    }

    return jsonResponse({ success: false, error: 'Invalid action' }, 400, corsHeaders);
  } catch (error) {
    console.error('Unhandled error:', error);
    return jsonResponse({ success: false, error: 'Internal server error: ' + error.message }, 500, corsHeaders);
  }
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}
