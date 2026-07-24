// script.js
// ============================================================
//  Email & SMS Marketing Pro - Global Application Logic
//  Authentication, navigation, dashboard, and dynamic module loading.
// ============================================================

(function() {
  'use strict';

  // ========== CONFIG ==========
  const API_BASE = window.location.origin + '/api';
  const STORAGE_TOKEN = 'emailExtractorToken';
  const STORAGE_USER = 'emailExtractorUsername';

  // ========== DOM REFS ==========
  const loginPage = document.getElementById('loginPage');
  const dashboardPage = document.getElementById('dashboardPage');
  const loginForm = document.getElementById('loginForm');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const userBadge = document.getElementById('userBadge');
  const logoutBtn = document.getElementById('logoutBtn');

  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  const statEmailsToday = document.getElementById('statEmailsToday');
  const statEmailsSent = document.getElementById('statEmailsSent');
  const statSmsSent = document.getElementById('statSmsSent');
  const statBrevoRemaining = document.getElementById('statBrevoRemaining');
  const statTotalContacts = document.getElementById('statTotalContacts');
  const recentActivities = document.getElementById('recentActivities');
  const analyticsChart = document.getElementById('analyticsChart');
  const brevoUsageBar = document.getElementById('brevoUsageBar');

  // API Settings
  const emailProviderSelect = document.getElementById('emailProviderSelect');
  const brevoApiKey = document.getElementById('brevoApiKey');
  const brevoSenderEmail = document.getElementById('brevoSenderEmail');
  const saveBrevoApiBtn = document.getElementById('saveBrevoApiBtn');
  const brevoStats = document.getElementById('brevoStats');
  const brevoUsed = document.getElementById('brevoUsed');
  const brevoRemaining = document.getElementById('brevoRemaining');
  const brevoLimit = document.getElementById('brevoLimit');

  const smsProviderSelect = document.getElementById('smsProviderSelect');
  const smsApiKey = document.getElementById('smsApiKey');
  const smsApiBaseUrl = document.getElementById('smsApiBaseUrl');
  const smsDefaultSender = document.getElementById('smsDefaultSender');
  const saveSmsApiBtn = document.getElementById('saveSmsApiBtn');
  const smsStats = document.getElementById('smsStats');
  const smsUsed = document.getElementById('smsUsed');
  const smsRemaining = document.getElementById('smsRemaining');
  const smsLimit = document.getElementById('smsLimit');

  const callProviderSelect = document.getElementById('callProviderSelect');
  const callApiKey = document.getElementById('callApiKey');
  const callApiBaseUrl = document.getElementById('callApiBaseUrl');
  const callDefaultCallerId = document.getElementById('callDefaultCallerId');
  const saveCallApiBtn = document.getElementById('saveCallApiBtn');
  const callStats = document.getElementById('callStats');
  const callUsed = document.getElementById('callUsed');
  const callRemaining = document.getElementById('callRemaining');
  const callLimit = document.getElementById('callLimit');

  const textApiKey = document.getElementById('textApiKey');
  const textApiBaseUrl = document.getElementById('textApiBaseUrl');
  const saveTextApiBtn = document.getElementById('saveTextApiBtn');

  // ===== Advanced Scraping & Verification API Elements =====
  const scrapeProviderSelect = document.getElementById('scrapeProviderSelect');
  const scrapeApiKeyInput = document.getElementById('scrapeApiKeyInput');
  const saveScrapeApiBtn = document.getElementById('saveScrapeApiBtn');

  const phoneVerifyProviderSelect = document.getElementById('phoneVerifyProviderSelect');
  const phoneVerifyApiKeyInput = document.getElementById('phoneVerifyApiKeyInput');
  const savePhoneVerifyApiBtn = document.getElementById('savePhoneVerifyApiBtn');

  const emailVerifyProviderSelect = document.getElementById('emailVerifyProviderSelect');
  const emailVerifyApiKeyInput = document.getElementById('emailVerifyApiKeyInput');
  const saveEmailVerifyApiBtn = document.getElementById('saveEmailVerifyApiBtn');

  // Audit Logs
  const auditLogsBody = document.getElementById('auditLogsBody');
  const auditLogsCount = document.getElementById('auditLogsCount');
  const refreshAuditLogsBtn = document.getElementById('refreshAuditLogsBtn');
  const auditDateFilter = document.getElementById('auditDateFilter');
  const auditActionFilter = document.getElementById('auditActionFilter');
  const auditSearchFilter = document.getElementById('auditSearchFilter');
  const applyAuditFiltersBtn = document.getElementById('applyAuditFiltersBtn');
  const resetAuditFiltersBtn = document.getElementById('resetAuditFiltersBtn');
  const exportAuditCsvBtn = document.getElementById('exportAuditCsvBtn');

  // ========== STATE ==========
  let authToken = localStorage.getItem(STORAGE_TOKEN);
  let currentUser = localStorage.getItem(STORAGE_USER);
  let chartInstance = null;
  let allAuditLogs = [];
  let filteredAuditLogs = [];

  // ========== HELPERS ==========
  function showError(msg, el = loginError) {
    el.textContent = msg;
    el.classList.remove('hidden');
    console.error(msg);
  }

  function hideError(el = loginError) {
    el.classList.add('hidden');
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      const orig = btn.innerHTML;
      btn.innerHTML = '<div class="spinner spinner-sm"></div>';
      btn.dataset.orig = orig;
    } else {
      btn.disabled = false;
      if (btn.dataset.orig) btn.innerHTML = btn.dataset.orig;
    }
  }

  function formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function downloadFile(content, name, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function apiCall(endpoint, method = 'GET', body = null, needAuth = true) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (needAuth && authToken) {
      opts.headers.Authorization = `Bearer ${authToken}`;
    }
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + endpoint, opts);
    if (res.status === 401) {
      logout();
      return { success: false, error: 'Session expired' };
    }
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'Unknown error' };
    }
    return data;
  }

  function addActivity(action, details = '') {
    const ts = new Date().toLocaleTimeString();
    const html = `
      <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 fade-in">
        <div class="flex justify-between items-start gap-2">
          <div><p class="text-sm font-semibold text-slate-800">${action}</p><p class="text-xs text-slate-600">${details}</p></div>
          <p class="text-xs text-slate-400 whitespace-nowrap">${ts}</p>
        </div>
      </div>
    `;
    recentActivities.insertAdjacentHTML('afterbegin', html);
    if (recentActivities.children.length > 10) {
      recentActivities.lastElementChild.remove();
    }
  }

  function getActionIcon(action) {
    const map = {
      'LOGIN_SUCCESS': '🔓',
      'LOGIN_FAILED': '❌',
      'LOGOUT': '🔒',
      'API_KEY_UPDATED': '🔑',
      'SCRAPE_EMAILS': '✉️',
      'SCRAPE_PHONES': '📱',
      'SEND_EMAILS': '📧',
      'SEND_SMS': '📱',
      'SCRAPE_ERROR': '⚠️',
      'CONTACTS_IMPORT': '📥'
    };
    return map[action] || '📋';
  }

  function getStatusBadge(status) {
    const map = {
      'success': 'success',
      'failed': 'failed',
      'pending': 'pending',
      'info': 'info'
    };
    return map[status] || 'info';
  }

  // ========== AUTHENTICATION ==========
  async function handleLogin(e) {
    e.preventDefault();
    hideError();
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) {
      showError('Username and password are required');
      return;
    }
    setLoading(loginForm.querySelector('button'), true);
    const result = await apiCall('/auth/login', 'POST', { username, password }, false);
    setLoading(loginForm.querySelector('button'), false);
    if (result.success) {
      authToken = result.token;
      currentUser = result.username;
      localStorage.setItem(STORAGE_TOKEN, authToken);
      localStorage.setItem(STORAGE_USER, currentUser);
      showDashboard();
      addActivity('Login successful', `User: ${username}`);
      loadDashboardData();
    } else {
      showError(result.error || 'Login failed');
    }
  }

  async function logout() {
    await apiCall('/auth/logout', 'POST');
    authToken = null;
    currentUser = null;
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    showLoginPage();
  }

  function showLoginPage() {
    loginPage.classList.remove('hidden');
    dashboardPage.classList.add('hidden');
  }

  function showDashboard() {
    loginPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
    userBadge.textContent = `👤 ${currentUser}`;
  }

  // ========== TAB NAVIGATION ==========
  function switchTab(name) {
    tabContents.forEach(t => t.classList.add('hidden'));
    tabButtons.forEach(b => b.classList.remove('active'));
    const target = document.getElementById(name + 'Tab');
    if (target) target.classList.remove('hidden');
    const btn = document.querySelector(`[data-tab="${name}"]`);
    if (btn) btn.classList.add('active');

    if (name === 'dashboard') loadDashboardData();
    else if (name === 'audit-logs') loadAuditLogs();
    else if (name === 'api-settings') loadApiStats();
    else if (name === 'scraper') loadScraperModules();
    else if (name === 'campaign') loadCampaignModules();
  }

  // ========== DYNAMIC MODULE LOADERS ==========
  async function loadScraperModules() {
    await loadBulkTextExtractor();
    await loadWebsiteExtractor();
    await loadLocationSearch();
  }

  async function loadCampaignModules() {
    await loadEmailCampaign();
    await loadSmsCampaign();
    await loadCallCampaign();
  }

  async function loadBulkTextExtractor() {
    const container = document.getElementById('bulkTextExtractorContainer');
    if (container.dataset.loaded) return;
    try {
      const resp = await fetch('/text-contact-extractor/index.html');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      container.innerHTML = html;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/text-contact-extractor/style.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = '/text-contact-extractor/script.js';
      document.body.appendChild(script);
      container.dataset.loaded = 'true';
    } catch (e) {
      container.innerHTML = `<div class="text-red-500 p-4">Failed to load Bulk Text Extractor: ${e.message}</div>`;
    }
  }

  async function loadWebsiteExtractor() {
    const container = document.getElementById('websiteExtractorContainer');
    if (container.dataset.loaded) return;
    try {
      const resp = await fetch('/website-contact-extractor/index.html');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      container.innerHTML = html;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/website-contact-extractor/style.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = '/website-contact-extractor/script.js';
      document.body.appendChild(script);
      container.dataset.loaded = 'true';
    } catch (e) {
      container.innerHTML = `<div class="text-red-500 p-4">Failed to load Website Extractor: ${e.message}</div>`;
    }
  }

  async function loadLocationSearch() {
    const container = document.getElementById('locationSearchContainer');
    if (container.dataset.loaded) return;
    try {
      const resp = await fetch('/location-contact-search/index.html');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      container.innerHTML = html;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/location-contact-search/style.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = '/location-contact-search/script.js';
      document.body.appendChild(script);
      container.dataset.loaded = 'true';
    } catch (e) {
      container.innerHTML = `<div class="text-red-500 p-4">Failed to load Location Search: ${e.message}</div>`;
    }
  }

  async function loadEmailCampaign() {
    const container = document.getElementById('emailCampaignContainer');
    if (container.dataset.loaded) return;
    try {
      const resp = await fetch('/email/index.html');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      container.innerHTML = html;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/email/style.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = '/email/script.js';
      document.body.appendChild(script);
      container.dataset.loaded = 'true';
    } catch (e) {
      container.innerHTML = `<div class="text-red-500 p-4">Failed to load Email Campaign: ${e.message}</div>`;
    }
  }

  async function loadSmsCampaign() {
    const container = document.getElementById('smsCampaignContainer');
    if (container.dataset.loaded) return;
    try {
      const resp = await fetch('/sms/index.html');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      container.innerHTML = html;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/sms/style.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = '/sms/script.js';
      document.body.appendChild(script);
      container.dataset.loaded = 'true';
    } catch (e) {
      container.innerHTML = `<div class="text-red-500 p-4">Failed to load SMS Campaign: ${e.message}</div>`;
    }
  }

  async function loadCallCampaign() {
    const container = document.getElementById('callCampaignContainer');
    if (container.dataset.loaded) return;
    try {
      const resp = await fetch('/call/index.html');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const html = await resp.text();
      container.innerHTML = html;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/call/style.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = '/call/script.js';
      document.body.appendChild(script);
      container.dataset.loaded = 'true';
    } catch (e) {
      container.innerHTML = `<div class="text-red-500 p-4">Failed to load Call Campaign: ${e.message}</div>`;
    }
  }

  // ========== DASHBOARD ==========
  async function loadDashboardData() {
    await loadApiStats();
    await loadAuditLogs();
    const stats = await apiCall('/dashboard/stats');
    if (stats.success && stats.stats) {
      statEmailsToday.textContent = formatNum(stats.stats.emailsToday || 0);
      statEmailsSent.textContent = formatNum(stats.stats.emailsSentToday || 0);
      statSmsSent.textContent = formatNum(stats.stats.smsSentToday || 0);
      statBrevoRemaining.textContent = formatNum(stats.stats.brevoRemaining || 0);
      statTotalContacts.textContent = formatNum(stats.stats.totalContacts || 0);
      const used = (stats.stats.brevoLimit || 300) - (stats.stats.brevoRemaining || 0);
      const pct = Math.min(100, (used / (stats.stats.brevoLimit || 300)) * 100);
      if (brevoUsageBar) brevoUsageBar.style.width = pct + '%';
    }
    const chartData = await apiCall('/dashboard/charts');
    if (chartData.success && chartData.data) {
      initChart(chartData.data);
    } else {
      initChart([]);
    }
  }

  function initChart(data) {
    if (chartInstance) chartInstance.destroy();
    const ctx = analyticsChart.getContext('2d');
    const labels = data.length ? data.map(d => d.date.slice(5)) : ['No data'];
    const extracted = data.length ? data.map(d => d.extracted) : [0];
    const sent = data.length ? data.map(d => d.sent) : [0];

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Extracted', data: extracted, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 },
          { label: 'Sent', data: sent, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // ========== API SETTINGS ==========
  async function loadApiStats() {
    const br = await apiCall('/api-keys/stats?apiName=brevo');
    if (br.success && br.data) {
      brevoUsed.textContent = formatNum(br.data.used);
      brevoRemaining.textContent = formatNum(br.data.remaining);
      brevoLimit.textContent = formatNum(br.data.limit);
      brevoStats.classList.remove('hidden');
      statBrevoRemaining.textContent = formatNum(br.data.remaining);
      const used = br.data.limit - br.data.remaining;
      const pct = Math.min(100, (used / br.data.limit) * 100);
      if (brevoUsageBar) brevoUsageBar.style.width = pct + '%';
    }
    const sms = await apiCall('/api-keys/stats?apiName=sms');
    if (sms.success && sms.data) {
      smsUsed.textContent = formatNum(sms.data.used);
      smsRemaining.textContent = formatNum(sms.data.remaining);
      smsLimit.textContent = formatNum(sms.data.limit);
      smsStats.classList.remove('hidden');
    }
    const call = await apiCall('/api-keys/stats?apiName=call');
    if (call.success && call.data) {
      callUsed.textContent = formatNum(call.data.used);
      callRemaining.textContent = formatNum(call.data.remaining);
      callLimit.textContent = formatNum(call.data.limit);
      callStats.classList.remove('hidden');
    }
  }

  // ========== SAVE FUNCTIONS ==========
  async function handleSaveBrevo() {
    const key = brevoApiKey.value.trim();
    const sender = brevoSenderEmail.value.trim();
    if (!key || !sender) { showError('API Key and Sender Email required', brevoStats); return; }
    setLoading(saveBrevoApiBtn, true);
    const res = await apiCall('/api-keys/save', 'POST', { apiName: 'brevo', apiKey: key });
    setLoading(saveBrevoApiBtn, false);
    if (res.success) {
      brevoApiKey.value = '';
      brevoSenderEmail.value = '';
      addActivity('🔑 Brevo API key', 'Saved');
      alert('Email API key saved successfully');
      await loadApiStats();
    } else {
      showError(res.error || 'Save failed', brevoStats);
    }
  }

  async function handleSaveSms() {
    const provider = smsProviderSelect.value;
    const key = smsApiKey.value.trim();
    const baseUrl = smsApiBaseUrl.value.trim();
    const sender = smsDefaultSender.value.trim();
    if (!key || !baseUrl || !sender) {
      showError('All SMS API fields are required', smsStats);
      return;
    }
    setLoading(saveSmsApiBtn, true);
    const res = await apiCall('/api-keys/save', 'POST', {
      apiName: 'sms',
      apiKey: key,
      provider,
      baseUrl,
      defaultSender: sender
    });
    setLoading(saveSmsApiBtn, false);
    if (res.success) {
      smsApiKey.value = '';
      smsApiBaseUrl.value = '';
      smsDefaultSender.value = '';
      addActivity('🔑 SMS API key', 'Saved');
      alert('SMS API configuration saved successfully');
      await loadApiStats();
    } else {
      showError(res.error || 'Save failed', smsStats);
    }
  }

  async function handleSaveCall() {
    const provider = callProviderSelect.value;
    const key = callApiKey.value.trim();
    const baseUrl = callApiBaseUrl.value.trim();
    const defaultCallerId = callDefaultCallerId.value.trim();
    if (!key || !baseUrl || !defaultCallerId) {
      alert('Call API-র সব ফিল্ড পূরণ করুন');
      return;
    }
    setLoading(saveCallApiBtn, true);
    const res = await apiCall('/api-keys/save', 'POST', {
      apiName: 'call',
      apiKey: key,
      provider,
      baseUrl,
      defaultCallerId
    });
    setLoading(saveCallApiBtn, false);
    if (res.success) {
      callApiKey.value = '';
      callApiBaseUrl.value = '';
      callDefaultCallerId.value = '';
      addActivity('🔑 Call API key', 'Saved');
      alert('Call API configuration saved successfully');
      await loadApiStats();
    } else {
      alert(res.error || 'সেভ করতে ব্যর্থ');
    }
  }

  async function handleSaveText() {
    const key = textApiKey.value.trim();
    const baseUrl = textApiBaseUrl.value.trim();
    setLoading(saveTextApiBtn, true);
    const res = await apiCall('/api-keys/save', 'POST', {
      apiName: 'text',
      apiKey: key || 'not_required',
      baseUrl: baseUrl || ''
    });
    setLoading(saveTextApiBtn, false);
    if (res.success) {
      textApiKey.value = '';
      textApiBaseUrl.value = '';
      addActivity('🔑 Text API key', 'Saved');
      alert('Text API configuration saved successfully');
    } else {
      alert(res.error || 'সেভ করতে ব্যর্থ');
    }
  }

  // 1. Website Scraping API
  async function handleSaveScrapingApi() {
    const provider = scrapeProviderSelect.value;
    const key = scrapeApiKeyInput.value.trim();
    if (!key) { alert('অনুগ্রহ করে Scraping API Key প্রদান করুন।'); return; }
    
    setLoading(saveScrapeApiBtn, true);
    const res = await apiCall('/api-keys/save', 'POST', {
      apiName: 'website_scraping',
      provider: provider,
      apiKey: key
    });
    setLoading(saveScrapeApiBtn, false);
    
    if (res.success) {
      scrapeApiKeyInput.value = '';
      addActivity('🔑 Scraping API', `Saved Provider: ${provider}`);
      alert(`${provider.toUpperCase()} API Key সফলভাবে সেভ হয়েছে!`);
    } else {
      alert(res.error || 'সেভ করতে ব্যর্থ হয়েছে।');
    }
  }

  // 2. Phone Verification API
  async function handleSavePhoneVerifyApi() {
    const provider = phoneVerifyProviderSelect.value;
    const key = phoneVerifyApiKeyInput.value.trim();
    if (!key) { alert('অনুগ্রহ করে Phone Verification API Key প্রদান করুন।'); return; }
    
    setLoading(savePhoneVerifyApiBtn, true);
    const res = await apiCall('/api-keys/save', 'POST', {
      apiName: 'phone_verification',
      provider: provider,
      apiKey: key
    });
    setLoading(savePhoneVerifyApiBtn, false);
    
    if (res.success) {
      phoneVerifyApiKeyInput.value = '';
      addActivity('🔑 Phone Verify API', `Saved Provider: ${provider}`);
      alert(`${provider.toUpperCase()} API Key সফলভাবে সেভ হয়েছে!`);
    } else {
      alert(res.error || 'সেভ করতে ব্যর্থ হয়েছে।');
    }
  }

  // 3. Email Verification API
  async function handleSaveEmailVerifyApi() {
    const provider = emailVerifyProviderSelect.value;
    const key = emailVerifyApiKeyInput.value.trim();
    if (!key) { alert('অনুগ্রহ করে Email Verification API Key প্রদান করুন।'); return; }
    
    setLoading(saveEmailVerifyApiBtn, true);
    const res = await apiCall('/api-keys/save', 'POST', {
      apiName: 'email_verification',
      provider: provider,
      apiKey: key
    });
    setLoading(saveEmailVerifyApiBtn, false);
    
    if (res.success) {
      emailVerifyApiKeyInput.value = '';
      addActivity('🔑 Email Verify API', `Saved Provider: ${provider}`);
      alert(`${provider.toUpperCase()} API Key সফলভাবে সেভ হয়েছে!`);
    } else {
      alert(res.error || 'সেভ করতে ব্যর্থ হয়েছে।');
    }
  }

  // ========== AUDIT LOGS ==========
  async function loadAuditLogs() {
    const date = auditDateFilter.value || new Date().toISOString().split('T')[0];
    const res = await apiCall(`/audit-logs?date=${date}&limit=200`);
    if (res.success && res.events) {
      allAuditLogs = res.events;
      applyFilters();
      auditLogsCount.textContent = `${filteredAuditLogs.length} events`;
    } else {
      auditLogsBody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-500 py-8">No logs found</td></tr>';
      auditLogsCount.textContent = '0 events';
    }
  }

  function applyFilters() {
    const action = auditActionFilter.value;
    const search = auditSearchFilter.value.toLowerCase().trim();

    filteredAuditLogs = allAuditLogs.filter(ev => {
      if (action !== 'all' && ev.action !== action) return false;
      if (search) {
        const user = (ev.username || '').toLowerCase();
        const details = JSON.stringify(ev.details || '').toLowerCase();
        const actionStr = ev.action.toLowerCase();
        if (!user.includes(search) && !details.includes(search) && !actionStr.includes(search)) return false;
      }
      return true;
    });

    displayAuditLogs(filteredAuditLogs);
    auditLogsCount.textContent = `${filteredAuditLogs.length} events`;
  }

  function displayAuditLogs(events) {
    if (!events || events.length === 0) {
      auditLogsBody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-500 py-8">No matching logs</td></tr>';
      return;
    }
    let html = '';
    for (const ev of events.slice().reverse()) {
      const ts = new Date(ev.timestamp).toLocaleString();
      const icon = getActionIcon(ev.action);
      const user = ev.username || 'system';
      const details = ev.details ? Object.entries(ev.details).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
      const status = ev.success !== undefined ? (ev.success ? 'success' : 'failed') : 'info';
      const badge = getStatusBadge(status);
      html += `
        <tr class="hover:bg-slate-50/80 transition-all">
          <td class="text-xs text-slate-500 whitespace-nowrap">${ts}</td>
          <td class="font-medium text-slate-700">${user}</td>
          <td><span class="flex items-center gap-1.5">${icon} ${ev.action.replace(/_/g, ' ')}</span></td>
          <td class="text-xs text-slate-500 max-w-[200px] truncate" title="${details}">${details || '—'}</td>
          <td><span class="status-badge ${badge}">${status}</span></td>
        </tr>
      `;
    }
    auditLogsBody.innerHTML = html;
  }

  function exportAuditCsv() {
    const data = filteredAuditLogs.length ? filteredAuditLogs : allAuditLogs;
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }
    let csv = 'Timestamp,User,Action,Details,Status\n';
    for (const ev of data) {
      const ts = new Date(ev.timestamp).toLocaleString();
      const user = ev.username || 'system';
      const details = ev.details ? JSON.stringify(ev.details) : '';
      const status = ev.success !== undefined ? (ev.success ? 'success' : 'failed') : 'info';
      csv += `"${ts}","${user}","${ev.action}","${details.replace(/"/g, '""')}","${status}"\n`;
    }
    downloadFile(csv, `audit_logs_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  }

  // ========== EVENT BINDINGS ==========
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', logout);

  tabButtons.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  saveBrevoApiBtn.addEventListener('click', handleSaveBrevo);
  saveSmsApiBtn.addEventListener('click', handleSaveSms);
  saveCallApiBtn.addEventListener('click', handleSaveCall);
  saveTextApiBtn.addEventListener('click', handleSaveText);

  // Advanced API Save Events
  if (saveScrapeApiBtn) saveScrapeApiBtn.addEventListener('click', handleSaveScrapingApi);
  if (savePhoneVerifyApiBtn) savePhoneVerifyApiBtn.addEventListener('click', handleSavePhoneVerifyApi);
  if (saveEmailVerifyApiBtn) saveEmailVerifyApiBtn.addEventListener('click', handleSaveEmailVerifyApi);

  refreshAuditLogsBtn.addEventListener('click', loadAuditLogs);
  applyAuditFiltersBtn.addEventListener('click', applyFilters);
  resetAuditFiltersBtn.addEventListener('click', () => {
    auditDateFilter.value = new Date().toISOString().split('T')[0];
    auditActionFilter.value = 'all';
    auditSearchFilter.value = '';
    loadAuditLogs();
  });
  exportAuditCsvBtn.addEventListener('click', exportAuditCsv);

  // ========== INITIALIZATION ==========
  function init() {
    auditDateFilter.value = new Date().toISOString().split('T')[0];

    if (authToken && currentUser) {
      showDashboard();
      loadDashboardData();
    } else {
      showLoginPage();
    }
    console.log('✅ Marketing Pro v3.0 initialized');
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose debug
  window.__debug = { logout, loadDashboardData, loadAuditLogs, loadApiStats };

})();
