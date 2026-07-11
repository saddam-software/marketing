/**
 * AI-Powered Smart People & Business Finder Platform - Core Spatial API
 * File: functions/api/finder-api/location-secret.js
 * Architecture: Enterprise Clean Engine (SOLID Compliant) + JWT Secure
 */

// =========================================================================
// 🛡️ NATIVE WEB CRYPTO JWT HELPER (সিকিউরিটি ইঞ্জিন)
// ============================================================
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

// টোকেনটি আসল নাকি ভুয়া তা যাচাই করার ফাংশন
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
    
    // মেয়াদের সময় পার হয়ে গেছে কি না চেক করা
    if (payload.exp && (Date.now() / 1000) > payload.exp) {
      return { valid: false, error: 'Token has expired.' };
    }
    
    return { valid: true, user: payload };
  } catch (err) {
    return { valid: false, error: 'Invalid Token.' };
  }
}


// =========================================================================
// ENTERPRISE MASTER RECORD DATASET (Normalized Production-Grade Layer)
// =========================================================================
const ENTERPRISE_GEO_REGISTRY = {
  divisions: {
    'dhaka': { name: 'Dhaka', aliases: ['dhaka', 'ঢাকা', 'dhaka division'] },
    'chattogram': { name: 'Chattogram', aliases: ['chattogram', 'chittagong', 'চট্টগ্রাম', 'ctg'] },
    'sylhet': { name: 'Sylhet', aliases: ['sylhet', 'সিলেট'] },
    'rajshahi': { name: 'Rajshahi', aliases: ['rajshahi', 'রাজশাহী'] }
  },
  districts: {
    'dhaka': { division: 'dhaka', name: 'Dhaka', aliases: ['dhaka', 'ঢাকা'] },
    'gazipur': { division: 'dhaka', name: 'Gazipur', aliases: ['gazipur', 'গাজীপুর'] },
    'chattogram': { division: 'chattogram', name: 'Chattogram', aliases: ['chattogram', 'chittagong', 'চট্টগ্রাম'] }
  },
  thanas: {
    'dhanmondi': { district: 'dhaka', name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
    'gulshan': { district: 'dhaka', name: 'Gulshan', lat: 23.7925, lng: 90.4078 },
    'mirpur': { district: 'dhaka', name: 'Mirpur', lat: 23.8042, lng: 90.3667 },
    'halishahar': { district: 'chattogram', name: 'Halishahar', lat: 22.3364, lng: 91.7828 }
  }
};

const MASTER_PROFILES_REPOSITORY = [
  {
    id: 'MP-NODE-001',
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
    id: 'MP-NODE-002',
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
    id: 'MP-NODE-003',
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
    id: 'MP-NODE-004',
    name: 'Chittagong Port Logistics Hub',
    entityType: 'BUSINESS',
    division: 'chattogram',
    district: 'chattogram',
    thana: 'halishahar',
    coordinates: { lat: 22.3360, lng: 91.7820 },
    channels: { email: 'ops@ctglogistics.com', phone: '+8801512345681', whatsapp: '', social: '' },
    confidenceScore: 88,
    verificationStatus: 'VERIFIED'
  }
];

// =========================================================================
// GEO-INTELLIGENCE & SPATIAL CORE ENGINE
// =========================================================================
class GeoIntelligenceEngine {
  /**
   * Calculates distance between two points using the Haversine Formula
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Translates multi-language aliases to normalized uniform key names
   */
  static normalizeQueryLocation(term) {
    if (!term) return '';
    const cleanTerm = term.trim().toLowerCase();
    
    // Check inside Division Aliases
    for (const [key, node] of Object.entries(ENTERPRISE_GEO_REGISTRY.divisions)) {
      if (node.aliases.includes(cleanTerm)) return key;
    }
    // Check inside District Aliases
    for (const [key, node] of Object.entries(ENTERPRISE_GEO_REGISTRY.districts)) {
      if (node.aliases.includes(cleanTerm)) return key;
    }
    return cleanTerm;
  }
}

// =========================================================================
// CLOUDFLARE WORKER ROUTE REQUEST HANDLER INTERFACE
// =========================================================================
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const action = searchParams.get('action');

  // Enterprise Security Architecture: CORS Boundary Definitions
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 🛡️ Cryptographic Bearer Token Validation (Updated Secure Method)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ success: false, error: 'Unauthorized: Missing valid security context identity token.' }, 401, corsHeaders);
  }

  const token = authHeader.split(' ')[1];
  // wrangler.toml থেকে গোপন চাবি নেওয়া হচ্ছে
  const secret = env.JWT_SECRET || 'LocalDevelopmentSecretKey123!@#';
  
  const authResult = await verifyJWT(token, secret);
  if (!authResult.valid) {
    return jsonResponse({ success: false, error: `Unauthorized: ${authResult.error}` }, 401, corsHeaders);
  }

  // =========================================================================
  // ROUTING CONTROLLER LAYER
  // =========================================================================
  
  // Endpoint Hierarchy: Get Divisions Registry
  if (action === 'getDivisions') {
    const data = Object.entries(ENTERPRISE_GEO_REGISTRY.divisions).map(([key, item]) => ({ id: key, name: item.name }));
    return jsonResponse({ success: true, divisions: data }, 200, corsHeaders);
  }

  // Endpoint Hierarchy: Get Districts filtered by Division Node
  if (action === 'getDistricts') {
    const division = searchParams.get('division');
    if (!division) return jsonResponse({ success: false, error: 'Missing filter context target: division parameter required.' }, 400, corsHeaders);
    
    const normalizedDiv = GeoIntelligenceEngine.normalizeQueryLocation(division);
    const filteredDistricts = Object.entries(ENTERPRISE_GEO_REGISTRY.districts)
      .filter(([_, value]) => value.division === normalizedDiv)
      .map(([key, value]) => ({ id: key, name: value.name }));
      
    return jsonResponse({ success: true, districts: filteredDistricts }, 200, corsHeaders);
  }

  // Endpoint Hierarchy: Get Thanas filtered by District Node
  if (action === 'getThanas') {
    const district = searchParams.get('district');
    if (!district) return jsonResponse({ success: false, error: 'Missing filter context target: district parameter required.' }, 400, corsHeaders);
    
    const normalizedDist = GeoIntelligenceEngine.normalizeQueryLocation(district);
    const filteredThanas = Object.entries(ENTERPRISE_GEO_REGISTRY.thanas)
      .filter(([_, value]) => value.district === normalizedDist)
      .map(([key, value]) => ({ id: key, name: value.name, lat: value.lat, lng: value.lng }));

    return jsonResponse({ success: true, thanas: filteredThanas }, 200, corsHeaders);
  }

  // Core Processing Unit: Consolidated Unified Search Engine Execution Node
  if (action === 'search') {
    // Extract parameters from transaction execution request
    const queryTerm = searchParams.get('query') || '';
    const entityType = searchParams.get('entityType') || 'all';
    const division = searchParams.get('division') || '';
    const district = searchParams.get('district') || '';
    const thana = searchParams.get('thana') || '';
    const radius = parseFloat(searchParams.get('radius') || '0');
    const minConfidence = parseInt(searchParams.get('minConfidence') || '0', 10);
    const verificationStatus = searchParams.get('verificationStatus') || 'all';
    
    // Channel flags constraints
    const reqEmail = searchParams.get('hasEmail') === 'true';
    const reqPhone = searchParams.get('hasPhone') === 'true';
    const reqWhatsapp = searchParams.get('hasWhatsapp') === 'true';
    const reqSocial = searchParams.get('hasSocial') === 'true';

    // Pagination bounds configuration definitions
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const offset = (page - 1) * limit;

    // Filter processing framework pipeline
    let filteredResults = MASTER_PROFILES_REPOSITORY.filter(profile => {
      // 1. Text Similarity/NLP Keyword Search Engine Layer
      if (queryTerm) {
        const cleanQuery = queryTerm.toLowerCase();
        const matchesText = profile.name.toLowerCase().includes(cleanQuery) || 
                            profile.entityType.toLowerCase().includes(cleanQuery);
        if (!matchesText) return false;
      }

      // 2. Entity Architecture Type Rule
      if (entityType !== 'all' && profile.entityType !== entityType) return false;

      // 3. Trust Metric Confidence Threshold Validation
      if (profile.confidenceScore < minConfidence) return false;

      // 4. Verification Framework State Check
      if (verificationStatus !== 'all' && profile.verificationStatus !== verificationStatus) return false;

      // 5. Geographic Strict Structural Match Filtering Rules
      if (division && profile.division !== GeoIntelligenceEngine.normalizeQueryLocation(division)) return false;
      if (district && profile.district !== GeoIntelligenceEngine.normalizeQueryLocation(district)) return false;
      if (thana && profile.thana !== GeoIntelligenceEngine.normalizeQueryLocation(thana)) return false;

      // 6. Spatial Radius Match Rules Evaluation (Haversine Implementation Engine Layer)
      if (radius > 0 && thana) {
        const centerThanaNode = ENTERPRISE_GEO_REGISTRY.thanas[thana.toLowerCase()];
        if (centerThanaNode) {
          const actualDistance = GeoIntelligenceEngine.calculateDistance(
            centerThanaNode.lat, centerThanaNode.lng,
            profile.coordinates.lat, profile.coordinates.lng
          );
          if (actualDistance > radius) return false;
        }
      }

      // 7. Dynamic Matrix Data Channel Flow Validations
      if (reqEmail && (!profile.channels || !profile.channels.email)) return false;
      if (reqPhone && (!profile.channels || !profile.channels.phone)) return false;
      if (reqWhatsapp && (!profile.channels || !profile.channels.whatsapp)) return false;
      if (reqSocial && (!profile.channels || !profile.channels.social)) return false;

      return true;
    });

    // Compute Enterprise Aggregations & Metadata Previews before slice slicing
    const totalRecords = filteredResults.length;
    const paginatedRecords = filteredResults.slice(offset, offset + limit);

    return jsonResponse({
      success: true,
      meta: {
        totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit)
      },
      contacts: paginatedRecords
    }, 200, corsHeaders);
  }

  // Fallback Rule Handler Execution State
  return jsonResponse({ success: false, error: 'Execution Rejected: Bad Command Action Resource Request Path Parameter.' }, 400, corsHeaders);
}

// =========================================================================
// PIPELINE RESPONSE UTILITY HELPER
// =========================================================================
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    }
  });
}
