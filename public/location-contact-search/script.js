/**
 * Smart Contact Finder – Simplified Module (with retry safety)
 * File: public/location-contact-search/script.js
 */

(function() {
    'use strict';

    // ==================== DOM REFS (will be re-checked) ====================
    let countrySelect, divisionSelect, districtSelect, hasEmailCheck, executeBtn,
        toggle, modeIndicator, resultList, emptyState, resultsMeta, resultCountBadge,
        filterHint, paginationInfo, pageIndicator, prevPageBtn, nextPageBtn;

    // ==================== STATE ====================
    let isDatabaseMode = false;
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
        if (!resultList || !emptyState) return;
        resultList.innerHTML = '';
        emptyState.classList.remove('hidden');
        const p1 = emptyState.querySelector('p:first-of-type');
        const p2 = emptyState.querySelector('p:last-of-type');
        if (p1) p1.textContent = message || 'No results';
        if (p2) p2.textContent = detail || 'Try adjusting filters and search again.';
        if (resultsMeta) resultsMeta.textContent = message || 'No results';
        if (paginationInfo) paginationInfo.textContent = 'Showing 0';
        if (pageIndicator) pageIndicator.textContent = '0 / 0';
        if (prevPageBtn) prevPageBtn.disabled = true;
        if (nextPageBtn) nextPageBtn.disabled = true;
        if (resultCountBadge) resultCountBadge.textContent = '0 results';
    }

    function clearResults() {
        currentData = [];
        totalResults = 0;
        totalPages = 1;
        currentPage = 1;
        if (resultList) resultList.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
            const p1 = emptyState.querySelector('p:first-of-type');
            const p2 = emptyState.querySelector('p:last-of-type');
            if (p1) p1.textContent = 'Ready to search';
            if (p2) p2.textContent = 'Adjust filters and click Execute Smart Find';
        }
        if (resultsMeta) resultsMeta.textContent = 'Ready';
        if (paginationInfo) paginationInfo.textContent = 'Showing 0';
        if (pageIndicator) pageIndicator.textContent = '1 / 1';
        if (prevPageBtn) prevPageBtn.disabled = true;
        if (nextPageBtn) nextPageBtn.disabled = true;
        if (resultCountBadge) resultCountBadge.textContent = '0 results';
    }

    function renderPage() {
        if (!resultList || !paginationInfo || !pageIndicator || !prevPageBtn || !nextPageBtn || !resultCountBadge) return;
        const start = (currentPage - 1) * PAGE_LIMIT;
        const end = Math.min(start + PAGE_LIMIT, currentData.length);
        const pageData = currentData.slice(start, end);

        resultList.innerHTML = '';
        emptyState.classList.add('hidden');

        if (!pageData || pageData.length === 0) {
            showEmpty('No results on this page.');
            return;
        }

        const hasEmail = hasEmailCheck ? hasEmailCheck.checked : false;

        pageData.forEach(item => {
            const card = document.createElement('div');
            card.className = 'result-card fade-in';

            const primaryContact = hasEmail ? (item.email || '') : (item.phone || '');
            const contactLabel = hasEmail ? 'Email' : 'Phone';
            const contactValue = primaryContact || '—';

            let descParts = [];
            if (item.address) descParts.push(item.address);
            if (item.website) descParts.push(item.website);
            if (item.entityType) descParts.push(item.entityType);
            if (item.division) descParts.push(item.division);
            if (item.district) descParts.push(item.district);
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

        const totalDisplay = Math.min(totalResults, currentData.length);
        paginationInfo.textContent = `Showing ${start + 1}–${Math.min(end, totalResults)} of ${totalResults}`;
        pageIndicator.textContent = `${currentPage} / ${totalPages || 1}`;
        prevPageBtn.disabled = currentPage <= 1;
        nextPageBtn.disabled = currentPage >= totalPages;
        resultCountBadge.textContent = `${totalResults} results`;
    }

    // ==================== API CALLS FOR GEO HIERARCHY ====================
    async function loadDivisions(country) {
        if (!divisionSelect) return;
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
        if (districtSelect) {
            districtSelect.innerHTML = '<option value="">— All —</option>';
            districtSelect.disabled = true;
        }
    }

    async function loadDistricts(division) {
        if (!districtSelect) return;
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
        if (!countrySelect || !divisionSelect || !districtSelect || !hasEmailCheck || !executeBtn) return;
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
            query: ''
        });

        if (isDatabaseMode) {
            params.set('mode', 'db');
        }

        const url = `/api/finder-api/location-secret?${params.toString()}`;

        executeBtn.disabled = true;
        executeBtn.innerHTML = '<span class="inline-block animate-spin mr-1">⟳</span> Searching...';
        if (resultList) resultList.innerHTML = '';
        if (emptyState) emptyState.classList.add('hidden');
        if (resultsMeta) resultsMeta.textContent = 'Searching...';

        try {
            const data = await apiFetch(url);
            if (data.success && data.contacts) {
                currentData = data.contacts || [];
                totalResults = data.meta?.totalRecords || currentData.length;
                totalPages = Math.ceil(totalResults / PAGE_LIMIT) || 1;
                if (currentPage > totalPages) currentPage = totalPages;
                renderPage();
                if (resultsMeta) resultsMeta.textContent = `Found ${totalResults} result${totalResults !== 1 ? 's' : ''}`;
                if (resultCountBadge) resultCountBadge.textContent = `${totalResults} results`;
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

    // ==================== CACHE DOM AND BIND EVENTS ====================
    function cacheElements() {
        countrySelect = document.getElementById('filterCountry');
        divisionSelect = document.getElementById('filterDivision');
        districtSelect = document.getElementById('filterDistrict');
        hasEmailCheck = document.getElementById('filterHasEmail');
        executeBtn = document.getElementById('executeSearchBtn');
        toggle = document.getElementById('dataSourceToggle');
        modeIndicator = document.getElementById('modeIndicator');
        resultList = document.getElementById('resultList');
        emptyState = document.getElementById('emptyState');
        resultsMeta = document.getElementById('resultsMeta');
        resultCountBadge = document.getElementById('resultCountBadge');
        filterHint = document.getElementById('filterHint');
        paginationInfo = document.getElementById('paginationInfo');
        pageIndicator = document.getElementById('pageIndicator');
        prevPageBtn = document.getElementById('prevPageBtn');
        nextPageBtn = document.getElementById('nextPageBtn');
    }

    function bindEvents() {
        if (!countrySelect || !divisionSelect || !districtSelect || !hasEmailCheck || !executeBtn || !toggle) {
            return false; // not ready
        }

        // Toggle
        toggle.addEventListener('click', function() {
            isDatabaseMode = !isDatabaseMode;
            this.classList.toggle('active', isDatabaseMode);
            this.setAttribute('aria-checked', isDatabaseMode);
            if (modeIndicator) {
                modeIndicator.textContent = isDatabaseMode ? 'Database' : 'Live';
                modeIndicator.className = 'text-[10px] px-2 py-0.5 rounded-full ' +
                    (isDatabaseMode ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700');
            }
            if (filterHint) {
                filterHint.innerHTML = isDatabaseMode ?
                    '💡 Using <strong>Database</strong> cache. Results may be limited to stored data.' :
                    '💡 Using <strong>Live API</strong>. Fetches fresh data from multiple sources.';
            }
            clearResults();
        });

        // Country change
        countrySelect.addEventListener('change', function() {
            loadDivisions(this.value);
        });

        // Division change
        divisionSelect.addEventListener('change', function() {
            loadDistricts(this.value);
        });

        // Execute search
        executeBtn.addEventListener('click', function() {
            currentPage = 1;
            performSearch();
        });

        // Pagination
        if (prevPageBtn && nextPageBtn) {
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
        }

        // Keyboard shortcut
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.target.closest('#locationContactFinder')) {
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT')) {
                    executeBtn.click();
                }
            }
        });

        return true;
    }

    // ==================== INIT WITH RETRY ====================
    let retryCount = 0;
    const MAX_RETRIES = 20;

    function init() {
        cacheElements();
        // Check if critical elements exist
        if (!countrySelect || !divisionSelect || !districtSelect || !hasEmailCheck || !executeBtn || !toggle) {
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                setTimeout(init, 200);
            }
            return;
        }

        // Elements exist – bind events
        const bound = bindEvents();
        if (!bound) {
            if (retryCount < MAX_RETRIES) {
                retryCount++;
                setTimeout(init, 200);
            }
            return;
        }

        // Set initial state
        if (toggle) {
            toggle.classList.remove('active');
            toggle.setAttribute('aria-checked', 'false');
        }
        if (modeIndicator) {
            modeIndicator.textContent = 'Live';
            modeIndicator.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
        }
        if (filterHint) {
            filterHint.innerHTML = '💡 Using <strong>Live API</strong>. Fetches fresh data from multiple sources.';
        }

        // Load divisions for default country
        const defaultCountry = countrySelect.value || 'bangladesh';
        loadDivisions(defaultCountry);
        clearResults();
    }

    // ==================== START ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready – but our container might be loaded later.
        // We'll start retry immediately.
        init();
    }

})();
