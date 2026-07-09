// public/location-contact-search/script.js
(function() {
  'use strict';

  // Get auth token from localStorage (set by main script.js)
  function getAuthToken() {
    return localStorage.getItem('emailExtractorToken') || null;
  }

  // DOM refs
  const districtSelect = document.getElementById('districtSelect');
  const thanaSelect = document.getElementById('thanaSelect');
  const searchBtn = document.getElementById('searchLocationBtn');
  const statusDiv = document.getElementById('locationSearchStatus');
  const resultBody = document.getElementById('locationResultBody');
  const resultCount = document.getElementById('locationResultCount');
  const resultMeta = document.getElementById('locationResultMeta');
  const exportCsvBtn = document.getElementById('exportLocationCsv');

  // State
  let currentContacts = [];

  // ========== API call helper ==========
  async function apiCall(endpoint, params = {}) {
    const token = getAuthToken();
    const queryStr = new URLSearchParams(params).toString();
    const url = `/api/finder-api/${endpoint}${queryStr ? '?' + queryStr : ''}`;
    
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (res.status === 404) {
        showStatus('❌ API endpoint not found. Check server setup.', 'error');
        console.error('404 from:', url);
        return null;
      }
      
      if (res.status === 401) {
        showStatus('❌ Not authenticated. Please login.', 'error');
        return null;
      }
      
      const data = await res.json();
      return data;
    } catch (err) {
      showStatus('❌ Network error: ' + err.message, 'error');
      console.error('Fetch error:', err);
      return null;
    }
  }

  // ========== Load district & thana data ==========
  async function loadLocationData() {
    showStatus('Loading districts...', 'info');
    const data = await apiCall('location-secret', { action: 'getLocations' });
    
    if (data && data.success && data.districts) {
      populateDistricts(data.districts);
      showStatus('✅ Districts loaded', 'success');
    } else {
      showStatus('❌ Failed to load location data', 'error');
    }
  }

  function populateDistricts(districts) {
    districtSelect.innerHTML = '<option value="">— Select District —</option>';
    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      districtSelect.appendChild(opt);
    });
  }

  function populateThanas(thanas) {
    thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
    thanaSelect.disabled = false;
    thanas.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      thanaSelect.appendChild(opt);
    });
  }

  // District change → load thanas
  districtSelect.addEventListener('change', async function() {
    const district = this.value;
    if (!district) {
      thanaSelect.innerHTML = '<option value="">— Select Thana —</option>';
      thanaSelect.disabled = true;
      return;
    }
    
    showStatus(`Loading thanas for ${district}...`, 'info');
    const data = await apiCall('location-secret', { 
      action: 'getThanas',
      district: district
    });
    
    if (data && data.success && data.thanas) {
      populateThanas(data.thanas);
      showStatus(`✅ ${data.thanas.length} thanas loaded`, 'success');
    } else {
      showStatus('❌ No thanas found', 'error');
    }
  });

  // ========== Search ==========
  searchBtn.addEventListener('click', async function() {
    const district = districtSelect.value;
    const thana = thanaSelect.value;
    
    if (!district || !thana) {
      showStatus('⚠️ Please select both district and thana.', 'error');
      return;
    }
    
    showStatus('Searching...', 'info');
    searchBtn.disabled = true;

    const data = await apiCall('location-secret', {
      action: 'search',
      district: district,
      thana: thana
    });

    searchBtn.disabled = false;

    if (data && data.success) {
      currentContacts = data.contacts || [];
      displayResults(currentContacts);
      exportCsvBtn.disabled = false;
      showStatus(`✅ Found ${currentContacts.length} contacts`, 'success');
    } else {
      showStatus(`❌ ${data?.error || 'Search failed'}`, 'error');
      currentContacts = [];
      displayResults([]);
      exportCsvBtn.disabled = true;
    }
  });

  // ========== Display results ==========
  function displayResults(contacts) {
    if (!contacts || contacts.length === 0) {
      resultBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-8">No contacts found</td></tr>`;
      resultCount.textContent = '0 contacts';
      resultMeta.textContent = '—';
      return;
    }
    let html = '';
    contacts.forEach(c => {
      html += `
        <tr>
          <td class="font-medium text-slate-700">${c.name || 'N/A'}</td>
          <td class="text-sm text-blue-600"><a href="mailto:${c.email}">${c.email}</a></td>
          <td class="text-sm">${c.phone || 'N/A'}</td>
          <td class="text-xs text-slate-500">${c.thana}</td>
        </tr>
      `;
    });
    resultBody.innerHTML = html;
    resultCount.textContent = `${contacts.length} contacts`;
    resultMeta.textContent = `Showing ${contacts.length} contacts`;
  }

  // ========== Export CSV ==========
  exportCsvBtn.addEventListener('click', function() {
    if (!currentContacts.length) return;
    let csv = 'Name,Email,Phone,District,Thana\n';
    currentContacts.forEach(c => {
      csv += `"${c.name || ''}","${c.email || ''}","${c.phone || ''}","${c.district || ''}","${c.thana || ''}"\n`;
    });
    downloadFile(csv, `contacts_${districtSelect.value}_${thanaSelect.value}.csv`, 'text/csv');
  });

  function downloadFile(content, name, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ========== Status helper ==========
  function showStatus(msg, type = 'info') {
    statusDiv.textContent = msg;
    statusDiv.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700', 'bg-blue-50', 'text-blue-700');
    if (type === 'success') statusDiv.classList.add('bg-green-50', 'text-green-700');
    else if (type === 'error') statusDiv.classList.add('bg-red-50', 'text-red-700');
    else statusDiv.classList.add('bg-blue-50', 'text-blue-700');
    
    if (type === 'success' || type === 'error') {
      setTimeout(() => statusDiv.classList.add('hidden'), 4000);
    }
  }

  // ========== Init ==========
  console.log('Location Search Module initialized');
  loadLocationData();
})();
