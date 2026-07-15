/**
 * ============================================================================
 * Enterprise-Grade AI-Powered Contact Intelligence System
 * File: website-secret.js (Cloudflare Worker Backend)
 * Features: Centralized KV API, Anti-Bot Bypass, Global Phone Normalization, 
 *           Email Obfuscation Healing, Smart Crawler Scoring.
 * ============================================================================
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // CORS Headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // 1. Centralized Dynamic API Configuration Loader (Zero-Code Update)
        async function loadDynamicConfig() {
            try {
                const configData = await env.SECRETS_KV.get('API_CONFIGS', 'json');
                return configData || {
                    scraping: { key: '', baseUrl: '' },
                    emailVerify: { key: '', baseUrl: '' },
                    phoneVerify: { key: '', baseUrl: '' },
                    ocr: { key: '', baseUrl: '' },
                    ai: { key: '', baseUrl: '' }
                };
            } catch (error) {
                console.error("KV Load Error:", error);
                return {};
            }
        }

        // Router
        if (url.pathname === '/api/scrape/website' && request.method === 'POST') {
            try {
                const body = await request.json();
                const targetUrl = body.url;
                const limit = body.limit || 100;
                const depth = body.depth || 1;

                if (!targetUrl) {
                    return new Response(JSON.stringify({ success: false, error: "Target URL is required" }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }

                const apiConfig = await loadDynamicConfig();
                const result = await processScrapingJob(targetUrl, depth, limit, apiConfig);

                return new Response(JSON.stringify({ success: true, data: result }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });

            } catch (error) {
                return new Response(JSON.stringify({ success: false, error: error.message }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        return new Response(JSON.stringify({ success: false, error: "Endpoint not found" }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
};

/**
 * ============================================================
 * Core Scraping Engine & Document Mining
 * ============================================================
 */
