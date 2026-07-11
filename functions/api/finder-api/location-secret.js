/**
 * AI-Powered Smart People & Business Finder Platform - Core Spatial API
 * MULTI-SOURCE AUTO-CACHING ENGINE (Google + OSM + Foursquare + Yelp)
 */

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

// =========================================================================
// STATIC GEO REGISTRY (Bangladesh 8 Divisions, 26+ Districts, 20+ Thanas)
// =========================================================================
const ENTERPRISE_GEO_REGISTRY = {
  divisions: {
    'dhaka': { name: 'Dhaka', aliases: ['dhaka', 'ঢাকা'] },
    'chattogram': { name: 'Chattogram', aliases: ['chattogram', 'chittagong', 'চট্টগ্রাম'] },
    'sylhet': { name: 'Sylhet', aliases: ['sylhet', 'সিলেট'] },
    'rajshahi': { name: 'Rajshahi', aliases: ['rajshahi', 'রাজশাহী'] },
    'khulna': { name: 'Khulna', aliases: ['khulna', 'খুলনা'] },
    'barishal': { name: 'Barishal', aliases: ['barishal', 'বরিশাল'] },
    'rangpur': { name: 'Rangpur', aliases: ['rangpur', 'রংপুর'] },
    'mymensingh': { name: 'Mymensingh', aliases: ['mymensingh', 'ময়মনসিংহ'] }
  },
  districts: {
    'dhaka': { division: 'dhaka', name: 'Dhaka' },
    'gazipur': { division: 'dhaka', name: 'Gazipur' },
    'narayanganj': { division: 'dhaka', name: 'Narayanganj' },
    'tangail': { division: 'dhaka', name: 'Tangail' },
    'faridpur': { division: 'dhaka', name: 'Faridpur' },
    'chattogram': { division: 'chattogram', name: 'Chattogram' },
    'cox_bazar': { division: 'chattogram', name: "Cox's Bazar" },
    'rangamati': { division: 'chattogram', name: 'Rangamati' },
    'comilla': { division: 'chattogram', name: 'Comilla' },
    'noakhali': { division: 'chattogram', name: 'Noakhali' },
    'sylhet': { division: 'sylhet', name: 'Sylhet' },
    'moulvibazar': { division: 'sylhet', name: 'Moulvibazar' },
    'habiganj': { division: 'sylhet', name: 'Habiganj' },
    'rajshahi': { division: 'rajshahi', name: 'Rajshahi' },
    'naogaon': { division: 'rajshahi', name: 'Naogaon' },
    'natore': { division: 'rajshahi', name: 'Natore' },
    'khulna': { division: 'khulna', name: 'Khulna' },
    'kushtia': { division: 'khulna', name: 'Kushtia' },
    'jessore': { division: 'khulna', name: 'Jessore' },
    'barishal': { division: 'barishal', name: 'Barishal' },
    'barguna': { division: 'barishal', name: 'Barguna' },
    'rangpur': { division: 'rangpur', name: 'Rangpur' },
    'dinajpur': { division: 'rangpur', name: 'Dinajpur' },
    'mymensingh': { division: 'mymensingh', name: 'Mymensingh' },
    'jamalpur': { division: 'mymensingh', name: 'Jamalpur' }
  },
  thanas: {
    'dhanmondi': { district: 'dhaka', name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
    'gulshan': { district: 'dhaka', name: 'Gulshan', lat: 23.7925, lng: 90.4078 },
    'mirpur': { district: 'dhaka', name: 'Mirpur', lat: 23.8042, lng: 90.3667 },
    'uttara': { district: 'dhaka', name: 'Uttara', lat: 23.8729, lng: 90.3987 },
    'motijheel': { district: 'dhaka', name: 'Motijheel', lat: 23.7330, lng: 90.4172 },
    'savar': { district: 'dhaka', name: 'Savar', lat: 23.8583, lng: 90.2665 },
    'gazipur_sadar': { district: 'gazipur', name: 'Gazipur Sadar', lat: 23.9994, lng: 90.4204 },
    'kaliakair': { district: 'gazipur', name: 'Kaliakair', lat: 24.0741, lng: 90.3291 },
    'narayanganj_sadar': { district: 'narayanganj', name: 'Narayanganj Sadar', lat: 23.6233, lng: 90.5000 },
    'halishahar': { district: 'chattogram', name: 'Halishahar', lat: 22.3364, lng: 91.7828 },
    'pahartali': { district: 'chattogram', name: 'Pahartali', lat: 22.3657, lng: 91.7935 },
    'khulshi': { district: 'chattogram', name: 'Khulshi', lat: 22.3519, lng: 91.7961 },
    'cox_bazar_sadar': { district: 'cox_bazar', name: "Cox's Bazar Sadar", lat: 21.4272, lng: 92.0058 },
    'sylhet_sadar': { district: 'sylhet', name: 'Sylhet Sadar', lat: 24.8996, lng: 91.8710 },
    'shahparan': { district: 'sylhet', name: 'Shahparan', lat: 24.9038, lng: 91.8698 },
    'rajshahi_sadar': { district: 'rajshahi', name: 'Rajshahi Sadar', lat: 24.3745, lng: 88.6041 },
    'khulna_sadar': { district: 'khulna', name: 'Khulna Sadar', lat: 22.8456, lng: 89.5403 },
    'barishal_sadar': { district: 'barishal', name: 'Barishal Sadar', lat: 22.7010, lng: 90.3535 },
    'rangpur_sadar': { district: 'rangpur', name: 'Rangpur Sadar', lat: 25.7468, lng: 89.2508 },
    'mymensingh_sadar': { district: 'mymensingh', name: 'Mymensingh Sadar', lat: 24.7471, lng: 90.4203 }
  }
};

// =========================================================================
// GEO INTELLIGENCE ENGINE (Helper)
// =========================================================================
class GeoIntelligenceEngine {
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  static normalizeQueryLocation(term) {
    if (!term) return '';
    const clean = term.trim().toLowerCase();
    for (const [key, node] of Object.entries(ENTERPRISE_GEO_REGISTRY.divisions)) {
      if (node.aliases.includes(clean)) return key;
    }
    for (const [key, node] of Object.entries(ENTERPRISE_GEO_REGISTRY.districts)) {
      if (node.aliases && node.aliases.includes(clean)) return key;
    }
    return clean;
  }

  // ঠিকানা থেকে Division/ District বের করার সহজ ফাংশন
  static extractDivisionFromAddress(address) {
    if (!address) return '';
    const lower = address.toLowerCase();
    for (const [key, node] of Object.entries(ENTERPRISE_GEO_REGISTRY.divisions)) {
      if (lower.includes(key) || node.aliases.some(a => lower.includes(a))) return key;
    }
    return '';
  }
  static extractDistrictFromAddress(address) {
    if (!address) return '';
    const lower = address.toLowerCase();
    for (const [key, node] of Object.entries(ENTERPRISE_GEO_REGISTRY.districts)) {
      if (lower.includes(key) || lower.includes(node.name.toLowerCase())) return key;
    }
    return '';
  }
}

// =========================================================================
// EXTERNAL DATA FETCHERS (MULTI-SOURCE)
// =========================================================================

// 1. Google Places API
async function fetchFromGoogle(query, env) {
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key || key === 'YOUR_GOOGLE_API_KEY') return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (data.status !== 'OK') return [];
    return data.results.map(place => ({
      source: 'google',
      id: `google_${place.place_id}`,
      name: place.name,
      address: place.formatted_address,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      phone: place.formatted_phone_number || '',
      website: place.website || '',
      types: place.types || [],
      confidence: 75
    }));
  } catch (e) { return []; }
}

