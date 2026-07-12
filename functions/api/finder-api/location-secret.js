/**
 * AI-Powered Smart People & Business Finder Platform - Core Spatial API
 * MULTI-COUNTRY + MULTI-SOURCE AUTO-CACHING ENGINE (Hybrid)
 * Countries: Bangladesh, India, UAE, Thailand, Niger, Argentina, Ireland, Malta, Brazil
 * Active APIs: All 114 APIs (configured with active: true)
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
// ENTERPRISE GEO REGISTRY (9 Countries × 3 Divisions × 3 Districts × 3 Thanas)
// =========================================================================
const ENTERPRISE_GEO_REGISTRY = {
  // =====================================================================
  // COUNTRIES (Top-level)
  // =====================================================================
  countries: {
    'bangladesh': { name: 'Bangladesh', code: 'BD' },
    'india': { name: 'India', code: 'IN' },
    'uae': { name: 'United Arab Emirates', code: 'AE' },
    'thailand': { name: 'Thailand', code: 'TH' },
    'niger': { name: 'Niger (West African)', code: 'NE' },
    'argentina': { name: 'Argentina', code: 'AR' },
    'ireland': { name: 'Ireland', code: 'IE' },
    'malta': { name: 'Malta', code: 'MT' },
    'brazil': { name: 'Brazil', code: 'BR' }
  },

  // =====================================================================
  // DIVISIONS (State/Province/Region level)
  // =====================================================================
  divisions: {
    // ===== BANGLADESH (3 Divisions) =====
    'dhaka': { country: 'bangladesh', name: 'Dhaka', aliases: ['dhaka', 'ঢাকা'] },
    'chattogram': { country: 'bangladesh', name: 'Chattogram', aliases: ['chattogram', 'chittagong', 'চট্টগ্রাম'] },
    'sylhet': { country: 'bangladesh', name: 'Sylhet', aliases: ['sylhet', 'সিলেট'] },

    // ===== INDIA (3 States) =====
    'maharashtra': { country: 'india', name: 'Maharashtra', aliases: ['maharashtra'] },
    'karnataka': { country: 'india', name: 'Karnataka', aliases: ['karnataka'] },
    'tamil_nadu': { country: 'india', name: 'Tamil Nadu', aliases: ['tamil nadu'] },

    // ===== UAE (3 Emirates) =====
    'dubai': { country: 'uae', name: 'Dubai', aliases: ['dubai'] },
    'abu_dhabi': { country: 'uae', name: 'Abu Dhabi', aliases: ['abu dhabi'] },
    'sharjah': { country: 'uae', name: 'Sharjah', aliases: ['sharjah'] },

    // ===== THAILAND (3 Regions) =====
    'bangkok_metropolitan': { country: 'thailand', name: 'Bangkok Metropolitan', aliases: ['bangkok'] },
    'chonburi': { country: 'thailand', name: 'Chonburi', aliases: ['chonburi'] },
    'chiang_mai': { country: 'thailand', name: 'Chiang Mai', aliases: ['chiang mai'] },

    // ===== NIGER (3 Departments) =====
    'niamey': { country: 'niger', name: 'Niamey', aliases: ['niamey'] },
    'tillaberi': { country: 'niger', name: 'Tillaberi', aliases: ['tillaberi'] },
    'dosso': { country: 'niger', name: 'Dosso', aliases: ['dosso'] },

    // ===== ARGENTINA (3 Provinces) =====
    'buenos_aires': { country: 'argentina', name: 'Buenos Aires', aliases: ['buenos aires'] },
    'cordoba': { country: 'argentina', name: 'Cordoba', aliases: ['cordoba'] },
    'mendoza': { country: 'argentina', name: 'Mendoza', aliases: ['mendoza'] },

    // ===== IRELAND (3 Provinces) =====
    'leinster': { country: 'ireland', name: 'Leinster', aliases: ['leinster'] },
    'munster': { country: 'ireland', name: 'Munster', aliases: ['munster'] },
    'connacht': { country: 'ireland', name: 'Connacht', aliases: ['connacht'] },

    // ===== MALTA (3 Regions) =====
    'south_eastern': { country: 'malta', name: 'South Eastern', aliases: ['south eastern'] },
    'northern': { country: 'malta', name: 'Northern', aliases: ['northern'] },
    'port': { country: 'malta', name: 'Port', aliases: ['port'] },

    // ===== BRAZIL (3 States) =====
    'sao_paulo': { country: 'brazil', name: 'São Paulo', aliases: ['sao paulo'] },
    'rio_de_janeiro': { country: 'brazil', name: 'Rio de Janeiro', aliases: ['rio de janeiro'] },
    'minas_gerais': { country: 'brazil', name: 'Minas Gerais', aliases: ['minas gerais'] }
  },

  // =====================================================================
  // DISTRICTS (City/County level) - Each linked to a Division
  // =====================================================================
  districts: {
    // ===== BANGLADESH (6 Districts) =====
    'dhaka': { division: 'dhaka', name: 'Dhaka' },
    'gazipur': { division: 'dhaka', name: 'Gazipur' },
    'narayanganj': { division: 'dhaka', name: 'Narayanganj' },
    'chattogram': { division: 'chattogram', name: 'Chattogram' },
    'cox_bazar': { division: 'chattogram', name: "Cox's Bazar" },
    'sylhet': { division: 'sylhet', name: 'Sylhet' },

    // ===== INDIA (4 Districts) =====
    'mumbai': { division: 'maharashtra', name: 'Mumbai' },
    'pune': { division: 'maharashtra', name: 'Pune' },
    'bangalore': { division: 'karnataka', name: 'Bangalore' },
    'chennai': { division: 'tamil_nadu', name: 'Chennai' },

    // ===== UAE (3 Districts) =====
    'dubai_city': { division: 'dubai', name: 'Dubai City' },
    'abu_dhabi_city': { division: 'abu_dhabi', name: 'Abu Dhabi City' },
    'sharjah_city': { division: 'sharjah', name: 'Sharjah City' },

    // ===== THAILAND (3 Districts) =====
    'bangkok_city': { division: 'bangkok_metropolitan', name: 'Bangkok City' },
    'pattaya': { division: 'chonburi', name: 'Pattaya' },
    'chiang_mai_city': { division: 'chiang_mai', name: 'Chiang Mai City' },

    // ===== NIGER (3 Districts) =====
    'niamey_city': { division: 'niamey', name: 'Niamey City' },
    'tillaberi_city': { division: 'tillaberi', name: 'Tillaberi City' },
    'dosso_city': { division: 'dosso', name: 'Dosso City' },

    // ===== ARGENTINA (3 Districts) =====
    'buenos_aires_city': { division: 'buenos_aires', name: 'Buenos Aires City' },
    'cordoba_city': { division: 'cordoba', name: 'Cordoba City' },
    'mendoza_city': { division: 'mendoza', name: 'Mendoza City' },

    // ===== IRELAND (3 Districts) =====
    'dublin': { division: 'leinster', name: 'Dublin' },
    'cork': { division: 'munster', name: 'Cork' },
    'galway': { division: 'connacht', name: 'Galway' },

    // ===== MALTA (3 Districts) =====
    'valletta': { division: 'south_eastern', name: 'Valletta' },
    'mosta': { division: 'northern', name: 'Mosta' },
    'birgu': { division: 'port', name: 'Birgu' },

    // ===== BRAZIL (3 Districts) =====
    'sao_paulo_city': { division: 'sao_paulo', name: 'São Paulo City' },
    'rio_city': { division: 'rio_de_janeiro', name: 'Rio City' },
    'belo_horizonte': { division: 'minas_gerais', name: 'Belo Horizonte' }
  },

  // =====================================================================
  // THANAS (Neighborhood/Zone level) - Each linked to a District with GPS
  // =====================================================================
  thanas: {
    // ===== BANGLADESH (5 Thanas) =====
    'gulshan': { district: 'dhaka', name: 'Gulshan', lat: 23.7925, lng: 90.4078 },
    'dhanmondi': { district: 'dhaka', name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
    'uttara': { district: 'dhaka', name: 'Uttara', lat: 23.8729, lng: 90.3987 },
    'cox_bazar_sadar': { district: 'cox_bazar', name: "Cox's Bazar Sadar", lat: 21.4272, lng: 92.0058 },
    'sylhet_sadar': { district: 'sylhet', name: 'Sylhet Sadar', lat: 24.8996, lng: 91.8710 },

    // ===== INDIA (3 Thanas) =====
    'andheri': { district: 'mumbai', name: 'Andheri', lat: 19.1197, lng: 72.8468 },
    'bandra': { district: 'mumbai', name: 'Bandra', lat: 19.0596, lng: 72.8295 },
    'indiranagar': { district: 'bangalore', name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },

    // ===== UAE (3 Thanas) =====
    'downtown_dubai': { district: 'dubai_city', name: 'Downtown Dubai', lat: 25.1961, lng: 55.2741 },
    'marina': { district: 'dubai_city', name: 'Dubai Marina', lat: 25.0801, lng: 55.1431 },
    'corniche': { district: 'abu_dhabi_city', name: 'Corniche', lat: 24.4667, lng: 54.3667 },

    // ===== THAILAND (3 Thanas) =====
    'sukhumvit': { district: 'bangkok_city', name: 'Sukhumvit', lat: 13.7367, lng: 100.5623 },
    'silom': { district: 'bangkok_city', name: 'Silom', lat: 13.7249, lng: 100.5234 },
    'old_city': { district: 'chiang_mai_city', name: 'Old City', lat: 18.7893, lng: 98.9852 },

    // ===== NIGER (3 Thanas) =====
    'plateau': { district: 'niamey_city', name: 'Plateau', lat: 13.5127, lng: 2.1126 },
    'goudel': { district: 'niamey_city', name: 'Goudel', lat: 13.5064, lng: 2.0982 },
    'kollo': { district: 'tillaberi_city', name: 'Kollo', lat: 13.3056, lng: 1.9833 },

    // ===== ARGENTINA (3 Thanas) =====
    'palermo': { district: 'buenos_aires_city', name: 'Palermo', lat: -34.5889, lng: -58.4306 },
    'recoleta': { district: 'buenos_aires_city', name: 'Recoleta', lat: -34.5889, lng: -58.3924 },
    'nueva_cordoba': { district: 'cordoba_city', name: 'Nueva Cordoba', lat: -31.4201, lng: -64.1888 },

    // ===== IRELAND (3 Thanas) =====
    'temple_bar': { district: 'dublin', name: 'Temple Bar', lat: 53.3454, lng: -6.2622 },
    'docklands': { district: 'dublin', name: 'Docklands', lat: 53.3471, lng: -6.2411 },
    'cork_city_center': { district: 'cork', name: 'Cork City Center', lat: 51.8985, lng: -8.4756 },

    // ===== MALTA (3 Thanas) =====
    'valletta_waterfront': { district: 'valletta', name: 'Valletta Waterfront', lat: 35.8989, lng: 14.5146 },
    'mosta_dome': { district: 'mosta', name: 'Mosta Dome', lat: 35.9092, lng: 14.4266 },
    'birgu_waterfront': { district: 'birgu', name: 'Birgu Waterfront', lat: 35.8875, lng: 14.5226 },

    // ===== BRAZIL (3 Thanas) =====
    'paulista': { district: 'sao_paulo_city', name: 'Paulista', lat: -23.5617, lng: -46.6561 },
    'vila_olimpia': { district: 'sao_paulo_city', name: 'Vila Olimpia', lat: -23.5939, lng: -46.6875 },
    'copacabana': { district: 'rio_city', name: 'Copacabana', lat: -22.9711, lng: -43.1803 }
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

  static normalizeQueryLocation(term, type) {
    if (!term) return '';
    const clean = term.trim().toLowerCase();
    const target = type === 'division' ? ENTERPRISE_GEO_REGISTRY.divisions : 
                  type === 'district' ? ENTERPRISE_GEO_REGISTRY.districts : 
                  ENTERPRISE_GEO_REGISTRY.thanas;
    for (const [key, node] of Object.entries(target)) {
      if (node.aliases && node.aliases.includes(clean)) return key;
      if (node.name && node.name.toLowerCase() === clean) return key;
    }
    return clean;
  }

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

// =========================================================================
// API CONFIGURATIONS (Full 114 APIs - Mapped to existing D1 schema)
// =========================================================================
const API_CONFIG = {
  // ===== 1. 6sense API =====
  sixsense: {
    name: '6sense API', active: true,
    fetch: async (q, env) => {
      const key = env.SIXSENSE_API_KEY;
      if (!key || key === 'YOUR_SIXSENSE_API_KEY') return [];
      try {
        const url = `https://api.6sense.com/v2/companies/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.data || []).map(c => ({ source: '6sense', id: `6s_${c.id || Date.now()}`, name: c.name || 'Unknown', address: c.location || '', lat: 0, lng: 0, phone: c.phone || '', website: c.website || '', types: ['business'], confidence: 65 }));
      } catch (e) { return []; }
    }
  },
  // ===== 2. Abstract API (IP Geolocation) =====
  abstract: {
    name: 'Abstract API', active: true,
    fetch: async (q, env) => {
      const key = env.ABSTRACT_API_KEY;
      if (!key || key === 'YOUR_ABSTRACT_API_KEY') return [];
      try {
        const url = `https://ipgeolocation.abstractapi.com/v1/?api_key=${key}&ip_address=${encodeURIComponent(q)}`;
        const res = await fetch(url); const d = await res.json();
        if (d.latitude) {
          return [{ source: 'abstract', id: `abs_${Date.now()}`, name: d.city || q, address: `${d.country}, ${d.region}`, lat: d.latitude, lng: d.longitude, phone: '', website: '', types: ['location'], confidence: 50 }];
        } return [];
      } catch (e) { return []; }
    }
  },
  // ===== 3. Alpha Vantage (Stocks/Crypto) =====
  alphavantage: {
    name: 'Alpha Vantage', active: true,
    fetch: async (q, env) => {
      const key = env.ALPHA_VANTAGE_API_KEY;
      if (!key || key === 'YOUR_ALPHA_VANTAGE_API_KEY') return [];
      try {
        const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.bestMatches || []).map(m => ({ source: 'alphavantage', id: `av_${m['1. symbol'] || Date.now()}`, name: m['2. name'] || m['1. symbol'], address: m['4. region'] || '', lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 4. Amadeus Travel API =====
  amadeus: {
    name: 'Amadeus Travel', active: true,
    fetch: async (q, env) => {
      const key = env.AMADEUS_API_KEY;
      const secret = env.AMADEUS_CLIENT_SECRET;
      if (!key || !secret) return [];
      try {
        const tokenRes = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `grant_type=client_credentials&client_id=${key}&client_secret=${secret}`
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) return [];
        const searchRes = await fetch(`https://test.api.amadeus.com/v1/reference-data/locations?subType=AIRPORT&keyword=${encodeURIComponent(q)}`, {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const d = await searchRes.json();
        return (d.data || []).map(loc => ({ source: 'amadeus', id: `amd_${loc.id}`, name: loc.name || q, address: `${loc.address?.cityName || ''}, ${loc.address?.countryName || ''}`, lat: loc.geoCode?.latitude || 0, lng: loc.geoCode?.longitude || 0, phone: '', website: '', types: ['travel'], confidence: 55 }));
      } catch (e) { return []; }
    }
  },
  // ===== 5. Amplemarket API =====
  amplemarket: {
    name: 'Amplemarket API', active: true,
    fetch: async (q, env) => {
      const key = env.AMPLEMARKET_API_KEY;
      if (!key || key === 'YOUR_AMPLEMARKET_API_KEY') return [];
      try {
        const url = `https://api.amplemarket.com/v1/people/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.people || []).map(p => ({ source: 'amplemarket', id: `am_${p.id}`, name: p.name || 'Unknown', address: p.location || '', lat: 0, lng: 0, phone: p.phone || '', website: p.company_website || '', types: ['professional'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 6. Apify =====
  apify: {
    name: 'Apify', active: true,
    fetch: async (q, env) => {
      const key = env.APIFY_API_KEY;
      if (!key || key === 'YOUR_APIFY_API_KEY') return [];
      try {
        const url = `https://api.apify.com/v2/datasets?token=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.data?.items || []).slice(0, 5).map(item => ({ source: 'apify', id: `ap_${item.id || Date.now()}`, name: item.name || q, address: item.address || '', lat: item.lat || 0, lng: item.lng || 0, phone: item.phone || '', website: item.website || '', types: ['web'], confidence: 45 }));
      } catch (e) { return []; }
    }
  },
  // ===== 7. Apollo.io API =====
  apollo: {
    name: 'Apollo.io API', active: true,
    fetch: async (q, env) => {
      const key = env.APOLLO_API_KEY;
      if (!key || key === 'YOUR_APOLLO_API_KEY') return [];
      try {
        const url = `https://api.apollo.io/v1/mixed_people/search?q=${encodeURIComponent(q)}&api_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.people || []).map(p => ({ source: 'apollo', id: `apollo_${p.id}`, name: p.name || 'Unknown', address: p.location || '', lat: 0, lng: 0, phone: p.phone || '', website: p.website || '', types: ['business'], confidence: 75 }));
      } catch (e) { return []; }
    }
  },
  // ===== 8. AviationStack API =====
  aviationstack: {
    name: 'AviationStack API', active: true,
    fetch: async (q, env) => {
      const key = env.AVIATIONSTACK_API_KEY;
      if (!key || key === 'YOUR_AVIATIONSTACK_API_KEY') return [];
      try {
        const url = `http://api.aviationstack.com/v1/airports?access_key=${key}&search=${encodeURIComponent(q)}`;
        const res = await fetch(url); const d = await res.json();
        return (d.data || []).map(a => ({ source: 'aviationstack', id: `as_${a.id}`, name: a.airport_name || q, address: `${a.city}, ${a.country}`, lat: a.lat || 0, lng: a.lon || 0, phone: '', website: '', types: ['airport'], confidence: 50 }));
      } catch (e) { return []; }
    }
  },
  // ===== 9. Azure Maps =====
  azure_maps: {
    name: 'Azure Maps', active: true,
    fetch: async (q, env) => {
      const key = env.AZURE_MAPS_API_KEY;
      if (!key || key === 'YOUR_AZURE_MAPS_API_KEY') return [];
      try {
        const url = `https://atlas.microsoft.com/search/poi/json?api-version=1.0&query=${encodeURIComponent(q)}&subscription-key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.results || []).map(r => ({ source: 'azure_maps', id: `az_${r.id}`, name: r.poi?.name || 'Unknown', address: r.address?.freeformAddress || '', lat: r.position?.lat || 0, lng: r.position?.lon || 0, phone: r.poi?.phone || '', website: '', types: ['place'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 10. Barcode Lookup API =====
  barcode_lookup: {
    name: 'Barcode Lookup API', active: true,
    fetch: async (q, env) => {
      const key = env.BARCODE_API_KEY;
      if (!key || key === 'YOUR_BARCODE_API_KEY') return [];
      try {
        const url = `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(q)}&key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.products || []).map(p => ({ source: 'barcode', id: `bc_${p.barcode}`, name: p.product_name || q, address: p.manufacturer || '', lat: 0, lng: 0, phone: '', website: '', types: ['product'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 11. BigDataCloud =====
  bigdatacloud: {
    name: 'BigDataCloud', active: true,
    fetch: async (q, env) => {
      const key = env.BIGDATACLOUD_API_KEY;
      if (!key || key === 'YOUR_BIGDATACLOUD_API_KEY') return [];
      try {
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=0&longitude=0&localityLanguage=en&key=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.countryName) return [{ source: 'bigdatacloud', id: `bdc_${Date.now()}`, name: d.city || q, address: d.countryName, lat: 0, lng: 0, phone: '', website: '', types: ['location'], confidence: 40 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 12. Bombora Company Surge API =====
  bombora: {
    name: 'Bombora Surge', active: true,
    fetch: async (q, env) => {
      const key = env.BOMBORA_API_KEY;
      if (!key || key === 'YOUR_BOMBORA_API_KEY') return [];
      try {
        const url = `https://api.bombora.com/v1/surge/companies?search=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.companies || []).map(c => ({ source: 'bombora', id: `bom_${c.id}`, name: c.name || q, address: c.location || '', lat: 0, lng: 0, phone: '', website: c.domain || '', types: ['business'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 13. Brave Search API =====
  brave_search: {
    name: 'Brave Search API', active: true,
    fetch: async (q, env) => {
      const key = env.BRAVE_SEARCH_API_KEY;
      if (!key || key === 'YOUR_BRAVE_SEARCH_API_KEY') return [];
      try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5`;
        const res = await fetch(url, { headers: { 'X-Subscription-Token': key } });
        const d = await res.json();
        return (d.web?.results || []).map(r => ({ source: 'brave', id: `br_${r.id}`, name: r.title || 'Unknown', address: r.url || '', lat: 0, lng: 0, phone: '', website: r.url || '', types: ['web'], confidence: 35 }));
      } catch (e) { return []; }
    }
  },
  // ===== 14. BrightData =====
  brightdata: {
    name: 'BrightData', active: true,
    fetch: async (q, env) => {
      const key = env.BRIGHTDATA_API_KEY;
      if (!key || key === 'YOUR_BRIGHTDATA_API_KEY') return [];
      try {
        const url = `https://api.brightdata.com/zone?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(item => ({ source: 'brightdata', id: `bd_${item.id}`, name: item.name || q, address: item.address || '', lat: item.lat || 0, lng: item.lng || 0, phone: item.phone || '', website: '', types: ['scraped'], confidence: 50 }));
      } catch (e) { return []; }
    }
  },
  // ===== 15. BuiltWith API =====
  builtwith: {
    name: 'BuiltWith API', active: true,
    fetch: async (q, env) => {
      const key = env.BUILTWITH_API_KEY;
      if (!key || key === 'YOUR_BUILTWITH_API_KEY') return [];
      try {
        const url = `https://api.builtwith.com/v2/api.json?lookup=${encodeURIComponent(q)}&apikey=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.Results) return [{ source: 'builtwith', id: `bw_${Date.now()}`, name: d.Domain || q, address: d.Domain || '', lat: 0, lng: 0, phone: '', website: d.Domain || '', types: ['tech'], confidence: 45 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 16. Censys API =====
  censys: {
    name: 'Censys API', active: true,
    fetch: async (q, env) => {
      const key = env.CENSYS_API_KEY;
      if (!key || key === 'YOUR_CENSYS_API_KEY') return [];
      try {
        const url = `https://search.censys.io/api/v2/hosts/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json', 'X-Api-Key': key } });
        const d = await res.json();
        return (d.result?.hits || []).map(h => ({ source: 'censys', id: `ce_${h.ip}`, name: h.ip || q, address: h.location?.country || '', lat: h.location?.latitude || 0, lng: h.location?.longitude || 0, phone: '', website: '', types: ['network'], confidence: 30 }));
      } catch (e) { return []; }
    }
  },
  // ===== 17. Clay API =====
  clay: {
    name: 'Clay API', active: true,
    fetch: async (q, env) => {
      const key = env.CLAY_API_KEY;
      if (!key || key === 'YOUR_CLAY_API_KEY') return [];
      try {
        const url = `https://api.clay.com/v1/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(r => ({ source: 'clay', id: `cl_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: r.phone || '', website: r.website || '', types: ['enriched'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 18. Cleanlist.ai API =====
  cleanlist: {
    name: 'Cleanlist.ai API', active: true,
    fetch: async (q, env) => {
      const key = env.CLEANLIST_API_KEY;
      if (!key || key === 'YOUR_CLEANLIST_API_KEY') return [];
      try {
        const url = `https://api.cleanlist.ai/v1/clean?email=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        if (d.status === 'valid') return [{ source: 'cleanlist', id: `cll_${Date.now()}`, name: d.email || q, address: '', lat: 0, lng: 0, phone: '', website: '', types: ['email'], confidence: 80 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 19. Clearout API =====
  clearout: {
    name: 'Clearout API', active: true,
    fetch: async (q, env) => {
      const key = env.CLEAROUT_API_KEY;
      if (!key || key === 'YOUR_CLEAROUT_API_KEY') return [];
      try {
        const url = `https://api.clearout.io/v2/email/verify?email=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        if (d.data?.status === 'valid') return [{ source: 'clearout', id: `co_${Date.now()}`, name: d.data.email || q, address: '', lat: 0, lng: 0, phone: '', website: '', types: ['email'], confidence: 80 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 20. Cognism API =====
  cognism: {
    name: 'Cognism API', active: true,
    fetch: async (q, env) => {
      const key = env.COGNISM_API_KEY;
      if (!key || key === 'YOUR_COGNISM_API_KEY') return [];
      try {
        const url = `https://api.cognism.com/v1/prospects?search=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.data || []).map(p => ({ source: 'cognism', id: `cog_${p.id}`, name: p.name || q, address: p.location || '', lat: 0, lng: 0, phone: p.mobile_phone || p.phone || '', website: p.company_website || '', types: ['business'], confidence: 75 }));
      } catch (e) { return []; }
    }
  },
  // ===== 21. Coffee.ai API =====
  coffee: {
    name: 'Coffee.ai API', active: true,
    fetch: async (q, env) => {
      const key = env.COFFEE_API_KEY;
      if (!key || key === 'YOUR_COFFEE_API_KEY') return [];
      try {
        const url = `https://api.coffee.ai/v1/enrich?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(r => ({ source: 'coffee', id: `cf_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: r.phone || '', website: r.website || '', types: ['ai'], confidence: 65 }));
      } catch (e) { return []; }
    }
  },
  // ===== 22. CoinGecko API =====
  coingecko: {
    name: 'CoinGecko API', active: true,
    fetch: async (q, env) => {
      const key = env.COINGECKO_API_KEY;
      if (!key || key === 'YOUR_COINGECKO_API_KEY') return [];
      try {
        const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url); const d = await res.json();
        return (d.coins || []).map(c => ({ source: 'coingecko', id: `cg_${c.id}`, name: c.name || q, address: c.symbol || '', lat: 0, lng: 0, phone: '', website: '', types: ['crypto'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 23. CoinMarketCap API =====
  coinmarketcap: {
    name: 'CoinMarketCap API', active: true,
    fetch: async (q, env) => {
      const key = env.COINMARKETCAP_API_KEY;
      if (!key || key === 'YOUR_COINMARKETCAP_API_KEY') return [];
      try {
        const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'X-CMC_PRO_API_KEY': key } });
        const d = await res.json();
        const data = d.data || {};
        return Object.keys(data).map(sym => ({ source: 'coinmarketcap', id: `cmc_${sym}`, name: data[sym]?.name || sym, address: data[sym]?.symbol || '', lat: 0, lng: 0, phone: '', website: '', types: ['crypto'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 24. ContactOut API =====
  contactout: {
    name: 'ContactOut API', active: true,
    fetch: async (q, env) => {
      const key = env.CONTACTOUT_API_KEY;
      if (!key || key === 'YOUR_CONTACTOUT_API_KEY') return [];
      try {
        const url = `https://api.contactout.com/v1/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(r => ({ source: 'contactout', id: `ct_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: r.phone || '', website: r.website || '', types: ['social'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 25. Crunchbase API =====
  crunchbase: {
    name: 'Crunchbase API', active: true,
    fetch: async (q, env) => {
      const key = env.CRUNCHBASE_API_KEY;
      if (!key || key === 'YOUR_CRUNCHBASE_API_KEY') return [];
      try {
        const url = `https://api.crunchbase.com/api/v4/searches/entities?q=${encodeURIComponent(q)}&api_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.entities || []).map(e => ({ source: 'crunchbase', id: `cb_${e.uuid}`, name: e.name || q, address: e.location || '', lat: 0, lng: 0, phone: '', website: e.website || '', types: ['funding'], confidence: 65 }));
      } catch (e) { return []; }
    }
  },
  // ===== 26. CurrencyLayer API =====
  currencylayer: {
    name: 'CurrencyLayer API', active: true,
    fetch: async (q, env) => {
      const key = env.CURRENCYLAYER_API_KEY;
      if (!key || key === 'YOUR_CURRENCYLAYER_API_KEY') return [];
      try {
        const url = `http://api.currencylayer.com/live?access_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.success) return [{ source: 'currencylayer', id: `cl_${Date.now()}`, name: 'Currency Rates', address: q, lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 30 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 27. Datanyze API =====
  datanyze: {
    name: 'Datanyze API', active: true,
    fetch: async (q, env) => {
      const key = env.DATANYZE_API_KEY;
      if (!key || key === 'YOUR_DATANYZE_API_KEY') return [];
      try {
        const url = `https://api.datanyze.com/v1/companies/search?query=${encodeURIComponent(q)}&token=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.data || []).map(c => ({ source: 'datanyze', id: `dz_${c.id}`, name: c.name || q, address: c.location || '', lat: 0, lng: 0, phone: '', website: c.website || '', types: ['tech'], confidence: 55 }));
      } catch (e) { return []; }
    }
  },
  // ===== 28. DeBounce API =====
  debounce: {
    name: 'DeBounce API', active: true,
    fetch: async (q, env) => {
      const key = env.DEBOUNCE_API_KEY;
      if (!key || key === 'YOUR_DEBOUNCE_API_KEY') return [];
      try {
        const url = `https://api.debounce.io/v1/?api_key=${key}&email=${encodeURIComponent(q)}`;
        const res = await fetch(url); const d = await res.json();
        if (d.status === 'valid') return [{ source: 'debounce', id: `db_${Date.now()}`, name: q, address: '', lat: 0, lng: 0, phone: '', website: '', types: ['email'], confidence: 80 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 29. DeHashed API =====
  dehashed: {
    name: 'DeHashed API', active: true,
    fetch: async (q, env) => {
      const key = env.DEHASHED_API_KEY;
      if (!key || key === 'YOUR_DEHASHED_API_KEY') return [];
      try {
        const url = `https://api.dehashed.com/v1/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.entries || []).slice(0, 5).map(e => ({ source: 'dehashed', id: `dh_${e.id}`, name: e.email || q, address: e.ip || '', lat: 0, lng: 0, phone: '', website: '', types: ['security'], confidence: 20 }));
      } catch (e) { return []; }
    }
  },
  // ===== 30. DuckDuckGo Instant Answer API =====
  duckduckgo: {
    name: 'DuckDuckGo Instant Answer', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json`;
        const res = await fetch(url); const d = await res.json();
        if (d.AbstractText) return [{ source: 'duckduckgo', id: `ddg_${Date.now()}`, name: d.Heading || q, address: d.AbstractText.substring(0, 100), lat: 0, lng: 0, phone: '', website: d.AbstractURL || '', types: ['web'], confidence: 30 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 31. Dun & Bradstreet (D&B Direct) =====
  dnb: {
    name: 'Dun & Bradstreet', active: true,
    fetch: async (q, env) => {
      const key = env.DNB_API_KEY;
      if (!key || key === 'YOUR_DNB_API_KEY') return [];
      try {
        const url = `https://api.dnb.com/v1/companies/search?name=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(c => ({ source: 'dnb', id: `dnb_${c.duns}`, name: c.name || q, address: c.location || '', lat: 0, lng: 0, phone: c.phone || '', website: c.website || '', types: ['enterprise'], confidence: 80 }));
      } catch (e) { return []; }
    }
  },
  // ===== 32. Edamam API =====
  edamam: {
    name: 'Edamam API', active: true,
    fetch: async (q, env) => {
      const key = env.EDAMAM_API_KEY;
      const appId = env.EDAMAM_APP_ID;
      if (!key || !appId) return [];
      try {
        const url = `https://api.edamam.com/api/recipes/v2?type=public&q=${encodeURIComponent(q)}&app_id=${appId}&app_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.hits || []).slice(0, 5).map(h => ({ source: 'edamam', id: `ed_${h.recipe?.uri}`, name: h.recipe?.label || q, address: h.recipe?.source || '', lat: 0, lng: 0, phone: '', website: h.recipe?.url || '', types: ['food'], confidence: 45 }));
      } catch (e) { return []; }
    }
  },
  // ===== 33. Enrich.so API =====
  enrich_so: {
    name: 'Enrich.so API', active: true,
    fetch: async (q, env) => {
      const key = env.ENRICH_SO_API_KEY;
      if (!key || key === 'YOUR_ENRICH_SO_API_KEY') return [];
      try {
        const url = `https://api.enrich.so/v1/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(r => ({ source: 'enrich_so', id: `en_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: r.phone || '', website: r.website || '', types: ['enrich'], confidence: 65 }));
      } catch (e) { return []; }
    }
  },
  // ===== 34. EOD Historical Data API =====
  eod: {
    name: 'EOD Historical Data', active: true,
    fetch: async (q, env) => {
      const key = env.EOD_API_KEY;
      if (!key || key === 'YOUR_EOD_API_KEY') return [];
      try {
        const url = `https://eodhistoricaldata.com/api/search/${encodeURIComponent(q)}?api_token=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d || []).map(item => ({ source: 'eod', id: `eod_${item.code}`, name: item.name || q, address: item.exchange || '', lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 35. Esri ArcGIS REST API =====
  esri: {
    name: 'Esri ArcGIS', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find?text=${encodeURIComponent(q)}&f=json&maxLocations=5`;
        const res = await fetch(url); const d = await res.json();
        return (d.locations || []).map(l => ({ source: 'esri', id: `esri_${l.id}`, name: l.name || q, address: l.address || '', lat: l.location?.y || 0, lng: l.location?.x || 0, phone: '', website: '', types: ['geocode'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 36. Eventbrite API =====
  eventbrite: {
    name: 'Eventbrite API', active: true,
    fetch: async (q, env) => {
      const key = env.EVENTBRITE_API_KEY;
      if (!key || key === 'YOUR_EVENTBRITE_API_KEY') return [];
      try {
        const url = `https://www.eventbriteapi.com/v3/events/search/?q=${encodeURIComponent(q)}&token=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.events || []).slice(0, 5).map(e => ({ source: 'eventbrite', id: `eb_${e.id}`, name: e.name?.text || q, address: e.venue?.address?.localized_address_display || '', lat: e.venue?.latitude || 0, lng: e.venue?.longitude || 0, phone: '', website: e.url || '', types: ['event'], confidence: 55 }));
      } catch (e) { return []; }
    }
  },
  // ===== 37. ExchangeRate API =====
  exchangerate: {
    name: 'ExchangeRate API', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://api.exchangerate-api.com/v4/latest/${encodeURIComponent(q.toUpperCase())}`;
        const res = await fetch(url); const d = await res.json();
        if (d.base) return [{ source: 'exchangerate', id: `er_${Date.now()}`, name: `Exchange Rate: ${d.base}`, address: '', lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 30 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 38. Financial Modeling Prep API =====
  fmp: {
    name: 'FMP API', active: true,
    fetch: async (q, env) => {
      const key = env.FMP_API_KEY;
      if (!key || key === 'YOUR_FMP_API_KEY') return [];
      try {
        const url = `https://financialmodelingprep.com/api/v3/search?query=${encodeURIComponent(q)}&apikey=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d || []).map(item => ({ source: 'fmp', id: `fmp_${item.symbol}`, name: item.name || q, address: item.exchange || '', lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 45 }));
      } catch (e) { return []; }
    }
  },
  // ===== 39. Fingerprint API =====
  fingerprintjs: {
    name: 'Fingerprint API', active: true,
    fetch: async (q, env) => {
      const key = env.FINGERPRINT_API_KEY;
      if (!key || key === 'YOUR_FINGERPRINT_API_KEY') return [];
      try {
        const url = `https://api.fpjs.io/visitors?visitor_id=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Auth-API-Key': key } });
        const d = await res.json();
        if (d.visitorId) return [{ source: 'fingerprint', id: `fp_${d.visitorId}`, name: `Visitor ${d.visitorId}`, address: d.ip || '', lat: 0, lng: 0, phone: '', website: '', types: ['security'], confidence: 50 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 40. Finnhub API =====
  finnhub: {
    name: 'Finnhub API', active: true,
    fetch: async (q, env) => {
      const key = env.FINNHUB_API_KEY;
      if (!key || key === 'YOUR_FINNHUB_API_KEY') return [];
      try {
        const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.result || []).map(r => ({ source: 'finnhub', id: `fh_${r.symbol}`, name: r.description || q, address: r.displaySymbol || '', lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 45 }));
      } catch (e) { return []; }
    }
  },
  // ===== 41. Fixer API =====
  fixer: {
    name: 'Fixer API', active: true,
    fetch: async (q, env) => {
      const key = env.FIXER_API_KEY;
      if (!key || key === 'YOUR_FIXER_API_KEY') return [];
      try {
        const url = `http://data.fixer.io/api/latest?access_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.success) return [{ source: 'fixer', id: `fx_${Date.now()}`, name: 'Currency Rates', address: q, lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 30 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 42. G2 API =====
  g2: {
    name: 'G2 API', active: true,
    fetch: async (q, env) => {
      const key = env.G2_API_KEY;
      if (!key || key === 'YOUR_G2_API_KEY') return [];
      try {
        const url = `https://api.g2.com/v1/products/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.products || []).map(p => ({ source: 'g2', id: `g2_${p.id}`, name: p.name || q, address: p.category || '', lat: 0, lng: 0, phone: '', website: p.website || '', types: ['software'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 43. Geoapify Places API =====
  geoapify: {
    name: 'Geoapify Places', active: true,
    fetch: async (q, env) => {
      const key = env.GEOAPIFY_API_KEY;
      if (!key || key === 'YOUR_GEOAPIFY_API_KEY') return [];
      try {
        const url = `https://api.geoapify.com/v2/places?text=${encodeURIComponent(q)}&apiKey=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.features || []).slice(0, 5).map(f => ({ source: 'geoapify', id: `gpf_${f.properties?.place_id}`, name: f.properties?.name || q, address: f.properties?.formatted || '', lat: f.geometry?.coordinates?.[1] || 0, lng: f.geometry?.coordinates?.[0] || 0, phone: '', website: '', types: f.properties?.categories || [], confidence: 65 }));
      } catch (e) { return []; }
    }
  },
  // ===== 44. GeoJS =====
  geojs: {
    name: 'GeoJS', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(q)}.json`;
        const res = await fetch(url); const d = await res.json();
        if (d.latitude) return [{ source: 'geojs', id: `gjs_${Date.now()}`, name: d.city || q, address: d.country || '', lat: d.latitude || 0, lng: d.longitude || 0, phone: '', website: '', types: ['location'], confidence: 40 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 45. Geonames API =====
  geonames: {
    name: 'Geonames API', active: true,
    fetch: async (q, env) => {
      const key = env.GEONAMES_API_KEY;
      if (!key || key === 'YOUR_GEONAMES_API_KEY') return [];
      try {
        const url = `http://api.geonames.org/search?q=${encodeURIComponent(q)}&maxRows=5&username=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.geonames || []).map(g => ({ source: 'geonames', id: `gn_${g.geonameId}`, name: g.name || q, address: `${g.adminName1}, ${g.countryName}`.trim(), lat: g.lat || 0, lng: g.lng || 0, phone: '', website: '', types: ['location'], confidence: 50 }));
      } catch (e) { return []; }
    }
  },
  // ===== 46. GitHub API =====
  github: {
    name: 'GitHub API', active: true,
    fetch: async (q, env) => {
      const key = env.GITHUB_API_KEY;
      if (!key || key === 'YOUR_GITHUB_API_KEY') return [];
      try {
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.items || []).slice(0, 5).map(item => ({ source: 'github', id: `gh_${item.id}`, name: item.name || q, address: item.description || '', lat: 0, lng: 0, phone: '', website: item.html_url || '', types: ['tech'], confidence: 55 }));
      } catch (e) { return []; }
    }
  },
  // ===== 47. Google Air Quality API =====
  google_air: {
    name: 'Google Air Quality', active: true,
    fetch: async (q, env) => {
      const key = env.GOOGLE_AIR_API_KEY;
      if (!key || key === 'YOUR_GOOGLE_AIR_API_KEY') return [];
      try {
        const url = `https://airquality.googleapis.com/v1/currentConditions?query=${encodeURIComponent(q)}&key=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.indexes) return [{ source: 'google_air', id: `ga_${Date.now()}`, name: `${q} Air Quality`, address: d.city || '', lat: 0, lng: 0, phone: '', website: '', types: ['environment'], confidence: 45 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 48. GraphHopper API =====
  graphhopper: {
    name: 'GraphHopper API', active: true,
    fetch: async (q, env) => {
      const key = env.GRAPHHOPPER_API_KEY;
      if (!key || key === 'YOUR_GRAPHHOPPER_API_KEY') return [];
      try {
        const url = `https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(q)}&key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.hits || []).slice(0, 5).map(h => ({ source: 'graphhopper', id: `gh_${h.point?.lat || Date.now()}`, name: h.name || q, address: h.country || '', lat: h.point?.lat || 0, lng: h.point?.lng || 0, phone: '', website: '', types: ['geocode'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 49. HaveIBeenPwned API =====
  hibp: {
    name: 'Have I Been Pwned', active: true,
    fetch: async (q, env) => {
      const key = env.HIBP_API_KEY;
      if (!key || key === 'YOUR_HIBP_API_KEY') return [];
      try {
        const url = `https://haveibeenpwned.com/api/v3/breaches/${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'hibp-api-key': key } });
        const d = await res.json();
        if (Array.isArray(d)) return d.slice(0, 3).map(b => ({ source: 'hibp', id: `hibp_${b.Name}`, name: b.Title || q, address: b.Domain || '', lat: 0, lng: 0, phone: '', website: '', types: ['security'], confidence: 60 }));
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 50. HERE Maps Places API =====
  here: {
    name: 'HERE Maps Places', active: true,
    fetch: async (q, env) => {
      const key = env.HERE_API_KEY;
      if (!key || key === 'YOUR_HERE_API_KEY') return [];
      try {
        const url = `https://discover.search.hereapi.com/v1/discover?q=${encodeURIComponent(q)}&apiKey=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.items || []).slice(0, 5).map(item => ({ source: 'here', id: `here_${item.id}`, name: item.title || q, address: item.address?.label || '', lat: item.position?.lat || 0, lng: item.position?.lng || 0, phone: '', website: '', types: ['place'], confidence: 65 }));
      } catch (e) { return []; }
    }
  },
  // ===== 51. HubSpot Clearbit API =====
  clearbit: {
    name: 'HubSpot Clearbit', active: true,
    fetch: async (q, env) => {
      const key = env.CLEARBIT_API_KEY;
      if (!key || key === 'YOUR_CLEARBIT_API_KEY') return [];
      try {
        const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d || []).map(c => ({ source: 'clearbit', id: `clb_${c.domain}`, name: c.name || q, address: c.location || '', lat: 0, lng: 0, phone: '', website: c.domain || '', types: ['business'], confidence: 75 }));
      } catch (e) { return []; }
    }
  },
  // ===== 52. Hunter.io API =====
  hunter: {
    name: 'Hunter.io API', active: true,
    fetch: async (q, env) => {
      const key = env.HUNTER_API_KEY;
      if (!key || key === 'YOUR_HUNTER_API_KEY') return [];
      try {
        const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(q)}&api_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.data?.emails || []).slice(0, 5).map(e => ({ source: 'hunter', id: `hnt_${e.value}`, name: e.first_name || e.value, address: e.domain || '', lat: 0, lng: 0, phone: '', website: e.domain || '', types: ['email'], confidence: 80 }));
      } catch (e) { return []; }
    }
  },
  // ===== 53. IEX Cloud API =====
  iex: {
    name: 'IEX Cloud API', active: true,
    fetch: async (q, env) => {
      const key = env.IEX_API_KEY;
      if (!key || key === 'YOUR_IEX_API_KEY') return [];
      try {
        const url = `https://cloud.iexapis.com/stable/search/${encodeURIComponent(q)}?token=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d || []).map(item => ({ source: 'iex', id: `iex_${item.symbol}`, name: item.securityName || q, address: item.exchange || '', lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 45 }));
      } catch (e) { return []; }
    }
  },
  // ===== 54. ip-api.com =====
  ipapi: {
    name: 'ip-api.com', active: true,
    fetch: async (q, env) => {
      try {
        const url = `http://ip-api.com/json/${encodeURIComponent(q)}?fields=status,message,country,regionName,city,lat,lon`;
        const res = await fetch(url); const d = await res.json();
        if (d.status === 'success') return [{ source: 'ipapi', id: `ipa_${Date.now()}`, name: d.city || q, address: `${d.regionName}, ${d.country}`.trim(), lat: d.lat || 0, lng: d.lon || 0, phone: '', website: '', types: ['location'], confidence: 50 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 55. ipinfo.io =====
  ipinfo: {
    name: 'ipinfo.io', active: true,
    fetch: async (q, env) => {
      const key = env.IPINFO_API_KEY;
      if (!key || key === 'YOUR_IPINFO_API_KEY') return [];
      try {
        const url = `https://ipinfo.io/${encodeURIComponent(q)}/json?token=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.loc) {
          const coords = d.loc.split(',');
          return [{ source: 'ipinfo', id: `ipi_${Date.now()}`, name: d.city || q, address: `${d.region}, ${d.country}`.trim(), lat: parseFloat(coords[0]) || 0, lng: parseFloat(coords[1]) || 0, phone: '', website: '', types: ['location'], confidence: 55 }];
        }
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 56. ipwhois API =====
  ipwhois: {
    name: 'ipwhois API', active: true,
    fetch: async (q, env) => {
      const key = env.IPWHOIS_API_KEY;
      if (!key || key === 'YOUR_IPWHOIS_API_KEY') return [];
      try {
        const url = `https://ipwhois.app/api/v2?ip=${encodeURIComponent(q)}&key=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.latitude) return [{ source: 'ipwhois', id: `ipw_${Date.now()}`, name: d.city || q, address: `${d.region}, ${d.country}`.trim(), lat: d.latitude || 0, lng: d.longitude || 0, phone: '', website: '', types: ['location'], confidence: 50 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 57. Kaspr API =====
  kaspr: {
    name: 'Kaspr API', active: true,
    fetch: async (q, env) => {
      const key = env.KASPR_API_KEY;
      if (!key || key === 'YOUR_KASPR_API_KEY') return [];
      try {
        const url = `https://api.kaspr.io/v1/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(r => ({ source: 'kaspr', id: `kp_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: r.phone || '', website: r.company || '', types: ['linkedin'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 58. LeadIQ API =====
  leadiq: {
    name: 'LeadIQ API', active: true,
    fetch: async (q, env) => {
      const key = env.LEADIQ_API_KEY;
      if (!key || key === 'YOUR_LEADIQ_API_KEY') return [];
      try {
        const url = `https://api.leadiq.com/v1/prospects/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.data || []).map(p => ({ source: 'leadiq', id: `lq_${p.id}`, name: p.name || q, address: p.location || '', lat: 0, lng: 0, phone: p.phone || '', website: p.company_website || '', types: ['sales'], confidence: 65 }));
      } catch (e) { return []; }
    }
  },
  // ===== 59. LocationIQ =====
  locationiq: {
    name: 'LocationIQ', active: true,
    fetch: async (q, env) => {
      const key = env.LOCATIONIQ_API_KEY;
      if (!key || key === 'YOUR_LOCATIONIQ_API_KEY') return [];
      try {
        const url = `https://us1.locationiq.com/v1/search.php?key=${key}&q=${encodeURIComponent(q)}&format=json`;
        const res = await fetch(url); const d = await res.json();
        return (d || []).slice(0, 5).map(item => ({ source: 'locationiq', id: `liq_${item.place_id}`, name: item.display_name.split(',')[0] || q, address: item.display_name || '', lat: item.lat || 0, lng: item.lon || 0, phone: '', website: '', types: ['geocode'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 60. Lusha API =====
  lusha: {
    name: 'Lusha API', active: true,
    fetch: async (q, env) => {
      const key = env.LUSHA_API_KEY;
      if (!key || key === 'YOUR_LUSHA_API_KEY') return [];
      try {
        const url = `https://api.lusha.com/v1/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(r => ({ source: 'lusha', id: `lu_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: r.phone || '', website: r.company || '', types: ['b2b'], confidence: 75 }));
      } catch (e) { return []; }
    }
  },
  // ===== 61. Mapbox Search API =====
  mapbox: {
    name: 'Mapbox Search', active: true,
    fetch: async (q, env) => {
      const key = env.MAPBOX_API_KEY;
      if (!key || key === 'YOUR_MAPBOX_API_KEY') return [];
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.features || []).slice(0, 5).map(f => ({ source: 'mapbox', id: `mbx_${f.id}`, name: f.place_name || q, address: f.place_name || '', lat: f.center?.[1] || 0, lng: f.center?.[0] || 0, phone: '', website: '', types: ['geocode'], confidence: 65 }));
      } catch (e) { return []; }
    }
  },
  // ===== 62. MapQuest API =====
  mapquest: {
    name: 'MapQuest API', active: true,
    fetch: async (q, env) => {
      const key = env.MAPQUEST_API_KEY;
      if (!key || key === 'YOUR_MAPQUEST_API_KEY') return [];
      try {
        const url = `https://www.mapquestapi.com/geocoding/v1/address?key=${key}&location=${encodeURIComponent(q)}&maxResults=5`;
        const res = await fetch(url); const d = await res.json();
        return (d.results?.[0]?.locations || []).map(l => ({ source: 'mapquest', id: `mq_${l.geoQuality}` || `mq_${Date.now()}`, name: l.street || q, address: l.adminArea5 || '', lat: l.latLng?.lat || 0, lng: l.latLng?.lng || 0, phone: '', website: '', types: ['geocode'], confidence: 55 }));
      } catch (e) { return []; }
    }
  },
  // ===== 63. MapTiler Geocoding API =====
  maptiler: {
    name: 'MapTiler Geocoding', active: true,
    fetch: async (q, env) => {
      const key = env.MAPTILER_API_KEY;
      if (!key || key === 'YOUR_MAPTILER_API_KEY') return [];
      try {
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.features || []).slice(0, 5).map(f => ({ source: 'maptiler', id: `mt_${f.id}`, name: f.text || q, address: f.place_name || '', lat: f.center?.[1] || 0, lng: f.center?.[0] || 0, phone: '', website: '', types: ['geocode'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 64. Marketstack API =====
  marketstack: {
    name: 'Marketstack API', active: true,
    fetch: async (q, env) => {
      const key = env.MARKETSTACK_API_KEY;
      if (!key || key === 'YOUR_MARKETSTACK_API_KEY') return [];
      try {
        const url = `https://api.marketstack.com/v1/tickers?search=${encodeURIComponent(q)}&access_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.data || []).map(item => ({ source: 'marketstack', id: `ms_${item.symbol}`, name: item.name || q, address: item.stock_exchange?.name || '', lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 65. Maxar Geospatial =====
  maxar: {
    name: 'Maxar Geospatial', active: true,
    fetch: async (q, env) => {
      const key = env.MAXAR_API_KEY;
      if (!key || key === 'YOUR_MAXAR_API_KEY') return [];
      try {
        const url = `https://api.maxar.com/v1/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.features || []).slice(0, 5).map(f => ({ source: 'maxar', id: `max_${f.id}`, name: f.properties?.name || q, address: '', lat: f.geometry?.coordinates?.[1] || 0, lng: f.geometry?.coordinates?.[0] || 0, phone: '', website: '', types: ['satellite'], confidence: 50 }));
      } catch (e) { return []; }
    }
  },
  // ===== 66. Nasdaq Data Link API =====
  nasdaq: {
    name: 'Nasdaq Data Link', active: true,
    fetch: async (q, env) => {
      const key = env.NASDAQ_API_KEY;
      if (!key || key === 'YOUR_NASDAQ_API_KEY') return [];
      try {
        const url = `https://data.nasdaq.com/api/v1/datasets.json?search=${encodeURIComponent(q)}&api_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.datasets || []).slice(0, 5).map(ds => ({ source: 'nasdaq', id: `nd_${ds.id}`, name: ds.name || q, address: ds.description || '', lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 67. NeverBounce API =====
  neverbounce: {
    name: 'NeverBounce API', active: true,
    fetch: async (q, env) => {
      const key = env.NEVERBOUNCE_API_KEY;
      if (!key || key === 'YOUR_NEVERBOUNCE_API_KEY') return [];
      try {
        const url = `https://api.neverbounce.com/v4/single/check?key=${key}&email=${encodeURIComponent(q)}`;
        const res = await fetch(url); const d = await res.json();
        if (d.status === 'valid') return [{ source: 'neverbounce', id: `nb_${Date.now()}`, name: q, address: '', lat: 0, lng: 0, phone: '', website: '', types: ['email'], confidence: 80 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 68. Nutritionix API =====
  nutritionix: {
    name: 'Nutritionix API', active: true,
    fetch: async (q, env) => {
      const key = env.NUTRITIONIX_API_KEY;
      const appId = env.NUTRITIONIX_APP_ID;
      if (!key || !appId) return [];
      try {
        const url = `https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'x-app-id': appId, 'x-app-key': key } });
        const d = await res.json();
        return (d.common || []).slice(0, 5).map(item => ({ source: 'nutritionix', id: `nx_${item.food_name}`, name: item.food_name || q, address: item.brand_name || '', lat: 0, lng: 0, phone: '', website: '', types: ['food'], confidence: 45 }));
      } catch (e) { return []; }
    }
  },
  // ===== 69. OpenAQ API =====
  openaq: {
    name: 'OpenAQ API', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://api.openaq.org/v2/locations?search=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'X-API-Key': env.OPENA_API_KEY || 'dummy' } });
        const d = await res.json();
        return (d.results || []).slice(0, 5).map(l => ({ source: 'openaq', id: `oaq_${l.id}`, name: l.name || q, address: `${l.city}, ${l.country}`.trim(), lat: l.coordinates?.latitude || 0, lng: l.coordinates?.longitude || 0, phone: '', website: '', types: ['environment'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 70. OpenCage Geocoder =====
  opencage: {
    name: 'OpenCage Geocoder', active: true,
    fetch: async (q, env) => {
      const key = env.OPENCAGE_API_KEY;
      if (!key || key === 'YOUR_OPENCAGE_API_KEY') return [];
      try {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(q)}&key=${key}&limit=5`;
        const res = await fetch(url); const d = await res.json();
        return (d.results || []).map(r => ({ source: 'opencage', id: `oc_${r.annotations?.geohash || Date.now()}`, name: r.components?.city || q, address: r.formatted || '', lat: r.geometry?.lat || 0, lng: r.geometry?.lng || 0, phone: '', website: '', types: ['geocode'], confidence: 65 }));
      } catch (e) { return []; }
    }
  },
  // ===== 71. OpenCorporates API =====
  opencorporates: {
    name: 'OpenCorporates', active: true,
    fetch: async (q, env) => {
      const key = env.OPENCORPORATES_API_KEY;
      if (!key || key === 'YOUR_OPENCORPORATES_API_KEY') return [];
      try {
        const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(q)}&api_token=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.results?.companies || []).slice(0, 5).map(c => ({ source: 'opencorporates', id: `ocp_${c.company?.id}`, name: c.company?.name || q, address: c.company?.jurisdiction_code || '', lat: 0, lng: 0, phone: '', website: '', types: ['business'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 72. OpenFoodFacts API =====
  openfoodfacts: {
    name: 'OpenFoodFacts', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(q)}&page_size=5`;
        const res = await fetch(url); const d = await res.json();
        return (d.products || []).map(p => ({ source: 'openfoodfacts', id: `off_${p.id}`, name: p.product_name || q, address: p.brands || '', lat: 0, lng: 0, phone: '', website: p.url || '', types: ['food'], confidence: 45 }));
      } catch (e) { return []; }
    }
  },
  // ===== 73. OpenRouteService API =====
  openrouteservice: {
    name: 'OpenRouteService', active: true,
    fetch: async (q, env) => {
      const key = env.OPENROUTESERVICE_API_KEY;
      if (!key || key === 'YOUR_OPENROUTESERVICE_API_KEY') return [];
      try {
        const url = `https://api.openrouteservice.org/geocode/search?api_key=${key}&text=${encodeURIComponent(q)}&size=5`;
        const res = await fetch(url); const d = await res.json();
        return (d.features || []).map(f => ({ source: 'openrouteservice', id: `ors_${f.properties?.id}`, name: f.properties?.name || q, address: f.properties?.label || '', lat: f.geometry?.coordinates?.[1] || 0, lng: f.geometry?.coordinates?.[0] || 0, phone: '', website: '', types: ['geocode'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 74. OpenSky Network API =====
  opensky: {
    name: 'OpenSky Network', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://opensky-network.org/api/states/all?lamin=0&lomin=0&lamax=90&lomax=180`;
        const res = await fetch(url); const d = await res.json();
        return (d.states || []).slice(0, 5).map(s => ({ source: 'opensky', id: `os_${s[0]}`, name: `Flight ${s[0]}`, address: `${s[2] || ''}`, lat: s[6] || 0, lng: s[5] || 0, phone: '', website: '', types: ['aviation'], confidence: 30 }));
      } catch (e) { return []; }
    }
  },
  // ===== 75. OpenTripMap =====
  opentripmap: {
    name: 'OpenTripMap', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://api.opentripmap.com/v1/en/places/geoname?name=${encodeURIComponent(q)}&apikey=${env.OPENTRIPMAP_API_KEY || 'dummy'}`;
        const res = await fetch(url); const d = await res.json();
        if (d.name) return [{ source: 'opentripmap', id: `otm_${d.xid}`, name: d.name || q, address: d.address || '', lat: d.lat || 0, lng: d.lon || 0, phone: '', website: '', types: ['tourism'], confidence: 50 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 76. OpenWeatherMap =====
  openweather: {
    name: 'OpenWeatherMap', active: true,
    fetch: async (q, env) => {
      const key = env.OPENWEATHER_API_KEY;
      if (!key || key === 'YOUR_OPENWEATHER_API_KEY') return [];
      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.coord) return [{ source: 'openweather', id: `ow_${Date.now()}`, name: d.name || q, address: d.sys?.country || '', lat: d.coord?.lat || 0, lng: d.coord?.lon || 0, phone: '', website: '', types: ['weather'], confidence: 55 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 77. People Data Labs (PDL) API =====
  pdl: {
    name: 'People Data Labs', active: true,
    fetch: async (q, env) => {
      const key = env.PDL_API_KEY;
      if (!key || key === 'YOUR_PDL_API_KEY') return [];
      try {
        const url = `https://api.peopledatalabs.com/v5/person/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'X-Api-Key': key } });
        const d = await res.json();
        return (d.data || []).slice(0, 5).map(p => ({ source: 'pdl', id: `pdl_${p.id}`, name: p.full_name || q, address: p.location || '', lat: 0, lng: 0, phone: p.phone || '', website: p.company_website || '', types: ['profile'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 78. Pinterest API =====
  pinterest: {
    name: 'Pinterest API', active: true,
    fetch: async (q, env) => {
      const key = env.PINTEREST_API_KEY;
      if (!key || key === 'YOUR_PINTEREST_API_KEY') return [];
      try {
        const url = `https://api.pinterest.com/v5/search/pins?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.items || []).slice(0, 5).map(p => ({ source: 'pinterest', id: `pin_${p.id}`, name: p.title || q, address: '', lat: 0, lng: 0, phone: '', website: p.link || '', types: ['social'], confidence: 35 }));
      } catch (e) { return []; }
    }
  },
  // ===== 79. Planet API =====
  planet: {
    name: 'Planet API', active: true,
    fetch: async (q, env) => {
      const key = env.PLANET_API_KEY;
      if (!key || key === 'YOUR_PLANET_API_KEY') return [];
      try {
        const url = `https://api.planet.com/data/v1/searches?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.items || []).slice(0, 3).map(item => ({ source: 'planet', id: `pl_${item.id}`, name: item.properties?.title || q, address: '', lat: item.geometry?.coordinates?.[1] || 0, lng: item.geometry?.coordinates?.[0] || 0, phone: '', website: '', types: ['satellite'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 80. Polygon.io API =====
  polygon: {
    name: 'Polygon.io API', active: true,
    fetch: async (q, env) => {
      const key = env.POLYGON_API_KEY;
      if (!key || key === 'YOUR_POLYGON_API_KEY') return [];
      try {
        const url = `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(q)}&apiKey=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.results || []).slice(0, 5).map(item => ({ source: 'polygon', id: `poly_${item.ticker}`, name: item.name || q, address: item.market || '', lat: 0, lng: 0, phone: '', website: '', types: ['finance'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 81. PositionStack =====
  positionstack: {
    name: 'PositionStack', active: true,
    fetch: async (q, env) => {
      const key = env.POSITIONSTACK_API_KEY;
      if (!key || key === 'YOUR_POSITIONSTACK_API_KEY') return [];
      try {
        const url = `http://api.positionstack.com/v1/forward?access_key=${key}&query=${encodeURIComponent(q)}&limit=5`;
        const res = await fetch(url); const d = await res.json();
        return (d.data || []).map(item => ({ source: 'positionstack', id: `ps_${item.latitude}_${item.longitude}`, name: item.label || q, address: item.label || '', lat: item.latitude || 0, lng: item.longitude || 0, phone: '', website: '', types: ['geocode'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 82. PredictLeads API =====
  predictleads: {
    name: 'PredictLeads API', active: true,
    fetch: async (q, env) => {
      const key = env.PREDICTLEADS_API_KEY;
      if (!key || key === 'YOUR_PREDICTLEADS_API_KEY') return [];
      try {
        const url = `https://api.predictleads.com/v1/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(r => ({ source: 'predictleads', id: `pl_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: '', website: r.website || '', types: ['intel'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 83. Proxycurl API =====
  proxycurl: {
    name: 'Proxycurl API', active: true,
    fetch: async (q, env) => {
      const key = env.PROXYCURL_API_KEY;
      if (!key || key === 'YOUR_PROXYCURL_API_KEY') return [];
      try {
        const url = `https://nubela.co/proxycurl/api/search/person?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).slice(0, 5).map(r => ({ source: 'proxycurl', id: `pc_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: r.phone || '', website: r.website || '', types: ['linkedin'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 84. Radar API =====
  radar: {
    name: 'Radar API', active: true,
    fetch: async (q, env) => {
      const key = env.RADAR_API_KEY;
      if (!key || key === 'YOUR_RADAR_API_KEY') return [];
      try {
        const url = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': key } });
        const d = await res.json();
        return (d.addresses || []).slice(0, 5).map(a => ({ source: 'radar', id: `rd_${a.id}`, name: a.addressLabel || q, address: a.formattedAddress || '', lat: a.latitude || 0, lng: a.longitude || 0, phone: '', website: '', types: ['geocode'], confidence: 60 }));
      } catch (e) { return []; }
    }
  },
  // ===== 85. Reddit API =====
  reddit: {
    name: 'Reddit API', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&limit=5`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const d = await res.json();
        return (d.data?.children || []).map(child => ({ source: 'reddit', id: `rdt_${child.data?.id}`, name: child.data?.title || q, address: child.data?.subreddit || '', lat: 0, lng: 0, phone: '', website: `https://reddit.com${child.data?.permalink || ''}`, types: ['social'], confidence: 30 }));
      } catch (e) { return []; }
    }
  },
  // ===== 86. RocketReach API =====
  rocketreach: {
    name: 'RocketReach API', active: true,
    fetch: async (q, env) => {
      const key = env.ROCKETREACH_API_KEY;
      if (!key || key === 'YOUR_ROCKETREACH_API_KEY') return [];
      try {
        const url = `https://api.rocketreach.co/v1/search/people?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.people || []).slice(0, 5).map(p => ({ source: 'rocketreach', id: `rr_${p.id}`, name: p.name || q, address: p.location || '', lat: 0, lng: 0, phone: p.phone || '', website: p.website || '', types: ['b2b'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 87. SalesIntel API =====
  salesintel: {
    name: 'SalesIntel API', active: true,
    fetch: async (q, env) => {
      const key = env.SALESINTEL_API_KEY;
      if (!key || key === 'YOUR_SALESINTEL_API_KEY') return [];
      try {
        const url = `https://api.salesintel.io/v1/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(r => ({ source: 'salesintel', id: `si_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: r.phone || '', website: r.website || '', types: ['b2b'], confidence: 80 }));
      } catch (e) { return []; }
    }
  },
  // ===== 88. ScrapingBee =====
  scrapingbee: {
    name: 'ScrapingBee', active: true,
    fetch: async (q, env) => {
      const key = env.SCRAPINGBEE_API_KEY;
      if (!key || key === 'YOUR_SCRAPINGBEE_API_KEY') return [];
      try {
        const url = `https://app.scrapingbee.com/api/v1/?api_key=${key}&url=${encodeURIComponent(q)}&render_js=false`;
        const res = await fetch(url); const d = await res.json();
        return [{ source: 'scrapingbee', id: `sb_${Date.now()}`, name: `Scraped: ${q}`, address: '', lat: 0, lng: 0, phone: '', website: q, types: ['scraped'], confidence: 30 }];
      } catch (e) { return []; }
    }
  },
  // ===== 89. Seamless.ai API =====
  seamless: {
    name: 'Seamless.ai API', active: true,
    fetch: async (q, env) => {
      const key = env.SEAMLESS_API_KEY;
      if (!key || key === 'YOUR_SEAMLESS_API_KEY') return [];
      try {
        const url = `https://api.seamless.ai/v1/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.contacts || []).slice(0, 5).map(c => ({ source: 'seamless', id: `sm_${c.id}`, name: c.name || q, address: c.location || '', lat: 0, lng: 0, phone: c.phone || '', website: c.company || '', types: ['b2b'], confidence: 75 }));
      } catch (e) { return []; }
    }
  },
  // ===== 90. Sentinel Hub API =====
  sentinel: {
    name: 'Sentinel Hub API', active: true,
    fetch: async (q, env) => {
      const key = env.SENTINEL_API_KEY;
      if (!key || key === 'YOUR_SENTINEL_API_KEY') return [];
      try {
        const url = `https://services.sentinel-hub.com/api/v1/catalog/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.features || []).slice(0, 3).map(f => ({ source: 'sentinel', id: `sen_${f.id}`, name: f.properties?.title || q, address: '', lat: f.geometry?.coordinates?.[1] || 0, lng: f.geometry?.coordinates?.[0] || 0, phone: '', website: '', types: ['satellite'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 91. SerpAPI =====
  serpapi: {
    name: 'SerpAPI', active: true,
    fetch: async (q, env) => {
      const key = env.SERPAPI_API_KEY;
      if (!key || key === 'YOUR_SERPAPI_API_KEY') return [];
      try {
        const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${key}&engine=google`;
        const res = await fetch(url); const d = await res.json();
        return (d.organic_results || []).slice(0, 5).map(r => ({ source: 'serpapi', id: `serp_${r.position}`, name: r.title || q, address: r.snippet || '', lat: 0, lng: 0, phone: '', website: r.link || '', types: ['web'], confidence: 50 }));
      } catch (e) { return []; }
    }
  },
  // ===== 92. Shodan API =====
  shodan: {
    name: 'Shodan API', active: true,
    fetch: async (q, env) => {
      const key = env.SHODAN_API_KEY;
      if (!key || key === 'YOUR_SHODAN_API_KEY') return [];
      try {
        const url = `https://api.shodan.io/shodan/host/search?key=${key}&query=${encodeURIComponent(q)}&limit=5`;
        const res = await fetch(url); const d = await res.json();
        return (d.matches || []).map(m => ({ source: 'shodan', id: `sh_${m.ip_str}`, name: m.ip_str || q, address: m.location?.country || '', lat: m.location?.latitude || 0, lng: m.location?.longitude || 0, phone: '', website: '', types: ['network'], confidence: 30 }));
      } catch (e) { return []; }
    }
  },
  // ===== 93. Skrapp.io API =====
  skrapp: {
    name: 'Skrapp.io API', active: true,
    fetch: async (q, env) => {
      const key = env.SKRAPP_API_KEY;
      if (!key || key === 'YOUR_SKRAPP_API_KEY') return [];
      try {
        const url = `https://api.skrapp.io/v1/search?domain=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.emails || []).slice(0, 5).map(e => ({ source: 'skrapp', id: `sk_${e.value}`, name: e.value || q, address: e.domain || '', lat: 0, lng: 0, phone: '', website: e.domain || '', types: ['email'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 94. Snov.io API =====
  snov: {
    name: 'Snov.io API', active: true,
    fetch: async (q, env) => {
      const key = env.SNOV_API_KEY;
      if (!key || key === 'YOUR_SNOV_API_KEY') return [];
      try {
        const url = `https://api.snov.io/v1/domain-emails?domain=${encodeURIComponent(q)}`;
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: q, accessToken: key }) });
        const d = await res.json();
        return (d.emails || []).slice(0, 5).map(e => ({ source: 'snov', id: `snov_${e.email}`, name: e.email || q, address: e.domain || '', lat: 0, lng: 0, phone: '', website: e.domain || '', types: ['email'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 95. Spoonacular API =====
  spoonacular: {
    name: 'Spoonacular API', active: true,
    fetch: async (q, env) => {
      const key = env.SPOONACULAR_API_KEY;
      if (!key || key === 'YOUR_SPOONACULAR_API_KEY') return [];
      try {
        const url = `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(q)}&apiKey=${key}&number=5`;
        const res = await fetch(url); const d = await res.json();
        return (d.results || []).map(r => ({ source: 'spoonacular', id: `sp_${r.id}`, name: r.title || q, address: '', lat: 0, lng: 0, phone: '', website: '', types: ['food'], confidence: 45 }));
      } catch (e) { return []; }
    }
  },
  // ===== 96. Stack Overflow API =====
  stackoverflow: {
    name: 'Stack Overflow API', active: true,
    fetch: async (q, env) => {
      try {
        const url = `https://api.stackexchange.com/2.3/search?order=desc&sort=relevance&intitle=${encodeURIComponent(q)}&site=stackoverflow`;
        const res = await fetch(url); const d = await res.json();
        return (d.items || []).slice(0, 5).map(item => ({ source: 'stackoverflow', id: `so_${item.question_id}`, name: item.title || q, address: item.tags?.join(', ') || '', lat: 0, lng: 0, phone: '', website: item.link || '', types: ['tech'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 97. Telesign API =====
  telesign: {
    name: 'Telesign API', active: true,
    fetch: async (q, env) => {
      const key = env.TELESIGN_API_KEY;
      const cid = env.TELESIGN_CUSTOMER_ID;
      if (!key || !cid) return [];
      try {
        const url = `https://rest-api.telesign.com/v1/phoneid/${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Basic ${btoa(`${cid}:${key}`)}` } });
        const d = await res.json();
        if (d.status?.code === 200) return [{ source: 'telesign', id: `ts_${Date.now()}`, name: d.phoneNumber || q, address: d.location?.city || '', lat: 0, lng: 0, phone: d.phoneNumber || '', website: '', types: ['phone'], confidence: 60 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 98. Ticketmaster Discovery API =====
  ticketmaster: {
    name: 'Ticketmaster Discovery', active: true,
    fetch: async (q, env) => {
      const key = env.TICKETMASTER_API_KEY;
      if (!key || key === 'YOUR_TICKETMASTER_API_KEY') return [];
      try {
        const url = `https://app.ticketmaster.com/discovery/v2/events.json?keyword=${encodeURIComponent(q)}&apikey=${key}&size=5`;
        const res = await fetch(url); const d = await res.json();
        return (d._embedded?.events || []).map(e => ({ source: 'ticketmaster', id: `tm_${e.id}`, name: e.name || q, address: e._embedded?.venues?.[0]?.address?.line1 || '', lat: e._embedded?.venues?.[0]?.location?.latitude || 0, lng: e._embedded?.venues?.[0]?.location?.longitude || 0, phone: '', website: e.url || '', types: ['event'], confidence: 50 }));
      } catch (e) { return []; }
    }
  },
  // ===== 99. Tomorrow.io API =====
  tomorrowio: {
    name: 'Tomorrow.io API', active: true,
    fetch: async (q, env) => {
      const key = env.TOMORROWIO_API_KEY;
      if (!key || key === 'YOUR_TOMORROWIO_API_KEY') return [];
      try {
        const url = `https://api.tomorrow.io/v4/timelines?location=${encodeURIComponent(q)}&apikey=${key}&timesteps=1h`;
        const res = await fetch(url); const d = await res.json();
        if (d.data) return [{ source: 'tomorrowio', id: `toi_${Date.now()}`, name: `Weather: ${q}`, address: q, lat: 0, lng: 0, phone: '', website: '', types: ['weather'], confidence: 45 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 100. Twilio Lookup v2 =====
  twilio: {
    name: 'Twilio Lookup v2', active: true,
    fetch: async (q, env) => {
      const key = env.TWILIO_API_KEY;
      const secret = env.TWILIO_API_SECRET;
      if (!key || !secret) return [];
      try {
        const auth = btoa(`${key}:${secret}`);
        const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Basic ${auth}` } });
        const d = await res.json();
        if (d.phone_number) return [{ source: 'twilio', id: `tw_${Date.now()}`, name: d.phone_number || q, address: d.country_code || '', lat: 0, lng: 0, phone: d.phone_number || '', website: '', types: ['phone'], confidence: 70 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 101. UPCitemdb API =====
  upcitemdb: {
    name: 'UPCitemdb API', active: true,
    fetch: async (q, env) => {
      const key = env.UPCITEMDB_API_KEY;
      if (!key || key === 'YOUR_UPCITEMDB_API_KEY') return [];
      try {
        const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(q)}&api_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.items || []).slice(0, 5).map(item => ({ source: 'upcitemdb', id: `upc_${item.upc}`, name: item.title || q, address: item.brand || '', lat: 0, lng: 0, phone: '', website: '', types: ['product'], confidence: 45 }));
      } catch (e) { return []; }
    }
  },
  // ===== 102. UpLead API =====
  uplead: {
    name: 'UpLead API', active: true,
    fetch: async (q, env) => {
      const key = env.UPLEAD_API_KEY;
      if (!key || key === 'YOUR_UPLEAD_API_KEY') return [];
      try {
        const url = `https://api.uplead.com/v1/search?query=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.results || []).map(r => ({ source: 'uplead', id: `up_${r.id}`, name: r.name || q, address: r.location || '', lat: 0, lng: 0, phone: r.phone || '', website: r.website || '', types: ['b2b'], confidence: 80 }));
      } catch (e) { return []; }
    }
  },
  // ===== 103. Verifalia API =====
  verifalia: {
    name: 'Verifalia API', active: true,
    fetch: async (q, env) => {
      const key = env.VERIFALIA_API_KEY;
      if (!key || key === 'YOUR_VERIFALIA_API_KEY') return [];
      try {
        const url = `https://api.verifalia.com/v2.5/emails/${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        if (d.classification?.status === 'Valid') return [{ source: 'verifalia', id: `vf_${Date.now()}`, name: q, address: '', lat: 0, lng: 0, phone: '', website: '', types: ['email'], confidence: 80 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 104. Visual Crossing =====
  visualcrossing: {
    name: 'Visual Crossing', active: true,
    fetch: async (q, env) => {
      const key = env.VISUALCROSSING_API_KEY;
      if (!key || key === 'YOUR_VISUALCROSSING_API_KEY') return [];
      try {
        const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/weatherdata/search?query=${encodeURIComponent(q)}&apikey=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.location) return [{ source: 'visualcrossing', id: `vc_${Date.now()}`, name: d.location || q, address: '', lat: 0, lng: 0, phone: '', website: '', types: ['weather'], confidence: 45 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 105. VoilaNorbert API =====
  voilanorbert: {
    name: 'VoilaNorbert API', active: true,
    fetch: async (q, env) => {
      const key = env.VOILANORBERT_API_KEY;
      if (!key || key === 'YOUR_VOILANORBERT_API_KEY') return [];
      try {
        const url = `https://api.voilanorbert.com/v1/domain/search?domain=${encodeURIComponent(q)}&api_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        return (d.emails || []).slice(0, 5).map(e => ({ source: 'voilanorbert', id: `vn_${e.email}`, name: e.email || q, address: e.domain || '', lat: 0, lng: 0, phone: '', website: e.domain || '', types: ['email'], confidence: 70 }));
      } catch (e) { return []; }
    }
  },
  // ===== 106. WAQI API =====
  waqi: {
    name: 'WAQI API', active: true,
    fetch: async (q, env) => {
      const key = env.WAQI_API_KEY;
      if (!key || key === 'YOUR_WAQI_API_KEY') return [];
      try {
        const url = `https://api.waqi.info/feed/${encodeURIComponent(q)}/?token=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.data) return [{ source: 'waqi', id: `wa_${Date.now()}`, name: `${q} Air Quality`, address: d.data?.city?.name || '', lat: d.data?.city?.geo?.[0] || 0, lng: d.data?.city?.geo?.[1] || 0, phone: '', website: '', types: ['environment'], confidence: 45 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 107. Wappalyzer API =====
  wappalyzer: {
    name: 'Wappalyzer API', active: true,
    fetch: async (q, env) => {
      const key = env.WAPPALYZER_API_KEY;
      if (!key || key === 'YOUR_WAPPALYZER_API_KEY') return [];
      try {
        const url = `https://api.wappalyzer.com/v2/lookup?url=${encodeURIComponent(q)}&api_key=${key}`;
        const res = await fetch(url); const d = await res.json();
        if (d.technologies) return [{ source: 'wappalyzer', id: `wp_${Date.now()}`, name: `Tech Stack: ${q}`, address: q, lat: 0, lng: 0, phone: '', website: q, types: ['tech'], confidence: 55 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 108. WeatherAPI =====
  weatherapi: {
    name: 'WeatherAPI', active: true,
    fetch: async (q, env) => {
      const key = env.WEATHERAPI_KEY;
      if (!key || key === 'YOUR_WEATHERAPI_KEY') return [];
      try {
        const url = `http://api.weatherapi.com/v1/current.json?key=${key}&q=${encodeURIComponent(q)}`;
        const res = await fetch(url); const d = await res.json();
        if (d.location) return [{ source: 'weatherapi', id: `wapi_${Date.now()}`, name: d.location?.name || q, address: `${d.location?.region}, ${d.location?.country}`.trim(), lat: d.location?.lat || 0, lng: d.location?.lon || 0, phone: '', website: '', types: ['weather'], confidence: 55 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 109. WhoisXML API =====
  whoisxml: {
    name: 'WhoisXML API', active: true,
    fetch: async (q, env) => {
      const key = env.WHOISXML_API_KEY;
      if (!key || key === 'YOUR_WHOISXML_API_KEY') return [];
      try {
        const url = `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${key}&domainName=${encodeURIComponent(q)}&outputFormat=JSON`;
        const res = await fetch(url); const d = await res.json();
        if (d.WhoisRecord) return [{ source: 'whoisxml', id: `wx_${Date.now()}`, name: d.WhoisRecord?.domainName || q, address: d.WhoisRecord?.registrant?.country || '', lat: 0, lng: 0, phone: d.WhoisRecord?.registrant?.phone || '', website: d.WhoisRecord?.domainName || '', types: ['domain'], confidence: 50 }];
        return [];
      } catch (e) { return []; }
    }
  },
  // ===== 110. X (Twitter) API v2 =====
  twitter: {
    name: 'Twitter API v2', active: true,
    fetch: async (q, env) => {
      const key = env.TWITTER_API_KEY;
      if (!key || key === 'YOUR_TWITTER_API_KEY') return [];
      try {
        const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(q)}&max_results=5`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.data || []).slice(0, 5).map(t => ({ source: 'twitter', id: `twt_${t.id}`, name: t.text.substring(0, 50) || q, address: '', lat: 0, lng: 0, phone: '', website: '', types: ['social'], confidence: 40 }));
      } catch (e) { return []; }
    }
  },
  // ===== 111. ZoomInfo API =====
  zoominfo: {
    name: 'ZoomInfo API', active: true,
    fetch: async (q, env) => {
      const key = env.ZOOMINFO_API_KEY;
      if (!key || key === 'YOUR_ZOOMINFO_API_KEY') return [];
      try {
        const url = `https://api.zoominfo.com/v1/companies/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const d = await res.json();
        return (d.companies || []).slice(0, 5).map(c => ({ source: 'zoominfo', id: `zi_${c.id}`, name: c.name || q, address: c.location || '', lat: 0, lng: 0, phone: c.phone || '', website: c.website || '', types: ['b2b'], confidence: 80 }));
      } catch (e) { return []; }
    }
  }
};

// সব API-র ফাংশন লিস্ট (শুধু একটিভগুলোই ডেটা দেবে)
function getActiveAPIs() {
  return Object.values(API_CONFIG).filter(api => api.active);
}

// =========================================================================
// NORMALIZE & INSERT
// =========================================================================
async function normalizeAndInsertProfiles(rawItems, env, country) {
  let inserted = 0;
  for (const item of rawItems) {
    if (!item.name || !item.lat) continue;
    const division = GeoIntelligenceEngine.extractDivisionFromAddress(item.address, country) || '';
    const district = GeoIntelligenceEngine.extractDistrictFromAddress(item.address, country) || '';
    const entityType = (item.types && item.types.some(t => ['restaurant', 'hotel', 'spa', 'tourism', 'food', 'cafe'].includes(t))) ? 'SERVICE' : 'BUSINESS';

    const query = `
      INSERT OR IGNORE INTO profiles 
      (id, name, entityType, country, division, district, thana, lat, lng, email, phone, whatsapp, social, confidenceScore, verificationStatus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      item.id,
      item.name.substring(0, 100),
      entityType,
      country,
      division || '',
      district || '',
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
    // ----- getCountries -----
    if (action === 'getCountries') {
      const data = Object.entries(ENTERPRISE_GEO_REGISTRY.countries).map(([key, item]) => ({ id: key, name: item.name }));
      return jsonResponse({ success: true, countries: data }, 200, corsHeaders);
    }

    // ----- getDivisions (by country) -----
    if (action === 'getDivisions') {
      const country = searchParams.get('country') || 'bangladesh';
      const filtered = Object.entries(ENTERPRISE_GEO_REGISTRY.divisions)
        .filter(([_, val]) => val.country === country)
        .map(([key, val]) => ({ id: key, name: val.name }));
      return jsonResponse({ success: true, divisions: filtered }, 200, corsHeaders);
    }

    // ----- getDistricts (by division) -----
    if (action === 'getDistricts') {
      const division = searchParams.get('division');
      if (!division) return jsonResponse({ success: false, error: 'Missing division' }, 400, corsHeaders);
      const filtered = Object.entries(ENTERPRISE_GEO_REGISTRY.districts)
        .filter(([_, val]) => val.division === division)
        .map(([key, val]) => ({ id: key, name: val.name }));
      return jsonResponse({ success: true, districts: filtered }, 200, corsHeaders);
    }

    // ----- getThanas (by district) -----
    if (action === 'getThanas') {
      const district = searchParams.get('district');
      if (!district) return jsonResponse({ success: false, error: 'Missing district' }, 400, corsHeaders);
      const filtered = Object.entries(ENTERPRISE_GEO_REGISTRY.thanas)
        .filter(([_, val]) => val.district === district)
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
      const country = searchParams.get('country') || 'bangladesh';
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
      if (country) { conditions.push(`country = ?`); params.push(country); }
      if (queryTerm) { conditions.push(`(name LIKE ? OR entityType LIKE ?)`); const q = `%${queryTerm}%`; params.push(q, q); }
      if (division) { conditions.push(`division = ?`); params.push(division); }
      if (district) { conditions.push(`district = ?`); params.push(district); }
      if (thana) { conditions.push(`thana = ?`); params.push(thana); }
      if (minConfidence > 0) { conditions.push(`confidenceScore >= ?`); params.push(minConfidence); }
      if (verificationStatus !== 'all') { conditions.push(`verificationStatus = ?`); params.push(verificationStatus); }
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
        console.log(`🔄 Low results (${totalRecords}) for "${queryTerm}" in ${country}. Fetching from external APIs...`);
        
        const activeAPIs = getActiveAPIs();
        const fetchPromises = activeAPIs.map(api => api.fetch(queryTerm, env));
        const results = await Promise.allSettled(fetchPromises);
        
        let allItems = [];
        for (const result of results) {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allItems = allItems.concat(result.value);
          }
        }

        if (allItems.length > 0) {
          const uniqueMap = new Map();
          for (const item of allItems) {
            if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
          }
          const uniqueItems = Array.from(uniqueMap.values()).slice(0, 20);
          
          const inserted = await normalizeAndInsertProfiles(uniqueItems, env, country);
          console.log(`✅ Inserted ${inserted} new profiles from external sources.`);

          const newCount = await env.DB.prepare(countQuery).bind(...params).first();
          totalRecords = newCount ? newCount.total : 0;
        }
      }

      // ফাইনাল ডেটা কোয়েরি (পেজিনেশন সহ)
      const dataQuery = `
        SELECT id, name, entityType, country, division, district, thana, lat, lng,
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
