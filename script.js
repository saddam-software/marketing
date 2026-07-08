// script.js
// ============================================================
//  Email & SMS Marketing Pro - Frontend Application Logic
//  Handles authentication, dashboard, scraper, campaigns (Email/SMS),
//  API settings (Email + SMS), and audit logs with filters & CSV export.
//  Fully integrated with the Cloudflare Pages backend.
// ============================================================

(function() {
  'use strict';

  // ========== CONFIGURATION ==========
  const API_BASE = window.location.origin + '/api';
  const STORAGE_TOKEN = 'emailExtractorToken';
  const STORAGE_USER = 'emailExtractorUsername';

  // ========== DOM REFERENCES ==========
  // Login
  const loginPage = document.getElementById('loginPage');
  const dashboardPage = document.getElementById('dashboardPage');
  const loginForm = document.getElementById('loginForm');
  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const userBadge = document.getElementById('userBadge');
  const logoutBtn = document.getElementById('logoutBtn');

  // Tabs
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // Dashboard
  const statEmailsToday = document.getElementById('statEmailsToday');
  const statEmailsSent = document.getElementById('statEmailsSent');
  const statSmsSent = document.getElementById('statSmsSent');
  const statBrevoRemaining = document.getElementById('statBrevoRemaining');
  const statTotalContacts = document.getElementById('statTotalContacts');
  const recentActivities = document.getElementById('recentActivities');
  const analyticsChart = document.getElementById('analyticsChart');
  const brevoUsageBar = document.getElementById('brevoUsageBar');

  // Scraper
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
  const scraperLimit = document.getElementById('scraperLimit');
  const forceScrape = document.getElementById('forceScrape');

  // Campaign
  const campaignTypeToggle = document.getElementById('campaignTypeToggle');
  const campaignTypeLabel = document.getElementById('campaignTypeLabel');
  const campaignIcon = document.getElementById('campaignIcon');
  const campaignTitle = document.getElementById('campaignTitle');
  const emailFields = document.getElementById('emailFields');
  const smsFields = document.getElementById('smsFields');
  const campaignSubject = document.getElementById('campaignSubject');
  const campaignHtmlContent = document.getElementById('campaignHtmlContent');
  const campaignSmsContent = document.getElementById('campaignSmsContent');
  const campaignSmsSender = document.getElementById('campaignSmsSender');
  const smsCharCounter = document.getElementById('smsCharCounter');
  const smsSegmentCounter = document.getElementById('smsSegmentCounter');
  const smsCharProgress = document.getElementById('smsCharProgress');
  const campaignRecipients = document.getElementById('campaignRecipients');
  const sendCampaignBtn = document.getElementById('sendCampaignBtn');
  const sendBtnText = document.getElementById('sendBtnText');
  const campaignProgressContainer = document.getElementById('campaignProgressContainer');
  const campaignProgressBar = document.getElementById('campaignProgressBar');
  const campaignProgressText = document.getElementById('campaignProgressText');
  const campaignProgressLabel = document.getElementById('campaignProgressLabel');
  const campaignResults = document.getElementById('campaignResults');
  const campaignResultCount = document.getElementById('campaignResultCount');
  const campaignResultBadge = document.getElementById('campaignResultBadge');

  // API Settings - Email
  const emailProviderSelect = document.getElementById('emailProviderSelect');
  const brevoApiKey = document.getElementById('brevoApiKey');
  const brevoSenderEmail = document.getElementById('brevoSenderEmail');
  const saveBrevoApiBtn = document.getElementById('saveBrevoApiBtn');
  const brevoStats = document.getElementById('brevoStats');
  const brevoUsed = document.getElementById('brevoUsed');
  const brevoRemaining = document.getElementById('brevoRemaining');
  const brevoLimit = document.getElementById('brevoLimit');

  // API Settings - SMS
  const smsProviderSelect = document.getElementById('smsProviderSelect');
  const smsApiKey = document.getElementById('smsApiKey');
  const smsApiBaseUrl = document.getElementById('smsApiBaseUrl');
  const smsDefaultSender = document.getElementById('smsDefaultSender');
  const saveSmsApiBtn = document.getElementById('saveSmsApiBtn');
  const smsStats = document.getElementById('smsStats');
  const smsUsed = document.getElementById('smsUsed');
  const smsRemaining = document.getElementById('smsRemaining');
  const smsLimit = document.getElementById('smsLimit');

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
  let scraperData = [];
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

  // ========== SCRAPER ==========
  async function handleScrape() {
    const url = scraperUrl.value.trim();
    const mode = document.querySelector('input[name="scraperMode"]:checked').value;
    const limit = scraperLimit ? parseInt(scraperLimit.value, 10) : 50;
    const force = forceScrape ? forceScrape.checked : false;

    if (!url) { showError('Please enter a URL', scraperResults); return; }

    setLoading(scrapeBtn, true);
    scraperProgressContainer.classList.remove('hidden');
    scraperProgressBar.style.width = '0%';
    scraperProgressText.textContent = '0%';
    scraperProgressLabel.textContent = mode === 'emails' ? 'Extracting emails…' : 'Extracting phone numbers…';

    const endpoint = mode === 'emails' ? '/scrape/emails' : '/scrape/phones';
    const result = await apiCall(endpoint, 'POST', { url, limit, force });

    if (result.success) {
      scraperData = mode === 'emails' ? result.emails : result.phones;
      displayScraperResults(scraperData, mode);
      const count = mode === 'emails' ? result.emailCount : result.phoneCount;
      const cachedMsg = result.cached ? ' (Loaded from Cache)' : '';
      addActivity(mode === 'emails' ? '✉️ Emails extracted' : '📱 Phones extracted',
        `${count} items found${cachedMsg}`);
      const stats = await apiCall('/dashboard/stats');
      if (stats.success && stats.stats) {
        statEmailsToday.textContent = formatNum(stats.stats.emailsToday || 0);
      }
    } else {
      showError(result.error || 'Scraping failed', scraperResults);
    }

    scraperProgressContainer.classList.add('hidden');
    setLoading(scrapeBtn, false);
  }

  function displayScraperResults(data, mode) {
    if (!data || data.length === 0) {
      scraperResults.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">No data found</div>';
      scraperResultCount.textContent = '0 items found';
      return;
    }
    let html = '<div class="space-y-2">';
    const limit = Math.min(100, data.length);
    for (let i = 0; i < limit; i++) {
      const item = data[i];
      html += `
        <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all result-row">
          <span class="text-sm font-mono text-slate-700 flex-1 break-all">${item}</span>
          <button class="ml-2 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-all copy-btn" data-value="${item}">Copy</button>
        </div>
      `;
    }
    if (data.length > limit) html += `<div class="p-2 text-center text-sm text-blue-600 font-medium">… and ${data.length - limit} more</div>`;
    html += '</div>';
    scraperResults.innerHTML = html;
    scraperResultCount.textContent = `${data.length} items found`;
    scraperResults.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.value);
        btn.textContent = '✓ Copied';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
    });
  }

  // ========== CAMPAIGN TOGGLE ==========
  function updateCampaignUI() {
    const isSms = campaignTypeToggle.checked;
    if (isSms) {
      emailFields.classList.add('hidden');
      smsFields.classList.remove('hidden');
      campaignTypeLabel.textContent = '📱 SMS Campaign';
      campaignIcon.textContent = '📱';
      campaignTitle.textContent = 'SMS Campaign';
      sendBtnText.textContent = 'Send SMS';
      sendCampaignBtn.className = 'w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md flex items-center justify-center gap-2';
      document.querySelector('#campaignProgressBar').className = 'bg-purple-600 h-2.5 rounded-full progress-bar-fill';
    } else {
      emailFields.classList.remove('hidden');
      smsFields.classList.add('hidden');
      campaignTypeLabel.textContent = '✉️ Email Campaign';
      campaignIcon.textContent = '✉️';
      campaignTitle.textContent = 'Email Campaign';
      sendBtnText.textContent = 'Send Campaign';
      sendCampaignBtn.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md flex items-center justify-center gap-2';
      document.querySelector('#campaignProgressBar').className = 'bg-blue-600 h-2.5 rounded-full progress-bar-fill';
    }
    campaignResults.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">Switch mode to start a new campaign.</div>';
    campaignResultCount.textContent = '0 sent';
    campaignResultBadge.textContent = 'Ready';
    campaignResultBadge.className = 'text-xs bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full';
    campaignProgressContainer.classList.add('hidden');
  }

  // ========== SMS CHARACTER COUNTER ==========
  function updateSmsCounter() {
    const text = campaignSmsContent.value || '';
    const len = text.length;
    const maxPerSms = 160;
    const segments = len <= maxPerSms ? 1 : Math.ceil(len / 153);
    const pct = Math.min(100, (len / (maxPerSms * 3)) * 100);

    smsCharCounter.textContent = `${len} / ${maxPerSms} characters`;
    smsSegmentCounter.textContent = `${segments} segment${segments > 1 ? 's' : ''}`;

    smsCharCounter.className = 'sms-counter';
    if (len > maxPerSms * 2) smsCharCounter.classList.add('danger');
    else if (len > maxPerSms) smsCharCounter.classList.add('warning');
    else smsCharCounter.classList.add('safe');

    smsCharProgress.style.width = Math.min(100, pct) + '%';
    if (pct > 80) smsCharProgress.className = 'char-progress-fill bg-red-500';
    else if (pct > 50) smsCharProgress.className = 'char-progress-fill bg-amber-500';
    else smsCharProgress.className = 'char-progress-fill bg-emerald-500';
  }

  // ========== CAMPAIGN SEND ==========
  async function handleSendCampaign() {
    const isSms = campaignTypeToggle.checked;
    const recipientFilter = campaignRecipients.value;

    if (!recipientFilter) {
      showError('Select a recipient group', campaignResults);
      return;
    }

    let payload = { recipientFilter };

    if (isSms) {
      const message = campaignSmsContent.value.trim();
      const sender = campaignSmsSender.value.trim() || 'Marketing';
      if (!message) {
        showError('SMS message is required', campaignResults);
        return;
      }
      payload.type = 'sms';
      payload.message = message;
      payload.sender = sender;
    } else {
      const subject = campaignSubject.value.trim();
      const htmlContent = campaignHtmlContent.value.trim();
      if (!subject || !htmlContent) {
        showError('Subject and HTML content are required', campaignResults);
        return;
      }
      payload.type = 'email';
      payload.subject = subject;
      payload.htmlContent = htmlContent;
    }

    setLoading(sendCampaignBtn, true);
    campaignProgressContainer.classList.remove('hidden');
    campaignProgressBar.style.width = '0%';
    campaignProgressText.textContent = '0%';
    campaignProgressLabel.textContent = isSms ? 'Sending SMS…' : 'Sending emails…';
    campaignResultBadge.textContent = 'Sending…';
    campaignResultBadge.className = 'text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full';

    const result = await apiCall('/campaigns/send', 'POST', payload);

    if (result.success) {
      campaignResults.innerHTML = '<div class="space-y-2"></div>';
      const container = campaignResults.querySelector('div');
      let successCount = 0;
      for (const r of result.results) {
        const statusColor = r.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
        const icon = r.success ? '✅' : '❌';
        const text = r.success ? 'Sent' : 'Failed';
        if (r.success) successCount++;
        container.insertAdjacentHTML('beforeend', `
          <div class="p-2.5 ${statusColor} rounded-lg border fade-in">
            <div class="flex justify-between items-center">
              <span class="text-sm font-mono">${r.email || r.phone || 'N/A'}</span>
              <span class="text-xs font-medium">${icon} ${text}</span>
            </div>
          </div>
        `);
      }
      campaignResultCount.textContent = `${successCount}/${result.total} ${isSms ? 'SMS' : 'emails'} sent`;
      campaignResultBadge.textContent = '✅ Done';
      campaignResultBadge.className = 'text-xs bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full';
      addActivity(isSms ? '📱 SMS campaign' : '📧 Email campaign', `${successCount} sent successfully`);

      const stats = await apiCall('/dashboard/stats');
      if (stats.success && stats.stats) {
        statEmailsSent.textContent = formatNum(stats.stats.emailsSentToday || 0);
        statSmsSent.textContent = formatNum(stats.stats.smsSentToday || 0);
        statBrevoRemaining.textContent = formatNum(stats.stats.brevoRemaining || 0);
      }
    } else {
      showError(result.error || 'Campaign failed', campaignResults);
      campaignResultBadge.textContent = '❌ Failed';
      campaignResultBadge.className = 'text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full';
    }

    setLoading(sendCampaignBtn, false);
    setTimeout(() => {
      campaignProgressContainer.classList.add('hidden');
    }, 2000);
  }

  // ========== API SETTINGS ==========
  async function loadApiStats() {
    // Email (Brevo)
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
    // SMS
    const sms = await apiCall('/api-keys/stats?apiName=sms');
    if (sms.success && sms.data) {
      smsUsed.textContent = formatNum(sms.data.used);
      smsRemaining.textContent = formatNum(sms.data.remaining);
      smsLimit.textContent = formatNum(sms.data.limit);
      smsStats.classList.remove('hidden');
    }
  }

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

  scrapeBtn.addEventListener('click', handleScrape);
  exportScraperBtn.addEventListener('click', () => {
    if (!scraperData.length) { showError('No data to export', scraperResults); return; }
    downloadFile(scraperData.join('\n'), 'extracted_data.txt');
  });
  clearScraperBtn.addEventListener('click', () => {
    scraperData = [];
    scraperUrl.value = '';
    scraperResults.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">No data</div>';
    scraperResultCount.textContent = '0 items found';
  });

  campaignTypeToggle.addEventListener('change', updateCampaignUI);
  campaignSmsContent.addEventListener('input', updateSmsCounter);
  sendCampaignBtn.addEventListener('click', handleSendCampaign);

  saveBrevoApiBtn.addEventListener('click', handleSaveBrevo);
  saveSmsApiBtn.addEventListener('click', handleSaveSms);

  refreshAuditLogsBtn.addEventListener('click', loadAuditLogs);
  applyAuditFiltersBtn.addEventListener('click', applyFilters);
  resetAuditFiltersBtn.addEventListener('click', () => {
    auditDateFilter.value = new Date().toISOString().split('T')[0];
    auditActionFilter.value = 'all';
    auditSearchFilter.value = '';
    loadAuditLogs();
  });
  exportAuditCsvBtn.addEventListener('click', exportAuditCsv);

  // Email editor toolbar commands
  document.querySelectorAll('.email-editor-toolbar button').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      const textarea = campaignHtmlContent;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.substring(start, end);
      let replacement = '';
      switch (cmd) {
        case 'bold': replacement = `<strong>${selected}</strong>`; break;
        case 'italic': replacement = `<em>${selected}</em>`; break;
        case 'underline': replacement = `<u>${selected}</u>`; break;
        case 'h1': replacement = `<h1>${selected}</h1>`; break;
        case 'h2': replacement = `<h2>${selected}</h2>`; break;
        case 'link': {
          const url = prompt('Enter URL:', 'https://');
          if (url) replacement = `<a href="${url}">${selected || url}</a>`;
          else return;
          break;
        }
        case 'ul': replacement = `<ul>\n  <li>${selected.split('\n').filter(s => s.trim()).join('</li>\n  <li>')}</li>\n</ul>`; break;
        case 'ol': replacement = `<ol>\n  <li>${selected.split('\n').filter(s => s.trim()).join('</li>\n  <li>')}</li>\n</ol>`; break;
        default: return;
      }
      textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
      textarea.focus();
      textarea.selectionStart = start;
      textarea.selectionEnd = start + replacement.length;
    });
  });






