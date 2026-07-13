/**
 * Smart Contact Finder – Simplified Module
 * File: public/location-contact-search/script.js
 * Purpose: Clean, minimal logic for searching contacts with API/Database toggle.
 * No extra logs, no metadata, no verify/export/bulk actions.
 */

(function() {
    'use strict';

    // ==================== DOM REFS ====================
    const countrySelect = document.getElementById('filterCountry');
    const divisionSelect = document.getElementById('filterDivision');
    const districtSelect = document.getElementById('filterDistrict');
    const hasEmailCheck = document.getElementById('filterHasEmail');
    const executeBtn = document.getElementById('executeSearchBtn');
    const toggle = document.getElementById('dataSourceToggle');
    const modeIndicator = document.getElementById('modeIndicator');
    const resultList = document.getElementById('resultList');
    const emptyState = document.getElementById('emptyState');
    const resultsMeta = document.getElementById('resultsMeta');
    const resultCountBadge = document.getElementById('resultCountBadge');
    const filterHint = document.getElementById('filterHint');
    const paginationInfo = document.getElementById('paginationInfo');
    const pageIndicator = document.getElementById('pageIndicator');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    // ==================== STATE ====================
    let isDatabaseMode = false;       // false = Live API, true = Database only
    let currentPage = 1;
    let totalPages = 1;
    let totalResults = 0;
    let currentData = [];
    const PAGE_LIMIT = 25;

    // ==================== HELPERS ====================
    function getToken() {
        return localStorage.getItem('emailExtractorToken') || '';
    }

    async function apiFetch(endpoint, options = {}) {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...(options.headers || {})
        };
        const resp = await fetch(endpoint, { ...options, headers });
        return resp.json();
    }

    function escapeHtml(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // ==================== UI HELPERS ====================
    function showEmpty(message, detail) {
        resultList.innerHTML = '';
        emptyState.classList.remove('hidden');
        const p1 = emptyState.querySelector('p:first-of-type');
        const p2 = emptyState.querySelector('p:last-of-type');
        if (p1) p1.textContent = message || 'No results';
        if (p2) p2.textContent = detail || 'Try adjusting filters and search again.';
        resultsMeta.textContent = message || 'No results';
        paginationInfo.textContent = 'Showing 0';
        pageIndicator.textContent = '0 / 0';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        resultCountBadge.textContent = '0 results';
    }

    function clearResults() {
        currentData = [];
        totalResults = 0;
        totalPages = 1;
        currentPage = 1;
        resultList.innerHTML = '';
        emptyState.classList.remove('hidden');
        const p1 = emptyState.querySelector('p:first-of-type');
        const p2 = emptyState.querySelector('p:last-of-type');
        if (p1) p1.textContent = 'Ready to search';
        if (p2) p2.textContent = 'Adjust filters and click Execute Smart Find';
        resultsMeta.textContent = 'Ready';
        paginationInfo.textContent = 'Showing 0';
        pageIndicator.textContent = '1 / 1';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        resultCountBadge.textContent = '0 results';
    }

    function renderPage() {
        const start = (currentPage - 1) * PAGE_LIMIT;
        const end = Math.min(start + PAGE_LIMIT, currentData.length);
        const pageData = currentData.slice(start, end);

        resultList.innerHTML = '';
        emptyState.classList.add('hidden');

        if (!pageData || pageData.length === 0) {
            showEmpty('No results on this page.');
            return;
        }

        const hasEmail = hasEmailCheck.checked;

        pageData.forEach(item => {
            const card = document.createElement('div');
            card.className = 'result-card fade-in';

            // Primary contact: email if filter is on, else phone
            const primaryContact = hasEmail ? (item.email || '') : (item.phone || '');
            const contactLabel = hasEmail ? 'Email' : 'Phone';
            const contactValue = primaryContact || '—';

            // Build description from available fields (1-2 lines)
            let descParts = [];
            if (item.address) descParts.push(item.address);
            if (item.website) descParts.push(item.website);
            if (item.entityType) descParts.push(item.entityType);
            if (item.division) descParts.push(item.division);
            if (item.district) descParts.push(item.district);
            // Also include any extra context like "Chamber time..." if present
            if (item.description) descParts.push(item.description);
            const description = descParts.join(' · ') || 'No additional details';

            card.innerHTML = `
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-slate-800 text-base">${escapeHtml(item.name || 'Unknown')}</div>
                        <div class="mt-0.5 flex items-center gap-2 flex-wrap">
                            <span class="label">${contactLabel}</span>
                            <span class="value">${escapeHtml(contactValue)}</span>
                        </div>
                        <div class="desc mt-1">${escapeHtml(description)}</div>
                    </div>
                    <div class="flex items-start gap-2 mt-1 sm:mt-0 flex-shrink-0">
                        <span class="badge-source">${item.source || 'web'}</span>
                        ${item.country ? `<span class="badge-source">${escapeHtml(item.country)}</span>` : ''}
                    </div>
                </div>
            `;
            resultList.appendChild(card);
        });

        // Update pagination
        const totalDisplay = Math.min(totalResults, currentData.length);
        paginationInfo.textContent = `Showing ${start + 1}–${Math.min(end, totalResults)} of ${totalResults}`;
        pageIndicator.textContent = `${currentPage} / ${totalPages || 1}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
        resultCountBadge.textContent = `${totalResults} results`;
    }

    // ==================== API CALLS FOR GEO HIERARCHY ====================
    async function loadDivisions(country) {
        divisionSelect.innerHTML = '<option value="">Loading...</option>';
        divisionSelect.disabled = true;
        try {
            const data = await apiFetch(`/api/finder-api/location-secret?action=getDivisions&country=${country}`);
            if (data.success && data.divisions) {
                divisionSelect.innerHTML = '<option value="">— All —</option>';
                data.divisions.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = d.name;
                    divisionSelect.appendChild(opt);
                });
                divisionSelect.disabled = false;
            } else {
                divisionSelect.innerHTML = '<option value="">No divisions</option>';
                divisionSelect.disabled = true;
            }
        } catch (_) {
            divisionSelect.innerHTML = '<option value="">Error</option>';
            divisionSelect.disabled = true;
        }
        // Reset district
        districtSelect.innerHTML = '<option value="">— All —</option>';
        districtSelect.disabled = true;
    }

    async function loadDistricts(division) {
        if (!division) {
            districtSelect.innerHTML = '<option value="">— All —</option>';
            districtSelect.disabled = true;
            return;
        }
        districtSelect.innerHTML = '<option value="">Loading...</option>';
        districtSelect.disabled = true;
        try {
            const data = await apiFetch(`/api/finder-api/location-secret?action=getDistricts&division=${division}`);
            if (data.success && data.districts) {
                districtSelect.innerHTML = '<option value="">— All —</option>';
                data.districts.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.id;
                    opt.textContent = d.name;
                    districtSelect.appendChild(opt);
                });
                districtSelect.disabled = false;
            } else {
                districtSelect.innerHTML = '<option value="">No districts</option>';
                districtSelect.disabled = true;
            }
        } catch (_) {
            districtSelect.innerHTML = '<option value="">Error</option>';
            districtSelect.disabled = true;
        }
    }

    // ==================== MAIN SEARCH ====================
    async function performSearch() {
        const country = countrySelect.value || 'bangladesh';
        const division = divisionSelect.value || '';
        const district = districtSelect.value || '';
        const hasEmail = hasEmailCheck.checked;

        const params = new URLSearchParams({
            action: 'search',
            country: country,
            division: division,
            district: district,
            hasEmail: hasEmail ? 'true' : 'false',
            page: currentPage,
            limit: PAGE_LIMIT,
            query: ''   // empty for broad search
        });

        // Add mode hint for backend (optional)
        if (isDatabaseMode) {
            params.set('mode', 'db');
        }

        const url = `/api/finder-api/location-secret?${params.toString()}`;

        // UI feedback
        executeBtn.disabled = true;
        executeBtn.innerHTML = '<span class="inline-block animate-spin mr-1">⟳</span> Searching...';
        resultList.innerHTML = '';
        emptyState.classList.add('hidden');
        resultsMeta.textContent = 'Searching...';

        try {
            const data = await apiFetch(url);
            if (data.success && data.contacts) {
                currentData = data.contacts || [];
                totalResults = data.meta?.totalRecords || currentData.length;
                totalPages = Math.ceil(totalResults / PAGE_LIMIT) || 1;
                if (currentPage > totalPages) currentPage = totalPages;
                renderPage();
                resultsMeta.textContent = `Found ${totalResults} result${totalResults !== 1 ? 's' : ''}`;
                resultCountBadge.textContent = `${totalResults} results`;
            } else {
                showEmpty('No results found. Try adjusting filters.', data.error);
            }
        } catch (_) {
            showEmpty('Something went wrong. Please try again.');
        } finally {
            executeBtn.disabled = false;
            executeBtn.innerHTML =
                '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Execute Smart Find';
        }
    }

    // ==================== EVENT BINDINGS ====================
    function init() {
        // ---- Toggle ----
        toggle.addEventListener('click', function() {
            isDatabaseMode = !isDatabaseMode;
            this.classList.toggle('active', isDatabaseMode);
            this.setAttribute('aria-checked', isDatabaseMode);
            modeIndicator.textContent = isDatabaseMode ? 'Database' : 'Live';
            modeIndicator.className = 'text-[10px] px-2 py-0.5 rounded-full ' +
                (isDatabaseMode ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700');
            filterHint.innerHTML = isDatabaseMode ?
                '💡 Using <strong>Database</strong> cache. Results may be limited to stored data.' :
                '💡 Using <strong>Live API</strong>. Fetches fresh data from multiple sources.';
            clearResults();
        });

        // ---- Country change ----
        countrySelect.addEventListener('change', function() {
            loadDivisions(this.value);
        });

        // ---- Division change ----
        divisionSelect.addEventListener('change', function() {
            loadDistricts(this.value);
        });

        // ---- Execute search ----
        executeBtn.addEventListener('click', function() {
            currentPage = 1;
            performSearch();
        });

        // ---- Pagination ----
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                renderPage();
            }
        });
        nextPageBtn.addEventListener('click', function() {
            if (currentPage < totalPages) {
                currentPage++;
                renderPage();
            }
        });

        // ---- Keyboard shortcut: Enter on any input/select triggers search ----
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.closest('#locationContactFinder')) {
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) {
                    executeBtn.click();
                }
            }
        });

        // ---- Initial load ----
        const defaultCountry = countrySelect.value || 'bangladesh';
        loadDivisions(defaultCountry);
        clearResults();
    }

    // ---- Start when DOM ready ----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
