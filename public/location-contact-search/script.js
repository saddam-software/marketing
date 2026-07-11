/**
 * AI-Powered Smart People & Business Finder Platform
 * File: public/location-contact-search/script.js
 * Clean version – no debug logs, only critical errors.
 * 
 * Updated: Verify Node feature (Option A) implemented.
 * Updated: Export Directory CSV functionality added.
 * Updated: AI Query parser with badge feedback.
 * Updated: D1 database compatibility – direct profile properties (email, phone, etc.)
 */

(function() {
    'use strict';

    if (window.SmartLocationFinder) {
        return;
    }

    class SmartLocationFinder {
        constructor() {
            this.state = {
                filters: {
                    entityType: 'all',
                    division: '',
                    district: '',
                    thana: '',
                    radius: 0,
                    minConfidence: 0,
                    verificationStatus: 'all',
                    channels: {
                        email: false,
                        phone: false,
                        whatsapp: false,
                        social: false
                    }
                },
                searchQuery: '',
                pagination: {
                    currentPage: 1,
                    limit: 25,
                    totalPages: 1,
                    totalRecords: 0
                },
                data: []
            };
            this.currentModalProfileId = null;
            this.retryCount = 0;
            this.maxRetries = 5;
            this.init();
        }

        init() {
            this.cacheDOM();
            if (this.divisionSelect) {
                this.bindEvents();
                this.loadGeoHierarchy();
                this.updateStatsBar();
            } else {
                this.retryInit();
            }
        }

        retryInit() {
            if (this.retryCount >= this.maxRetries) return;
            this.retryCount++;
            setTimeout(() => {
                this.cacheDOM();
                if (this.divisionSelect) {
                    this.bindEvents();
                    this.loadGeoHierarchy();
                    this.updateStatsBar();
                } else {
                    this.retryInit();
                }
            }, 200);
        }

        cacheDOM() {
            this.divisionSelect = document.getElementById('divisionSelect');
            this.districtSelect = document.getElementById('districtSelect');
            this.thanaSelect = document.getElementById('thanaSelect');
            this.entityTypeSelect = document.getElementById('entityTypeSelect');
            this.geoRadiusSlider = document.getElementById('geoRadiusSlider');
            this.radiusValueDisplay = document.getElementById('radiusValueDisplay');
            this.confidenceScoreSlider = document.getElementById('confidenceScoreSlider');
            this.confidenceValueDisplay = document.getElementById('confidenceValueDisplay');
            this.verificationStatusSelect = document.getElementById('verificationStatusSelect');
            this.hasEmailCheck = document.getElementById('hasEmailCheck');
            this.hasPhoneCheck = document.getElementById('hasPhoneCheck');
            this.hasWhatsappCheck = document.getElementById('hasWhatsappCheck');
            this.hasSocialCheck = document.getElementById('hasSocialCheck');
            this.smartNlpSearchInput = document.getElementById('smartNlpSearchInput');
            this.clearSmartSearchBtn = document.getElementById('clearSmartSearchBtn');
            this.searchLocationBtn = document.getElementById('searchLocationBtn');
            this.resetAllFiltersBtn = document.getElementById('resetAllFiltersBtn');
            this.locationResultBody = document.getElementById('locationResultBody');
            this.locationResultCount = document.getElementById('locationResultCount');
            this.locationResultMeta = document.getElementById('locationResultMeta');
            this.tablePaginationWrapper = document.getElementById('tablePaginationWrapper');
            this.paginationLimitSelect = document.getElementById('paginationLimitSelect');
            this.prevPageBtn = document.getElementById('prevPageBtn');
            this.nextPageBtn = document.getElementById('nextPageBtn');
            this.currentPageNumDisplay = document.getElementById('currentPageNumDisplay');
            this.totalPageNumDisplay = document.getElementById('totalPageNumDisplay');
            this.masterProfileDetailsModal = document.getElementById('masterProfileDetailsModal');
            this.closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
            this.closeProfileModalBottomBtn = document.getElementById('closeProfileModalBottomBtn');
            this.verifyProfileInstanceBtn = document.getElementById('verifyProfileInstanceBtn');
            this.exportLocationCsvBtn = document.getElementById('exportLocationCsv');
            this.aiIntentBadge = document.getElementById('aiIntentBadge');
        }

        bindEvents() {
            this.geoRadiusSlider?.addEventListener('input', (e) => {
                const val = e.target.value;
                this.radiusValueDisplay.textContent = val == 0 ? 'Global' : `${val} KM`;
                this.state.filters.radius = val;
            });
            this.confidenceScoreSlider?.addEventListener('input', (e) => {
                this.confidenceValueDisplay.textContent = `${e.target.value}%`;
                this.state.filters.minConfidence = e.target.value;
            });
            this.searchLocationBtn?.addEventListener('click', () => {
                this.state.pagination.currentPage = 1;
                this.executeSearch();
            });
            this.clearSmartSearchBtn?.addEventListener('click', () => {
                this.smartNlpSearchInput.value = '';
                this.state.searchQuery = '';
                if (this.aiIntentBadge) {
                    this.aiIntentBadge.classList.add('hidden');
                }
            });
            this.resetAllFiltersBtn?.addEventListener('click', () => this.resetFilters());
            this.paginationLimitSelect?.addEventListener('change', (e) => {
                this.state.pagination.limit = parseInt(e.target.value);
                this.state.pagination.currentPage = 1;
                this.executeSearch();
            });
            this.prevPageBtn?.addEventListener('click', () => {
                if (this.state.pagination.currentPage > 1) {
                    this.state.pagination.currentPage--;
                    this.executeSearch();
                }
            });
            this.nextPageBtn?.addEventListener('click', () => {
                if (this.state.pagination.currentPage < this.state.pagination.totalPages) {
                    this.state.pagination.currentPage++;
                    this.executeSearch();
                }
            });
            this.closeProfileModalBtn?.addEventListener('click', () => this.toggleModal(false));
            this.closeProfileModalBottomBtn?.addEventListener('click', () => this.toggleModal(false));
            this.verifyProfileInstanceBtn?.addEventListener('click', () => this.verifyCurrentProfile());
            this.exportLocationCsvBtn?.addEventListener('click', () => this.exportToCSV());
        }

        getAuthHeaders() {
            const token = localStorage.getItem('emailExtractorToken');
            return {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };
        }

        async loadGeoHierarchy() {
            const headers = this.getAuthHeaders();

            try {
                const divResponse = await fetch('/api/finder-api/location-secret?action=getDivisions', { headers });
                const divData = await divResponse.json();
                if (divData.success && divData.divisions) {
                    this.divisionSelect.innerHTML = '<option value="">— Select Division —</option>';
                    divData.divisions.forEach(div => {
                        const option = document.createElement('option');
                        option.value = div.id;
                        option.textContent = div.name;
                        this.divisionSelect.appendChild(option);
                    });
                    this.divisionSelect.disabled = false;
                } else {
                    this.divisionSelect.innerHTML = '<option value="">Failed to load divisions</option>';
                    this.divisionSelect.disabled = true;
                }
            } catch (_) {
                this.divisionSelect.innerHTML = '<option value="">Error loading divisions</option>';
                this.divisionSelect.disabled = true;
            }

            this.divisionSelect.addEventListener('change', async (e) => {
                const divisionId = e.target.value;
                this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
                this.thanaSelect.disabled = true;

                if (!divisionId) {
                    this.districtSelect.innerHTML = '<option value="">— Select District —</option>';
                    this.districtSelect.disabled = true;
                    return;
                }

                this.districtSelect.innerHTML = '<option value="">Loading districts...</option>';
                this.districtSelect.disabled = true;

                try {
                    const distResponse = await fetch(`/api/finder-api/location-secret?action=getDistricts&division=${divisionId}`, { headers });
                    const distData = await distResponse.json();
                    if (distData.success && distData.districts && distData.districts.length > 0) {
                        this.districtSelect.innerHTML = '<option value="">— Select District —</option>';
                        distData.districts.forEach(dist => {
                            const opt = document.createElement('option');
                            opt.value = dist.id;
                            opt.textContent = dist.name;
                            this.districtSelect.appendChild(opt);
                        });
                        this.districtSelect.disabled = false;
                    } else {
                        this.districtSelect.innerHTML = '<option value="">No districts found</option>';
                        this.districtSelect.disabled = true;
                    }
                } catch (_) {
                    this.districtSelect.innerHTML = '<option value="">Error loading districts</option>';
                    this.districtSelect.disabled = true;
                }
            });

            this.districtSelect.addEventListener('change', async (e) => {
                const districtId = e.target.value;
                if (!districtId) {
                    this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
                    this.thanaSelect.disabled = true;
                    return;
                }

                this.thanaSelect.innerHTML = '<option value="">Loading thanas...</option>';
                this.thanaSelect.disabled = true;

                try {
                    const thanaResponse = await fetch(`/api/finder-api/location-secret?action=getThanas&district=${districtId}`, { headers });
                    const thanaData = await thanaResponse.json();
                    if (thanaData.success && thanaData.thanas && thanaData.thanas.length > 0) {
                        this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
                        thanaData.thanas.forEach(thana => {
                            const opt = document.createElement('option');
                            opt.value = thana.id;
                            opt.textContent = thana.name;
                            this.thanaSelect.appendChild(opt);
                        });
                        this.thanaSelect.disabled = false;
                    } else {
                        this.thanaSelect.innerHTML = '<option value="">No thanas found</option>';
                        this.thanaSelect.disabled = true;
                    }
                } catch (_) {
                    this.thanaSelect.innerHTML = '<option value="">Error loading thanas</option>';
                    this.thanaSelect.disabled = true;
                }
            });
        }

        resetFilters() {
            document.getElementById('advancedSearchForm')?.reset();
            this.geoRadiusSlider.value = 0;
            this.radiusValueDisplay.textContent = 'Global';
            this.confidenceScoreSlider.value = 0;
            this.confidenceValueDisplay.textContent = '0%';
            this.smartNlpSearchInput.value = '';
            
            if (this.aiIntentBadge) {
                this.aiIntentBadge.classList.add('hidden');
            }

            this.state.filters.entityType = 'all';
            this.state.filters.division = '';
            this.state.filters.district = '';
            this.state.filters.thana = '';
            this.state.pagination.currentPage = 1;
            this.state.data = [];
            
            this.locationResultBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-slate-500 py-16">
                        <div class="flex flex-col items-center justify-center space-y-3">
                            <div class="p-4 bg-slate-50 text-slate-400 rounded-full">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                            </div>
                            <div>
                                <p class="font-semibold text-slate-700">Filters Reset Successful</p>
                                <p class="text-xs text-slate-400 mt-1">Ready for new parameters execution.</p>
                            </div>
                        </div>
                    </td>
                </tr>`;
            this.locationResultCount.textContent = '0 Records';
            this.tablePaginationWrapper.classList.add('hidden');
            if (this.exportLocationCsvBtn) {
                this.exportLocationCsvBtn.disabled = true;
            }
        }

        // ================= AI PARSER =================
        parseSmartQuery(query) {
            if (!query || query.trim() === '') {
                if (this.aiIntentBadge) {
                    this.aiIntentBadge.classList.add('hidden');
                }
                return;
            }

            const lower = query.toLowerCase();
            let intentDetected = false;

            if (lower.includes('email')) {
                if (this.hasEmailCheck) {
                    this.hasEmailCheck.checked = true;
                    intentDetected = true;
                }
            }

            if (lower.includes('phone') || lower.includes('call')) {
                if (this.hasPhoneCheck) {
                    this.hasPhoneCheck.checked = true;
                    intentDetected = true;
                }
            }

            if (lower.includes('business') || lower.includes('company')) {
                if (this.entityTypeSelect) {
                    this.entityTypeSelect.value = 'BUSINESS';
                    intentDetected = true;
                }
            }

            if (lower.includes('creator') || lower.includes('influencer')) {
                if (this.entityTypeSelect) {
                    this.entityTypeSelect.value = 'CREATOR';
                    intentDetected = true;
                }
            }

            const divisionMap = {
                'dhaka': 'Dhaka',
                'sylhet': 'Sylhet',
                'chattogram': 'Chattogram'
            };
            for (const [key, name] of Object.entries(divisionMap)) {
                if (lower.includes(key)) {
                    const options = this.divisionSelect?.options;
                    if (options) {
                        for (let i = 0; i < options.length; i++) {
                            const opt = options[i];
                            if (opt.text.toLowerCase() === name.toLowerCase()) {
                                this.divisionSelect.value = opt.value;
                                intentDetected = true;
                                const event = new Event('change', { bubbles: true });
                                this.divisionSelect.dispatchEvent(event);
                                break;
                            }
                        }
                    }
                    break;
                }
            }

            if (lower.includes('verified')) {
                if (this.verificationStatusSelect) {
                    this.verificationStatusSelect.value = 'VERIFIED';
                    intentDetected = true;
                }
            }

            if (this.aiIntentBadge) {
                if (intentDetected) {
                    this.aiIntentBadge.classList.remove('hidden');
                } else {
                    this.aiIntentBadge.classList.add('hidden');
                }
            }
        }

        async executeSearch() {
            this.parseSmartQuery(this.smartNlpSearchInput.value);

            this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center py-10"><div class="animate-pulse flex flex-col items-center"><div class="h-8 w-8 bg-blue-200 rounded-full mb-3"></div><div class="text-sm text-slate-500">Searching...</div></div></td></tr>`;
            
            this.state.searchQuery = this.smartNlpSearchInput.value;
            this.state.filters.entityType = this.entityTypeSelect.value;
            this.state.filters.division = this.divisionSelect.value;
            this.state.filters.district = this.districtSelect.value;
            this.state.filters.thana = this.thanaSelect.value;
            this.state.filters.verificationStatus = this.verificationStatusSelect.value;

            const queryParams = new URLSearchParams({
                action: 'search',
                query: this.state.searchQuery,
                entityType: this.state.filters.entityType,
                division: this.state.filters.division,
                district: this.state.filters.district,
                thana: this.state.filters.thana,
                radius: this.state.filters.radius,
                minConfidence: this.state.filters.minConfidence,
                verificationStatus: this.state.filters.verificationStatus,
                hasEmail: this.hasEmailCheck.checked,
                hasPhone: this.hasPhoneCheck.checked,
                hasWhatsapp: this.hasWhatsappCheck.checked,
                hasSocial: this.hasSocialCheck.checked,
                page: this.state.pagination.currentPage,
                limit: this.state.pagination.limit
            });

            try {
                const token = localStorage.getItem('emailExtractorToken');
                if(!token) {
                    this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-10 font-bold">Authentication Error: Please log in again.</td></tr>`;
                    return;
                }

                const response = await fetch(`/api/finder-api/location-secret?${queryParams.toString()}`, {
                    method: 'GET',
                    headers: this.getAuthHeaders()
                });
                
                const data = await response.json();

                if (data.success) {
                    this.state.data = data.contacts;
                    this.state.pagination.totalRecords = data.meta.totalRecords;
                    this.state.pagination.totalPages = data.meta.totalPages;
                    
                    this.renderTable();
                    this.updatePaginationUI();
                } else {
                    this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-10">Search Error: ${data.error}</td></tr>`;
                }

            } catch (_) {
                this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-10">Network error. Please try again.</td></tr>`;
            }
        }

        // ================= RENDER TABLE (D1 COMPATIBLE) =================
        renderTable() {
            this.locationResultBody.innerHTML = '';
            this.locationResultCount.textContent = `${this.state.pagination.totalRecords} Records Found (Page ${this.state.pagination.currentPage})`;
            this.locationResultMeta.textContent = 'Showing real-time results directly from Master Engine.';

            if (this.exportLocationCsvBtn) {
                this.exportLocationCsvBtn.disabled = (this.state.data.length === 0);
            }

            if (this.state.data.length === 0) {
                this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-500 py-10">No verified profiles found matching your criteria. Try loosening the filters.</td></tr>`;
                return;
            }

            this.state.data.forEach(profile => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-blue-50/50 transition-colors cursor-pointer group";
                
                const locationText = [profile.thana, profile.district].filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');

                // D1 direct properties (fallback to channels for backward compatibility)
                const hasEmail = !!(profile.email || (profile.channels && profile.channels.email));
                const hasPhone = !!(profile.phone || (profile.channels && profile.channels.phone));
                const hasWhatsapp = !!(profile.whatsapp || (profile.channels && profile.channels.whatsapp));
                const hasSocial = !!(profile.social || (profile.channels && profile.channels.social));

                tr.innerHTML = `
                    <td class="p-3 text-center">
                        <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" value="${profile.id}">
                    </td>
                    <td class="p-3">
                        <div class="font-semibold text-slate-800">${profile.name}</div>
                        <div class="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">${profile.entityType}</div>
                    </td>
                    <td class="p-3">
                        <div class="flex items-center gap-2">
                            ${hasEmail ? `<span title="Email" class="w-2 h-2 rounded-full bg-emerald-500"></span>` : `<span class="w-2 h-2 rounded-full bg-slate-200"></span>`}
                            ${hasPhone ? `<span title="Phone" class="w-2 h-2 rounded-full bg-blue-500"></span>` : `<span class="w-2 h-2 rounded-full bg-slate-200"></span>`}
                            ${hasWhatsapp ? `<span title="WhatsApp" class="w-2 h-2 rounded-full bg-green-500"></span>` : `<span class="w-2 h-2 rounded-full bg-slate-200"></span>`}
                            ${hasSocial ? `<span title="Social" class="w-2 h-2 rounded-full bg-purple-500"></span>` : `<span class="w-2 h-2 rounded-full bg-slate-200"></span>`}
                        </div>
                    </td>
                    <td class="p-3 text-xs text-slate-600 capitalize">
                        ${locationText || 'Location Unknown'}
                    </td>
                    <td class="p-3 text-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${profile.confidenceScore > 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                            ${profile.confidenceScore}% Match
                        </span>
                    </td>
                    <td class="p-3 text-right">
                        <button class="view-profile-btn text-xs bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 px-3 py-1.5 rounded transition-all shadow-sm" data-id="${profile.id}">View Matrix</button>
                    </td>
                `;
                this.locationResultBody.appendChild(tr);
            });

            document.querySelectorAll('.view-profile-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    this.openProfileModal(id);
                });
            });
        }

        updatePaginationUI() {
            if (this.state.pagination.totalPages > 0) {
                this.tablePaginationWrapper.classList.remove('hidden');
            } else {
                this.tablePaginationWrapper.classList.add('hidden');
            }
            
            this.currentPageNumDisplay.textContent = this.state.pagination.currentPage;
            this.totalPageNumDisplay.textContent = this.state.pagination.totalPages || 1;

            this.prevPageBtn.disabled = this.state.pagination.currentPage <= 1;
            this.nextPageBtn.disabled = this.state.pagination.currentPage >= this.state.pagination.totalPages;
        }

        // ================= OPEN PROFILE MODAL (D1 COMPATIBLE) =================
        openProfileModal(profileId) {
            const profile = this.state.data.find(p => p.id === profileId);
            if(!profile) return;

            this.currentModalProfileId = profileId;

            document.getElementById('modalProfileTitle').innerHTML = `<span>🛡️</span> Entity Reference: #${profile.id}`;

            // D1 direct properties (fallback to channels)
            const email = profile.email || (profile.channels && profile.channels.email) || '';
            const phone = profile.phone || (profile.channels && profile.channels.phone) || '';
            const whatsapp = profile.whatsapp || (profile.channels && profile.channels.whatsapp) || '';
            const social = profile.social || (profile.channels && profile.channels.social) || '';

            document.getElementById('modalProfileBody').innerHTML = `
                <div class="p-4 bg-blue-50 rounded-lg border border-blue-100 text-blue-800 text-sm">
                    <strong>System Note:</strong> Live Data Matrix established securely. 
                </div>
                
                <div class="mt-4">
                    <h4 class="text-lg font-bold text-slate-800">${profile.name}</h4>
                    <p class="text-xs text-slate-500 uppercase tracking-wide">${profile.entityType}</p>
                </div>

                <div class="grid grid-cols-2 gap-4 mt-4">
                    <div class="bg-slate-50 p-3 rounded border border-slate-200">
                        <p class="text-xs text-slate-500 uppercase">Contact Channels</p>
                        <div class="mt-1 space-y-1 text-sm font-medium">
                            ${email ? `<p class="text-slate-800">✉️ ${email}</p>` : ''}
                            ${phone ? `<p class="text-slate-800">📞 ${phone}</p>` : ''}
                            ${whatsapp ? `<p class="text-slate-800">💬 ${whatsapp}</p>` : ''}
                            ${social ? `<p class="text-slate-800">🔗 ${social}</p>` : ''}
                            ${!email && !phone && !whatsapp && !social ? '<p class="text-slate-400">No contact info</p>' : ''}
                        </div>
                    </div>
                    <div class="bg-slate-50 p-3 rounded border border-slate-200">
                        <p class="text-xs text-slate-500 uppercase">Verification Level</p>
                        <p class="font-medium ${profile.verificationStatus === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600'} mt-1">
                            ${profile.verificationStatus}
                        </p>
                        <p class="text-xs text-slate-500 mt-2">Confidence: ${profile.confidenceScore}%</p>
                    </div>
                </div>
            `;
            this.toggleModal(true);
        }

        toggleModal(show) {
            if (show) {
                this.masterProfileDetailsModal.classList.remove('hidden');
            } else {
                this.masterProfileDetailsModal.classList.add('hidden');
                this.currentModalProfileId = null;
            }
        }

        updateStatsBar() {
            document.getElementById('metaTotalProfiles').textContent = 'Live Data';
            document.getElementById('metaVerifiedProfiles').textContent = 'Secured';
            document.getElementById('metaAvgConfidence').textContent = 'Engine';
            document.getElementById('metaGeocodedCount').textContent = 'Active';
        }

        // ================= VERIFY NODE FEATURE =================
        async verifyCurrentProfile() {
            if (!this.currentModalProfileId) {
                alert('No profile selected for verification.');
                return;
            }

            const token = localStorage.getItem('emailExtractorToken');
            if (!token) {
                alert('Authentication required. Please log in again.');
                return;
            }

            const btn = this.verifyProfileInstanceBtn;
            const originalText = btn.textContent;
            btn.textContent = 'Verifying...';
            btn.disabled = true;

            try {
                const response = await fetch('/api/finder-api/location-secret?action=verifyProfile', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify({ profileId: this.currentModalProfileId })
                });
                const data = await response.json();

                if (data.success) {
                    const profileIndex = this.state.data.findIndex(p => p.id === this.currentModalProfileId);
                    if (profileIndex !== -1) {
                        this.state.data[profileIndex].verificationStatus = data.profile.verificationStatus;
                        this.state.data[profileIndex].confidenceScore = data.profile.confidenceScore;
                    }

                    this.renderTable();

                    const updatedProfile = this.state.data.find(p => p.id === this.currentModalProfileId);
                    if (updatedProfile) {
                        this.openProfileModal(this.currentModalProfileId);
                    }

                    this.locationResultMeta.textContent = '✅ Profile successfully verified!';
                } else {
                    alert('Verification failed: ' + (data.error || 'Unknown error'));
                }
            } catch (_) {
                alert('Network error while verifying. Please try again.');
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }

        // ================= EXPORT CSV FEATURE =================
        exportToCSV() {
            const data = this.state.data;
            if (!data || data.length === 0) {
                alert('No data to export.');
                return;
            }

            const headers = [
                'ID',
                'Name',
                'Entity Type',
                'Verification Status',
                'Confidence Score',
                'Email',
                'Phone',
                'WhatsApp',
                'Social'
            ];

            const rows = data.map(profile => {
                // D1 direct properties (fallback to channels)
                const email = profile.email || (profile.channels && profile.channels.email) || '';
                const phone = profile.phone || (profile.channels && profile.channels.phone) || '';
                const whatsapp = profile.whatsapp || (profile.channels && profile.channels.whatsapp) || '';
                const social = profile.social || (profile.channels && profile.channels.social) || '';
                return [
                    profile.id || '',
                    profile.name || '',
                    profile.entityType || '',
                    profile.verificationStatus || '',
                    profile.confidenceScore || '',
                    email,
                    phone,
                    whatsapp,
                    social
                ];
            });

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.setAttribute('download', `location_contacts_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }

    window.SmartLocationFinder = SmartLocationFinder;

    function initApp() {
        if (document.getElementById('divisionSelect')) {
            if (!window.AppController || !(window.AppController instanceof SmartLocationFinder)) {
                window.AppController = new SmartLocationFinder();
            }
        } else {
            setTimeout(initApp, 200);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        setTimeout(initApp, 100);
    }

})();