// ========== BULK TEXT EXTRACTOR LOGIC ==========
const rawTextInput = document.getElementById('rawTextInput');
const extractTextBtn = document.getElementById('extractTextBtn');
const extractResults = document.getElementById('extractResults');
const extEmailCount = document.getElementById('extEmailCount');
const extPhoneCount = document.getElementById('extPhoneCount');

if (extractTextBtn && rawTextInput) {
    extractTextBtn.addEventListener('click', () => {
        const text = rawTextInput.value;
        
        if (!text.trim()) {
            alert('অনুগ্রহ করে আগে কিছু টেক্সট পেস্ট করুন!');
            return;
        }

        // ইমেইল খুঁজে বের করার Regex
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
        
        // মোবাইল নাম্বার খুঁজে বের করার Regex (বাংলাদেশের এবং আন্তর্জাতিক নাম্বারের জন্য)
        // এটি যেকোনো ১০ থেকে ১৫ ডিজিটের নাম্বার খুঁজে বের করবে
        const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/g;

        // টেক্সট থেকে ম্যাচগুলো বের করা
        const foundEmails = text.match(emailRegex) || [];
        let foundPhonesRaw = text.match(phoneRegex) || [];

        // ফোন নাম্বারগুলো থেকে অপ্রয়োজনীয় স্পেস বা চিহ্ন মুছে শুধু নাম্বার রাখা
        const foundPhones = foundPhonesRaw
            .map(phone => phone.replace(/[^\d+]/g, '')) // শুধু ডিজিট এবং + চিহ্ন রাখা
            .filter(phone => phone.length >= 10); // কমপক্ষে ১০ ডিজিট হতে হবে

        // ডুপ্লিকেট (একই ইমেইল/নাম্বার বারবার থাকলে) রিমুভ করা
        const uniqueEmails = [...new Set(foundEmails)];
        const uniquePhones = [...new Set(foundPhones)];

        // রেজাল্ট UI-তে দেখানো
        extEmailCount.textContent = uniqueEmails.length;
        extPhoneCount.textContent = uniquePhones.length;
        extractResults.classList.remove('hidden');

        // আপনার বর্তমান ক্যাম্পেইন সিস্টেমে যুক্ত করার জন্য গ্লোবাল ভেরিয়েবল বা ফাংশন কল করতে পারেন
        // উদাহরণস্বরূপ: (আপনার প্রজেক্টের লজিক অনুযায়ী এটি কাস্টমাইজ করতে হবে)
        console.log("প্রস্তুতকৃত ইমেইলস:", uniqueEmails);
        console.log("প্রস্তুতকৃত মোবাইল নাম্বার:", uniquePhones);
        
        // alert(`সফলভাবে ${uniqueEmails.length} টি ইমেইল এবং ${uniquePhones.length} টি নাম্বার পাওয়া গেছে!`);
    });
}
  




  
  // ========== INITIALIZATION ==========
  function init() {
    auditDateFilter.value = new Date().toISOString().split('T')[0];
    updateSmsCounter();
    updateCampaignUI();

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
