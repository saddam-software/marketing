/**
 * ============================================================================
 * Frontend Script: Website Contact Extractor
 * Purpose: Handles UI interactions, API calls to the Cloudflare Worker, 
 *          and dynamic rendering of scraped data.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. DOM Elements Selection
    const extractForm = document.getElementById('extract-form');
    const urlInput = document.getElementById('target-url');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultsContainer = document.getElementById('results-container');
    const emailTableBody = document.getElementById('email-results-body');
    const phoneTableBody = document.getElementById('phone-results-body');
    const scanStats = document.getElementById('scan-stats');

    // IMPORTANT: Replace this with your actual Cloudflare Worker URL
    const BACKEND_API_URL = 'https://YOUR_WORKER_SUBDOMAIN.workers.dev/api/scrape/website';

    // 2. Form Submit Event Listener
    extractForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default page reload
        
        const targetUrl = urlInput.value.trim();
        if (!targetUrl) {
            alert('Please enter a valid website URL.');
            return;
        }

        // Prepare UI for loading
        showLoading(true);
        clearPreviousResults();

        try {
            // 3. API Call to Backend
            const response = await fetch(BACKEND_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    url: targetUrl,
                    limit: 20, // Customize scraping limit if needed
                    depth: 2   // Customize crawl depth if needed
                })
            });

            const result = await response.json();

            if (result.success) {
                // 4. Render Data
                renderResults(result.data);
            } else {
                throw new Error(result.error || 'Failed to extract data.');
            }

        } catch (error) {
            console.error('Extraction Error:', error);
            alert(`Error: ${error.message}. Please check your backend connection or URL.`);
        } finally {
            showLoading(false);
        }
    });

    /**
     * ============================================================
     * Helper Functions for UI & Rendering
     * ============================================================
     */

    // Toggles the loading spinner/message
    function showLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.style.display = 'block';
            resultsContainer.style.display = 'none';
        } else {
            loadingIndicator.style.display = 'none';
        }
    }

    // Clears old table data before a new search
    function clearPreviousResults() {
        emailTableBody.innerHTML = '';
        phoneTableBody.innerHTML = '';
        scanStats.innerHTML = '';
    }

    // Populates the DOM with the scraped data
    function renderResults(data) {
        const { emails, phones, pagesScanned } = data;

        // Update Stats
        scanStats.innerHTML = `<strong>Scan Complete:</strong> Scanned ${pagesScanned} pages. Found ${emails.length} emails and ${phones.length} phone numbers.`;

        // Render Emails
        if (emails.length > 0) {
            emails.forEach(email => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${email.value}</td>
                    <td><span class="badge category-${email.category.toLowerCase()}">${email.category}</span></td>
                    <td>${email.confidenceScore}%</td>
                    <td><a href="${email.source}" target="_blank" rel="noopener noreferrer">Source</a></td>
                `;
                emailTableBody.appendChild(row);
            });
        } else {
            emailTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No emails found.</td></tr>';
        }

        // Render Phones
        if (phones.length > 0) {
            phones.forEach(phone => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${phone.value}</td>
                    <td><span class="badge category-${phone.category.replace('/', '-').toLowerCase()}">${phone.category}</span></td>
                    <td>${phone.confidenceScore}%</td>
                    <td><a href="${phone.source}" target="_blank" rel="noopener noreferrer">Source</a></td>
                `;
                phoneTableBody.appendChild(row);
            });
        } else {
            phoneTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No phone numbers found.</td></tr>';
        }

        // Show the results container
        resultsContainer.style.display = 'block';
    }
});
