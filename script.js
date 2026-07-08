// script.js
// ============================================================
//  Email Extractor Pro - Frontend Application Logic
//  Handles authentication, dashboard, scraper, campaigns,
//  API settings, and audit logs.
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
  const statBrevoRemaining = document.getElementById('statBrevoRemaining');
  const statTotalContacts = document.getElementById('statTotalContacts');
  const recentActivities = document.getElementById('recentActivities');
  const analyticsChart = document.getElementById('analyticsChart');

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

  // Campaign
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

  // API Settings
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

  // Audit Logs
  const auditLogsList = document.getElementById('auditLogsList');
  const auditLogsCount = document.getElementById('auditLogsCount');
  const refreshAuditLogsBtn = document.getElementById('refreshAuditLogsBtn');

  // ========== STATE ==========
  let authToken = localStorage.getItem(STORAGE_TOKEN);
  let currentUser = localStorage.getItem(STORAGE_USER);
  let scraperData = [];
  let chartInstance = null;

  // ========== HELPERS ==========

  /**
   * Display an error message in a given element.
   */
  function showError(message, element = loginError) {
    element.textContent = message;
    element.classList.remove('hidden');
    console.error('[Error]', message);
  }

  /**
   * Hide an error message element.
   */
  function hideError(element = loginError) {
    element.classList.add('hidden');
  }

  /**
   * Set loading state on a button (show spinner, disable).
   */
  function setLoading(button, isLoading) {
    if (!button) return;
    if (isLoading) {
      button.disabled = true;
      const originalHtml = button.innerHTML;
      button.innerHTML = '<div class="spinner"></div>';
      button.dataset.originalHtml = originalHtml;
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
      }
    }
  }

  /**
   * Format a number with comma separators.
   */
  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Trigger a file download.
   */
  function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generic API call with automatic token handling and error parsing.
   */
  async function apiCall(endpoint, method = 'GET', body = null, requiresAuth = true) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (requiresAuth && authToken) {
      options.headers.Authorization = `Bearer ${authToken}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, options);

      // If unauthorized, clear session
      if (response.status === 401) {
        await logout();
        return { success: false, error: 'Session expired. Please login again.' };
      }

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Request failed' };
      }

      return data;
    } catch (error) {
      console.error('[API Error]', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }

  /**
   * Add an activity entry to the recent activities list.
   */
  function addActivity(action, details = '') {
    const timestamp = new Date().toLocaleTimeString();
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

    // Keep only the latest 10 activities
    const children = recentActivities.querySelectorAll('> div');
    if (children.length > 10) {
      children[children.length - 1].remove();
    }
  }

  // ========== AUTHENTICATION ==========

  /**
   * Handle login form submission.
   */
  async function handleLogin(event) {
    event.preventDefault();
    hideError();

    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();

    if (!username || !password) {
      showError('Username and password are required.');
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
      await loadDashboardData();
    } else {
      showError(result.error || 'Login failed.');
    }
  }

  /**
   * Log out the current user.
   */
  async function logout() {
    // Notify server (optional)
    await apiCall('/auth/logout', 'POST');

    authToken = null;
    currentUser = null;
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);

    showLoginPage();
  }

  /**
   * Show the login page and hide dashboard.
   */
  function showLoginPage() {
    loginPage.classList.remove('hidden');
    dashboardPage.classList.add('hidden');
  }

  /**
   * Show the dashboard and hide login.
   */
  function showDashboard() {
    loginPage.classList.add('hidden');
    dashboardPage.classList.remove('hidden');
    userBadge.textContent = `👤 ${currentUser}`;
  }

  // ========== TAB NAVIGATION ==========

  /**
   * Switch to a specific tab.
   */
  function switchTab(tabName) {
    // Hide all tabs
    tabContents.forEach(tab => tab.classList.add('hidden'));
    // Remove active class from buttons
    tabButtons.forEach(btn => btn.classList.remove('active'));

    // Show selected tab
    const targetTab = document.getElementById(`${tabName}Tab`);
    if (targetTab) targetTab.classList.remove('hidden');

    // Activate button
    const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetBtn) targetBtn.classList.add('active');

    // Load data on demand
    if (tabName === 'dashboard') loadDashboardData();
    else if (tabName === 'audit-logs') loadAuditLogs();
    else if (tabName === 'api-settings') loadApiStats();
  }

  // ========== DASHBOARD ==========

  /**
   * Load all dashboard data: stats, chart, and recent activities.
   */
  async function loadDashboardData() {
    // Load API stats (for Brevo remaining)
    await loadApiStats();

    // Load statistics
    const statsResult = await apiCall('/dashboard/stats');
    if (statsResult.success && statsResult.stats) {
      const stats = statsResult.stats;
      statEmailsToday.textContent = formatNumber(stats.emailsToday || 0);
      statEmailsSent.textContent = formatNumber(stats.emailsSentToday || 0);
      statBrevoRemaining.textContent = formatNumber(stats.brevoRemaining || 0);
      statTotalContacts.textContent = formatNumber(stats.totalContacts || 0);
    }

    // Load chart data
    const chartResult = await apiCall('/dashboard/charts');
    if (chartResult.success && chartResult.data) {
      initChart(chartResult.data);
    } else {
      initChart([]);
    }

    // Load recent activities from audit logs (latest 5)
    const today = new Date().toISOString().split('T')[0];
    const auditResult = await apiCall(`/audit-logs?date=${today}&limit=5`);
    if (auditResult.success && auditResult.events) {
      // Clear existing activities
      recentActivities.innerHTML = '';
      // Add each as an activity
      const events = auditResult.events.slice(0, 5);
      for (const ev of events) {
        const action = ev.action.replace(/_/g, ' ').toLowerCase();
        const details = ev.details ? JSON.stringify(ev.details) : '';
        addActivity(action, details);
      }
    }
  }

  /**
   * Initialize or update the Chart.js line chart.
   */
  function initChart(data) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    const ctx = analyticsChart.getContext('2d');

    // Prepare labels and datasets
    const labels = data.length ? data.map(d => d.date.slice(5)) : ['No Data'];
    const extracted = data.length ? data.map(d => d.extracted) : [0];
    const sent = data.length ? data.map(d => d.sent) : [0];

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Extracted Emails',
            data: extracted,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
          {
            label: 'Sent Emails',
            data: sent,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
          },
        ],
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

  // ========== SCRAPER ==========

  /**
   * Handle scraping request.
   */
  async function handleScrape() {
    const url = scraperUrl.value.trim();
    const mode = document.querySelector('input[name="scraperMode"]:checked').value;

    if (!url) {
      showError('Please enter a valid URL.', scraperResults);
      return;
    }

    setLoading(scrapeBtn, true);
    scraperProgressContainer.classList.remove('hidden');
    scraperProgressBar.style.width = '0%';
    scraperProgressText.textContent = '0%';
    scraperProgressLabel.textContent = mode === 'emails' ? 'Extracting emails…' : 'Extracting phone numbers…';

    const endpoint = mode === 'emails' ? '/scrape/emails' : '/scrape/phones';
    const result = await apiCall(endpoint, 'POST', { url });

    if (result.success) {
      scraperData = mode === 'emails' ? result.emails : result.phones;
      displayScraperResults(scraperData, mode);

      const count = mode === 'emails' ? result.emailCount : result.phoneCount;
      addActivity(
        mode === 'emails' ? '✉️ Emails extracted' : '📱 Phone numbers extracted',
        `${count} items found from ${result.url}`
      );

      // Refresh dashboard stats
      const stats = await apiCall('/dashboard/stats');
      if (stats.success && stats.stats) {
        statEmailsToday.textContent = formatNumber(stats.stats.emailsToday || 0);
      }
    } else {
      showError(result.error || 'Scraping failed.', scraperResults);
    }

    scraperProgressContainer.classList.add('hidden');
    setLoading(scrapeBtn, false);
  }

  /**
   * Display scraped results in the results panel.
   */
  function displayScraperResults(data, mode) {
    if (!data || data.length === 0) {
      scraperResults.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">No data found.</div>';
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
    if (data.length > limit) {
      html += `<div class="p-2 text-center text-sm text-blue-600 font-medium">… and ${data.length - limit} more</div>`;
    }
    html += '</div>';

    scraperResults.innerHTML = html;
    scraperResultCount.textContent = `${data.length} items found`;

    // Add copy functionality
    scraperResults.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.value;
        navigator.clipboard.writeText(value).then(() => {
          btn.textContent = '✓ Copied';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        }).catch(() => {
          // Fallback
          const input = document.createElement('input');
          input.value = value;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
          btn.textContent = '✓ Copied';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
      });
    });
  }

  // ========== EMAIL CAMPAIGN ==========

  /**
   * Send an email campaign.
   */
  async function handleSendCampaign() {
    const subject = campaignSubject.value.trim();
    const htmlContent = campaignHtmlContent.value.trim();
    const recipientFilter = campaignRecipients.value;

    if (!subject || !htmlContent) {
      showError('Subject and HTML content are required.');
      return;
    }
    if (!recipientFilter) {
      showError('Please select a recipient group.');
      return;
    }

    setLoading(sendCampaignBtn, true);
    campaignProgressContainer.classList.remove('hidden');
    campaignProgressBar.style.width = '0%';
    campaignProgressText.textContent = '0%';
    campaignProgressLabel.textContent = 'Sending emails…';

    const result = await apiCall('/campaigns/send', 'POST', {
      subject,
      htmlContent,
      recipientFilter,
    });

    if (result.success) {
      // Show results
      campaignResults.innerHTML = '<div class="space-y-2"></div>';
      const container = campaignResults.querySelector('div');
      let sentCount = 0;

      for (const r of result.results) {
        const statusColor = r.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
        const icon = r.success ? '✅' : '❌';
        const statusText = r.success ? 'Sent' : 'Failed';
        if (r.success) sentCount++;

        container.insertAdjacentHTML('beforeend', `
          <div class="p-2.5 ${statusColor} rounded-lg border">
            <div class="flex justify-between items-center">
              <span class="text-sm font-mono">${r.email}</span>
              <span class="text-xs font-medium">${icon} ${statusText}</span>
            </div>
          </div>
        `);
      }

      campaignResultCount.textContent = `${sentCount}/${result.total} emails sent`;
      addActivity('📧 Email campaign sent', `${sentCount} successful`);

      // Update stats
      const stats = await apiCall('/dashboard/stats');
      if (stats.success && stats.stats) {
        statEmailsSent.textContent = formatNumber(stats.stats.emailsSentToday || 0);
        statBrevoRemaining.textContent = formatNumber(stats.stats.brevoRemaining || 0);
      }
    } else {
      showError(result.error || 'Campaign failed.');
    }

    setLoading(sendCampaignBtn, false);
    setTimeout(() => {
      campaignProgressContainer.classList.add('hidden');
    }, 2000);
  }

  // ========== API SETTINGS ==========

  /**
   * Load API usage statistics for both Abstract and Brevo.
   */
  async function loadApiStats() {
    // Abstract
    const absResult = await apiCall('/api-keys/stats?apiName=abstract');
    if (absResult.success && absResult.data) {
      const stats = absResult.data;
      abstractUsed.textContent = formatNumber(stats.used);
      abstractRemaining.textContent = formatNumber(stats.remaining);
      abstractLimit.textContent = formatNumber(stats.limit);
      abstractStats.classList.remove('hidden');
    }

    // Brevo
    const brResult = await apiCall('/api-keys/stats?apiName=brevo');
    if (brResult.success && brResult.data) {
      const stats = brResult.data;
      brevoUsed.textContent = formatNumber(stats.used);
      brevoRemaining.textContent = formatNumber(stats.remaining);
      brevoLimit.textContent = formatNumber(stats.limit);
      brevoStats.classList.remove('hidden');
      // Update dashboard stat
      statBrevoRemaining.textContent = formatNumber(stats.remaining);
    }
  }

  /**
   * Save Abstract API key.
   */
  async function handleSaveAbstract() {
    const key = abstractApiKey.value.trim();
    if (!key) {
      showError('API key is required.');
      return;
    }

    setLoading(saveAbstractApiBtn, true);
    const result = await apiCall('/api-keys/save', 'POST', {
      apiName: 'abstract',
      apiKey: key,
    });
    setLoading(saveAbstractApiBtn, false);

    if (result.success) {
      abstractApiKey.value = '';
      addActivity('🔑 Abstract API key saved', '');
      alert('API key saved successfully.');
      await loadApiStats();
    } else {
      showError(result.error || 'Failed to save API key.');
    }
  }

  /**
   * Save Brevo API key and sender email.
   */
  async function handleSaveBrevo() {
    const key = brevoApiKey.value.trim();
    const sender = brevoSenderEmail.value.trim();

    if (!key || !sender) {
      showError('Both API key and sender email are required.');
      return;
    }

    setLoading(saveBrevoApiBtn, true);
    const result = await apiCall('/api-keys/save', 'POST', {
      apiName: 'brevo',
      apiKey: key,
    });
    setLoading(saveBrevoApiBtn, false);

    if (result.success) {
      brevoApiKey.value = '';
      brevoSenderEmail.value = '';
      addActivity('🔑 Brevo API key saved', '');
      alert('API key saved successfully.');
      await loadApiStats();
    } else {
      showError(result.error || 'Failed to save API key.');
    }
  }

  // ========== AUDIT LOGS ==========

  /**
   * Load audit logs for today.
   */
  async function loadAuditLogs() {
    const today = new Date().toISOString().split('T')[0];
    const result = await apiCall(`/audit-logs?date=${today}&limit=100`);

    if (result.success && result.events) {
      displayAuditLogs(result.events);
      auditLogsCount.textContent = `${result.totalEvents} events`;
    } else {
      auditLogsList.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">No logs available.</div>';
      auditLogsCount.textContent = '0 events';
    }
  }

  /**
   * Render audit logs in the UI.
   */
  function displayAuditLogs(events) {
    if (!events || events.length === 0) {
      auditLogsList.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">No logs found.</div>';
      return;
    }

    let html = '<div class="space-y-2">';
    // Show latest first
    const sorted = [...events].reverse();
    for (const ev of sorted) {
      const timestamp = new Date(ev.timestamp).toLocaleTimeString();
      const icon = getActionIcon(ev.action);
      const user = ev.username || 'system';
      html += `
        <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition-all">
          <div class="flex justify-between items-start gap-2">
            <div class="flex-1">
              <p class="text-sm font-semibold text-slate-800">${icon} ${ev.action}</p>
              <p class="text-xs text-slate-600">User: ${user}</p>
            </div>
            <p class="text-xs text-slate-400 whitespace-nowrap">${timestamp}</p>
          </div>
        </div>
      `;
    }
    html += '</div>';
    auditLogsList.innerHTML = html;
  }

  /**
   * Get an emoji icon for an action type.
   */
  function getActionIcon(action) {
    const icons = {
      'LOGIN_SUCCESS': '🔓',
      'LOGIN_FAILED': '❌',
      'LOGOUT': '🔒',
      'API_KEY_UPDATED': '🔑',
      'SCRAPE_EMAILS': '✉️',
      'SCRAPE_PHONES': '📱',
      'SEND_EMAILS': '📧',
      'SCRAPE_ERROR': '⚠️',
      'CONTACTS_IMPORT': '📥',
    };
    return icons[action] || '📋';
  }

  // ========== EVENT BINDINGS ==========

  // Login
  loginForm.addEventListener('submit', handleLogin);

  // Logout
  logoutBtn.addEventListener('click', logout);

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Scraper
  scrapeBtn.addEventListener('click', handleScrape);
  exportScraperBtn.addEventListener('click', () => {
    if (!scraperData || scraperData.length === 0) {
      showError('No data to export.', scraperResults);
      return;
    }
    downloadFile(scraperData.join('\n'), 'extracted_data.txt');
  });
  clearScraperBtn.addEventListener('click', () => {
    scraperData = [];
    scraperUrl.value = '';
    scraperResults.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">No data.</div>';
    scraperResultCount.textContent = '0 items found';
  });

  // Campaign
  sendCampaignBtn.addEventListener('click', handleSendCampaign);

  // API Settings
  saveAbstractApiBtn.addEventListener('click', handleSaveAbstract);
  saveBrevoApiBtn.addEventListener('click', handleSaveBrevo);

  // Audit Logs
  refreshAuditLogsBtn.addEventListener('click', loadAuditLogs);

  // ========== INITIALIZATION ==========

  /**
   * Initialize the application.
   */
  function init() {
    if (authToken && currentUser) {
      showDashboard();
      loadDashboardData();
    } else {
      showLoginPage();
    }
    console.log('✅ Email Extractor Pro v3.0 initialized');
  }

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', init);

  // Expose for debugging
  window.__debug = {
    logout,
    loadDashboardData,
    loadAuditLogs,
    loadApiStats,
    apiCall,
  };

})();