// 2. OpenStreetMap Nominatim (100% Free, No API Key!)
async function fetchFromOSM(query, env) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'YourApp/1.0 (your-email@example.com)' } // OSM নীতিমালা অনুযায়ী
    });
    const data = await resp.json();
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
      source: 'osm',
      id: `osm_${item.osm_type}_${item.osm_id}`,
      name: item.display_name.split(',')[0],
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      phone: '',
      website: '',
      types: [item.class],
      confidence: 50 // OSM ডেটা কম কনফিডেন্স
    }));
  } catch (e) { return []; }
}

// 3. Foursquare Places API
async function fetchFromFoursquare(query, env) {
  const key = env.FOURSQUARE_API_KEY;
  if (!key || key === 'YOUR_FOURSQUARE_API_KEY') return [];
  try {
    const url = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&limit=10`;
    const resp = await fetch(url, {
      headers: { 'Authorization': key }
    });
    const data = await resp.json();
    if (!data.results) return [];
    return data.results.map(place => ({
      source: 'foursquare',
      id: `fsq_${place.fsq_id}`,
      name: place.name,
      address: place.location?.formatted_address || '',
      lat: place.geocodes?.main?.latitude || 0,
      lng: place.geocodes?.main?.longitude || 0,
      phone: place.tel || '',
      website: place.website || '',
      types: place.categories?.map(c => c.name) || [],
      confidence: 65
    }));
  } catch (e) { return []; }
}

// 4. Yelp Fusion API
async function fetchFromYelp(query, env) {
  const key = env.YELP_API_KEY;
  if (!key || key === 'YOUR_YELP_API_KEY') return [];
  try {
    const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(query)}&limit=10`;
    const resp = await fetch(url, {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const data = await resp.json();
    if (!data.businesses) return [];
    return data.businesses.map(biz => ({
      source: 'yelp',
      id: `yelp_${biz.id}`,
      name: biz.name,
      address: biz.location?.address1 || '',
      lat: biz.coordinates?.latitude || 0,
      lng: biz.coordinates?.longitude || 0,
      phone: biz.phone || '',
      website: biz.url || '',
      types: biz.categories?.map(c => c.title) || [],
      confidence: 70
    }));
  } catch (e) { return []; }
}

// 5. Generic Normalizer & Inserter
async function normalizeAndInsertProfiles(rawItems, env) {
  let inserted = 0;
  for (const item of rawItems) {
    if (!item.name || !item.lat) continue;
    const division = GeoIntelligenceEngine.extractDivisionFromAddress(item.address);
    const district = GeoIntelligenceEngine.extractDistrictFromAddress(item.address);
    const entityType = (item.types && item.types.some(t => ['restaurant', 'hotel', 'spa', 'tourism'].includes(t))) ? 'SERVICE' : 'BUSINESS';

    const query = `
      INSERT OR IGNORE INTO profiles 
      (id, name, entityType, division, district, thana, lat, lng, email, phone, whatsapp, social, confidenceScore, verificationStatus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      item.id,
      item.name.substring(0, 100),
      entityType,
      division || 'dhaka',
      district || 'dhaka',
      '',
      item.lat,
      item.lng,
      '',
      item.phone || '',
      '',
      item.website || '',
      item.confidence || 60,
      'UNVERIFIED'
    ];
    try {
      const result = await env.DB.prepare(query).bind(...params).run();
      if (result.meta?.changes > 0) inserted++;
    } catch (e) { /* skip duplicates */ }
  }
  return inserted;
}

// =========================================================================
// CLOUDFLARE WORKER HANDLER
// =========================================================================
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

  // Auth
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
    // ----- static routes (getDivisions, getDistricts, getThanas) -----
    if (action === 'getDivisions') {
      const data = Object.entries(ENTERPRISE_GEO_REGISTRY.divisions).map(([key, item]) => ({ id: key, name: item.name }));
      return jsonResponse({ success: true, divisions: data }, 200, corsHeaders);
    }
    if (action === 'getDistricts') {
      const division = searchParams.get('division');
      if (!division) return jsonResponse({ success: false, error: 'Missing division' }, 400, corsHeaders);
      const normalized = GeoIntelligenceEngine.normalizeQueryLocation(division);
      const filtered = Object.entries(ENTERPRISE_GEO_REGISTRY.districts)
        .filter(([_, val]) => val.division === normalized)
        .map(([key, val]) => ({ id: key, name: val.name }));
      return jsonResponse({ success: true, districts: filtered }, 200, corsHeaders);
    }
    if (action === 'getThanas') {
      const district = searchParams.get('district');
      if (!district) return jsonResponse({ success: false, error: 'Missing district' }, 400, corsHeaders);
      const normalized = GeoIntelligenceEngine.normalizeQueryLocation(district);
      const filtered = Object.entries(ENTERPRISE_GEO_REGISTRY.thanas)
        .filter(([_, val]) => val.district === normalized)
        .map(([key, val]) => ({ id: key, name: val.name, lat: val.lat, lng: val.lng }));
      return jsonResponse({ success: true, thanas: filtered }, 200, corsHeaders);
    }

    // ----- verifyProfile (D1) -----
    if (action === 'verifyProfile') {
      if (request.method !== 'POST') {
        return jsonResponse({ success: false, error: 'Method not allowed' }, 405, corsHeaders);
      }
      let body;
      try { body = await request.json(); } catch (_) {
        return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, corsHeaders);
      }
      const { profileId } = body;
      if (!profileId) return jsonResponse({ success: false, error: 'Missing profileId' }, 400, corsHeaders);
      if (!env.DB) return jsonResponse({ success: false, error: 'Database binding not found' }, 500, corsHeaders);

      try {
        const updateQuery = `
          UPDATE profiles 
          SET verificationStatus = 'VERIFIED', 
              confidenceScore = GREATEST(confidenceScore, 92)
          WHERE id = ?
          RETURNING id, verificationStatus, confidenceScore
        `;
        const result = await env.DB.prepare(updateQuery).bind(profileId).first();
        if (!result) return jsonResponse({ success: false, error: 'Profile not found' }, 404, corsHeaders);
        return jsonResponse({ success: true, profile: result }, 200, corsHeaders);
      } catch (err) {
        return jsonResponse({ success: false, error: 'DB error: ' + err.message }, 500, corsHeaders);
      }
    }

    // ----- SEARCH (MAIN LOGIC WITH AUTO-FETCH) -----
    if (action === 'search') {
      if (!env.DB) return jsonResponse({ success: false, error: 'Database binding not found' }, 500, corsHeaders);

      const queryTerm = searchParams.get('query') || '';
      const entityType = searchParams.get('entityType') || 'all';
      const division = searchParams.get('division') || '';
      const district = searchParams.get('district') || '';
      const thana = searchParams.get('thana') || '';
      const radius = parseFloat(searchParams.get('radius') || '0');
      const minConfidence = parseInt(searchParams.get('minConfidence') || '0', 10);
      const verificationStatus = searchParams.get('verificationStatus') || 'all';
      const reqEmail = searchParams.get('hasEmail') === 'true';
      const reqPhone = searchParams.get('hasPhone') === 'true';
      const reqWhatsapp = searchParams.get('hasWhatsapp') === 'true';
      const reqSocial = searchParams.get('hasSocial') === 'true';
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '25', 10);
      const offset = (page - 1) * limit;

      // Build D1 Search Query
      const conditions = [];
      const params = [];
      if (queryTerm) { conditions.push(`(name LIKE ? OR entityType LIKE ?)`); const q = `%${queryTerm}%`; params.push(q, q); }
      if (entityType !== 'all') { conditions.push(`entityType = ?`); params.push(entityType); }
      if (minConfidence > 0) { conditions.push(`confidenceScore >= ?`); params.push(minConfidence); }
      if (verificationStatus !== 'all') { conditions.push(`verificationStatus = ?`); params.push(verificationStatus); }
      if (division) { const norm = GeoIntelligenceEngine.normalizeQueryLocation(division); conditions.push(`division = ?`); params.push(norm); }
      if (district) { const norm = GeoIntelligenceEngine.normalizeQueryLocation(district); conditions.push(`district = ?`); params.push(norm); }
      if (thana) { const norm = GeoIntelligenceEngine.normalizeQueryLocation(thana); conditions.push(`thana = ?`); params.push(norm); }
      if (reqEmail) conditions.push(`email IS NOT NULL AND email != ''`);
      if (reqPhone) conditions.push(`phone IS NOT NULL AND phone != ''`);
      if (reqWhatsapp) conditions.push(`whatsapp IS NOT NULL AND whatsapp != ''`);
      if (reqSocial) conditions.push(`social IS NOT NULL AND social != ''`);

      let whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countQuery = `SELECT COUNT(*) as total FROM profiles ${whereClause}`;
      const countResult = await env.DB.prepare(countQuery).bind(...params).first();
      let totalRecords = countResult ? countResult.total : 0;

      // ---- AUTO-FETCH LOGIC: যদি D1-এ কম ডেটা থাকে এবং সার্চ টার্ম দেওয়া থাকে ----
      if (totalRecords < 3 && queryTerm && queryTerm.length > 2) {
        console.log(`🔄 Low results (${totalRecords}) for "${queryTerm}". Fetching from external APIs...`);
        
        // সমস্ত API থেকে সমান্তরালে (Parallel) ডেটা আনা
        const fetchPromises = [
          fetchFromGoogle(queryTerm, env),
          fetchFromOSM(queryTerm, env),
          fetchFromFoursquare(queryTerm, env),
          fetchFromYelp(queryTerm, env)
        ];
        const results = await Promise.allSettled(fetchPromises);
        
        let allItems = [];
        for (const result of results) {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allItems = allItems.concat(result.value);
          }
        }

        if (allItems.length > 0) {
          // সাজানোর পর সর্বোচ্চ ২০টি ইউনিক ডেটা নেওয়া
          const uniqueMap = new Map();
          for (const item of allItems) {
            if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
          }
          const uniqueItems = Array.from(uniqueMap.values()).slice(0, 20);
          
          // D1-এ সেভ করা
          const inserted = await normalizeAndInsertProfiles(uniqueItems, env);
          console.log(`✅ Inserted ${inserted} new profiles from external sources.`);

          // আবার D1 থেকে রিলোড (হয়তো এখন ডেটা বেশি)
          const newCount = await env.DB.prepare(countQuery).bind(...params).first();
          totalRecords = newCount ? newCount.total : 0;
        }
      }

      // ফাইনাল ডেটা কোয়েরি (পেজিনেশন সহ)
      const dataQuery = `
        SELECT id, name, entityType, division, district, thana, lat, lng,
               email, phone, whatsapp, social, confidenceScore, verificationStatus
        FROM profiles
        ${whereClause}
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, limit, offset];
      const dataResult = await env.DB.prepare(dataQuery).bind(...dataParams).all();
      let results = dataResult.results || [];

      // Radius ফিল্টার (JS-এ)
      if (radius > 0 && thana) {
        const center = ENTERPRISE_GEO_REGISTRY.thanas[thana.toLowerCase()];
        if (center) {
          results = results.filter(p => {
            const dist = GeoIntelligenceEngine.calculateDistance(center.lat, center.lng, p.lat, p.lng);
            return dist <= radius;
          });
          totalRecords = results.length;
        }
      }

      const paginated = results.slice(0, limit);
      return jsonResponse({
        success: true,
        meta: { totalRecords, page, limit, totalPages: Math.ceil(totalRecords / limit) },
        contacts: paginated
      }, 200, corsHeaders);
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
