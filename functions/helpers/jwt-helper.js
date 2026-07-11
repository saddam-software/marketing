/**
 * Security Engine: Native Web Crypto JWT Helper
 * File: functions/helpers/jwt-helper.js
 * Purpose: Secure Token Sign & Verification without external dependencies.
 */

// ১. ডেটাকে সুরক্ষিত লিংকে রূপান্তর করার জন্য সাহায্যকারী ফাংশন (Base64URL)
function bufferToBase64Url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

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

/**
 * ইউজার লগইন করার পর তার জন্য সুরক্ষিত টোকেন তৈরি করার ফাংশন
 * @param {Object} payload - ইউজারের তথ্য (যেমন: username, role)
 * @param {string} secret - আপনার গোপন চাবি (JWT_SECRET)
 * @returns {string} - সম্পূর্ণ সুরক্ষিত JWT টোকেন
 */
export async function generateJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encoder = new TextEncoder();
  
  // হেডার এবং পেলোডকে এনকোড করা
  const encodedHeader = bufferToBase64Url(encoder.encode(JSON.stringify(header)));
  const encodedPayload = bufferToBase64Url(encoder.encode(JSON.stringify(payload)));
  
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  
  // Web Crypto API দিয়ে গোপন চাবিটি প্রস্তুত করা
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // HMAC-SHA256 অ্যালগরিদম দিয়ে ডিজিটাল সিগনেচার বা সিল তৈরি করা
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(dataToSign)
  );
  
  const encodedSignature = bufferToBase64Url(signature);
  
  // তিনটি অংশ ডট (.) দিয়ে জোড়া লাগিয়ে টোকেন তৈরি
  return `${dataToSign}.${encodedSignature}`;
}

/**
 * ব্রাউজার থেকে আসা টোকেনটি আসল নাকি নকল তা যাচাই করার ফাংশন
 * @param {string} token - ইউজারের পাঠানো টোকেন
 * @param {string} secret - আপনার গোপন চাবি (JWT_SECRET)
 * @returns {Object} - { valid: true/false, payload: ..., error: ... }
 */
export async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed token structure' };
    }
    
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
    
    // সিগনেচারটি আসল কি না তা ক্রিপ্টোগ্রাফি দিয়ে চেক করা
    const signatureBuffer = base64UrlToBuffer(encodedSignature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBuffer,
      encoder.encode(dataToSign)
    );
    
    if (!isValid) {
      return { valid: false, error: 'Invalid digital signature' };
    }
    
    // টোকেনের ভেতর থেকে ইউজারের তথ্য বের করা
    const decoder = new TextDecoder();
    const payloadStr = decoder.decode(base64UrlToBuffer(encodedPayload));
    const payload = JSON.parse(payloadStr);
    
    // টোকেনের মেয়াদ (Expiration Time) শেষ হয়েছে কি না পরীক্ষা করা
    if (payload.exp && (Date.now() / 1000) > payload.exp) {
      return { valid: false, error: 'Token has expired' };
    }
    
    return { valid: true, payload };
  } catch (err) {
    return { valid: false, error: 'Token verification failed' };
  }
}
