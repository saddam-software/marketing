/**
 * AI-Powered Smart People & Business Finder Platform - Core Spatial API
 * MULTI-COUNTRY + MULTI-SOURCE AUTO-CACHING ENGINE (Hybrid)
 * Countries: Bangladesh, India, UAE, Thailand, Niger, Argentina, Ireland, Malta, Brazil
 * Selected Top APIs: Only the most popular and data-rich APIs are kept.
 * Auto-fetch with detailed console logs for Cloudflare Workers debugging.
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
  },
  thanas: {
    'gulshan': { district: 'dhaka', name: 'Gulshan', lat: 23.7925, lng: 90.4078 },
    'dhanmondi': { district: 'dhaka', name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
    'uttara': { district: 'dhaka', name: 'Uttara', lat: 23.8729, lng: 90.3987 },
    'cox_bazar_sadar': { district: 'cox_bazar', name: "Cox's Bazar Sadar", lat: 21.4272, lng: 92.0058 },
    'sylhet_sadar': { district: 'sylhet', name: 'Sylhet Sadar', lat: 24.8996, lng: 91.8710 },
    'andheri': { district: 'mumbai', name: 'Andheri', lat: 19.1197, lng: 72.8468 },
    'bandra': { district: 'mumbai', name: 'Bandra', lat: 19.0596, lng: 72.8295 },
    'indiranagar': { district: 'bangalore', name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
    'downtown_dubai': { district: 'dubai_city', name: 'Downtown Dubai', lat: 25.1961, lng: 55.2741 },
    'marina': { district: 'dubai_city', name: 'Dubai Marina', lat: 25.0801, lng: 55.1431 },
    'corniche': { district: 'abu_dhabi_city', name: 'Corniche', lat: 24.4667, lng: 54.3667 },
    'sukhumvit': { district: 'bangkok_city', name: 'Sukhumvit', lat: 13.7367, lng: 100.5623 },
    'silom': { district: 'bangkok_city', name: 'Silom', lat: 13.7249, lng: 100.5234 },
    'old_city': { district: 'chiang_mai_city', name: 'Old City', lat: 18.7893, lng: 98.9852 },
    'plateau': { district: 'niamey_city', name: 'Plateau', lat: 13.5127, lng: 2.1126 },
    'goudel': { district: 'niamey_city', name: 'Goudel', lat: 13.5064, lng: 2.0982 },
    'kollo': { district: 'tillaberi_city', name: 'Kollo', lat: 13.3056, lng: 1.9833 },
    'palermo': { district: 'buenos_aires_city', name: 'Palermo', lat: -34.5889, lng: -58.4306 },
    'recoleta': { district: 'buenos_aires_city', name: 'Recoleta', lat: -34.5889, lng: -58.3924 },
    'nueva_cordoba': { district: 'cordoba_city', name: 'Nueva Cordoba', lat: -31.4201, lng: -64.1888 },
    'temple_bar': { district: 'dublin', name: 'Temple Bar', lat: 53.3454, lng: -6.2622 },
    'docklands': { district: 'dublin', name: 'Docklands', lat: 53.3471, lng: -6.2411 },
    'cork_city_center': { district: 'cork', name: 'Cork City Center', lat: 51.8985, lng: -8.4756 },
    'valletta_waterfront': { district: 'valletta', name: 'Valletta Waterfront', lat: 35.8989, lng: 14.5146 },
    'mosta_dome': { district: 'mosta', name: 'Mosta Dome', lat: 35.9092, lng: 14.4266 },
    'birgu_waterfront': { district: 'birgu', name: 'Birgu Waterfront', lat: 35.8875, lng: 14.5226 },
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
// API CONFIGURATIONS – Only Top & Popular APIs (≈25 APIs)
// =========================================================================
const API_CONFIG = {
  // ----- Google Places API (Most comprehensive) -----
  google: {
    name: 'Google Places API',
    active: true,
    fetch: async (query, env) => {
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
          address: place.formatted_address || '',
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          phone: place.formatted_phone_number || '',
          website: place.website || '',
          types: place.types || [],
          confidence: 75
        }));
      } catch (e) { return []; }
    }
  },

  // ----- OpenStreetMap (Nominatim) - Free & reliable -----
  osm: {
    name: 'OpenStreetMap (Nominatim)',
    active: true,
    fetch: async (query) => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`;
        const resp = await fetch(url, { headers: { 'User-Agent': 'BusinessFinder/1.0' } });
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
          confidence: 50
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Foursquare Places API -----
  foursquare: {
    name: 'Foursquare Places API',
    active: true,
    fetch: async (query, env) => {
      const key = env.FOURSQUARE_API_KEY;
      if (!key || key === 'YOUR_FOURSQUARE_API_KEY') return [];
      try {
        const url = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&limit=10`;
        const resp = await fetch(url, { headers: { 'Authorization': key } });
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
  },

  // ----- Yelp Fusion API -----
  yelp: {
    name: 'Yelp Fusion API',
    active: true,
    fetch: async (query, env) => {
      const key = env.YELP_API_KEY;
      if (!key || key === 'YOUR_YELP_API_KEY') return [];
      try {
        const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(query)}&limit=10`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
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
  },

  // ----- TomTom Places API -----
  tomtom: {
    name: 'TomTom Places API',
    active: true,
    fetch: async (query, env) => {
      const key = env.TOMTOM_API_KEY;
      if (!key || key === 'YOUR_TOMTOM_API_KEY') return [];
      try {
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${key}&limit=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.map(item => ({
          source: 'tomtom',
          id: `tomtom_${item.id}`,
          name: item.poi?.name || item.address?.streetName || 'Unknown',
          address: item.address?.freeformAddress || '',
          lat: item.position?.lat || 0,
          lng: item.position?.lon || 0,
          phone: '',
          website: '',
          types: item.poi?.categorySet?.map(c => c.name) || [],
          confidence: 60
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Mapbox Search API -----
  mapbox: {
    name: 'Mapbox Search',
    active: true,
    fetch: async (query, env) => {
      const key = env.MAPBOX_API_KEY;
      if (!key || key === 'YOUR_MAPBOX_API_KEY') return [];
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.features) return [];
        return data.features.slice(0, 5).map(f => ({
          source: 'mapbox',
          id: `mbx_${f.id}`,
          name: f.place_name || query,
          address: f.place_name || '',
          lat: f.center?.[1] || 0,
          lng: f.center?.[0] || 0,
          phone: '',
          website: '',
          types: ['geocode'],
          confidence: 65
        }));
      } catch (e) { return []; }
    }
  },

  // ----- OpenCage Geocoder -----
  opencage: {
    name: 'OpenCage Geocoder',
    active: true,
    fetch: async (query, env) => {
      const key = env.OPENCAGE_API_KEY;
      if (!key || key === 'YOUR_OPENCAGE_API_KEY') return [];
      try {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${key}&limit=5`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.map(r => ({
          source: 'opencage',
          id: `oc_${r.annotations?.geohash || Date.now()}`,
          name: r.components?.city || query,
          address: r.formatted || '',
          lat: r.geometry?.lat || 0,
          lng: r.geometry?.lng || 0,
          phone: '',
          website: '',
          types: ['geocode'],
          confidence: 65
        }));
      } catch (e) { return []; }
    }
  },

  // ----- LocationIQ -----
  locationiq: {
    name: 'LocationIQ',
    active: true,
    fetch: async (query, env) => {
      const key = env.LOCATIONIQ_API_KEY;
      if (!key || key === 'YOUR_LOCATIONIQ_API_KEY') return [];
      try {
        const url = `https://us1.locationiq.com/v1/search.php?key=${key}&q=${encodeURIComponent(query)}&format=json`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!Array.isArray(data)) return [];
        return data.slice(0, 5).map(item => ({
          source: 'locationiq',
          id: `liq_${item.place_id}`,
          name: item.display_name.split(',')[0] || query,
          address: item.display_name || '',
          lat: item.lat || 0,
          lng: item.lon || 0,
          phone: '',
          website: '',
          types: ['geocode'],
          confidence: 60
        }));
      } catch (e) { return []; }
    }
  },

  // ----- HERE Maps Places API -----
  here: {
    name: 'HERE Maps Places',
    active: true,
    fetch: async (query, env) => {
      const key = env.HERE_API_KEY;
      if (!key || key === 'YOUR_HERE_API_KEY') return [];
      try {
        const url = `https://discover.search.hereapi.com/v1/discover?q=${encodeURIComponent(query)}&apiKey=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.items) return [];
        return data.items.slice(0, 5).map(item => ({
          source: 'here',
          id: `here_${item.id}`,
          name: item.title || query,
          address: item.address?.label || '',
          lat: item.position?.lat || 0,
          lng: item.position?.lng || 0,
          phone: '',
          website: '',
          types: ['place'],
          confidence: 65
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Geoapify Places API -----
  geoapify: {
    name: 'Geoapify Places',
    active: true,
    fetch: async (query, env) => {
      const key = env.GEOAPIFY_API_KEY;
      if (!key || key === 'YOUR_GEOAPIFY_API_KEY') return [];
      try {
        const url = `https://api.geoapify.com/v2/places?text=${encodeURIComponent(query)}&apiKey=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.features) return [];
        return data.features.slice(0, 5).map(f => ({
          source: 'geoapify',
          id: `gpf_${f.properties?.place_id}`,
          name: f.properties?.name || query,
          address: f.properties?.formatted || '',
          lat: f.geometry?.coordinates?.[1] || 0,
          lng: f.geometry?.coordinates?.[0] || 0,
          phone: '',
          website: '',
          types: f.properties?.categories || [],
          confidence: 65
        }));
      } catch (e) { return []; }
    }
  },

  // ----- PositionStack -----
  positionstack: {
    name: 'PositionStack',
    active: true,
    fetch: async (query, env) => {
      const key = env.POSITIONSTACK_API_KEY;
      if (!key || key === 'YOUR_POSITIONSTACK_API_KEY') return [];
      try {
        const url = `http://api.positionstack.com/v1/forward?access_key=${key}&query=${encodeURIComponent(query)}&limit=5`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.data) return [];
        return data.data.map(item => ({
          source: 'positionstack',
          id: `ps_${item.latitude}_${item.longitude}`,
          name: item.label || query,
          address: item.label || '',
          lat: item.latitude || 0,
          lng: item.longitude || 0,
          phone: '',
          website: '',
          types: ['geocode'],
          confidence: 60
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Radar API -----
  radar: {
    name: 'Radar API',
    active: true,
    fetch: async (query, env) => {
      const key = env.RADAR_API_KEY;
      if (!key || key === 'YOUR_RADAR_API_KEY') return [];
      try {
        const url = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': key } });
        const data = await resp.json();
        if (!data.addresses) return [];
        return data.addresses.slice(0, 5).map(a => ({
          source: 'radar',
          id: `rd_${a.id}`,
          name: a.addressLabel || query,
          address: a.formattedAddress || '',
          lat: a.latitude || 0,
          lng: a.longitude || 0,
          phone: '',
          website: '',
          types: ['geocode'],
          confidence: 60
        }));
      } catch (e) { return []; }
    }
  },

  // ----- GraphHopper API -----
  graphhopper: {
    name: 'GraphHopper API',
    active: true,
    fetch: async (query, env) => {
      const key = env.GRAPHHOPPER_API_KEY;
      if (!key || key === 'YOUR_GRAPHHOPPER_API_KEY') return [];
      try {
        const url = `https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(query)}&key=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.hits) return [];
        return data.hits.slice(0, 5).map(h => ({
          source: 'graphhopper',
          id: `gh_${h.point?.lat || Date.now()}`,
          name: h.name || query,
          address: h.country || '',
          lat: h.point?.lat || 0,
          lng: h.point?.lng || 0,
          phone: '',
          website: '',
          types: ['geocode'],
          confidence: 60
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Esri ArcGIS -----
  esri: {
    name: 'Esri ArcGIS',
    active: true,
    fetch: async (query) => {
      try {
        const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find?text=${encodeURIComponent(query)}&f=json&maxLocations=5`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.locations) return [];
        return data.locations.map(l => ({
          source: 'esri',
          id: `esri_${l.id}`,
          name: l.name || query,
          address: l.address || '',
          lat: l.location?.y || 0,
          lng: l.location?.x || 0,
          phone: '',
          website: '',
          types: ['geocode'],
          confidence: 60
        }));
      } catch (e) { return []; }
    }
  },

  // ----- OpenRouteService -----
  openrouteservice: {
    name: 'OpenRouteService',
    active: true,
    fetch: async (query, env) => {
      const key = env.OPENROUTESERVICE_API_KEY;
      if (!key || key === 'YOUR_OPENROUTESERVICE_API_KEY') return [];
      try {
        const url = `https://api.openrouteservice.org/geocode/search?api_key=${key}&text=${encodeURIComponent(query)}&size=5`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.features) return [];
        return data.features.map(f => ({
          source: 'openrouteservice',
          id: `ors_${f.properties?.id}`,
          name: f.properties?.name || query,
          address: f.properties?.label || '',
          lat: f.geometry?.coordinates?.[1] || 0,
          lng: f.geometry?.coordinates?.[0] || 0,
          phone: '',
          website: '',
          types: ['geocode'],
          confidence: 60
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Azure Maps -----
  azure_maps: {
    name: 'Azure Maps',
    active: true,
    fetch: async (query, env) => {
      const key = env.AZURE_MAPS_API_KEY;
      if (!key || key === 'YOUR_AZURE_MAPS_API_KEY') return [];
      try {
        const url = `https://atlas.microsoft.com/search/poi/json?api-version=1.0&query=${encodeURIComponent(query)}&subscription-key=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.map(r => ({
          source: 'azure_maps',
          id: `az_${r.id}`,
          name: r.poi?.name || 'Unknown',
          address: r.address?.freeformAddress || '',
          lat: r.position?.lat || 0,
          lng: r.position?.lon || 0,
          phone: r.poi?.phone || '',
          website: '',
          types: ['place'],
          confidence: 60
        }));
      } catch (e) { return []; }
    }
  },

  // ----- IP Location APIs (ip-api.com) -----
  ipapi: {
    name: 'ip-api.com',
    active: true,
    fetch: async (query) => {
      try {
        const url = `http://ip-api.com/json/${encodeURIComponent(query)}?fields=status,message,country,regionName,city,lat,lon`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.status === 'success') {
          return [{
            source: 'ipapi',
            id: `ipa_${Date.now()}`,
            name: data.city || query,
            address: `${data.regionName}, ${data.country}`.trim(),
            lat: data.lat || 0,
            lng: data.lon || 0,
            phone: '',
            website: '',
            types: ['location'],
            confidence: 50
          }];
        }
        return [];
      } catch (e) { return []; }
    }
  },

  // ----- ipinfo.io -----
  ipinfo: {
    name: 'ipinfo.io',
    active: true,
    fetch: async (query, env) => {
      const key = env.IPINFO_API_KEY;
      if (!key || key === 'YOUR_IPINFO_API_KEY') return [];
      try {
        const url = `https://ipinfo.io/${encodeURIComponent(query)}/json?token=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.loc) {
          const coords = data.loc.split(',');
          return [{
            source: 'ipinfo',
            id: `ipi_${Date.now()}`,
            name: data.city || query,
            address: `${data.region}, ${data.country}`.trim(),
            lat: parseFloat(coords[0]) || 0,
            lng: parseFloat(coords[1]) || 0,
            phone: '',
            website: '',
            types: ['location'],
            confidence: 55
          }];
        }
        return [];
      } catch (e) { return []; }
    }
  },

  // ----- ipwhois API -----
  ipwhois: {
    name: 'ipwhois API',
    active: true,
    fetch: async (query, env) => {
      const key = env.IPWHOIS_API_KEY;
      if (!key || key === 'YOUR_IPWHOIS_API_KEY') return [];
      try {
        const url = `https://ipwhois.app/api/v2?ip=${encodeURIComponent(query)}&key=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.latitude) {
          return [{
            source: 'ipwhois',
            id: `ipw_${Date.now()}`,
            name: data.city || query,
            address: `${data.region}, ${data.country}`.trim(),
            lat: data.latitude || 0,
            lng: data.longitude || 0,
            phone: '',
            website: '',
            types: ['location'],
            confidence: 50
          }];
        }
        return [];
      } catch (e) { return []; }
    }
  },

  // ----- Hunter.io (Email/Company enrichment) -----
  hunter: {
    name: 'Hunter.io API',
    active: true,
    fetch: async (query, env) => {
      const key = env.HUNTER_API_KEY;
      if (!key || key === 'YOUR_HUNTER_API_KEY') return [];
      try {
        const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(query)}&api_key=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.data?.emails) return [];
        return data.data.emails.slice(0, 5).map(e => ({
          source: 'hunter',
          id: `hnt_${e.value}`,
          name: e.first_name || e.value,
          address: e.domain || '',
          lat: 0,
          lng: 0,
          phone: '',
          website: e.domain || '',
          types: ['email'],
          confidence: 80
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Clearbit (Company lookup) -----
  clearbit: {
    name: 'HubSpot Clearbit',
    active: true,
    fetch: async (query, env) => {
      const key = env.CLEARBIT_API_KEY;
      if (!key || key === 'YOUR_CLEARBIT_API_KEY') return [];
      try {
        const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!Array.isArray(data)) return [];
        return data.map(c => ({
          source: 'clearbit',
          id: `clb_${c.domain}`,
          name: c.name || query,
          address: c.location || '',
          lat: 0,
          lng: 0,
          phone: '',
          website: c.domain || '',
          types: ['business'],
          confidence: 75
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Apollo.io (B2B contacts) -----
  apollo: {
    name: 'Apollo.io API',
    active: true,
    fetch: async (query, env) => {
      const key = env.APOLLO_API_KEY;
      if (!key || key === 'YOUR_APOLLO_API_KEY') return [];
      try {
        const url = `https://api.apollo.io/v1/mixed_people/search?q=${encodeURIComponent(query)}&api_key=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.people) return [];
        return data.people.slice(0, 5).map(p => ({
          source: 'apollo',
          id: `apollo_${p.id}`,
          name: p.name || 'Unknown',
          address: p.location || '',
          lat: 0,
          lng: 0,
          phone: p.phone || '',
          website: p.website || '',
          types: ['business'],
          confidence: 75
        }));
      } catch (e) { return []; }
    }
  },

  // ----- ZoomInfo (Company data) -----
  zoominfo: {
    name: 'ZoomInfo API',
    active: true,
    fetch: async (query, env) => {
      const key = env.ZOOMINFO_API_KEY;
      if (!key || key === 'YOUR_ZOOMINFO_API_KEY') return [];
      try {
        const url = `https://api.zoominfo.com/v1/companies/search?q=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.companies) return [];
        return data.companies.slice(0, 5).map(c => ({
          source: 'zoominfo',
          id: `zi_${c.id}`,
          name: c.name || query,
          address: c.location || '',
          lat: 0,
          lng: 0,
          phone: c.phone || '',
          website: c.website || '',
          types: ['b2b'],
          confidence: 80
        }));
      } catch (e) { return []; }
    }
  },

  // ----- UpLead (B2B) -----
  uplead: {
    name: 'UpLead API',
    active: true,
    fetch: async (query, env) => {
      const key = env.UPLEAD_API_KEY;
      if (!key || key === 'YOUR_UPLEAD_API_KEY') return [];
      try {
        const url = `https://api.uplead.com/v1/search?query=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 5).map(r => ({
          source: 'uplead',
          id: `up_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0,
          lng: 0,
          phone: r.phone || '',
          website: r.website || '',
          types: ['b2b'],
          confidence: 80
        }));
      } catch (e) { return []; }
    }
  },

  // ----- SalesIntel (B2B) -----
  salesintel: {
    name: 'SalesIntel API',
    active: true,
    fetch: async (query, env) => {
      const key = env.SALESINTEL_API_KEY;
      if (!key || key === 'YOUR_SALESINTEL_API_KEY') return [];
      try {
        const url = `https://api.salesintel.io/v1/search?query=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 5).map(r => ({
          source: 'salesintel',
          id: `si_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0,
          lng: 0,
          phone: r.phone || '',
          website: r.website || '',
          types: ['b2b'],
          confidence: 80
        }));
      } catch (e) { return []; }
    }
  },

  // ----- People Data Labs (PDL) -----
  pdl: {
    name: 'People Data Labs',
    active: true,
    fetch: async (query, env) => {
      const key = env.PDL_API_KEY;
      if (!key || key === 'YOUR_PDL_API_KEY') return [];
      try {
        const url = `https://api.peopledatalabs.com/v5/person/search?q=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'X-Api-Key': key } });
        const data = await resp.json();
        if (!data.data) return [];
        return data.data.slice(0, 5).map(p => ({
          source: 'pdl',
          id: `pdl_${p.id}`,
          name: p.full_name || query,
          address: p.location || '',
          lat: 0,
          lng: 0,
          phone: p.phone || '',
          website: p.company_website || '',
          types: ['profile'],
          confidence: 70
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Proxycurl (LinkedIn profiles) -----
  proxycurl: {
    name: 'Proxycurl API',
    active: true,
    fetch: async (query, env) => {
      const key = env.PROXYCURL_API_KEY;
      if (!key || key === 'YOUR_PROXYCURL_API_KEY') return [];
      try {
        const url = `https://nubela.co/proxycurl/api/search/person?query=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 5).map(r => ({
          source: 'proxycurl',
          id: `pc_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0,
          lng: 0,
          phone: r.phone || '',
          website: r.website || '',
          types: ['linkedin'],
          confidence: 70
        }));
      } catch (e) { return []; }
    }
  },

  // ----- RocketReach -----
  rocketreach: {
    name: 'RocketReach API',
    active: true,
    fetch: async (query, env) => {
      const key = env.ROCKETREACH_API_KEY;
      if (!key || key === 'YOUR_ROCKETREACH_API_KEY') return [];
      try {
        const url = `https://api.rocketreach.co/v1/search/people?q=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.people) return [];
        return data.people.slice(0, 5).map(p => ({
          source: 'rocketreach',
          id: `rr_${p.id}`,
          name: p.name || query,
          address: p.location || '',
          lat: 0,
          lng: 0,
          phone: p.phone || '',
          website: p.website || '',
          types: ['b2b'],
          confidence: 70
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Lusha -----
  lusha: {
    name: 'Lusha API',
    active: true,
    fetch: async (query, env) => {
      const key = env.LUSHA_API_KEY;
      if (!key || key === 'YOUR_LUSHA_API_KEY') return [];
      try {
        const url = `https://api.lusha.com/v1/search?query=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 5).map(r => ({
          source: 'lusha',
          id: `lu_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0,
          lng: 0,
          phone: r.phone || '',
          website: r.company || '',
          types: ['b2b'],
          confidence: 75
        }));
      } catch (e) { return []; }
    }
  },

  // ----- Kaspr -----
  kaspr: {
    name: 'Kaspr API',
    active: true,
    fetch: async (query, env) => {
      const key = env.KASPR_API_KEY;
      if (!key || key === 'YOUR_KASPR_API_KEY') return [];
      try {
        const url = `https://api.kaspr.io/v1/search?query=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${key}` } });
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 5).map(r => ({
          source: 'kaspr',
          id: `kp_${r.id}`,
          name: r.name || query,
          address: r.location || '',
          lat: 0,
          lng: 0,
          phone: r.phone || '',
          website: r.company || '',
          types: ['linkedin'],
          confidence: 70
        }));
      } catch (e) { return []; }
    }
  },

  // ----- SerpAPI (Google search results) -----
  serpapi: {
    name: 'SerpAPI',
    active: true,
    fetch: async (query, env) => {
      const key = env.SERPAPI_API_KEY;
      if (!key || key === 'YOUR_SERPAPI_API_KEY') return [];
      try {
        const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${key}&engine=google`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.organic_results) return [];
        return data.organic_results.slice(0, 5).map(r => ({
          source: 'serpapi',
          id: `serp_${r.position}`,
          name: r.title || query,
          address: r.snippet || '',
          lat: 0,
          lng: 0,
          phone: '',
          website: r.link || '',
          types: ['web'],
          confidence: 50
        }));
      } catch (e) { return []; }
    }
  }
};

// Get only active APIs
function getActiveAPIs() {
  return Object.values(API_CONFIG).filter(api => api.active);
}

// =========================================================================
// NORMALIZE & INSERT (with logging)
// =========================================================================
async function normalizeAndInsertProfiles(rawItems, env, country, fallbackThana = '') {
  let inserted = 0;
  let skipped = 0;
  for (const item of rawItems) {
    if (!item.name || !item.lat) {
      skipped++;
      continue;
    }
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
      fallbackThana || '',
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
  console.log(`📊 Inserted ${inserted} new profiles (skipped ${skipped} invalid items)`);
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

    // ----- SEARCH (MAIN LOGIC WITH AUTO-FETCH & LOGGING) -----
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

      console.log(`🔍 SEARCH START: term="${queryTerm}", country="${country}", division="${division}", district="${district}", thana="${thana}"`);

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
      console.log(`📊 Initial DB records: ${totalRecords}`);

      // ---- AUTO-FETCH LOGIC with extensive logging ----
      let apiSearchTerm = queryTerm;
      if (!apiSearchTerm) {
        if (thana) apiSearchTerm = thana;
        else if (district) apiSearchTerm = district;
        else if (division) apiSearchTerm = division;
        else apiSearchTerm = country;
      }

      if (totalRecords < 3 && apiSearchTerm && apiSearchTerm.length > 2) {
        console.log(`🔄 Low results (${totalRecords}) for "${apiSearchTerm}" in ${country}. Fetching from external APIs...`);
        
        const activeAPIs = getActiveAPIs();
        console.log(`📡 Calling ${activeAPIs.length} external APIs...`);
        
        const fetchPromises = activeAPIs.map(async (api) => {
          try {
            const start = Date.now();
            const items = await api.fetch(apiSearchTerm, env);
            const duration = Date.now() - start;
            console.log(`   ✅ ${api.name}: ${items.length} items (${duration}ms)`);
            return { source: api.name, items, duration };
          } catch (err) {
            console.log(`   ❌ ${api.name}: error - ${err.message}`);
            return { source: api.name, items: [], error: err.message };
          }
        });
        
        const results = await Promise.allSettled(fetchPromises);
        let allItems = [];
        let totalFetched = 0;
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value && Array.isArray(result.value.items)) {
            allItems = allItems.concat(result.value.items);
            totalFetched += result.value.items.length;
          }
        }
        console.log(`📦 Total items fetched from all APIs: ${totalFetched}`);

        if (allItems.length > 0) {
          // Deduplicate by id
          const uniqueMap = new Map();
          for (const item of allItems) {
            if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
          }
          const uniqueItems = Array.from(uniqueMap.values()).slice(0, 50);
          console.log(`🆕 Unique items after dedup: ${uniqueItems.length}`);

          const inserted = await normalizeAndInsertProfiles(uniqueItems, env, country, thana);
          console.log(`💾 Inserted ${inserted} new profiles into D1.`);

          // Re-count after insertion
          const newCount = await env.DB.prepare(countQuery).bind(...params).first();
          totalRecords = newCount ? newCount.total : 0;
          console.log(`📊 New total records: ${totalRecords}`);
        } else {
          console.log(`⚠️ No items returned from any API.`);
        }
      } else {
        console.log(`⏭️ Skipping auto-fetch: records=${totalRecords}, term="${apiSearchTerm}" (condition not met)`);
      }

      // Final data query with pagination
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

      // Radius filter (client-side)
      if (radius > 0 && thana) {
        const center = ENTERPRISE_GEO_REGISTRY.thanas[thana.toLowerCase()];
        if (center) {
          const before = results.length;
          results = results.filter(p => {
            const dist = GeoIntelligenceEngine.calculateDistance(center.lat, center.lng, p.lat, p.lng);
            return dist <= radius;
          });
          console.log(`📏 Radius filter (${radius}km): kept ${results.length} of ${before} records`);
          totalRecords = results.length;
        }
      }

      const paginated = results.slice(0, limit);
      console.log(`✅ Final result: ${paginated.length} records returned (page ${page}, limit ${limit})`);
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
