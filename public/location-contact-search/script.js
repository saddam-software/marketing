/**
 * AI-Powered Smart People & Business Finder Platform
 * File: public/location-contact-search/script.js
 * Purpose: Handles UI interactions, state management, and real API integrations.
 */

class SmartLocationFinder {
    constructor() {
        // App State
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
            data: [] // Holds the fetched master profiles
        };

        // Initialize App
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadGeoHierarchy();
        this.updateStatsBar(); 
    }

    cacheDOM() {
        // Filters & Inputs
        this.entityTypeSelect = document.getElementById('entityTypeSelect');
        this.divisionSelect = document.getElementById('divisionSelect');
        this.districtSelect = document.getElementById('districtSelect');
        this.thanaSelect = document.getElementById('thanaSelect');
        this.geoRadiusSlider = document.getElementById('geoRadiusSlider');
        this.radiusValueDisplay = document.getElementById('radiusValueDisplay');
        this.confidenceScoreSlider = document.getElementById('confidenceScoreSlider');
        this.confidenceValueDisplay = document.getElementById('confidenceValueDisplay');
        this.verificationStatusSelect = document.getElementById('verificationStatusSelect');
        
        // Checkboxes
        this.hasEmailCheck = document.getElementById('hasEmailCheck');
        this.hasPhoneCheck = document.getElementById('hasPhoneCheck');
        this.hasWhatsappCheck = document.getElementById('hasWhatsappCheck');
        this.hasSocialCheck = document.getElementById('hasSocialCheck');
        
        // Search & Actions
        this.smartNlpSearchInput = document.getElementById('smartNlpSearchInput');
        this.clearSmartSearchBtn = document.getElementById('clearSmartSearchBtn');
        this.searchLocationBtn = document.getElementById('searchLocationBtn');
        this.resetAllFiltersBtn = document.getElementById('resetAllFiltersBtn');
        
        // Table & Displays
        this.locationResultBody = document.getElementById('locationResultBody');
        this.locationResultCount = document.getElementById('locationResultCount');
        this.locationResultMeta = document.getElementById('locationResultMeta');
        
        // Pagination
        this.tablePaginationWrapper = document.getElementById('tablePaginationWrapper');
        this.paginationLimitSelect = document.getElementById('paginationLimitSelect');
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.currentPageNumDisplay = document.getElementById('currentPageNumDisplay');
        this.totalPageNumDisplay = document.getElementById('totalPageNumDisplay');

        // Modal
        this.masterProfileDetailsModal = document.getElementById('masterProfileDetailsModal');
        this.closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
        this.closeProfileModalBottomBtn = document.getElementById('closeProfileModalBottomBtn');
    }

    bindEvents() {
        // Sliders Real-time Update
        this.geoRadiusSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.radiusValueDisplay.textContent = val == 0 ? 'Global' : `${val} KM`;
            this.state.filters.radius = val;
        });

        this.confidenceScoreSlider.addEventListener('input', (e) => {
            this.confidenceValueDisplay.textContent = `${e.target.value}%`;
            this.state.filters.minConfidence = e.target.value;
        });

        // Search Action
        this.searchLocationBtn.addEventListener('click', () => {
            this.state.pagination.currentPage = 1; // Reset to page 1 on new search
            this.executeSearch();
        });
        
        // NLP Input Clear
        this.clearSmartSearchBtn.addEventListener('click', () => {
            this.smartNlpSearchInput.value = '';
            this.state.searchQuery = '';
        });

        // Reset Filters
        this.resetAllFiltersBtn.addEventListener('click', () => this.resetFilters());

        // Pagination Limits and Buttons
        this.paginationLimitSelect.addEventListener('change', (e) => {
            this.state.pagination.limit = parseInt(e.target.value);
            this.state.pagination.currentPage = 1;
            this.executeSearch();
        });

        this.prevPageBtn.addEventListener('click', () => {
            if (this.state.pagination.currentPage > 1) {
                this.state.pagination.currentPage--;
                this.executeSearch();
            }
        });

        this.nextPageBtn.addEventListener('click', () => {
            if (this.state.pagination.currentPage < this.state.pagination.totalPages) {
                this.state.pagination.currentPage++;
                this.executeSearch();
            }
        });

        // Modal Closing
        this.closeProfileModalBtn.addEventListener('click', () => this.toggleModal(false));
        this.closeProfileModalBottomBtn.addEventListener('click', () => this.toggleModal(false));
    }

    // Helper: Get Authorization Headers
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
            // ১. Division লোড করা
            const divResponse = await fetch('/api/finder-api/location-secret?action=getDivisions', { headers });
            const divData = await divResponse.json();
            
            if (divData.success && divData.divisions) {
                this.divisionSelect.innerHTML = '<option value="">— Select Division —</option>';
                divData.divisions.forEach(div => {
                    let option = document.createElement('option');
                    option.value = div.id;
                    option.textContent = div.name;
                    this.divisionSelect.appendChild(option);
                });
            }

            // ২. Division সিলেক্ট করলে District লোড হবে
            this.divisionSelect.addEventListener('change', async (e) => {
                this.districtSelect.innerHTML = '<option value="">— Select District —</option>';
                this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
                
                const divisionId = e.target.value;
                if (!divisionId) return;

                const distResponse = await fetch(`/api/finder-api/location-secret?action=getDistricts&division=${divisionId}`, { headers });
                const distData = await distResponse.json();
                
                if (distData.success && distData.districts) {
                    distData.districts.forEach(dist => {
                        let opt = document.createElement('option');
                        opt.value = dist.id;
                        opt.textContent = dist.name;
                        this.districtSelect.appendChild(opt);
                    });
                }
            });

            // ৩. District সিলেক্ট করলে Thana লোড হবে
            this.districtSelect.addEventListener('change', async (e) => {
                this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
                
                const districtId = e.target.value;
                if (!districtId) return;

                const thanaResponse = await fetch(`/api/finder-api/location-secret?action=getThanas&district=${districtId}`, { headers });
                const thanaData = await thanaResponse.json();
                
                if (thanaData.success && thanaData.thanas) {
                    thanaData.thanas.forEach(thana => {
                        let opt = document.createElement('option');
                        opt.value = thana.id;
                        opt.textContent = thana.name;
                        this.thanaSelect.appendChild(opt);
                    });
                }
            });

        } catch (error) {
            console.error("Geographic data loading failed:", error);
        }
    }

    resetFilters() {
        document.getElementById('advancedSearchForm').reset();
        this.geoRadiusSlider.value = 0;
        this.radiusValueDisplay.textContent = 'Global';
        this.confidenceScoreSlider.value = 0;
        this.confidenceValueDisplay.textContent = '0%';
        this.smartNlpSearchInput.value = '';
        
        // Reset State
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
    }

    async executeSearch() {
        // Show Loading State
        this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center py-10"><div class="animate-pulse flex flex-col items-center"><div class="h-8 w-8 bg-blue-200 rounded-full mb-3"></div><div class="text-sm text-slate-500">Executing Smart AI Search via Engine...</div></div></td></tr>`;
        
        // Update State from DOM Inputs
        this.state.searchQuery = this.smartNlpSearchInput.value;
        this.state.filters.entityType = this.entityTypeSelect.value;
        this.state.filters.division = this.divisionSelect.value;
        this.state.filters.district = this.districtSelect.value;
        this.state.filters.thana = this.thanaSelect.value;
        this.state.filters.verificationStatus = this.verificationStatusSelect.value;

        // API Query Parameters তৈরি করা হচ্ছে
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
                this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-10 font-bold">Authentication Error: Token missing. Please log in again.</td></tr>`;
                return;
            }

            // আসল ব্যাকএন্ড API-তে কল করা (location-secret.js)
            const response = await fetch(`/api/finder-api/location-secret?${queryParams.toString()}`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            
            const data = await response.json();

            if (data.success) {
                // মক ডেটার বদলে সার্ভার থেকে আসা আসল ডেটা সেভ করা হচ্ছে
                this.state.data = data.contacts;
                
                // পেজিনেশন আপডেট
                this.state.pagination.totalRecords = data.meta.totalRecords;
                this.state.pagination.totalPages = data.meta.totalPages;
                
                this.renderTable();
                this.updatePaginationUI();
            } else {
                // সার্ভার থেকে কোনো এরর আসলে সেটা দেখানো
                this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-10">Search Error: ${data.error}</td></tr>`;
            }

        } catch (error) {
            console.error("Search Execution Failed:", error);
            this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-10">Network connection failed. Please check your internet or try again.</td></tr>`;
        }
    }

    renderTable() {
        this.locationResultBody.innerHTML = '';
        this.locationResultCount.textContent = `${this.state.pagination.totalRecords} Records Found (Page ${this.state.pagination.currentPage})`;
        this.locationResultMeta.textContent = `Showing real-time results directly from Master Engine.`;

        if (this.state.data.length === 0) {
            this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-500 py-10">No verified profiles found matching your criteria. Try loosening the filters.</td></tr>`;
            return;
        }

        this.state.data.forEach(profile => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50/50 transition-colors cursor-pointer group";
            
            // লোকেশন টেক্সট সুন্দর করে সাজানো
            const locationText = [profile.thana, profile.district].filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');

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
                        ${profile.channels && profile.channels.email ? `<span title="Email Verified" class="w-2 h-2 rounded-full bg-emerald-500"></span>` : `<span class="w-2 h-2 rounded-full bg-slate-200"></span>`}
                        ${profile.channels && profile.channels.phone ? `<span title="Phone Verified" class="w-2 h-2 rounded-full bg-blue-500"></span>` : `<span class="w-2 h-2 rounded-full bg-slate-200"></span>`}
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

        // Bind View Matrix Buttons
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

    openProfileModal(profileId) {
        // ডাইনামিক ডেটা খুঁজে বের করা
        const profile = this.state.data.find(p => p.id === profileId);
        if(!profile) return;

        document.getElementById('modalProfileTitle').innerHTML = `<span>🛡️</span> Entity Reference: #${profile.id}`;
        
        // প্রোফাইলের বিস্তারিত তথ্য মডালে দেখানো
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
                        ${profile.channels.email ? `<p class="text-slate-800">✉️ ${profile.channels.email}</p>` : ''}
                        ${profile.channels.phone ? `<p class="text-slate-800">📞 ${profile.channels.phone}</p>` : ''}
                        ${!profile.channels.email && !profile.channels.phone ? '<p class="text-slate-400">No primary contact found</p>' : ''}
                    </div>
                </div>
                <div class="bg-slate-50 p-3 rounded border border-slate-200">
                    <p class="text-xs text-slate-500 uppercase">Verification Level</p>
                    <p class="font-medium ${profile.verificationStatus === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600'} mt-1">
                        ${profile.verificationStatus}
                    </p>
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
        }
    }

    updateStatsBar() {
        // In a full production app, you might fetch these stats directly from an API too.
        document.getElementById('metaTotalProfiles').textContent = 'Live Data';
        document.getElementById('metaVerifiedProfiles').textContent = 'Secured';
        document.getElementById('metaAvgConfidence').textContent = 'Engine';
        document.getElementById('metaGeocodedCount').textContent = 'Active';
    }
}

// Initialize Application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.AppController = new SmartLocationFinder();
});
