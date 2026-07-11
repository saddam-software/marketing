/**
 * AI-Powered Smart People & Business Finder Platform - Core Spatial API
 * Clean version – no console logs.
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
// GEO REGISTRY (Full Bangladesh 8 Divisions, 26+ Districts, 20+ Thanas)
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
// MASTER PROFILES (18+ sample entities)
// =========================================================================
const MASTER_PROFILES_REPOSITORY = [
  {
    id: 'MP-001',
    name: 'TechNova Solutions Ltd.',
    entityType: 'BUSINESS',
    division: 'dhaka',
    district: 'dhaka',
    thana: 'gulshan',
    coordinates: { lat: 23.7929, lng: 90.4082 },
    channels: { email: 'info@technova.io', phone: '+8801712345678', whatsapp: '+8801712345678', social: 'linkedin.com/company/technova' },
    confidenceScore: 98,
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'MP-002',
    name: 'Dr. Sarah Rahman (Data AI Consultant)',
    entityType: 'PROFESSIONAL',
    division: 'dhaka',
    district: 'dhaka',
    thana: 'dhanmondi',
    coordinates: { lat: 23.7465, lng: 90.3750 },
    channels: { email: 'sarah.ai@freelance.net', phone: '+8801812345679', whatsapp: '', social: 'github.com/sarah-ai' },
    confidenceScore: 92,
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'MP-003',
    name: 'Creative Pixel Studio',
    entityType: 'CREATOR',
    division: 'dhaka',
    district: 'dhaka',
    thana: 'mirpur',
    coordinates: { lat: 23.8050, lng: 90.3670 },
    channels: { email: '', phone: '+8801912345680', whatsapp: '+8801912345680', social: 'youtube.com/creativepixel' },
    confidenceScore: 78,
    verificationStatus: 'PARTIAL'
  },
  {
    id: 'MP-004',
    name: 'Software Valley Ltd.',
    entityType: 'BUSINESS',
    division: 'dhaka',
    district: 'dhaka',
    thana: 'uttara',
    coordinates: { lat: 23.8729, lng: 90.3987 },
    channels: { email: 'contact@swvalley.com', phone: '+8801712345690', whatsapp: '+8801712345690', social: 'twitter.com/swvalley' },
    confidenceScore: 95,
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'MP-005',
    name: 'Green Textile Mills',
    entityType: 'BUSINESS',
    division: 'dhaka',
    district: 'gazipur',
    thana: 'gazipur_sadar',
    coordinates: { lat: 23.9994, lng: 90.4204 },
    channels: { email: 'info@greentex.com', phone: '+8801812345681', whatsapp: '', social: '' },
    confidenceScore: 85,
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'MP-006',
    name: 'Chittagong Port Logistics Hub',
    entityType: 'BUSINESS',
    division: 'chattogram',
    district: 'chattogram',
    thana: 'halishahar',
    coordinates: { lat: 22.3360, lng: 91.7820 },
    channels: { email: 'ops@ctglogistics.com', phone: '+8801512345681', whatsapp: '', social: '' },
    confidenceScore: 88,
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'MP-007',
    name: 'Dr. Anwar Hossain (Marine Biologist)',
    entityType: 'PROFESSIONAL',
    division: 'chattogram',
    district: 'chattogram',
    thana: 'khulshi',
    coordinates: { lat: 22.3519, lng: 91.7961 },
    channels: { email: 'anwar.marine@research.org', phone: '+8801812345682', whatsapp: '', social: 'researchgate.net/anwar' },
    confidenceScore: 91,
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'MP-008',
    name: 'Seagull Resort & Spa',
    entityType: 'SERVICE',
    division: 'chattogram',
    district: 'cox_bazar',
    thana: 'cox_bazar_sadar',
    coordinates: { lat: 21.4272, lng: 92.0058 },
    channels: { email: 'reservations@seagull.com', phone: '+8801712345691', whatsapp: '+8801712345691', social: 'facebook.com/seagullresort' },
    confidenceScore: 82,
    verificationStatus: 'PARTIAL'
  },
  {
    id: 'MP-009',
    name: 'Tea Valley Agro Ltd.',
    entityType: 'BUSINESS',
    division: 'sylhet',
    district: 'sylhet',
    thana: 'sylhet_sadar',
    coordinates: { lat: 24.8996, lng: 91.8710 },
    channels: { email: 'info@teavalley.com', phone: '+8801912345692', whatsapp: '', social: '' },
    confidenceScore: 76,
    verificationStatus: 'PARTIAL'
  },
  {
    id: 'MP-010',
    name: 'Sylhet Digital Hub',
    entityType: 'BUSINESS',
    division: 'sylhet',
    district: 'sylhet',
    thana: 'shahparan',
    coordinates: { lat: 24.9038, lng: 91.8698 },
    channels: { email: 'hello@sylhetdigital.com', phone: '+8801712345693', whatsapp: '+8801712345693', social: 'twitter.com/sylhetdig' },
    confidenceScore: 93,
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'MP-011',
    name: 'Rajshahi Silk House',
    entityType: 'BUSINESS',
    division: 'rajshahi',
    district: 'rajshahi',
    thana: 'rajshahi_sadar',
    coordinates: { lat: 24.3745, lng: 88.6041 },
    channels: { email: 'silk@rajshahi.com', phone: '+8801812345694', whatsapp: '', social: '' },
    confidenceScore: 70,
    verificationStatus: 'PARTIAL'
  },
  {
    id: 'MP-012',
    name: 'Sundarban Eco Tours',
    entityType: 'SERVICE',
    division: 'khulna',
    district: 'khulna',
    thana: 'khulna_sadar',
    coordinates: { lat: 22.8456, lng: 89.5403 },
    channels: { email: 'info@sundarbantours.com', phone: '+8801712345695', whatsapp: '+8801712345695', social: 'instagram.com/sundarbaneco' },
    confidenceScore: 86,
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'MP-013',
    name: 'Riverine Fisheries Ltd.',
    entityType: 'BUSINESS',
    division: 'barishal',
    district: 'barishal',
    thana: 'barishal_sadar',
    coordinates: { lat: 22.7010, lng: 90.3535 },
    channels: { email: 'catch@riverine.com', phone: '+8801912345696', whatsapp: '', social: '' },
    confidenceScore: 80,
    verificationStatus: 'PARTIAL'
  },
  {
    id: 'MP-014',
    name: 'Rangpur Agro Industries',
    entityType: 'BUSINESS',
    division: 'rangpur',
    district: 'rangpur',
    thana: 'rangpur_sadar',
    coordinates: { lat: 25.7468, lng: 89.2508 },
    channels: { email: 'agro@rangpur.com', phone: '+8801812345697', whatsapp: '', social: '' },
    confidenceScore: 75,
    verificationStatus: 'PARTIAL'
  },
  {
    id: 'MP-015',
    name: 'Mymensingh Dairy Co.',
    entityType: 'BUSINESS',
    division: 'mymensingh',
    district: 'mymensingh',
    thana: 'mymensingh_sadar',
    coordinates: { lat: 24.7471, lng: 90.4203 },
    channels: { email: 'dairy@mymensingh.com', phone: '+8801712345698', whatsapp: '', social: '' },
    confidenceScore: 68,
    verificationStatus: 'UNVERIFIED'
  },
  {
    id: 'MP-016',
    name: 'Nadia Akhter (Content Creator)',
    entityType: 'CREATOR',
    division: 'dhaka',
    district: 'dhaka',
    thana: 'motijheel',
    coordinates: { lat: 23.7330, lng: 90.4172 },
    channels: { email: 'nadia@contentstudio.com', phone: '', whatsapp: '', social: 'youtube.com/nadia_creates' },
    confidenceScore: 85,
    verificationStatus: 'VERIFIED'
  },
  {
    id: 'MP-017',
    name: 'IT Support Bangladesh',
    entityType: 'SERVICE',
    division: 'dhaka',
    district: 'narayanganj',
    thana: 'narayanganj_sadar',
    coordinates: { lat: 23.6233, lng: 90.5000 },
    channels: { email: 'support@itbd.com', phone: '+8801812345699', whatsapp: '+8801812345699', social: '' },
    confidenceScore: 90,
    verificationStatus: 'VERIFIED'
  }
];

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

  // Routes
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

  if (action === 'search') {
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

    let results = MASTER_PROFILES_REPOSITORY.filter(p => {
      if (queryTerm) {
        const q = queryTerm.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.entityType.toLowerCase().includes(q)) return false;
      }
      if (entityType !== 'all' && p.entityType !== entityType) return false;
      if (p.confidenceScore < minConfidence) return false;
      if (verificationStatus !== 'all' && p.verificationStatus !== verificationStatus) return false;
      if (division && p.division !== GeoIntelligenceEngine.normalizeQueryLocation(division)) return false;
      if (district && p.district !== GeoIntelligenceEngine.normalizeQueryLocation(district)) return false;
      if (thana && p.thana !== GeoIntelligenceEngine.normalizeQueryLocation(thana)) return false;

      if (radius > 0 && thana) {
        const center = ENTERPRISE_GEO_REGISTRY.thanas[thana.toLowerCase()];
        if (center) {
          const dist = GeoIntelligenceEngine.calculateDistance(
            center.lat, center.lng,
            p.coordinates.lat, p.coordinates.lng
          );
          if (dist > radius) return false;
        }
      }

      if (reqEmail && (!p.channels || !p.channels.email)) return false;
      if (reqPhone && (!p.channels || !p.channels.phone)) return false;
      if (reqWhatsapp && (!p.channels || !p.channels.whatsapp)) return false;
      if (reqSocial && (!p.channels || !p.channels.social)) return false;

      return true;
    });

    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    return jsonResponse({
      success: true,
      meta: {
        totalRecords: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      contacts: paginated
    }, 200, corsHeaders);
  }

  return jsonResponse({ success: false, error: 'Invalid action' }, 400, corsHeaders);
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
