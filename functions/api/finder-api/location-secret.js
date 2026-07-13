/**
 * AI-Powered Smart People & Business Finder Platform - Core Spatial API (SIMPLIFIED)
 * Now respects 'mode' parameter: 'db' = database only, else = live API with auto-fetch.
 * All metadata fields are still returned but frontend uses only what's needed.
 * FIXES: Added email to Hunter API, fixed email storage, and targeted search by keyword.
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
// ENTERPRISE GEO REGISTRY (same as before - kept for hierarchy)
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
// GEO INTELLIGENCE ENGINE (kept for distance calculation if needed)
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
// API CONFIGURATIONS (only the best & most popular APIs with pagination)
// =========================================================================
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const API_CONFIG = {
  google: {
    name: 'Google Places API',
    active: true,
    fetch: async function(query, env, pageToken = null) {
      const key = env.GOOGLE_PLACES_API_KEY;
      if (!key || key === 'YOUR_GOOGLE_API_KEY') return [];
      try {
        let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;
        if (pageToken) url += `&pagetoken=${pageToken}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.status !== 'OK') return [];
        let results = data.results.map(place => ({
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
        if (data.next_page_token && results.length < 50) {
          await sleep(2000);
          const next = await this.fetch(query, env, data.next_page_token);
          results = results.concat(next);
        }
        return results;
      } catch (e) { return []; }
    }
  },
  osm: {
    name: 'OpenStreetMap',
    active: true,
    fetch: async (query) => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=20`;
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
  foursquare: {
    name: 'Foursquare',
    active: true,
    fetch: async (query, env) => {
      const key = env.FOURSQUARE_API_KEY;
      if (!key || key === 'YOUR_FOURSQUARE_API_KEY') return [];
      try {
        const url = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&limit=20`;
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
  yelp: {
    name: 'Yelp',
    active: true,
    fetch: async (query, env) => {
      const key = env.YELP_API_KEY;
      if (!key || key === 'YOUR_YELP_API_KEY') return [];
      try {
        const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(query)}&limit=20`;
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
  tomtom: {
    name: 'TomTom',
    active: true,
    fetch: async (query, env) => {
      const key = env.TOMTOM_API_KEY;
      if (!key || key === 'YOUR_TOMTOM_API_KEY') return [];
      try {
        const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${key}&limit=20`;
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
  mapbox: {
    name: 'Mapbox',
    active: true,
    fetch: async (query, env) => {
      const key = env.MAPBOX_API_KEY;
      if (!key || key === 'YOUR_MAPBOX_API_KEY') return [];
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${key}&limit=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.features) return [];
        return data.features.slice(0, 10).map(f => ({
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
  opencage: {
    name: 'OpenCage',
    active: true,
    fetch: async (query, env) => {
      const key = env.OPENCAGE_API_KEY;
      if (!key || key === 'YOUR_OPENCAGE_API_KEY') return [];
      try {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${key}&limit=10`;
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
  locationiq: {
    name: 'LocationIQ',
    active: true,
    fetch: async (query, env) => {
      const key = env.LOCATIONIQ_API_KEY;
      if (!key || key === 'YOUR_LOCATIONIQ_API_KEY') return [];
      try {
        const url = `https://us1.locationiq.com/v1/search.php?key=${key}&q=${encodeURIComponent(query)}&format=json&limit=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!Array.isArray(data)) return [];
        return data.slice(0, 10).map(item => ({
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
  here: {
    name: 'HERE Maps',
    active: true,
    fetch: async (query, env) => {
      const key = env.HERE_API_KEY;
      if (!key || key === 'YOUR_HERE_API_KEY') return [];
      try {
        const url = `https://discover.search.hereapi.com/v1/discover?q=${encodeURIComponent(query)}&apiKey=${key}&limit=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.items) return [];
        return data.items.slice(0, 10).map(item => ({
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
  geoapify: {
    name: 'Geoapify',
    active: true,
    fetch: async (query, env) => {
      const key = env.GEOAPIFY_API_KEY;
      if (!key || key === 'YOUR_GEOAPIFY_API_KEY') return [];
      try {
        const url = `https://api.geoapify.com/v2/places?text=${encodeURIComponent(query)}&apiKey=${key}&limit=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.features) return [];
        return data.features.slice(0, 10).map(f => ({
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
  positionstack: {
    name: 'PositionStack',
    active: true,
    fetch: async (query, env) => {
      const key = env.POSITIONSTACK_API_KEY;
      if (!key || key === 'YOUR_POSITIONSTACK_API_KEY') return [];
      try {
        const url = `http://api.positionstack.com/v1/forward?access_key=${key}&query=${encodeURIComponent(query)}&limit=10`;
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
  radar: {
    name: 'Radar',
    active: true,
    fetch: async (query, env) => {
      const key = env.RADAR_API_KEY;
      if (!key || key === 'YOUR_RADAR_API_KEY') return [];
      try {
        const url = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(query)}`;
        const resp = await fetch(url, { headers: { 'Authorization': key } });
        const data = await resp.json();
        if (!data.addresses) return [];
        return data.addresses.slice(0, 10).map(a => ({
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
  graphhopper: {
    name: 'GraphHopper',
    active: true,
    fetch: async (query, env) => {
      const key = env.GRAPHHOPPER_API_KEY;
      if (!key || key === 'YOUR_GRAPHHOPPER_API_KEY') return [];
      try {
        const url = `https://graphhopper.com/api/1/geocode?q=${encodeURIComponent(query)}&key=${key}&limit=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.hits) return [];
        return data.hits.slice(0, 10).map(h => ({
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
  openrouteservice: {
    name: 'OpenRouteService',
    active: true,
    fetch: async (query, env) => {
      const key = env.OPENROUTESERVICE_API_KEY;
      if (!key || key === 'YOUR_OPENROUTESERVICE_API_KEY') return [];
      try {
        const url = `https://api.openrouteservice.org/geocode/search?api_key=${key}&text=${encodeURIComponent(query)}&size=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.features) return [];
        return data.features.slice(0, 10).map(f => ({
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
  azure_maps: {
    name: 'Azure Maps',
    active: true,
    fetch: async (query, env) => {
      const key = env.AZURE_MAPS_API_KEY;
      if (!key || key === 'YOUR_AZURE_MAPS_API_KEY') return [];
      try {
        const url = `https://atlas.microsoft.com/search/poi/json?api-version=1.0&query=${encodeURIComponent(query)}&subscription-key=${key}&limit=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.results) return [];
        return data.results.slice(0, 10).map(r => ({
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
  ipwhois: {
    name: 'ipwhois',
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
  hunter: {
    name: 'Hunter.io',
    active: true,
    fetch: async (query, env) => {
      const key = env.HUNTER_API_KEY;
      if (!key || key === 'YOUR_HUNTER_API_KEY') return [];
      try {
        const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(query)}&api_key=${key}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.data?.emails) return [];
        return data.data.emails.slice(0, 10).map(e => ({
          source: 'hunter',
          id: `hnt_${e.value}`,
          name: e.first_name || e.value,
          address: e.domain || '',
          lat: 0,
          lng: 0,
          email: e.value, // <-- FIX: added email field
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
  serpapi: {
    name: 'SerpAPI',
    active: true,
    fetch: async (query, env) => {
      const key = env.SERPAPI_API_KEY;
      if (!key || key === 'YOUR_SERPAPI_API_KEY') return [];
      try {
        const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${key}&engine=google&num=10`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (!data.organic_results) return [];
        return data.organic_results.slice(0, 10).map(r => ({
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

// =========================================================================
// BATCH FETCH ENGINE - generates profiles from all APIs for a country
// =========================================================================
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

async function fetchAllLocationsForCountry(country, env) {
  const allTerms = [];
  allTerms.push(country);
  const divisions = Object.entries(ENTERPRISE_GEO_REGISTRY.divisions)
    .filter(([_, val]) => val.country === country)
    .map(([key]) => key);
  allTerms.push(...divisions);
  for (const div of divisions) {
    const districts = Object.entries(ENTERPRISE_GEO_REGISTRY.districts)
      .filter(([_, val]) => val.division === div)
      .map(([key]) => key);
    allTerms.push(...districts);
  }
  const filteredDistricts = Object.entries(ENTERPRISE_GEO_REGISTRY.districts)
    .filter(([_, val]) => divisions.includes(val.division))
    .map(([key]) => key);
  for (const dist of filteredDistricts) {
    const thanas = Object.entries(ENTERPRISE_GEO_REGISTRY.thanas)
      .filter(([_, val]) => val.district === dist)
      .map(([key]) => key);
    allTerms.push(...thanas);
  }
  const categories = ['restaurant', 'hotel', 'business', 'company', 'shop', 'school', 'hospital', 'cafe', 'gym', 'spa'];
  const finalTerms = [];
  for (const term of allTerms) {
    finalTerms.push(term);
    for (const cat of categories) {
      finalTerms.push(`${cat} ${term}`);
      finalTerms.push(`${term} ${cat}`);
    }
  }
  const uniqueTerms = [...new Set(finalTerms)].slice(0, 200);
  let allItems = [];
  for (const term of uniqueTerms) {
    const items = await fetchFromAllAPIs(term, env);
    if (items.length) allItems = allItems.concat(items);
    await sleep(300);
  }
  return allItems;
}

// =========================================================================
// NORMALIZE & INSERT (FIXED: email is now stored)
// =========================================================================
async function normalizeAndInsertProfiles(rawItems, env, country, fallbackThana = '') {
  let inserted = 0;
  let skipped = 0;
  for (const item of rawItems) {
    if (!item.name || (!item.lat && item.source !== 'hunter' && item.source !== 'clearbit' && item.source !== 'apollo' && item.source !== 'zoominfo' && item.source !== 'uplead' && item.source !== 'salesintel' && item.source !== 'pdl' && item.source !== 'proxycurl' && item.source !== 'rocketreach' && item.source !== 'lusha' && item.source !== 'kaspr' && item.source !== 'serpapi')) {
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
        WHERE name = ? AND lat = ? AND lng = ?
      )
    `;
    const params = [
      item.id,
      item.name.substring(0, 100),
      entityType,
      country,
      division || '',
      district || '',
      fallbackThana || '',
      item.lat || 0,
      item.lng || 0,
      item.email || '', // <-- FIX: now storing email
      item.phone || '',
      '',
      item.website || '',
      item.confidence || 60,
      'UNVERIFIED',
      item.name.substring(0, 100),
      item.lat || 0,
      item.lng || 0
    ];
    try {
      const result = await env.DB.prepare(query).bind(...params).run();
      if (result.meta?.changes > 0) inserted++;
    } catch (e) { /* skip duplicates */ }
  }
  return inserted;
}

