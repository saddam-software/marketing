// functions/api/finder-api/location-secret.js
// ============================================================
//  Location-Based Contact Search API
//  Returns district, thana lists and filtered contacts.
// ============================================================

// ========== DEMO DATA (hardcoded) ==========
const LOCATION_DATA = {
  districts: {
    'Dhaka': ['Dhanmondi', 'Gulshan', 'Mirpur', 'Uttara', 'Motijheel'],
    'Chittagong': ['Pahartali', 'Halishahar', 'Agrabad', 'Chawkbazar'],
    'Rajshahi': ['Boalia', 'Motihar', 'Shaheb Bazar'],
    'Khulna': ['Sonadanga', 'Khalishpur', 'Daulatpur'],
    'Sylhet': ['Zindabazar', 'Amberkhana', 'Mirabazar']
  },
  contacts: [
    // Dhaka
    { district: 'Dhaka', thana: 'Dhanmondi', name: 'Mr. Rahman', email: 'rahman@example.com', phone: '+8801712345678' },
    { district: 'Dhaka', thana: 'Dhanmondi', name: 'Ms. Akter', email: 'akter@demo.com', phone: '+8801812345679' },
    { district: 'Dhaka', thana: 'Gulshan', name: 'Mr. Khan', email: 'khan@business.com', phone: '+8801912345680' },
    { district: 'Dhaka', thana: 'Gulshan', name: 'Mrs. Sultana', email: 'sultana@test.org', phone: '+8801512345681' },
    { district: 'Dhaka', thana: 'Mirpur', name: 'Mr. Islam', email: 'islam@mail.com', phone: '+8801612345682' },
    { district: 'Dhaka', thana: 'Uttara', name: 'Ms. Haque', email: 'haque@domain.net', phone: '+8801712345683' },
    // Chittagong
    { district: 'Chittagong', thana: 'Pahartali', name: 'Mr. Chowdhury', email: 'chowdhury@ctg.com', phone: '+8801812345684' },
    { district: 'Chittagong', thana: 'Halishahar', name: 'Mr. Das', email: 'das@ctg.org', phone: '+8801912345685' },
    { district: 'Chittagong', thana: 'Agrabad', name: 'Ms. Sen', email: 'sen@ctg.net', phone: '+8801512345686' },
    // Rajshahi
    { district: 'Rajshahi', thana: 'Boalia', name: 'Mr. Hossain', email: 'hossain@rjs.com', phone: '+8801612345687' },
    { district: 'Rajshahi', thana: 'Motihar', name: 'Ms. Khatun', email: 'khatun@rjs.org', phone: '+8801712345688' },
    // Khulna
    { district: 'Khulna', thana: 'Sonadanga', name: 'Mr. Ali', email: 'ali@khulna.com', phone: '+8801812345689' },
    { district: 'Khulna', thana: 'Khalishpur', name: 'Ms. Biswas', email: 'biswas@khulna.org', phone: '+8801912345690' },
    // Sylhet
    { district: 'Sylhet', thana: 'Zindabazar', name: 'Mr. Ahmad', email: 'ahmad@syl.com', phone: '+8801512345691' },
    { district: 'Sylhet', thana: 'Amberkhana', name: 'Ms. Nargis', email: 'nargis@syl.net', phone: '+8801612345692' },
  ]
};

/**
 * GET handler for location data and search.
 * Query parameters:
 * - action: 'getLocations' (returns districts)
 * - action: 'getThanas&district=Dhaka' (returns thanas for a district)
 * - action: 'search&district=Dhaka&thana=Gulshan' (returns contacts)
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  // Handle actions
  if (action === 'getLocations') {
    const districts = Object.keys(LOCATION_DATA.districts);
    return jsonResponse({ success: true, districts }, 200, corsHeaders);
  }

  if (action === 'getThanas') {
    const district = url.searchParams.get('district');
    if (!district) {
      return jsonResponse({ success: false, error: 'District parameter required' }, 400, corsHeaders);
    }
    const thanas = LOCATION_DATA.districts[district] || [];
    return jsonResponse({ success: true, thanas }, 200, corsHeaders);
  }

  if (action === 'search') {
    const district = url.searchParams.get('district');
    const thana = url.searchParams.get('thana');
    if (!district || !thana) {
      return jsonResponse({ success: false, error: 'Both district and thana required' }, 400, corsHeaders);
    }
    const contacts = LOCATION_DATA.contacts.filter(c =>
      c.district === district && c.thana === thana
    );
    return jsonResponse({ success: true, contacts }, 200, corsHeaders);
  }

  // Invalid action
  return jsonResponse({ success: false, error: 'Invalid action parameter' }, 400, corsHeaders);
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
