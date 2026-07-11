/**
 * AI-Powered Smart People & Business Finder Platform
 * File: public/location-contact-search/script.js
 * Purpose: Handles UI interactions, state management, and real API integrations.
 * Updated: Accurate Bangladesh Geo Hierarchy (8 Divisions, 64 Districts, Thanas).
 */

(function() {
    'use strict';

    if (window.SmartLocationFinder) {
        console.warn('SmartLocationFinder already defined, skipping redefinition.');
        return;
    }

    // --- বাংলাদেশের সঠিক জিও-হায়ারার্কি ডাটাবেস ---
    const bdGeoData = {
        "Dhaka": {
            "Dhaka": [
                // ৫টি প্রশাসনিক উপজেলা
                "Dhamrai", "Dohar", "Nawabganj", "Keraniganj", "Savar",
                // মেট্রোপলিটন থানা সমূহ
                "Adabor", "Badda", "Bangshal", "Bimanbandar", "Cantonment", "Chawkbazar", "Dakshinkhan", 
                "Darus Salam", "Demra", "Dhanmondi", "Gendaria", "Gulshan", "Hazaribagh", "Jatrabari", 
                "Kadamtali", "Kafrul", "Kalabagan", "Kamrangirchar", "Khilgaon", "Khilkhet", "Kotwali", 
                "Lalbagh", "Mirpur", "Mohammadpur", "Motijheel", "Mugda", "New Market", "Pallabi", 
                "Paltan", "Panthapath", "Ramna", "Rampura", "Rupnagar", "Sabujbagh", "Shah Ali", 
                "Shahbagh", "Sher-e-Bangla Nagar", "Shyampur", "Sutrapur", "Tejgaon", "Tejgaon Industrial Area", 
                "Turag", "Uttara East", "Uttara West", "Vasantek", "Vatara", "Wari"
            ],
            "Faridpur": ["Alfadanga", "Bhanga", "Boalmari", "Charbhadrasan", "Faridpur Sadar", "Madhukhali", "Nagarkanda", "Sadarpur", "Saltha"],
            "Gazipur": ["Gazipur Sadar", "Kaliakair", "Kaliganj", "Kapasia", "Sreepur"],
            "Gopalganj": ["Gopalganj Sadar", "Kashiani", "Kotalipara", "Muksudpur", "Tungipara"],
            "Kishoreganj": ["Austagram", "Bajitpur", "Bhairab", "Hossainpur", "Itna", "Karimganj", "Katiadi", "Kishoreganj Sadar", "Kuliarchar", "Mithamain", "Nikli", "Pakundia", "Tarail"],
            "Madaripur": ["Kalkini", "Madaripur Sadar", "Rajoir", "Shibchar"],
            "Manikganj": ["Daulatpur", "Ghior", "Harirampur", "Manikganj Sadar", "Saturia", "Shivalaya", "Singair"],
            "Munshiganj": ["Gazaria", "Lohajang", "Munshiganj Sadar", "Sirajdikhan", "Sreenagar", "Tongibari"],
            "Narayanganj": ["Araihazar", "Bandar", "Narayanganj Sadar", "Rupganj", "Sonargaon"],
            "Narsingdi": ["Belabo", "Monohardi", "Narsingdi Sadar", "Palash", "Raipura", "Shibpur"],
            "Rajbari": ["Baliakandi", "Goalandaghat", "Kalukhali", "Pangsha", "Rajbari Sadar"],
            "Shariatpur": ["Bhedarganj", "Damudya", "Gosairhat", "Naria", "Shariatpur Sadar", "Zajira"],
            "Tangail": ["Basail", "Bhuapur", "Delduar", "Dhanbari", "Ghatail", "Gopalpur", "Kalihati", "Madhupur", "Mirzapur", "Nagarpur", "Sakhipur", "Tangail Sadar"]
        },
        "Chattogram": {
            "Chattogram": ["Anwara", "Banshkhali", "Boalkhali", "Chandanaish", "Fatikchhari", "Hathazari", "Karnaphuli", "Lohagara", "Mirsharai", "Patiya", "Rangunia", "Raozan", "Sandwip", "Satkania", "Sitakunda", "Kotwali", "Panchlaish", "Pahartali", "Chandgaon"],
            "Bandarban": ["Alikadam", "Bandarban Sadar", "Lama", "Naikhongchhari", "Rowangchhari", "Ruma", "Thanchi"],
            "Brahmanbaria": ["Akhaura", "Ashuganj", "Bancharampur", "Brahmanbaria Sadar", "Kasba", "Nabinagar", "Nasirnagar", "Sarail", "Bijoynagar"],
            "Chandpur": ["Chandpur Sadar", "Faridganj", "Haimchar", "Haziganj", "Kachua", "Matlab North", "Matlab South", "Shahrasti"],
            "Cox's Bazar": ["Chakaria", "Cox's Bazar Sadar", "Kutubdia", "Maheshkhali", "Pekua", "Ramu", "Teknaf", "Ukhia"],
            "Cumilla": ["Barura", "Brahmanpara", "Burichang", "Chandina", "Chauddagram", "Cumilla Adarsha Sadar", "Cumilla Sadar Dakshin", "Daudkandi", "Debidwar", "Homna", "Laksam", "Lalmai", "Meghna", "Monohorgonj", "Muradnagar", "Nangalkot", "Titas"],
            "Feni": ["Chhagalnaiya", "Daganbhuiyan", "Feni Sadar", "Fulgazi", "Parshuram", "Sonagazi"],
            "Khagrachhari": ["Dighinala", "Guimara", "Khagrachhari Sadar", "Lakshmichhari", "Mahalchhari", "Manikchhari", "Matiranga", "Panchhari", "Ramgarh"],
            "Lakshmipur": ["Kamalnagar", "Lakshmipur Sadar", "Raipur", "Ramganj", "Ramgati"],
            "Noakhali": ["Begumganj", "Chatkhil", "Companiganj", "Hatiya", "Kabirhat", "Senbagh", "Sonaimuri", "Subarnachar", "Noakhali Sadar"],
            "Rangamati": ["Bagaichhari", "Barkal", "Kawkhali", "Belaichhari", "Kaptai", "Juraichhari", "Langadu", "Naniarchar", "Rajasthali", "Rangamati Sadar"]
        },
        "Rajshahi": {
            "Rajshahi": ["Bagha", "Bagmara", "Charghat", "Durgapur", "Godagari", "Mohanpur", "Paba", "Puthia", "Tanore", "Boalia", "Rajpara", "Motihar", "Shah Makhdum"],
            "Bogura": ["Adamdighi", "Bogura Sadar", "Dhunat", "Dupchanchia", "Gabtali", "Kahaloo", "Nandigram", "Sariakandi", "Shajahanpur", "Sherpur", "Shibganj", "Sonatola"],
            "Chapainawabganj": ["Bholahat", "Chapainawabganj Sadar", "Gomastapur", "Nachole", "Shibganj"],
            "Joypurhat": ["Akkelpur", "Joypurhat Sadar", "Kalai", "Khetlal", "Panchbibi"],
            "Naogaon": ["Atrai", "Badalgachhi", "Dhamoirhat", "Manda", "Mohadevpur", "Naogaon Sadar", "Niamatpur", "Patnitala", "Porsha", "Raninagar", "Sapahar"],
            "Natore": ["Baraigram", "Gurudaspur", "Lalpur", "Naldanga", "Natore Sadar", "Singra"],
            "Pabna": ["Atgharia", "Bera", "Bhangura", "Chatmohar", "Faridpur", "Ishwardi", "Pabna Sadar", "Santhia", "Sujanagar"],
            "Sirajganj": ["Belkuchi", "Chauhali", "Kamarkhanda", "Kazipur", "Raiganj", "Shahjadpur", "Sirajganj Sadar", "Tarash", "Ullahpara"]
        },
        "Khulna": {
            "Khulna": ["Batiaghata", "Dacope", "Dumuria", "Dighalia", "Koyra", "Paikgachha", "Phultala", "Rupsha", "Terokhada", "Khulna Sadar"],
            "Bagerhat": ["Bagerhat Sadar", "Chitalmari", "Fakirhat", "Kachua", "Mollahat", "Mongla", "Morrelganj", "Rampal", "Sarankhola"],
            "Chuadanga": ["Alamdanga", "Chuadanga Sadar", "Damurhuda", "Jibannagar"],
            "Jashore": ["Abhaynagar", "Bagherpara", "Chaugachha", "Jhikargachha", "Keshabpur", "Jashore Sadar", "Manirampur", "Sharsha"],
            "Jhenaidah": ["Harinakunda", "Jhenaidah Sadar", "Kaliganj", "Kotchandpur", "Maheshpur", "Shailkupa"],
            "Kushtia": ["Bheramara", "Daulatpur", "Khoksa", "Kumarkhali", "Kushtia Sadar", "Mirpur"],
            "Magura": ["Magura Sadar", "Mohammadpur", "Shalikha", "Sreepur"],
            "Meherpur": ["Gangni", "Meherpur Sadar", "Mujibnagar"],
            "Narail": ["Kalia", "Lohagara", "Narail Sadar"],
            "Satkhira": ["Assasuni", "Debhata", "Kalaroa", "Kaliganj", "Satkhira Sadar", "Shyamnagar", "Tala"]
        },
        "Barishal": {
            "Barishal": ["Agailjhara", "Babuganj", "Bakerganj", "Banaripara", "Gaurnadi", "Hizla", "Barishal Sadar", "Mehendiganj", "Muladi", "Wazirpur"],
            "Barguna": ["Amtali", "Bamna", "Barguna Sadar", "Betagi", "Patharghata", "Taltali"],
            "Bhola": ["Bhola Sadar", "Burhanuddin", "Char Fasson", "Daulatkhan", "Lalmohan", "Manpura", "Tazumuddin"],
            "Jhalokati": ["Jhalokati Sadar", "Kathalia", "Nalchity", "Rajapur"],
            "Patuakhali": ["Bauphal", "Dashmina", "Galachipa", "Kalapara", "Mirzaganj", "Patuakhali Sadar", "Rangabali"],
            "Pirojpur": ["Bhandaria", "Kawkhali", "Mathbaria", "Nazirpur", "Nesarabad", "Pirojpur Sadar", "Zianagar"]
        },
        "Sylhet": {
            "Sylhet": ["Balaganj", "Beanibazar", "Bishwanath", "Companiganj", "Dakshin Surma", "Fenchuganj", "Golapganj", "Gowainghat", "Jaintiapur", "Kanaighat", "Osmani Nagar", "Sylhet Sadar", "Zaquiganj"],
            "Habiganj": ["Ajmiriganj", "Bahubal", "Baniyachong", "Chunarughat", "Habiganj Sadar", "Lakhai", "Madhabpur", "Nabiganj", "Shayestaganj"],
            "Moulvibazar": ["Barlekha", "Juri", "Kamalganj", "Kulaura", "Moulvibazar Sadar", "Rajnagar", "Sreemangal"],
            "Sunamganj": ["Bishwamvarpur", "Chhatak", "Dakshin Sunamganj", "Derai", "Dharamapasha", "Dowarabazar", "Jagannathpur", "Jamalganj", "Sullah", "Sunamganj Sadar", "Tahirpur"]
        },
        "Rangpur": {
            "Rangpur": ["Badarganj", "Gangachhara", "Kaunia", "Rangpur Sadar", "Mithapukur", "Pirgachha", "Pirganj", "Taraganj"],
            "Dinajpur": ["Biral", "Bochaganj", "Chirirbandar", "Phulbari", "Ghoraghat", "Hakimpur", "Kaharole", "Khansama", "Dinajpur Sadar", "Nawabganj", "Parbatipur"],
            "Gaibandha": ["Phulchhari", "Gaibandha Sadar", "Gobindaganj", "Palashbari", "Sadullapur", "Saghata", "Sundarganj"],
            "Kurigram": ["Bhurungamari", "Char Rajibpur", "Chilmari", "Phulbari", "Kurigram Sadar", "Nageshwari", "Rajarhat", "Raomari", "Ulipur"],
            "Lalmonirhat": ["Aditmari", "Hatibandha", "Kaliganj", "Lalmonirhat Sadar", "Patgram"],
            "Nilphamari": ["Dimla", "Domar", "Jaldhaka", "Kishoreganj", "Nilphamari Sadar", "Saidpur"],
            "Panchagarh": ["Atwari", "Boda", "Debiganj", "Panchagarh Sadar", "Tetulia"],
            "Thakurgaon": ["Baliadangi", "Haripur", "Pirganj", "Ranisankail", "Thakurgaon Sadar"]
        },
        "Mymensingh": {
            "Mymensingh": ["Bhaluka", "Dhobaura", "Fulbaria", "Gaffargaon", "Gauripur", "Haluaghat", "Ishwarganj", "Mymensingh Sadar", "Muktagachha", "Nandail", "Phulpur", "Tarakanda"],
            "Jamalpur": ["Baksiganj", "Dewanganj", "Islampur", "Jamalpur Sadar", "Madarganj", "Melandaha", "Sarishabari"],
            "Netrokona": ["Atpara", "Barhatta", "Durgapur", "Khaliajuri", "Kalmakanda", "Kendua", "Madan", "Mohanganj", "Netrokona Sadar", "Purbadhala"],
            "Sherpur": ["Jhenaigati", "Nakla", "Nalitabari", "Sherpur Sadar", "Sreebardi"]
        }
    };

    window.SmartLocationFinder = class SmartLocationFinder {
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
            this.retryCount = 0;
            this.maxRetries = 5;
            this.init();
        }

        init() {
            console.log('🔧 init() called');
            this.cacheDOM();
            if (this.divisionSelect) {
                this.bindEvents();
                this.loadGeoHierarchy();
                this.updateStatsBar();
            } else {
                console.warn('⚠️ DOM elements not ready, retrying...');
                this.retryInit();
            }
        }

        retryInit() {
            if (this.retryCount >= this.maxRetries) {
                console.error('❌ Max retries reached. Could not find required DOM elements.');
                return;
            }
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
        }

        bindEvents() {
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

            // Cascade Dropdowns
            this.divisionSelect?.addEventListener('change', (e) => {
                this.state.filters.division = e.target.value;
                this.populateDistricts(e.target.value);
            });

            this.districtSelect?.addEventListener('change', (e) => {
                this.state.filters.district = e.target.value;
                this.populateThanas(this.state.filters.division, e.target.value);
            });

            this.thanaSelect?.addEventListener('change', (e) => {
                this.state.filters.thana = e.target.value;
            });

            // Search Triggers
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
        }

        // --- জিও-হায়ারার্কি পপুলেশন ---
        loadGeoHierarchy() {
            console.log('🌍 loadGeoHierarchy() started (Using Offline Master Data)');
            this.divisionSelect.innerHTML = '<option value="">— Select Division —</option>';
            
            const divisions = Object.keys(bdGeoData).sort();
            divisions.forEach(div => {
                const option = document.createElement('option');
                option.value = div;
                option.textContent = div;
                this.divisionSelect.appendChild(option);
            });
            console.log('✅ 8 Divisions loaded successfully');
        }

        populateDistricts(divisionName) {
            this.districtSelect.innerHTML = '<option value="">— Select District —</option>';
            this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
            
            if (!divisionName || !bdGeoData[divisionName]) return;

            const districts = Object.keys(bdGeoData[divisionName]).sort();
            districts.forEach(dist => {
                const option = document.createElement('option');
                option.value = dist;
                option.textContent = dist;
                this.districtSelect.appendChild(option);
            });
            console.log(`✅ ${districts.length} Districts loaded for ${divisionName}`);
        }

        populateThanas(divisionName, districtName) {
            this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
            
            if (!divisionName || !districtName || !bdGeoData[divisionName][districtName]) return;

            const thanas = bdGeoData[divisionName][districtName].sort();
            thanas.forEach(thana => {
                const option = document.createElement('option');
                option.value = thana;
                option.textContent = thana;
                this.thanaSelect.appendChild(option);
            });
            console.log(`✅ ${thanas.length} Thanas loaded for ${districtName}`);
        }

        resetFilters() {
            document.getElementById('advancedSearchForm').reset();
            this.state.filters = {
                entityType: 'all', division: '', district: '', thana: '',
                radius: 0, minConfidence: 0, verificationStatus: 'all',
                channels: { email: false, phone: false, whatsapp: false, social: false }
            };
            this.radiusValueDisplay.textContent = 'Global';
            this.confidenceValueDisplay.textContent = '0%';
            this.loadGeoHierarchy(); // Reset dropdowns
            this.districtSelect.innerHTML = '<option value="">— Select District —</option>';
            this.thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
            this.locationResultBody.innerHTML = `
              <tr>
                <td colspan="6" class="text-center text-slate-500 py-16">
                  <p class="font-semibold text-slate-700">Filters Reset</p>
                  <p class="text-xs text-slate-400 mt-1">Ready for a new query.</p>
                </td>
              </tr>
            `;
            this.locationResultCount.textContent = '0 Records';
        }

        async executeSearch() {
            // Update Filter States
            this.state.filters.entityType = this.entityTypeSelect.value;
            this.state.filters.verificationStatus = this.verificationStatusSelect.value;
            this.state.filters.channels.email = this.hasEmailCheck.checked;
            this.state.filters.channels.phone = this.hasPhoneCheck.checked;
            this.state.filters.channels.whatsapp = this.hasWhatsappCheck.checked;
            this.state.filters.channels.social = this.hasSocialCheck.checked;
            this.state.searchQuery = this.smartNlpSearchInput.value.trim();

            this.locationResultBody.innerHTML = '<tr><td colspan="6" class="text-center py-10"><div class="spinner mx-auto"></div></td></tr>';

            // Constructing Query Params
            const params = new URLSearchParams({
                action: 'search',
                query: this.state.searchQuery,
                entityType: this.state.filters.entityType,
                division: this.state.filters.division,
                district: this.state.filters.district,
                thana: this.state.filters.thana,
                radius: this.state.filters.radius,
                minConfidence: this.state.filters.minConfidence,
                verificationStatus: this.state.filters.verificationStatus,
                hasEmail: this.state.filters.channels.email,
                hasPhone: this.state.filters.channels.phone,
                page: this.state.pagination.currentPage,
                limit: this.state.pagination.limit
            });

            console.log('🔍 Search Parameters:', Object.fromEntries(params));
            
            try {
                // API Call
                const response = await fetch(`/api/finder-api/location-secret?${params.toString()}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('emailExtractorToken')}` }
                });
                
                const data = await response.json();
                console.log('📦 Server Response:', data);

                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Failed to fetch profiles.');
                }

                this.state.data = data.results || [];
                this.state.pagination.totalRecords = data.totalCount || 0;
                this.state.pagination.totalPages = Math.ceil(this.state.pagination.totalRecords / this.state.pagination.limit) || 1;
                
                this.renderTable();
            } catch (error) {
                console.error('Search Error:', error);
                this.locationResultBody.innerHTML = `
                  <tr>
                    <td colspan="6" class="text-center text-red-500 py-10 text-sm">
                      ⚠️ No verified profiles found matching your criteria. Try loosening the filters.
                      <br><span class="text-xs text-slate-400 mt-2 block">Error Details: ${error.message}</span>
                    </td>
                  </tr>
                `;
                this.locationResultCount.textContent = '0 Records';
                this.locationResultMeta.textContent = 'Search failed.';
            }
        }

        renderTable() {
            if (this.state.data.length === 0) {
                this.locationResultBody.innerHTML = `
                  <tr>
                    <td colspan="6" class="text-center text-slate-500 py-16 text-sm">
                        No verified profiles found matching your criteria. Try loosening the filters.
                    </td>
                  </tr>
                `;
                this.locationResultCount.textContent = '0 Records';
                this.locationResultMeta.textContent = 'Search returned empty.';
                this.tablePaginationWrapper.classList.add('hidden');
                return;
            }

            this.locationResultCount.textContent = `${this.state.pagination.totalRecords} Records`;
            this.locationResultMeta.textContent = `Showing page ${this.state.pagination.currentPage} of ${this.state.pagination.totalPages}`;
            
            let html = '';
            this.state.data.forEach(profile => {
                html += `
                <tr class="hover:bg-slate-50/80 transition-all">
                    <td class="p-3 text-center"><input type="checkbox" class="rounded border-slate-300 w-4 h-4"></td>
                    <td class="p-3 font-medium text-slate-800">${profile.name || 'Unknown Entity'}</td>
                    <td class="p-3 text-xs text-slate-500">${profile.email ? '📧 ' : ''}${profile.phone ? '📱 ' : ''}</td>
                    <td class="p-3 text-xs text-slate-600">${profile.thana || ''}, ${profile.district || ''}</td>
                    <td class="p-3 text-center text-xs font-semibold ${profile.confidence > 80 ? 'text-emerald-600' : 'text-amber-600'}">${profile.confidence || 0}%</td>
                    <td class="p-3 text-right"><button class="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">View</button></td>
                </tr>`;
            });

            this.locationResultBody.innerHTML = html;
            this.updatePaginationUI();
        }

        updatePaginationUI() {
            this.tablePaginationWrapper.classList.remove('hidden');
            this.currentPageNumDisplay.textContent = this.state.pagination.currentPage;
            this.totalPageNumDisplay.textContent = this.state.pagination.totalPages;
            
            this.prevPageBtn.disabled = this.state.pagination.currentPage === 1;
            this.nextPageBtn.disabled = this.state.pagination.currentPage === this.state.pagination.totalPages;
        }

        updateStatsBar() {
            // ডেমো স্ট্যাটিস্টিক্স আপডেট
            const total = document.getElementById('metaTotalProfiles');
            if (total) total.textContent = '245,000+';
        }
    };

    // Initialize module safely
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new window.SmartLocationFinder());
    } else {
        new window.SmartLocationFinder();
    }
})();
