/**
 * Location Finder API - Geographic Hierarchy Endpoints
 * Handles Division, District, Thana queries
 */

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

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const action = searchParams.get('action');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ✅ সিম্পল টোকেন চেক (ব্রাউজার থেকে Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse(
      { success: false, error: 'Unauthorized: Missing authentication token' },
      401,
      corsHeaders
    );
  }

  try {
    // getDivisions - সকল Division লিস্ট
    if (action === 'getDivisions') {
      const divisions = Object.entries(ENTERPRISE_GEO_REGISTRY.divisions).map(([key, item]) => ({
        id: key,
        name: item.name
      }));
      return jsonResponse({ success: true, divisions }, 200, corsHeaders);
    }

    // getDistricts - নির্দিষ্ট Division এর সকল District
    if (action === 'getDistricts') {
      const division = searchParams.get('division');
      if (!division) {
        return jsonResponse(
          { success: false, error: 'Missing division parameter' },
          400,
          corsHeaders
        );
      }

      const districts = Object.entries(ENTERPRISE_GEO_REGISTRY.districts)
        .filter(([_, value]) => value.division === division)
        .map(([key, value]) => ({
          id: key,
          name: value.name
        }));

      return jsonResponse({ success: true, districts }, 200, corsHeaders);
    }

    // getThanas - নির্দিষ্ট District এর সকল Thana
    if (action === 'getThanas') {
      const district = searchParams.get('district');
      if (!district) {
        return jsonResponse(
          { success: false, error: 'Missing district parameter' },
          400,
          corsHeaders
        );
      }

      const thanas = Object.entries(ENTERPRISE_GEO_REGISTRY.thanas)
        .filter(([_, value]) => value.district === district)
        .map(([key, value]) => ({
          id: key,
          name: value.name,
          lat: value.lat,
          lng: value.lng
        }));

      return jsonResponse({ success: true, thanas }, 200, corsHeaders);
    }

    return jsonResponse(
      { success: false, error: 'Invalid action parameter' },
      400,
      corsHeaders
    );
  } catch (error) {
    console.error('Location API Error:', error);
    return jsonResponse(
      { success: false, error: error.message },
      500,
      corsHeaders
    );
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
