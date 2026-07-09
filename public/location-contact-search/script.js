// public/location-contact-search/script.js
(function() {
  'use strict';

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
  // ✅ টোকেন একবার নিলেই হবে
  const token = localStorage.getItem('emailExtractorToken');

  // ========== Load district & thana data ==========
  async function loadLocationData() {
    try {
      const res = await fetch('/api/finder-api/location-secret?action=getLocations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.districts) {
        populateDistricts(data.districts);
      } else {
        showStatus('Failed to load location data', 'error');
      }
    } catch (err) {
      showStatus('Error loading location data: ' + err.message, 'error');
    }
  }

  function populateDistricts(districts) {
    districtSelect.innerHTML = '<option value="">— Select District —</option>';
    Object.keys(districts).forEach(d => {
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
    try {
      const res = await fetch(`/api/finder-api/location-secret?action=getThanas&district=${encodeURIComponent(district)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.thanas) {
        populateThanas(data.thanas);
      } else {
        showStatus('No thanas found for this district', 'error');
      }
    } catch (err) {
      showStatus('Error loading thanas: ' + err.message, 'error');
    }
  });

  // ========== Search ==========
  searchBtn.addEventListener('click', async function() {
    const district = districtSelect.value;
    const thana = thanaSelect.value;
    if (!district || !thana) {
      showStatus('Please select both district and thana.', 'error');
      return;
    }
    showStatus('Searching...', 'info');
    searchBtn.disabled = true;

    try {
      const res = await fetch(`/api/finder-api/location-secret?action=search&district=${encodeURIComponent(district)}&thana=${encodeURIComponent(thana)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        currentContacts = data.contacts || [];
        displayResults(currentContacts);
        exportCsvBtn.disabled = false;
        showStatus(`Found ${currentContacts.length} contacts`, 'success');
      } else {
        showStatus(data.error || 'Search failed', 'error');
        currentContacts = [];
        displayResults([]);
        exportCsvBtn.disabled = true;
      }
    } catch (err) {
      showStatus('Error: ' + err.message, 'error');
      currentContacts = [];
      displayResults([]);
      exportCsvBtn.disabled = true;
    } finally {
      searchBtn.disabled = false;
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
    resultMeta.textContent = `Showing all ${contacts.length} contacts from ${contacts[0]?.district} - ${contacts[0]?.thana}`;
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
    setTimeout(() => statusDiv.classList.add('hidden'), 5000);
  }

  // ========== Init ==========
  loadLocationData();
})();
