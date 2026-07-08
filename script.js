// script.js
// ============================================================
//  Email Extractor Pro - Frontend JavaScript
//  Admin Dashboard Logic, API Integration, DOM Manipulation
// ============================================================

(function() {
    'use strict';

    // ========== CONFIGURATION ==========
    const API_BASE_URL = window.location.origin + '/api';   
    const STORAGE_KEY_TOKEN = 'emailExtractorToken';
    const STORAGE_KEY_USERNAME = 'emailExtractorUsername';

    // ========== DOM REFS ==========
    
    // Pages
    const loginPage = document.getElementById('loginPage');
    const dashboardPage = document.getElementById('dashboardPage');
    
    // Login Form
    const loginForm = document.getElementById('loginForm');
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    
    // Header
    const userBadge = document.getElementById('userBadge');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Dashboard Tab
    const statEmailsToday = document.getElementById('statEmailsToday');
    const statEmailsSent = document.getElementById('statEmailsSent');
    const statBrevoRemaining = document.getElementById('statBrevoRemaining');
    const statTotalContacts = document.getElementById('statTotalContacts');
    const recentActivities = document.getElementById('recentActivities');
    const analyticsChart = document.getElementById('analyticsChart');
    
    // Scraper Tab
    const scraperUrl = document.getElementById('scraperUrl');
    const scraperMode = document.querySelectorAll('input[name="scraperMode"]');
    const scrapeBtn = document.getElementById('scrapeBtn');
    const scraperProgressContainer = document.getElementById('scraperProgressContainer');
    const scraperProgressBar = document.getElementById('scraperProgressBar');
    const scraperProgressText = document.getElementById('scraperProgressText');
    const scraperProgressLabel = document.getElementById('scraperProgressLabel');
    const scraperResults = document.getElementById('scraperResults');
    const scraperResultCount = document.getElementById('scraperResultCount');
    const exportScraperBtn = document.getElementById('exportScraperBtn');
    const clearScraperBtn = document.getElementById('clearScraperBtn');
    
    // Email Campaign Tab
    const campaignSubject = document.getElementById('campaignSubject');
    const campaignHtmlContent = document.getElementById('campaignHtmlContent');
    const campaignRecipients = document.getElementById('campaignRecipients');
    const sendCampaignBtn = document.getElementById('sendCampaignBtn');
    const campaignProgressContainer = document.getElementById('campaignProgressContainer');
    const campaignProgressBar = document.getElementById('campaignProgressBar');
    const campaignProgressText = document.getElementById('campaignProgressText');
    const campaignProgressLabel = document.getElementById('campaignProgressLabel');
    const campaignResults = document.getElementById('campaignResults');
    const campaignResultCount = document.getElementById('campaignResultCount');
    
    // API Settings Tab
    const abstractApiKey = document.getElementById('abstractApiKey');
    const saveAbstractApiBtn = document.getElementById('saveAbstractApiBtn');
    const abstractStats = document.getElementById('abstractStats');
    const abstractUsed = document.getElementById('abstractUsed');
    const abstractRemaining = document.getElementById('abstractRemaining');
    const abstractLimit = document.getElementById('abstractLimit');
    
    const brevoApiKey = document.getElementById('brevoApiKey');
    const brevoSenderEmail = document.getElementById('brevoSenderEmail');
    const saveBrevoApiBtn = document.getElementById('saveBrevoApiBtn');
    const brevoStats = document.getElementById('brevoStats');
    const brevoUsed = document.getElementById('brevoUsed');
    const brevoRemaining = document.getElementById('brevoRemaining');
    const brevoLimit = document.getElementById('brevoLimit');
    
    // Audit Logs Tab
    const auditLogsList = document.getElementById('auditLogsList');
    const auditLogsCount = document.getElementById('auditLogsCount');
    const refreshAuditLogsBtn = document.getElementById('refreshAuditLogsBtn');

    // ========== STATE ==========
    let authToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    let currentUsername = localStorage.getItem(STORAGE_KEY_USERNAME);
    let scraperData = [];
    let contactsList = [];
    let chartInstance = null;

    // ========== HELPER FUNCTIONS ==========

    /**
     * Show error message
     */
    function showError(message, elementId = null) {
        const element = elementId ? document.getElementById(elementId) : loginError;
        if (element) {
            element.textContent = message;
            element.classList.remove('hidden');
        }
        console.error('❌ Error:', message);
    }

    /**
     * Hide error message
     */
    function hideError(elementId = null) {
        const element = elementId ? document.getElementById(elementId) : loginError;
        if (element) {
            element.classList.add('hidden');
        }
    }

    /**
     * Show spinner/loading state
     */
    function setLoading(button, isLoading) {
        if (!button) return;
        if (isLoading) {
            button.disabled = true;
            const originalText = button.innerHTML;
            button.innerHTML = `<div class="spinner"></div>`;
            button.dataset.originalText = originalText;
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
            }
        }
    }

    /**
     * Format number with comma separator
     */
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    /**
     * API request helper
     */
    async function apiCall(endpoint, method = 'GET', body = null, includeAuth = true) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (includeAuth && authToken) {
            options.headers.Authorization = `Bearer ${authToken}`;
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            
            if (response.status === 401) {
                // Token expired or invalid
                logout();
                return { success: false, error: 'আপনার সেশন শেষ হয়েছে' };
            }

            const data = await response.json();
            
            if (!response.ok) {
                return { success: false, error: data.error || 'অজানা ত্রুটি' };
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Download file
     */
    function downloadFile(content, fileName, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Add activity log entry
     */
    function addActivityLog(action, details = '') {
        const timestamp = new Date().toLocaleTimeString('bn-BD');
        const html = `
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 fade-in">
                <div class="flex justify-between items-start gap-2">
                    <div>
                        <p class="text-sm font-semibold text-slate-800">${action}</p>
                        <p class="text-xs text-slate-600">${details}</p>
                    </div>
                    <p class="text-xs text-slate-400 whitespace-nowrap">${timestamp}</p>
                </div>
            </div>
        `;
        recentActivities.insertAdjacentHTML('afterbegin', html);
        
        // Keep only last 10 activities
        const activities = recentActivities.querySelectorAll('> div');
        if (activities.length > 10) {
            activities[activities.length - 1].remove();
        }
    }

    // ========== AUTHENTICATION ==========

    /**
     * Login handler
     */
    async function handleLogin(e) {
        e.preventDefault();
        hideError();

        const username = loginUsername.value.trim();
        const password = loginPassword.value.trim();

        if (!username || !password) {
            showError('ইউজারনেম এবং পাসওয়ার্ড প্রয়োজন');
            return;
        }

        setLoading(loginForm.querySelector('button'), true);

        const result = await apiCall('/auth/login', 'POST', { username, password }, false);

        if (result.success) {
            authToken = result.token;
            currentUsername = result.username;
            
            localStorage.setItem(STORAGE_KEY_TOKEN, authToken);
            localStorage.setItem(STORAGE_KEY_USERNAME, currentUsername);
            
            showDashboard();
            addActivityLog('লগইন সফল', `ব্যবহারকারী: ${username}`);
            loadDashboardData();
        } else {
            showError(result.error || 'লগইন ব্যর্থ হয়েছে');
        }

        setLoading(loginForm.querySelector('button'), false);
    }

    /**
     * Logout handler
     */
    async function logout() {
        await apiCall('/auth/logout', 'POST');
        
        authToken = null;
        currentUsername = null;
        
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_USERNAME);
        
        showLoginPage();
    }

    /**
     * Show login page
     */
    function showLoginPage() {
        loginPage.classList.remove('hidden');
        dashboardPage.classList.add('hidden');
    }

    /**
     * Show dashboard
     */
    function showDashboard() {
        loginPage.classList.add('hidden');
        dashboardPage.classList.remove('hidden');
        userBadge.textContent = `👤 ${currentUsername}`;
    }

    // ========== TAB NAVIGATION ==========

    /**
     * Switch tabs
     */
    function switchTab(tabName) {
        // Hide all tabs
        tabContents.forEach(tab => tab.classList.add('hidden'));
        
        // Remove active class from all buttons
        tabButtons.forEach(btn => btn.classList.remove('active'));
        
        // Show selected tab
        const selectedTab = document.getElementById(`${tabName}Tab`);
        if (selectedTab) {
            selectedTab.classList.remove('hidden');
        }
        
        // Add active class to selected button
        const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }

        // Load data if needed
        if (tabName === 'dashboard') {
            loadDashboardData();
        } else if (tabName === 'audit-logs') {
            loadAuditLogs();
        } else if (tabName === 'api-settings') {
            loadApiStats();
        }
    }

    // ========== DASHBOARD TAB ==========

    /**
     * Load dashboard data
     */
    async function loadDashboardData() {
        // Load API stats
        await loadApiStats();
        
        // Initialize chart
        initializeChart();
        
        // Load audit logs
        await loadAuditLogs();
    }

    /**
     * Initialize Chart.js
     */
    function initializeChart() {
        if (chartInstance) {
            chartInstance.destroy();
        }

        const ctx = analyticsChart.getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['12:00 AM', '3:00 AM', '6:00 AM', '9:00 AM', '12:00 PM', '3:00 PM', '6:00 PM', '9:00 PM'],
                datasets: [
                    {
                        label: 'এক্সট্র্যাক্ট করা ইমেইল',
                        data: [12, 19, 3, 5, 2, 3, 8, 15],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                    },
                    {
                        label: 'পাঠানো ইমেইল',
                        data: [5, 10, 8, 6, 12, 9, 4, 11],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                    },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        });
    }

    // ========== SCRAPER TAB ==========

    /**
     * Handle scraping
     */
    async function handleScrape() {
        const url = scraperUrl.value.trim();
        const mode = document.querySelector('input[name="scraperMode"]:checked').value;

        if (!url) {
            showError('URL প্রবেশ করুন', 'scraperResults');
            return;
        }

        setLoading(scrapeBtn, true);
        scraperProgressContainer.classList.remove('hidden');
        scraperProgressBar.style.width = '0%';
        scraperProgressText.textContent = '0%';
        scraperProgressLabel.textContent = mode === 'emails' ? 'ইমেইল এক্সট্র্যাক্ট করছে…' : 'ফোন নম্বর এক্সট্র্যাক্ট করছে…';

        const endpoint = mode === 'emails' ? '/scrape/emails' : '/scrape/phones';
        const result = await apiCall(endpoint, 'POST', { url });

        if (result.success) {
            scraperData = mode === 'emails' ? result.emails : result.phones;
            displayScraperResults(scraperData, mode);
            addActivityLog(
                mode === 'emails' ? '✉️ ইমেইল এক্সট্র্যাক্ট' : '📱 ফোন নম্বর এক্সট্র্যাক্ট',
                `${result[mode === 'emails' ? 'emailCount' : 'phoneCount']} টি আইটেম পাওয়া গেছে`
            );
            
            // Update stats
            statEmailsToday.textContent = formatNumber(result[mode === 'emails' ? 'emailCount' : 'phoneCount']);
        } else {
            showError(result.error || 'স্ক্র্যাপিং ব্যর্থ হয়েছে');
        }

        scraperProgressContainer.classList.add('hidden');
        setLoading(scrapeBtn, false);
    }

    /**
     * Display scraper results
     */
    function displayScraperResults(data, mode) {
        if (!data || data.length === 0) {
            scraperResults.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">কোনো ডেটা পাওয়া যায়নি</div>';
            scraperResultCount.textContent = '0 টি আইটেম পাওয়া গেছে';
            return;
        }

        let html = '<div class="space-y-2">';
        const limit = Math.min(100, data.length);
        
        for (let i = 0; i < limit; i++) {
            const item = data[i];
            html += `
                <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all result-row">
                    <span class="text-sm font-mono text-slate-700 flex-1 break-all">${item}</span>
                    <button class="ml-2 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-all copy-btn" data-value="${item}">
                        কপি
                    </button>
                </div>
            `;
        }
        
        if (data.length > limit) {
            html += `<div class="p-2 text-center text-sm text-blue-600 font-medium">… এবং ${data.length - limit} টি আরও</div>`;
        }
        
        html += '</div>';
        scraperResults.innerHTML = html;
        scraperResultCount.textContent = `${data.length} টি আইটেম পাওয়া গেছে`;

        // Add copy functionality
        scraperResults.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                navigator.clipboard.writeText(btn.dataset.value);
                btn.textContent = '✓ কপি করা হয়েছে';
                setTimeout(() => btn.textContent = 'কপি', 2000);
            });
        });
    }

    // ========== EMAIL CAMPAIGN TAB ==========

    /**
     * Send email campaign
     */
    async function handleSendCampaign() {
        const subject = campaignSubject.value.trim();
        const htmlContent = campaignHtmlContent.value.trim();
        const recipientFilter = campaignRecipients.value;

        if (!subject || !htmlContent) {
            showError('বিষয় এবং বিষয়বস্তু প্রয়োজন');
            return;
        }

        if (!recipientFilter) {
            showError('প্রাপক নির্বাচন করুন');
            return;
        }

        setLoading(sendCampaignBtn, true);
        campaignProgressContainer.classList.remove('hidden');
        campaignProgressBar.style.width = '0%';
        campaignProgressText.textContent = '0%';
        campaignProgressLabel.textContent = 'ইমেইল পাঠাচ্ছে…';

        // Simulate sending (demo - in real app, would call backend)
        const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
        
        campaignResults.innerHTML = '<div class="space-y-2"></div>';
        let successCount = 0;

        for (let i = 0; i < recipients.length; i++) {
            const email = recipients[i];
            
            // Simulate API call
            await new Promise(r => setTimeout(r, 500));
            
            const result = {
                email,
                success: Math.random() > 0.1, // 90% success rate
                messageId: `msg_${Math.random().toString(36).substr(2, 9)}`,
            };

            if (result.success) successCount++;

            const statusColor = result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
            const statusIcon = result.success ? '✅' : '❌';
            const statusText = result.success ? 'পাঠানো হয়েছে' : 'ব্যর্থ';

            const resultHtml = `
                <div class="p-2.5 ${statusColor} rounded-lg border">
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-mono">${email}</span>
                        <span class="text-xs font-medium">${statusIcon} ${statusText}</span>
                    </div>
                </div>
            `;

            campaignResults.querySelector('div').insertAdjacentHTML('beforeend', resultHtml);

            // Update progress
            const progress = Math.round(((i + 1) / recipients.length) * 100);
            campaignProgressBar.style.width = progress + '%';
            campaignProgressText.textContent = progress + '%';
        }

        campaignResultCount.textContent = `${successCount}/${recipients.length} টি ইমেইল পাঠানো হয়েছে`;
        addActivityLog('📧 ইমেইল ক্যাম্পেইন', `${successCount} টি সফলভাবে পাঠানো হয়েছে`);

        setLoading(sendCampaignBtn, false);
        setTimeout(() => {
            campaignProgressContainer.classList.add('hidden');
        }, 2000);
    }

    // ========== API SETTINGS TAB ==========

    /**
     * Load API stats
     */
    async function loadApiStats() {
        // Abstract API stats
        const abstractResult = await apiCall('/api-keys/stats?apiName=abstract');
        if (abstractResult.success && abstractResult.data) {
            const stats = abstractResult.data;
            abstractUsed.textContent = formatNumber(stats.used);
            abstractRemaining.textContent = formatNumber(stats.remaining);
            abstractLimit.textContent = formatNumber(stats.limit);
            abstractStats.classList.remove('hidden');
            statBrevoRemaining.textContent = formatNumber(stats.remaining);
        }

        // Brevo API stats
        const brevoResult = await apiCall('/api-keys/stats?apiName=brevo');
        if (brevoResult.success && brevoResult.data) {
            const stats = brevoResult.data;
            brevoUsed.textContent = formatNumber(stats.used);
            brevoRemaining.textContent = formatNumber(stats.remaining);
            brevoLimit.textContent = formatNumber(stats.limit);
            brevoStats.classList.remove('hidden');
        }
    }

    /**
     * Save Abstract API key
     */
    async function handleSaveAbstractApiKey() {
        const key = abstractApiKey.value.trim();

        if (!key) {
            showError('API Key প্রয়োজন');
            return;
        }

        setLoading(saveAbstractApiBtn, true);

        const result = await apiCall('/api-keys/save', 'POST', { apiName: 'abstract', apiKey: key });

        if (result.success) {
            abstractApiKey.value = '';
            addActivityLog('🔑 Abstract API Key', 'সংরক্ষণ করা হয়েছে');
            alert('✓ API Key সংরক্ষণ করা হয়েছে');
            await loadApiStats();
        } else {
            showError(result.error || 'সংরক্ষণ ব্যর্থ হয়েছে');
        }

        setLoading(saveAbstractApiBtn, false);
    }

    /**
     * Save Brevo API key
     */
    async function handleSaveBrevoApiKey() {
        const key = brevoApiKey.value.trim();
        const senderEmail = brevoSenderEmail.value.trim();

        if (!key || !senderEmail) {
            showError('API Key এবং Sender Email প্রয়োজন');
            return;
        }

        setLoading(saveBrevoApiBtn, true);

        const result = await apiCall('/api-keys/save', 'POST', { apiName: 'brevo', apiKey: key });

        if (result.success) {
            brevoApiKey.value = '';
            brevoSenderEmail.value = '';
            addActivityLog('🔑 Brevo API Key', 'সংরক্ষণ করা হয়েছে');
            alert('✓ API Key সংরক্ষণ করা হয়েছে');
            await loadApiStats();
        } else {
            showError(result.error || 'সংরক্ষণ ব্যর্থ হয়েছে');
        }

        setLoading(saveBrevoApiBtn, false);
    }

    // ========== AUDIT LOGS TAB ==========

    /**
     * Load audit logs
     */
    async function loadAuditLogs() {
        const today = new Date().toISOString().split('T')[0];
        const result = await apiCall(`/audit-logs?date=${today}`);

        if (result.success && result.events) {
            displayAuditLogs(result.events);
            auditLogsCount.textContent = `${result.totalEvents} টি ইভেন্ট`;
        }
    }

    /**
     * Display audit logs
     */
    function displayAuditLogs(events) {
        if (!events || events.length === 0) {
            auditLogsList.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">কোনো লগ নেই</div>';
            return;
        }

        let html = '<div class="space-y-2">';

        // Reverse to show latest first
        [...events].reverse().forEach(event => {
            const timestamp = new Date(event.timestamp).toLocaleTimeString('bn-BD');
            const actionIcon = getActionIcon(event.action);
            
            html += `
                <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all">
                    <div class="flex justify-between items-start gap-2">
                        <div class="flex-1">
                            <p class="text-sm font-semibold text-slate-800">${actionIcon} ${event.action}</p>
                            <p class="text-xs text-slate-600">ব্যবহারকারী: ${event.username}</p>
                        </div>
                        <p class="text-xs text-slate-400 whitespace-nowrap">${timestamp}</p>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        auditLogsList.innerHTML = html;
    }

    /**
     * Get action icon
     */
    function getActionIcon(action) {
        const icons = {
            'LOGIN': '🔓',
            'LOGOUT': '🔒',
            'API_KEY_UPDATED': '🔑',
            'SCRAPE_EMAILS': '✉️',
            'SCRAPE_PHONES': '📱',
            'SEND_EMAILS': '📧',
        };
        return icons[action] || '📋';
    }

    // ========== EVENT BINDINGS ==========

    // Login form
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', logout);

    // Tab navigation
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    // Scraper
    scrapeBtn.addEventListener('click', handleScrape);
    exportScraperBtn.addEventListener('click', () => {
        if (scraperData.length === 0) {
            showError('কোনো ডেটা নেই');
            return;
        }
        const content = scraperData.join('\n');
        downloadFile(content, 'extracted_data.txt');
    });
    clearScraperBtn.addEventListener('click', () => {
        scraperData = [];
        scraperUrl.value = '';
        scraperResults.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">কোনো ডেটা নেই</div>';
        scraperResultCount.textContent = '0 টি আইটেম পাওয়া গেছে';
    });

    // Email Campaign
    sendCampaignBtn.addEventListener('click', handleSendCampaign);

    // API Settings
    saveAbstractApiBtn.addEventListener('click', handleSaveAbstractApiKey);
    saveBrevoApiBtn.addEventListener('click', handleSaveBrevoApiKey);

    // Audit Logs
    refreshAuditLogsBtn.addEventListener('click', loadAuditLogs);

    // ========== INITIALIZATION ==========

    /**
     * Check if user is already logged in
     */
    function initializeApp() {
        if (authToken && currentUsername) {
            showDashboard();
            loadDashboardData();
        } else {
            showLoginPage();
        }
    }

    // Check auth on page load
    document.addEventListener('DOMContentLoaded', initializeApp);

    // Expose some functions to global scope for debugging
    window.emailExtractorDebug = {
        logout,
        loadDashboardData,
        loadAuditLogs,
        loadApiStats,
    };

    console.log('✅ Email Extractor Pro Dashboard Initialized');
    console.log('Debug mode: window.emailExtractorDebug');

})();
