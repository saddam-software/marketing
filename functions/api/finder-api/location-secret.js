/**
 * AI-Powered Smart People & Business Finder Platform - Core Spatial API
 * D1 Database integration with Auto-Fetch from Google Places API.
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
// GEO REGISTRY (Static – unchanged)
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
// GEO INTELLIGENCE ENGINE
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
}

// =========================================================================
// GOOGLE PLACES API INTEGRATION
// =========================================================================

// গুগল থেকে ম্যাপিং (Entity Type)
function mapGoogleTypesToEntityType(types) {
  if (!types) return 'BUSINESS';
  if (types.some(t => ['lodging', 'hotel', 'spa'].includes(t))) return 'SERVICE';
  if (types.some(t => ['restaurant', 'food', 'cafe'].includes(t))) return 'BUSINESS';
  if (types.some(t => ['doctor', 'health', 'hospital'].includes(t))) return 'PROFESSIONAL';
  if (types.some(t => ['school', 'university'].includes(t))) return 'SERVICE';
  return 'BUSINESS';
}

// ঠিকানা থেকে বিভাগ ও জেলা বের করা (বাংলাদেশের জন্য)
function extractDivisionAndDistrict(components) {
  let division = '';
  let district = '';
  if (!components) return { division, district };

  // লং নেম দিয়ে খোঁজ
  const divMap = {
    'dhaka': 'dhaka', 'ঢাকা': 'dhaka',
    'chittagong': 'chattogram', 'চট্টগ্রাম': 'chattogram',
    'sylhet': 'sylhet', 'সিলেট': 'sylhet',
    'rajshahi': 'rajshahi', 'রাজশাহী': 'rajshahi',
    'khulna': 'khulna', 'খুলনা': 'khulna',
    'barisal': 'barishal', 'বরিশাল': 'barishal',
    'rangpur': 'rangpur', 'রংপুর': 'rangpur',
    'mymensingh': 'mymensingh', 'ময়মনসিংহ': 'mymensingh'
  };

  // বাংলাদেশের জেলাগুলোর ম্যাপ (সাধারণ কিছু)
  const distMap = {
    'dhaka': 'dhaka', 'gazipur': 'gazipur', 'narayanganj': 'narayanganj',
    'tangail': 'tangail', 'faridpur': 'faridpur', 'chattogram': 'chattogram',
    'cox\'s bazar': 'cox_bazar', 'rangamati': 'rangamati', 'comilla': 'comilla',
    'noakhali': 'noakhali', 'sylhet': 'sylhet', 'moulvibazar': 'moulvibazar',
    'habiganj': 'habiganj', 'rajshahi': 'rajshahi', 'naogaon': 'naogaon',
    'natore': 'natore', 'khulna': 'khulna', 'kushtia': 'kushtia',
    'jessore': 'jessore', 'barishal': 'barishal', 'barguna': 'barguna',
    'rangpur': 'rangpur', 'dinajpur': 'dinajpur', 'mymensingh': 'mymensingh',
    'jamalpur': 'jamalpur'
  };

  for (const comp of components) {
    const lname = comp.long_name.toLowerCase();
    const sname = comp.short_name.toLowerCase();
    if (comp.types.includes('administrative_area_level_1')) {
      const found = divMap[lname] || divMap[sname];
      if (found) division = found;
    }
    if (comp.types.includes('administrative_area_level_2') || comp.types.includes('locality')) {
      const found = distMap[lname] || distMap[sname];
      if (found) district = found;
    }
  }

  return { division, district };
}

// গুগল প্লেস API-তে কল করা
async function fetchFromGoogle(query, apiKey) {
  if (!apiKey) {
    console.warn('Google API Key missing');
    return [];
  }
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Google API error:', data.status);
      return [];
    }
    return data.results || [];
  } catch (e) {
    console.error('Google fetch error:', e);
    return [];
  }
}

// গুগলের ডেটা আমাদের ডেটাবেজ ফরম্যাটে রূপান্তর
function mapGooglePlaceToProfile(place) {
  const { division, district } = extractDivisionAndDistrict(place.address_components);
  
  return {
    id: place.place_id,
    name: place.name || 'Unknown',
    entityType: mapGoogleTypesToEntityType(place.types),
    division: division || '',
    district: district || '',
    thana: '', // থানা সাধারণত পাই না
    lat: place.geometry?.location?.lat || 0,
    lng: place.geometry?.location?.lng || 0,
    email: '', // গুগল ইমেইল দেয় না
    phone: place.formatted_phone_number || '',
    whatsapp: '',
    social: place.website || '',
    confidenceScore: 60, // নতুন ডেটা, মিডিয়াম কনফিডেন্স
    verificationStatus: 'PARTIAL' // যেহেতু অটো আনা, তাই আংশিক
  };
}

// =========================================================================
// CLOUDFLARE WORKER HANDLER – D1 + AUTO FETCH
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
    // ----- getDivisions (static) -----
    if (action === 'getDivisions') {
      const data = Object.entries(ENTERPRISE_GEO_REGISTRY.divisions).map(([key, item]) => ({ id: key, name: item.name }));
      return jsonResponse({ success: true, divisions: data }, 200, corsHeaders);
    }

    // ----- getDistricts (static) -----
    if (action === 'getDistricts') {
      const division = searchParams.get('division');
      if (!division) return jsonResponse({ success: false, error: 'Missing division' }, 400, corsHeaders);
      const normalized = GeoIntelligenceEngine.normalizeQueryLocation(division);
      const filtered = Object.entries(ENTERPRISE_GEO_REGISTRY.districts)
        .filter(([_, val]) => val.division === normalized)
        .map(([key, val]) => ({ id: key, name: val.name }));
      return jsonResponse({ success: true, districts: filtered }, 200, corsHeaders);
    }

    // ----- getThanas (static) -----
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
      if (!profileId) {
        return jsonResponse({ success: false, error: 'Missing profileId' }, 400, corsHeaders);
      }
      if (!env.DB) {
        return jsonResponse({ success: false, error: 'Database binding not found' }, 500, corsHeaders);
      }

      try {
        const updateQuery = `
          UPDATE profiles 
          SET verificationStatus = 'VERIFIED', 
              confidenceScore = GREATEST(confidenceScore, 92)
          WHERE id = ?
          RETURNING id, verificationStatus, confidenceScore
        `;
        const result = await env.DB.prepare(updateQuery).bind(profileId).first();
        if (!result) {
          return jsonResponse({ success: false, error: 'Profile not found' }, 404, corsHeaders);
        }
        return jsonResponse({
          success: true,
          profile: {
            id: result.id,
            verificationStatus: result.verificationStatus,
            confidenceScore: result.confidenceScore
          }
        }, 200, corsHeaders);
      } catch (err) {
        console.error('verifyProfile error:', err);
        return jsonResponse({ success: false, error: 'Database error: ' + err.message }, 500, corsHeaders);
      }
    }

    // ----- search (D1 + Auto Fetch) -----
    if (action === 'search') {
      if (!env.DB) {
        return jsonResponse({ success: false, error: 'Database binding not found' }, 500, corsHeaders);
      }

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

      // --- ১. D1-এ সার্চ করুন ---
      const conditions = [];
      const params = [];

      if (queryTerm) {
        conditions.push(`(name LIKE ? OR entityType LIKE ?)`);
        const q = `%${queryTerm}%`;
        params.push(q, q);
      }
      if (entityType !== 'all') {
        conditions.push(`entityType = ?`);
        params.push(entityType);
      }
      if (minConfidence > 0) {
        conditions.push(`confidenceScore >= ?`);
        params.push(minConfidence);
      }
      if (verificationStatus !== 'all') {
        conditions.push(`verificationStatus = ?`);
        params.push(verificationStatus);
      }
      if (division) {
        const normDiv = GeoIntelligenceEngine.normalizeQueryLocation(division);
        conditions.push(`division = ?`);
        params.push(normDiv);
      }
      if (district) {
        const normDist = GeoIntelligenceEngine.normalizeQueryLocation(district);
        conditions.push(`district = ?`);
        params.push(normDist);
      }
      if (thana) {
        const normThana = GeoIntelligenceEngine.normalizeQueryLocation(thana);
        conditions.push(`thana = ?`);
        params.push(normThana);
      }
      if (reqEmail) conditions.push(`email IS NOT NULL AND email != ''`);
      if (reqPhone) conditions.push(`phone IS NOT NULL AND phone != ''`);
      if (reqWhatsapp) conditions.push(`whatsapp IS NOT NULL AND whatsapp != ''`);
      if (reqSocial) conditions.push(`social IS NOT NULL AND social != ''`);

      let whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      // D1 থেকে ডেটা কাউন্ট
      const countQuery = `SELECT COUNT(*) as total FROM profiles ${whereClause}`;
      const countResult = await env.DB.prepare(countQuery).bind(...params).first();
      let totalRecords = countResult ? countResult.total : 0;

      let results = [];
      // যদি রেজাল্ট কম হয় এবং query টার্মটি ২ অক্ষরের বেশি হয়, তাহলে গুগল থেকে আনব
      if (totalRecords < 5 && queryTerm.length > 2) {
        const apiKey = env.GOOGLE_PLACES_API_KEY || '';
        if (apiKey) {
          console.log('🔄 Fetching from Google for:', queryTerm);
          const googlePlaces = await fetchFromGoogle(queryTerm, apiKey);
          
          if (googlePlaces.length > 0) {
            // প্রতিটি প্লেস ডেটাবেজে সেভ করি
            let insertedCount = 0;
            for (const place of googlePlaces) {
              const profile = mapGooglePlaceToProfile(place);
              try {
                const insertQuery = `
                  INSERT OR IGNORE INTO profiles (
                    id, name, entityType, division, district, thana, 
                    lat, lng, email, phone, whatsapp, social, 
                    confidenceScore, verificationStatus
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                await env.DB.prepare(insertQuery).bind(
                  profile.id,
                  profile.name,
                  profile.entityType,
                  profile.division,
                  profile.district,
                  profile.thana,
                  profile.lat,
                  profile.lng,
                  profile.email,
                  profile.phone,
                  profile.whatsapp,
                  profile.social,
                  profile.confidenceScore,
                  profile.verificationStatus
                ).run();
                insertedCount++;
              } catch (e) {
                console.error('Insert error for', profile.id, e.message);
              }
            }
            console.log(`✅ Inserted ${insertedCount} new profiles from Google.`);

            // D1 থেকে নতুন করে রিলোড করি (সদ্য সেভ করা ডেটাসহ)
            const newCountQuery = `SELECT COUNT(*) as total FROM profiles ${whereClause}`;
            const newCountResult = await env.DB.prepare(newCountQuery).bind(...params).first();
            totalRecords = newCountResult ? newCountResult.total : 0;
          }
        } else {
          console.warn('⚠️ Google API Key not configured.');
        }
      }

      // D1 থেকে চূড়ান্ত ডেটা কোয়েরি
      const dataQuery = `
        SELECT 
          id, name, entityType, division, district, thana,
          lat, lng,
          email, phone, whatsapp, social,
          confidenceScore, verificationStatus
        FROM profiles
        ${whereClause}
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, limit, offset];
      const dataResult = await env.DB.prepare(dataQuery).bind(...dataParams).all();
      results = dataResult.results || [];

      // রেডিয়াস ফিল্টার (JS-এ, কারণ D1-এ Haversine নেই)
      if (radius > 0 && thana) {
        const center = ENTERPRISE_GEO_REGISTRY.thanas[thana.toLowerCase()];
        if (center) {
          results = results.filter(p => {
            const dist = GeoIntelligenceEngine.calculateDistance(
              center.lat, center.lng,
              p.lat, p.lng
            );
            return dist <= radius;
          });
          totalRecords = results.length;
        }
      }

      // পেজিনেশন ঠিক করা (যেহেতু রেডিয়াস ফিল্টার JS-এ)
      const paginated = results.slice(0, limit);

      return jsonResponse({
        success: true,
        meta: {
          totalRecords: totalRecords,
          page,
          limit,
          totalPages: Math.ceil(totalRecords / limit)
        },
        contacts: paginated
      }, 200, corsHeaders);
    }

    // invalid action
    return jsonResponse({ success: false, error: 'Invalid action' }, 400, corsHeaders);

  } catch (error) {
    console.error('Unhandled error:', error);
    return jsonResponse({ 
      success: false, 
      error: 'Internal server error: ' + error.message 
    }, 500, corsHeaders);
  }
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    }
  });
}