// =========================================================================
// CLOUDFLARE WORKER HANDLER (with simplified search mode)
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

  // --- CRON endpoint (no auth) ---
  if (action === 'cronFetch') {
    if (!env.DB) return jsonResponse({ success: false, error: 'Database binding not found' }, 500, corsHeaders);
    const countries = Object.keys(ENTERPRISE_GEO_REGISTRY.countries);
    let totalInserted = 0;
    for (const c of countries) {
      const rawItems = await fetchAllLocationsForCountry(c, env);
      if (rawItems.length) {
        const inserted = await normalizeAndInsertProfiles(rawItems, env, c, '');
        totalInserted += inserted;
      }
      await sleep(1000);
    }
    return jsonResponse({ success: true, message: `Cron fetch completed. Inserted ${totalInserted} new profiles.` }, 200, corsHeaders);
  }

  // --- Regular auth check for other endpoints ---
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

    // ----- getThanas (kept for completeness) -----
    if (action === 'getThanas') {
      const district = searchParams.get('district');
      if (!district) return jsonResponse({ success: false, error: 'Missing district' }, 400, corsHeaders);
      const filtered = Object.entries(ENTERPRISE_GEO_REGISTRY.thanas)
        .filter(([_, val]) => val.district === district)
        .map(([key, val]) => ({ id: key, name: val.name, lat: val.lat, lng: val.lng }));
      return jsonResponse({ success: true, thanas: filtered }, 200, corsHeaders);
    }

    // ----- verifyProfile (kept but not used in simplified UI) -----
    if (action === 'verifyProfile') {
      return jsonResponse({ success: false, error: 'Not implemented in simplified version' }, 400, corsHeaders);
    }

    // ----- batchFetchAll (manual trigger) -----
    if (action === 'batchFetchAll') {
      if (!env.DB) return jsonResponse({ success: false, error: 'Database binding not found' }, 500, corsHeaders);
      const country = searchParams.get('country') || 'all';
      const countries = country === 'all' ? Object.keys(ENTERPRISE_GEO_REGISTRY.countries) : [country];
      let totalInserted = 0;
      for (const c of countries) {
        const rawItems = await fetchAllLocationsForCountry(c, env);
        if (rawItems.length) {
          const inserted = await normalizeAndInsertProfiles(rawItems, env, c, '');
          totalInserted += inserted;
        }
        await sleep(1000);
      }
      return jsonResponse({ success: true, message: `Batch fetch completed. Inserted ${totalInserted} new profiles.` }, 200, corsHeaders);
    }

    // ----- SEARCH (with mode parameter and targeted keyword) -----
    if (action === 'search') {
      if (!env.DB) return jsonResponse({ success: false, error: 'Database binding not found' }, 500, corsHeaders);

      const queryTerm = searchParams.get('query') || ''; // keyword/industry
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

      // Auto-fetch ONLY if mode is live and we have a specific query and few records
      if (mode !== 'db' && totalRecords < 10 && country && queryTerm && queryTerm.trim().length > 0) {
        // Build a targeted query: e.g., "Software Company in Dhaka, Bangladesh"
        const locationParts = [district, division, country].filter(Boolean);
        const targetedQuery = `${queryTerm} in ${locationParts.join(', ')}`;
        // Use fetchFromAllAPIs with the targeted query (not the entire country)
        const rawItems = await fetchFromAllAPIs(targetedQuery, env);
        if (rawItems.length) {
          await normalizeAndInsertProfiles(rawItems, env, country, district || division);
          // Re-count after insertion
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
