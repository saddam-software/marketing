// public/location-contact-search/script.js
/**
 * Location-Based Contact Search Module
 * Production-ready, accessible, and maintainable.
 * Supports division → district → thana hierarchy.
 */
(function() {
  'use strict';

  // ========== DOM REFS ==========
  const form = document.getElementById('locationSearchForm');
  const divisionSelect = document.getElementById('divisionSelect');
  const districtSelect = document.getElementById('districtSelect');
  const thanaSelect = document.getElementById('thanaSelect');
  const entityTypeSelect = document.getElementById('entityTypeSelect');
  const searchBtn = document.getElementById('searchLocationBtn');
  const statusDiv = document.getElementById('locationSearchStatus');
  const resultBody = document.getElementById('locationResultBody');
  const resultCount = document.getElementById('locationResultCount');
  const resultMeta = document.getElementById('locationResultMeta');
  const lastUpdated = document.getElementById('locationLastUpdated');
  const exportBtn = document.getElementById('exportLocationCsv');
  const refreshBtn = document.getElementById('refreshLocationResults');

  // ========== STATE ==========
  let currentContacts = [];
  let currentDivision = '';
  let currentDistrict = '';
  let currentThana = '';
  // Load token once
  const token = localStorage.getItem('emailExtractorToken');

  // ========== HELPERS ==========
  function showStatus(msg, type = 'info') {
    statusDiv.textContent = msg;
    statusDiv.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700', 'bg-blue-50', 'text-blue-700', 'bg-amber-50', 'text-amber-700');
    const map = {
      success: 'bg-green-50 text-green-700',
      error: 'bg-red-50 text-red-700',
      info: 'bg-blue-50 text-blue-700',
      warning: 'bg-amber-50 text-amber-700',
    };
    statusDiv.classList.add(map[type] || map.info);
    // Auto-hide after 6s
    clearTimeout(window._statusTimer);
    window._statusTimer = setTimeout(() => {
      statusDiv.classList.add('hidden');
    }, 6000);
  }

  function setLoading(loading) {
    searchBtn.disabled = loading;
    if (loading) {
      searchBtn.innerHTML = `
        <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Searching...
      `;
    } else {
      searchBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        Search Contacts
      `;
    }
  }

  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function formatTimestamp(date) {
    return date.toLocaleString('en-BD', { hour12: false });
  }

  // ========== API CALLS ==========
  async function fetchAPI(endpoint) {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  }

  // ========== LOAD LOCATION DATA ==========
  async function loadDivisions() {
    try {
      const data = await fetchAPI('/api/finder-api/location-secret?action=getDivisions');
      if (data.success && data.divisions) {
        populateSelect(divisionSelect, data.divisions, '— Select Division —');
        // Reset dependents
        districtSelect.disabled = true;
        thanaSelect.disabled = true;
        populateSelect(districtSelect, [], '— Select District —');
        populateSelect(thanaSelect, [], '— Select Thana —');
      } else {
        showStatus('Failed to load divisions', 'error');
      }
    } catch (err) {
      showStatus('Error loading divisions: ' + err.message, 'error');
    }
  }

  async function loadDistricts(division) {
    if (!division) {
      districtSelect.disabled = true;
      thanaSelect.disabled = true;
      populateSelect(districtSelect, [], '— Select District —');
      populateSelect(thanaSelect, [], '— Select Thana —');
      return;
    }
    try {
      const data = await fetchAPI(`/api/finder-api/location-secret?action=getDistricts&division=${encodeURIComponent(division)}`);
      if (data.success && data.districts) {
        districtSelect.disabled = false;
        populateSelect(districtSelect, data.districts, '— Select District —');
        thanaSelect.disabled = true;
        populateSelect(thanaSelect, [], '— Select Thana —');
      } else {
        showStatus('No districts found for this division', 'warning');
      }
    } catch (err) {
      showStatus('Error loading districts: ' + err.message, 'error');
    }
  }

  async function loadThanas(district) {
    if (!district) {
      thanaSelect.disabled = true;
      populateSelect(thanaSelect, [], '— Select Thana —');
      return;
    }
    try {
      const data = await fetchAPI(`/api/finder-api/location-secret?action=getThanas&district=${encodeURIComponent(district)}`);
      if (data.success && data.thanas) {
        thanaSelect.disabled = false;
        populateSelect(thanaSelect, data.thanas, '— Select Thana —');
      } else {
        showStatus('No thanas found for this district', 'warning');
      }
    } catch (err) {
      showStatus('Error loading thanas: ' + err.message, 'error');
    }
  }

  // ========== POPULATE SELECT ==========
  function populateSelect(selectElement, options, defaultLabel) {
    selectElement.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = defaultLabel || '— Select —';
    selectElement.appendChild(defaultOpt);
    if (Array.isArray(options)) {
      options.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt;
        el.textContent = opt;
        selectElement.appendChild(el);
      });
    }
  }

  // ========== SEARCH ==========
  async function performSearch() {
    const division = divisionSelect.value;
    const district = districtSelect.value;
    const thana = thanaSelect.value;
    const entityType = entityTypeSelect.value;

    if (!division || !district || !thana) {
      showStatus('Please select division, district, and thana.', 'warning');
      return;
    }

    setLoading(true);
    showStatus('Searching...', 'info');

    try {
      // Build query
      const params = new URLSearchParams({
        action: 'search',
        division,
        district,
        thana,
        entityType: entityType || 'all'
      });
      const data = await fetchAPI(`/api/finder-api/location-secret?${params.toString()}`);
      if (data.success) {
        currentContacts = data.contacts || [];
        currentDivision = division;
        currentDistrict = district;
        currentThana = thana;
        displayResults(currentContacts);
        exportBtn.disabled = false;
        showStatus(`Found ${currentContacts.length} contacts`, 'success');
        lastUpdated.textContent = `Last updated: ${formatTimestamp(new Date())}`;
      } else {
        showStatus(data.error || 'Search failed', 'error');
        currentContacts = [];
        displayResults([]);
        exportBtn.disabled = true;
      }
    } catch (err) {
      showStatus('Error: ' + err.message, 'error');
      currentContacts = [];
      displayResults([]);
      exportBtn.disabled = true;
    } finally {
      setLoading(false);
    }
  }

  // ========== DISPLAY RESULTS ==========
  function displayResults(contacts) {
    if (!contacts || contacts.length === 0) {
      resultBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-10 text-sm">No contacts found</td></tr>`;
      resultCount.textContent = '0';
      resultMeta.textContent = '—';
      return;
    }

    let html = '';
    contacts.forEach(c => {
      const name = c.name || 'N/A';
      const email = c.email || '';
      const phone = c.phone || '';
      const thana = c.thana || '';
      html += `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="px-4 py-3 font-medium text-slate-800 text-sm">${name}</td>
          <td class="px-4 py-3 text-sm text-blue-600">
            ${email ? `<a href="mailto:${email}" class="hover:underline">${email}</a>` : '—'}
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${phone || '—'}</td>
          <td class="px-4 py-3 text-xs text-slate-500">${thana}</td>
        </tr>
      `;
    });
    resultBody.innerHTML = html;
    resultCount.textContent = contacts.length;
    const first = contacts[0] || {};
    resultMeta.textContent = `Showing ${contacts.length} contacts from ${first.district || currentDistrict} - ${first.thana || currentThana}`;
  }

  // ========== EXPORT CSV ==========
  function exportCSV() {
    if (!currentContacts || currentContacts.length === 0) {
      showStatus('No data to export', 'warning');
      return;
    }
    const headers = ['Name', 'Email', 'Phone', 'District', 'Thana', 'EntityType'];
    let csv = headers.join(',') + '\n';
    currentContacts.forEach(c => {
      const row = [
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        `"${(c.district || '').replace(/"/g, '""')}"`,
        `"${(c.thana || '').replace(/"/g, '""')}"`,
        `"${(c.entityType || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });
    const filename = `contacts_${currentDistrict}_${currentThana}_${new Date().toISOString().slice(0,10)}.csv`;
    downloadCSV(csv, filename);
    showStatus('CSV exported successfully', 'success');
  }

  // ========== EVENT BINDINGS ==========

  // Division change → load districts
  divisionSelect.addEventListener('change', function() {
    const division = this.value;
    currentDivision = division;
    loadDistricts(division);
    // Reset thana
    thanaSelect.disabled = true;
    populateSelect(thanaSelect, [], '— Select Thana —');
    // Clear results
    currentContacts = [];
    displayResults([]);
    exportBtn.disabled = true;
  });

  // District change → load thanas
  districtSelect.addEventListener('change', function() {
    const district = this.value;
    currentDistrict = district;
    loadThanas(district);
    // Clear results
    currentContacts = [];
    displayResults([]);
    exportBtn.disabled = true;
  });

  // Thana change → clear results (optional, but user expects to search after selection)
  thanaSelect.addEventListener('change', function() {
    // Optionally clear results to indicate new search needed
    if (this.value) {
      // We don't auto-search; user must click search
    }
  });

  // Form submit
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    performSearch();
  });

  // Refresh button
  refreshBtn.addEventListener('click', function() {
    if (divisionSelect.value && districtSelect.value && thanaSelect.value) {
      performSearch();
    } else {
      showStatus('Please select division, district, and thana first.', 'warning');
    }
  });

  // Export button
  exportBtn.addEventListener('click', exportCSV);

  // ========== INIT ==========
  async function init() {
    // Load divisions on start
    await loadDivisions();
    // Set default entity type (optional)
    entityTypeSelect.value = 'all';
    lastUpdated.textContent = `Ready`;
    showStatus('Select division, district & thana to search', 'info');
  }

  init();

  // Expose for debugging (optional)
  window.__locationSearch = {
    refresh: performSearch,
    export: exportCSV,
    loadDivisions,
    loadDistricts,
    loadThanas
  };

})();