async function processScrapingJob(startUrl, maxDepth, limit, apiConfig) {
    const visited = new Set();
    const queue = [{ url: cleanUrl(startUrl), depth: 1, score: 100 }];
    
    let allEmails = new Map(); // using Map for deduplication
    let allPhones = new Map();

    while (queue.length > 0 && visited.size < limit) {
        // Sort queue based on smart path scoring (highest score first)
        queue.sort((a, b) => b.score - a.score);
        const current = queue.shift();

        if (visited.has(current.url)) continue;
        visited.add(current.url);

        try {
            const htmlContent = await fetchWithAntiBot(current.url, apiConfig);
            
            // Extract Contacts
            const extractedEmails = extractAndHealEmails(htmlContent, current.url);
            const extractedPhones = extractAndNormalizePhones(htmlContent, current.url);

            extractedEmails.forEach(e => {
                if (!allEmails.has(e.value)) allEmails.set(e.value, e);
            });
            
            extractedPhones.forEach(p => {
                if (!allPhones.has(p.value)) allPhones.set(p.value, p);
            });

            // Smart Crawler: Extract and score internal links if within depth
            if (current.depth < maxDepth) {
                const newLinks = extractLinks(htmlContent, current.url);
                for (const link of newLinks) {
                    if (!visited.has(link)) {
                        queue.push({ 
                            url: link, 
                            depth: current.depth + 1, 
                            score: calculatePathScore(link) 
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to scrape ${current.url}:`, error.message);
        }
    }

    return {
        emails: Array.from(allEmails.values()),
        phones: Array.from(allPhones.values()),
        pagesScanned: visited.size,
        scannedUrls: Array.from(visited)
    };
}

/**
 * ============================================================
 * 2. Robust Universal URL & Anti-Bot Bypass
 * ============================================================
 */
async function fetchWithAntiBot(targetUrl, apiConfig) {
    // Dynamic Header Rotation to bypass basic WAF/Cloudflare
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36"
    ];
    
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
    const headers = {
        'User-Agent': randomUA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
    };

    // If an external Scraping API (like ScraperAPI) is configured in KV
    let fetchUrl = targetUrl;
    if (apiConfig.scraping && apiConfig.scraping.baseUrl && apiConfig.scraping.key) {
        fetchUrl = `${apiConfig.scraping.baseUrl}?api_key=${apiConfig.scraping.key}&url=${encodeURIComponent(targetUrl)}&render=true`;
    }

    const response = await fetch(fetchUrl, { headers, redirect: 'follow' });
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }
    
    return await response.text();
}

function cleanUrl(rawUrl) {
    try {
        const urlObj = new URL(rawUrl);
        // Remove heavy tracking/search parameters to avoid duplication
        urlObj.search = '';
        urlObj.hash = '';
        return urlObj.toString();
    } catch (e) {
        return rawUrl;
    }
}

/**
 * ============================================================
 * 4. Global Phone Intelligence (Multi-Format Normalization)
 * ============================================================
 */
function extractAndNormalizePhones(text, sourceUrl) {
    const results = [];
    // Catch various formats: +1 (234) 567-8901, +880 1818-206268, 01711-223344
    const phoneRegex = /(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{1,4}\)?[\s-]?)?[\d\s-]{7,15}\d/g;
    const matches = text.match(phoneRegex) || [];
    
    const tld = detectCountryFromUrl(sourceUrl);

    for (let raw of matches) {
        let clean = raw.replace(/[^\d+]/g, '');
        
        // Skip obvious fake numbers (e.g., sequential, too short)
        if (clean.length < 8 || clean.length > 15) continue;
        
        // AI Geo-Context Fallback (Auto Country Code Injection)
        if (!clean.startsWith('+')) {
            if (clean.startsWith('00')) {
                clean = '+' + clean.substring(2);
            } else if (clean.startsWith('0') && tld) {
                // Remove local zero and append country code
                clean = tld.code + clean.substring(1);
            } else if (tld) {
                // Prepend country code if no local zero
                clean = tld.code + clean;
            }
        }

        results.push({
            value: clean,
            source: sourceUrl,
            category: detectPhoneCategory(clean),
            confidenceScore: calculateConfidence(clean, 'phone')
        });
    }
    return results;
}

function detectCountryFromUrl(urlStr) {
    const map = {
        '.bd': { code: '+880', country: 'Bangladesh' },
        '.uk': { code: '+44', country: 'United Kingdom' },
        '.us': { code: '+1', country: 'USA' },
        '.au': { code: '+61', country: 'Australia' },
        '.in': { code: '+91', country: 'India' }
    };
    for (const [ext, data] of Object.entries(map)) {
        if (urlStr.includes(ext)) return data;
    }
    return null;
}

function detectPhoneCategory(phoneStr) {
    // Categorize for UI columns (Country-Wise)
    if (phoneStr.startsWith('+880')) return 'Bangladesh';
    if (phoneStr.startsWith('+1')) return 'USA/Canada';
    if (phoneStr.startsWith('+44')) return 'UK';
    return 'Global';
}

/**
 * ============================================================
 * 5. Advanced Email Intelligence & Obfuscation Healing
 * ============================================================
 */
function extractAndHealEmails(text, sourceUrl) {
    const results = [];
    
    // Obfuscation Healing
    // Replaces: info [at] domain dot com -> info@domain.com
    let healedText = text
        .replace(/\s*(?:\[at\]|\(at\)|\[@\]|@| at )\s*/gi, '@')
        .replace(/\s*(?:\[dot\]|\(dot\)|\[\.\]|\.| dot )\s*/gi, '.');

    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
    const matches = healedText.match(emailRegex) || [];

    for (let email of matches) {
        email = email.toLowerCase().trim();
        
        // Filter out obvious image extensions and false positives
        if (email.match(/\.(png|jpg|jpeg|gif|css|js|svg)$/)) continue;
        if (email.length > 60) continue;

        results.push({
            value: email,
            source: sourceUrl,
            category: detectEmailCategory(email),
            confidenceScore: calculateConfidence(email, 'email')
        });
    }
    return results;
}

function detectEmailCategory(email) {
    const prefix = email.split('@')[0].toLowerCase();
    if (['hr', 'career', 'jobs'].includes(prefix)) return 'HR';
    if (['ceo', 'founder', 'director'].includes(prefix)) return 'Management';
    if (['support', 'help', 'care'].includes(prefix)) return 'Support';
    if (['sales', 'marketing', 'info', 'hello', 'contact'].includes(prefix)) return 'General';
    return 'Personal';
}

/**
 * ============================================================
 * 6. Intelligent Crawler: Smart Path Scoring
 * ============================================================
 */
function calculatePathScore(urlStr) {
    let score = 10;
    const lowerUrl = urlStr.toLowerCase();
    
    // High Priority Paths
    const highPriority = ['contact', 'about', 'support', 'team', 'reach', 'locations'];
    const lowPriority = ['blog', 'tag', 'category', 'login', 'cart', 'checkout'];

    for (const keyword of highPriority) {
        if (lowerUrl.includes(keyword)) score += 50;
    }
    for (const keyword of lowPriority) {
        if (lowerUrl.includes(keyword)) score -= 20;
    }
    return score;
}

function extractLinks(html, baseUrl) {
    const links = new Set();
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;
    
    const baseDomain = new URL(baseUrl).hostname;

    while ((match = hrefRegex.exec(html)) !== null) {
        try {
            let linkUrl = new URL(match[1], baseUrl);
            
            // Stay within same domain / handle SPA structure internally
            if (linkUrl.hostname.includes(baseDomain)) {
                linkUrl.hash = ''; // Remove fragments targeting same page
                links.add(linkUrl.toString());
            }
        } catch (e) {
            // Ignore malformed URLs
        }
    }
    return Array.from(links);
}

/**
 * Data Integrity: AI Confidence Scoring stub
 */
function calculateConfidence(value, type) {
    if (type === 'email') {
        return value.includes('.com') || value.includes('.org') || value.includes('.net') ? 95 : 85;
    }
    if (type === 'phone') {
        return value.startsWith('+') && value.length > 10 ? 98 : 75;
    }
    return 50;
}
