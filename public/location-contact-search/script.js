/**
 * AI-Powered Smart People & Business Finder Platform
 * File: public/location-contact-search/script.js (DEBUG VERSION)
 */

class SmartLocationFinder {
    constructor() {
        console.log('🚀 SmartLocationFinder constructor called');
        this.state = {
            filters: {
                entityType: 'all',
                division: '',
                district: '',
                thana: '',
                radius: 0,
                minConfidence: 0,
                verificationStatus: 'all',
                channels: { email: false, phone: false, whatsapp: false, social: false }
            },
            searchQuery: '',
            pagination: { currentPage: 1, limit: 25, totalPages: 1, totalRecords: 0 },
            data: []
        };
        this.init();
    }

    init() {
        console.log('🔧 init() called');
        this.cacheDOM();
        this.bindEvents();
        this.loadGeoHierarchy();
        this.updateStatsBar();
    }

    cacheDOM() {
        console.log('📦 cacheDOM() called');
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

        // এলিমেন্ট চেক
        console.log('✅ divisionSelect:', this.divisionSelect);
        console.log('✅ districtSelect:', this.districtSelect);
        console.log('✅ thanaSelect:', this.thanaSelect);
        
        if (!this.divisionSelect) console.error('❌ divisionSelect NOT FOUND!');
        if (!this.districtSelect) console.error('❌ districtSelect NOT FOUND!');
        if (!this.thanaSelect) console.error('❌ thanaSelect NOT FOUND!');
    }

    bindEvents() {
        console.log('🔗 bindEvents() called');
        // Sliders
        this.geoRadiusSlider?.addEventListener('input', (e) => {
            const val = e.target.value;
            this.radiusValueDisplay.textContent = val == 0 ? 'Global' : `${val} KM`;
            this.state.filters.radius = val;
        });
        this.confidenceScoreSlider?.addEventListener('input', (e) => {
            this.confidenceValueDisplay.textContent = `${e.target.value}%`;
            this.state.filters.minConfidence = e.target.value;
        });
        // Search
        this.searchLocationBtn?.addEventListener('click', () => {
            this.state.pagination.currentPage = 1;
            this.executeSearch();
        });
        this.clearSmartSearchBtn?.addEventListener('click', () => {
            this.smartNlpSearchInput.value = '';
            this.state.searchQuery = '';
        });
        this.resetAllFiltersBtn?.addEventListener('click', () => this.resetFilters());
        // Pagination
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
        // Modal
        this.closeProfileModalBtn?.addEventListener('click', () => this.toggleModal(false));
        this.closeProfileModalBottomBtn?.addEventListener('click', () => this.toggleModal(false));
    }

    getAuthHeaders() {
        const token = localStorage.getItem('emailExtractorToken');
        console.log('🔑 Token:', token ? 'Present' : 'Missing');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // ===== GEO HIERARCHY WITH DEBUG LOGS =====
    async loadGeoHierarchy() {
        console.log('🌍 loadGeoHierarchy() started');
        const headers = this.getAuthHeaders();

        // 1. Division লোড
        try {
            console.log('📡 Fetching divisions...');
            const divResponse = await fetch('/api/finder-api/location-secret?action=getDivisions', { headers });
            console.log('📡 Division response status:', divResponse.status);
            const divData = await divResponse.json();
            console.log('📡 Division data:', divData);

            if (divData.success && divData.divisions) {
                this.divisionSelect.innerHTML = '<option value="">— Select Division —</option>';
                divData.divisions.forEach(div => {
                    const option = document.createElement('option');
                    option.value = div.id;
                    option.textContent = div.name;
                    this.divisionSelect.appendChild(option);
                });
                this.divisionSelect.disabled = false;
                console.log('✅ Divisions loaded successfully');
            } else {
                console.error('❌ Division load failed:', divData.error || 'Unknown error');
                this.divisionSelect.innerHTML = '<option value="">Failed to load divisions</option>';
                this.divisionSelect.disabled = true;
            }
        } catch (error) {
            console.error('❌ Division fetch error:', error);
            this.divisionSelect.innerHTML = '<option value="">Error loading divisions</option>';
            this.divisionSelect.disabled = true;
        }

        // 2. Division change -> District
        this.divisionSelect.addEventListener('change', async (e) => {
            console.log('🔄 Division changed to:', e.target.value);
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
                console.log(`📡 Fetching districts for division: ${divisionId}`);
                const distResponse = await fetch(`/api/finder-api/location-secret?action=getDistricts&division=${divisionId}`, { headers });
                console.log('📡 District response status:', distResponse.status);
                const distData = await distResponse.json();
                console.log('📡 District data:', distData);

                if (distData.success && distData.districts && distData.districts.length > 0) {
                    this.districtSelect.innerHTML = '<option value="">— Select District —</option>';
                    distData.districts.forEach(dist => {
                        const opt = document.createElement('option');
                        opt.value = dist.id;
                        opt.textContent = dist.name;
                        this.districtSelect.appendChild(opt);
                    });
                    this.districtSelect.disabled = false;
                    console.log('✅ Districts loaded successfully');
                } else {
                    console.warn('⚠️ No districts found');
                    this.districtSelect.innerHTML = '<option value="">No districts found</option>';
                    this.districtSelect.disabled = true;
                }
            } catch (error) {
                console.error('❌ District fetch error:', error);
                this.districtSelect.innerHTML = '<option value="">Error loading districts</option>';
                this.districtSelect.disabled = true;
            }
        });

        // 3. District change -> Thana
        this.districtSelect.addEventListener('change', async (e) => {
            console.log('🔄 District changed to:', e.target.value);
            const districtId = e.target.value;

            if (!districtId) {
                this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
                this.thanaSelect.disabled = true;
                return;
            }

            this.thanaSelect.innerHTML = '<option value="">Loading thanas...</option>';
            this.thanaSelect.disabled = true;

            try {
                console.log(`📡 Fetching thanas for district: ${districtId}`);
                const thanaResponse = await fetch(`/api/finder-api/location-secret?action=getThanas&district=${districtId}`, { headers });
                console.log('📡 Thana response status:', thanaResponse.status);
                const thanaData = await thanaResponse.json();
                console.log('📡 Thana data:', thanaData);

                if (thanaData.success && thanaData.thanas && thanaData.thanas.length > 0) {
                    this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
                    thanaData.thanas.forEach(thana => {
                        const opt = document.createElement('option');
                        opt.value = thana.id;
                        opt.textContent = thana.name;
                        this.thanaSelect.appendChild(opt);
                    });
                    this.thanaSelect.disabled = false;
                    console.log('✅ Thanas loaded successfully');
                } else {
                    console.warn('⚠️ No thanas found');
                    this.thanaSelect.innerHTML = '<option value="">No thanas found</option>';
                    this.thanaSelect.disabled = true;
                }
            } catch (error) {
                console.error('❌ Thana fetch error:', error);
                this.thanaSelect.innerHTML = '<option value="">Error loading thanas</option>';
                this.thanaSelect.disabled = true;
            }
        });
    }

    // অন্যান্য মেথড (resetFilters, executeSearch, renderTable, ইত্যাদি) আগের মতোই থাকবে
    resetFilters() { /* ... */ }
    async executeSearch() { /* ... */ }
    renderTable() { /* ... */ }
    updatePaginationUI() { /* ... */ }
    openProfileModal(profileId) { /* ... */ }
    toggleModal(show) { /* ... */ }
    updateStatsBar() { /* ... */ }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM fully loaded, initializing SmartLocationFinder...');
    window.AppController = new SmartLocationFinder();
});
