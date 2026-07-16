export default {
  async fetch(request, env, ctx) {
    // 1. Global Try-Catch for ensuring JSON response
    try {
      // Allow CORS for frontend communication
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      if (request.method !== "POST") {
        return new Response(JSON.stringify({ success: false, error: "Only POST method is allowed." }), {
          status: 405,
          headers: { "Content-Type": "application/json" }
        });
      }

      const body = await request.json();
      const { url, forceScrape = false } = body;

      if (!url) {
        return new Response(JSON.stringify({ success: false, error: "URL is required." }), { status: 400 });
      }

      // Shared state to hold data for Graceful Degradation
      const extractedData = {
        emails: new Set(),
        phones: new Set()
      };

      // 8. Smart KV Cache Mechanism
      // Generate a simple base64 cache key for the URL
      const cacheKey = `scrape_cache:${btoa(url).substring(0, 50)}`;
      
      if (!forceScrape) {
        const cachedResult = await env.KV.get(cacheKey, "json");
        if (cachedResult) {
          return new Response(JSON.stringify({
            success: true,
            source: "cache",
            data: cachedResult
          }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }
      }

      // 1. Dynamic API Configuration (KV Integration)
      // Reading configurations dynamically without hardcoding
      const scrapingConfig = await env.KV.get("api_config:website_scraping", "json") || {};
      
      const provider = scrapingConfig.provider || "scraperapi";
      const apiKey = scrapingConfig.apiKey || "";

      if (!apiKey && provider !== "custom") {
        return new Response(JSON.stringify({ success: false, error: "Scraping API Key is missing in configuration." }), { status: 500 });
      }

      // Main scraping execution block
      const mainScrapingTask = async () => {
        // 2. Smart URL Interception (SerpApi Integration)
        if (provider === "serpapi" && (url.includes("google.com/search") || url.includes("google.com/url"))) {
          const urlObj = new URL(url);
          const query = urlObj.searchParams.get("q") || urlObj.searchParams.get("url");
          
          if (query) {
            const serpApiUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${apiKey}`;
            const serpResponse = await fetch(serpApiUrl);
            const serpData = await serpResponse.json();

            // 3. Two-Tier Extraction (Extracting from snippet and title)
            const organicResults = serpData.organic_results || [];
            const deepLinks = [];

            for (const result of organicResults) {
              const combinedText = `${result.title || ""} ${result.snippet || ""}`;
              extractContactsFromText(combinedText, extractedData);
              if (result.link) deepLinks.push(result.link);
            }

            // 4. Concurrency Batching & Delay Control
            // Batch processing deep links (3 at a time)
            const batchSize = 3;
            for (let i = 0; i < deepLinks.length; i += batchSize) {
              const batch = deepLinks.slice(i, i + batchSize);
              
              await Promise.all(batch.map(async (link) => {
                await scrapeHtmlAndExtract(link, provider, apiKey, extractedData);
              }));

              // Artificial delay (Jitter) to prevent rate limiting
              if (i + batchSize < deepLinks.length) {
                await new Promise(resolve => setTimeout(resolve, 1500)); 
              }
            }
            return;
          }
        }

        // Standard direct website scraping
        await scrapeHtmlAndExtract(url, provider, apiKey, extractedData);
      };

      // 7. Timeout Racing (Graceful Degradation)
      // Cloudflare worker timeout safety (25 seconds max)
      const timeoutTask = new Promise((resolve) => {
        setTimeout(() => {
          resolve("TIMEOUT_REACHED");
        }, 24500); // 24.5 seconds
      });

      // Race the scraping task against the 24.5 second timer
      const raceResult = await Promise.race([
        mainScrapingTask().then(() => "COMPLETED"),
        timeoutTask
      ]);

      // Convert Sets back to Array for JSON serialization
      const finalResult = {
        emails: Array.from(extractedData.emails),
        phones: Array.from(extractedData.phones),
        status: raceResult === "TIMEOUT_REACHED" ? "partial_timeout" : "completed"
      };

      // Save to cache for 24 hours (86400 seconds) if we found anything
      if (finalResult.emails.length > 0 || finalResult.phones.length > 0) {
        await env.KV.put(cacheKey, JSON.stringify(finalResult), { expirationTtl: 86400 });
      }

      // Return the response
      return new Response(JSON.stringify({
        success: true,
        source: raceResult === "TIMEOUT_REACHED" ? "live_partial" : "live",
        data: finalResult
      }), { 
        status: 200, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });

    } catch (error) {
      // Global error handler sending JSON instead of HTML
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      }), { 
        status: 500, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
  }
};

/**
 * Helper: Build URL for ScraperAPI and fetch HTML
 * Handles Geo-targeting and Selective Rendering
 */
async function scrapeHtmlAndExtract(targetUrl, provider, apiKey, extractedData) {
  try {
    let fetchUrl = targetUrl;

    if (provider === "scraperapi") {
      // 6. Selective Rendering Optimization: render=true only if it seems like a SPA/React site
      // (For advanced use, this could be passed from frontend, but we'll use a smart guess here)
      const needsRender = targetUrl.includes("app.") || targetUrl.includes("react"); 
      
      // 5. ScraperAPI Geo-targeting (country_code=us)
      fetchUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&country_code=us&render=${needsRender}`;
    }

    const response = await fetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    
    if (response.ok) {
      const htmlText = await response.text();
      // Extract from the raw HTML (Visual text + JSON-LD + Mailto)
      extractContactsFromText(htmlText, extractedData);
    }
  } catch (err) {
    console.log(`Failed to scrape ${targetUrl}:`, err.message);
    // Ignore individual link failure to keep the batch running
  }
}

/**
 * Helper: Extract emails and phones using Regex from raw text/HTML
 * 3. Hidden Metadata Analysis (JSON-LD & Mailto) are covered as we scan raw HTML
 */
function extractContactsFromText(text, extractedData) {
  if (!text) return;

  // Regex for Emails (Covers standard emails and mailto: tags dynamically)
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const emails = text.match(emailRegex);
  if (emails) {
    emails.forEach(email => {
      // Basic cleanup and validation
      const cleanEmail = email.toLowerCase().trim();
      if (!cleanEmail.endsWith('.png') && !cleanEmail.endsWith('.jpg')) {
         extractedData.emails.add(cleanEmail);
      }
    });
  }

  // Regex for Phone Numbers (International and US formats)
  // Note: Phone regex can be tricky, this covers most generic formats
  const phoneRegex = /(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/g;
  const phones = text.match(phoneRegex);
  if (phones) {
    phones.forEach(phone => {
      // Add to set to maintain uniqueness
      extractedData.phones.add(phone.trim());
    });
  }
}
