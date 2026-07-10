/**
 * AI-Powered Smart People & Business Finder Platform
 * File: public/location-contact-search/script.js
 * Purpose: Handles UI interactions, state management, and mock API integrations.
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
        this.updateStatsBar(); // Load initial stats
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
        this.searchLocationBtn.addEventListener('click', () => this.executeSearch());
        
        // NLP Input Clear
        this.clearSmartSearchBtn.addEventListener('click', () => {
            this.smartNlpSearchInput.value = '';
            this.state.searchQuery = '';
        });

        // Reset Filters
        this.resetAllFiltersBtn.addEventListener('click', () => this.resetFilters());

        // Pagination Limits
        this.paginationLimitSelect.addEventListener('change', (e) => {
            this.state.pagination.limit = parseInt(e.target.value);
            this.state.pagination.currentPage = 1;
            this.executeSearch();
        });

        // Modal Closing
        this.closeProfileModalBtn.addEventListener('click', () => this.toggleModal(false));
        this.closeProfileModalBottomBtn.addEventListener('click', () => this.toggleModal(false));
    }

    // Mock Data for Geo Hierarchy (Replace with actual DB/API call later)
    loadGeoHierarchy() {
        const divisions = ['Dhaka', 'Chattogram', 'Sylhet', 'Rajshahi'];
        divisions.forEach(div => {
            let option = document.createElement('option');
            option.value = div.toLowerCase();
            option.textContent = div;
            this.divisionSelect.appendChild(option);
        });

        // Basic Cascading Logic Example
        this.divisionSelect.addEventListener('change', (e) => {
            this.districtSelect.innerHTML = '<option value="">— Select District —</option>';
            if(e.target.value === 'dhaka') {
                ['Dhaka', 'Gazipur', 'Narayanganj'].forEach(dist => {
                    let opt = document.createElement('option');
                    opt.value = dist.toLowerCase();
                    opt.textContent = dist;
                    this.districtSelect.appendChild(opt);
                });
            }
        });
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
        this.state.pagination.currentPage = 1;
        
        this.locationResultBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-slate-500 py-16">
                    <div class="flex flex-col items-center justify-center space-y-3">
                        <div class="p-4 bg-slate-50 text-slate-400 rounded-full">
                            <!-- SVG Icon from HTML -->
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
        this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center py-10"><div class="animate-pulse flex flex-col items-center"><div class="h-8 w-8 bg-blue-200 rounded-full mb-3"></div><div class="text-sm text-slate-500">Executing Smart AI Search...</div></div></td></tr>`;
        
        // Update State from DOM
        this.state.searchQuery = this.smartNlpSearchInput.value;
        this.state.filters.entityType = this.entityTypeSelect.value;
        this.state.filters.division = this.divisionSelect.value;
        
        try {
            // TODO: Replace with actual `fetch` API call to your backend
            // const response = await fetch('/api/v1/search', { method: 'POST', body: JSON.stringify(this.state) });
            // const data = await response.json();
            
            // Simulating API Latency & Mock Response
            setTimeout(() => {
                const mockData = this.generateMockResults();
                this.state.data = mockData;
                this.state.pagination.totalRecords = 125; // Dummy total
                this.state.pagination.totalPages = Math.ceil(125 / this.state.pagination.limit);
                
                this.renderTable();
                this.updatePaginationUI();
            }, 800);

        } catch (error) {
            console.error("Search Execution Failed:", error);
            this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-red-500 py-10">Error executing search. Please try again.</td></tr>`;
        }
    }

    renderTable() {
        this.locationResultBody.innerHTML = '';
        this.locationResultCount.textContent = `${this.state.data.length} Records (Page ${this.state.pagination.currentPage})`;
        this.locationResultMeta.textContent = `Showing results based on AI parsed parameters.`;

        if (this.state.data.length === 0) {
            this.locationResultBody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-500 py-10">No verified profiles found matching your criteria.</td></tr>`;
            return;
        }

        this.state.data.forEach(profile => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50/50 transition-colors cursor-pointer group";
            tr.innerHTML = `
                <td class="p-3 text-center">
                    <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer" value="${profile.id}">
                </td>
                <td class="p-3">
                    <div class="font-semibold text-slate-800">${profile.name}</div>
                    <div class="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">${profile.type}</div>
                </td>
                <td class="p-3">
                    <div class="flex items-center gap-2">
                        ${profile.hasEmail ? `<span title="Email Verified" class="w-2 h-2 rounded-full bg-emerald-500"></span>` : `<span class="w-2 h-2 rounded-full bg-slate-200"></span>`}
                        ${profile.hasPhone ? `<span title="Phone Verified" class="w-2 h-2 rounded-full bg-blue-500"></span>` : `<span class="w-2 h-2 rounded-full bg-slate-200"></span>`}
                    </div>
                </td>
                <td class="p-3 text-xs text-slate-600">
                    ${profile.location}
                </td>
                <td class="p-3 text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${profile.confidence > 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                        ${profile.confidence}% Match
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
        this.tablePaginationWrapper.classList.remove('hidden');
        this.currentPageNumDisplay.textContent = this.state.pagination.currentPage;
        this.totalPageNumDisplay.textContent = this.state.pagination.totalPages;

        this.prevPageBtn.disabled = this.state.pagination.currentPage === 1;
        this.nextPageBtn.disabled = this.state.pagination.currentPage === this.state.pagination.totalPages;
    }

    openProfileModal(profileId) {
        // In a real app, you would fetch profile details by ID here.
        document.getElementById('modalProfileTitle').innerHTML = `<span>🛡️</span> Entity Reference: #${profileId}`;
        document.getElementById('modalProfileBody').innerHTML = `
            <div class="p-4 bg-blue-50 rounded-lg border border-blue-100 text-blue-800 text-sm">
                <strong>System Note:</strong> Full data enrichment matrix will be dynamically loaded here from backend API. 
            </div>
            <div class="grid grid-cols-2 gap-4 mt-4">
                <div class="bg-slate-50 p-3 rounded border border-slate-200">
                    <p class="text-xs text-slate-500 uppercase">Geospatial Data</p>
                    <p class="font-medium text-slate-800 mt-1">Lat: 23.8103, Lng: 90.4125</p>
                </div>
                <div class="bg-slate-50 p-3 rounded border border-slate-200">
                    <p class="text-xs text-slate-500 uppercase">Verification Status</p>
                    <p class="font-medium text-emerald-600 mt-1">Level 3 Verified</p>
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
        // Placeholder for initial dashboard numbers
        document.getElementById('metaTotalProfiles').textContent = '142.5K';
        document.getElementById('metaVerifiedProfiles').textContent = '89.2K';
        document.getElementById('metaAvgConfidence').textContent = '94%';
        document.getElementById('metaGeocodedCount').textContent = '110K';
    }

    // Helper to generate mock data for UI testing
    generateMockResults() {
        return [
            { id: 'ENT-001', name: 'TechNova Solutions Ltd.', type: 'Business / IT', hasEmail: true, hasPhone: true, location: 'Gulshan, Dhaka', confidence: 98 },
            { id: 'ENT-002', name: 'Dr. Sarah Rahman', type: 'Professional / Medical', hasEmail: true, hasPhone: false, location: 'Dhanmondi, Dhaka', confidence: 85 },
            { id: 'ENT-003', name: 'Creative Pixel Studio', type: 'Creator / Agency', hasEmail: false, hasPhone: true, location: 'Banani, Dhaka', confidence: 76 },
            { id: 'ENT-004', name: 'Apex General Hospital', type: 'Service / Healthcare', hasEmail: true, hasPhone: true, location: 'Mirpur, Dhaka', confidence: 99 }
        ];
    }
}

// Initialize Application when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.AppController = new SmartLocationFinder();
});
