// public/text-contact-extractor/script.js
(function() {
  'use strict';

  // ========== DOM refs ==========
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const fileSize = document.getElementById('fileSize');
  const processFileBtn = document.getElementById('processFileBtn');
  const textInput = document.getElementById('textInput');
  const charCount = document.getElementById('charCount');
  const wordCount = document.getElementById('wordCount');
  const extractTextBtn = document.getElementById('extractTextBtn');
  const processingContainer = document.getElementById('processingContainer');
  const processingLabel = document.getElementById('processingLabel');
  const processingProgress = document.getElementById('processingProgress');
  const processingPercent = document.getElementById('processingPercent');
  const resultBody = document.getElementById('resultBody');
  const resultCount = document.getElementById('resultCount');
  const filterType = document.getElementById('filterType');
  const searchInput = document.getElementById('searchInput');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageIndicator = document.getElementById('pageIndicator');
  const paginationInfo = document.getElementById('paginationInfo');
  const totalFound = document.getElementById('totalFound');
  const duplicatesRemoved = document.getElementById('duplicatesRemoved');
  const validEmails = document.getElementById('validEmails');
  const validPhones = document.getElementById('validPhones');

  // ========== State ==========
  let allData = []; // Array of { value, type }
  let filteredData = [];
  let currentPage = 1;
  const pageSize = 50;

  // ========== Helpers ==========
  function updateCharWordCount() {
    const text = textInput.value;
    charCount.textContent = `${text.length} characters`;
    wordCount.textContent = `${text.trim() ? text.trim().split(/\s+/).length : 0} words`;
  }

  function showProcessing(show) {
    processingContainer.classList.toggle('hidden', !show);
  }

  function setProcessingProgress(percent, label) {
    processingProgress.style.width = Math.min(100, percent) + '%';
    processingPercent.textContent = Math.min(100, percent) + '%';
    if (label) processingLabel.textContent = label;
  }

  function updateAnalytics(emails, phones, total) {
    const uniqueEmails = new Set(emails);
    const uniquePhones = new Set(phones);
    const totalUnique = uniqueEmails.size + uniquePhones.size;
    const duplicates = total - totalUnique;
    totalFound.textContent = total;
    duplicatesRemoved.textContent = duplicates;
    validEmails.textContent = uniqueEmails.size;
    validPhones.textContent = uniquePhones.size;
  }

  function renderTable() {
    const filter = filterType.value;
    const search = searchInput.value.toLowerCase().trim();

    filteredData = allData.filter(item => {
      if (filter === 'email' && item.type !== 'email') return false;
      if (filter === 'phone' && item.type !== 'phone') return false;
      if (search) {
        if (!item.value.toLowerCase().includes(search)) return false;
      }
      return true;
    });

    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, totalItems);
    const pageData = filteredData.slice(start, end);

    // Update pagination info
    paginationInfo.textContent = `Showing ${totalItems ? start+1 : 0}-${end} of ${totalItems}`;
    pageIndicator.textContent = currentPage;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;

    if (pageData.length === 0) {
      resultBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-8">No matching data</td></tr>`;
      resultCount.textContent = '0 items';
      return;
    }

    let html = '';
    pageData.forEach((item, idx) => {
      const icon = item.type === 'email' ? '✉️' : '📱';
      const badge = item.type === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
      html += `
        <tr class="result-row">
          <td class="text-slate-400 text-xs">${start + idx + 1}</td>
          <td class="font-mono text-sm break-all">${item.value}</td>
          <td><span class="status-badge ${badge}">${item.type}</span></td>
          <td>
            <button class="copy-btn text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-all" data-value="${item.value}">Copy</button>
          </td>
        </tr>
      `;
    });
    resultBody.innerHTML = html;
    resultCount.textContent = `${totalItems} items`;

    // Attach copy events
    resultBody.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.value).then(() => {
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = 'Copy', 1500);
        });
      });
    });
  }

  function updateUIWithResults(emails, phones) {
    const emailArray = [...new Set(emails.map(e => e.toLowerCase().trim()))].filter(e => e);
    const phoneArray = [...new Set(phones.map(p => p.trim().replace(/[^\d+]/g, '')).filter(p => p.length >= 10))];
    const combined = [
      ...emailArray.map(e => ({ value: e, type: 'email' })),
      ...phoneArray.map(p => ({ value: p, type: 'phone' }))
    ];
    allData = combined;
    currentPage = 1;
    renderTable();
    updateAnalytics(emailArray, phoneArray, combined.length);
  }

  // ========== API call to backend ==========
  async function extractFromText(text) {
    showProcessing(true);
    setProcessingProgress(0, 'Sending data to server...');
    try {
      const response = await fetch('/api/finder-api/text-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'API error');
      setProcessingProgress(100, 'Done!');
      setTimeout(() => showProcessing(false), 600);
      // data should have { emails, phones }
      updateUIWithResults(data.emails || [], data.phones || []);
    } catch (err) {
      alert('Error: ' + err.message);
      showProcessing(false);
    }
  }

  async function extractFromFile(file) {
    showProcessing(true);
    setProcessingProgress(0, 'Reading file...');
    const text = await file.text();
    // Process in chunks if huge
    const chunkSize = 1024 * 1024; // 1MB
    if (text.length > chunkSize * 5) {
      // Use chunked processing via API (streaming not supported, send in parts?)
      // For simplicity, we'll send the whole text, but we can implement chunked splitting.
      // We'll just send the whole text; the server can handle large text.
    }
    await extractFromText(text);
  }

  // ========== Event listeners ==========
  // Drag & Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const validTypes = ['text/plain', 'text/csv', 'application/vnd.ms-excel', 'text/log'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(txt|csv|log)$/i)) {
        alert('Please drop a .txt, .csv, or .log file.');
        return;
      }
      handleFile(file);
    }
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    fileInfo.classList.remove('hidden');
    fileName.textContent = file.name;
    fileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';
    processFileBtn.disabled = false;
    processFileBtn.dataset.file = file;
  }

  processFileBtn.addEventListener('click', () => {
    const file = processFileBtn.dataset.file;
    if (file) extractFromFile(file);
  });

  // Text extraction
  textInput.addEventListener('input', updateCharWordCount);
  extractTextBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) { alert('Please paste some text.'); return; }
    extractFromText(text);
  });

  // Filters & Search
  filterType.addEventListener('change', renderTable);
  searchInput.addEventListener('input', renderTable);

  // Pagination
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
  });
  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (currentPage < totalPages) { currentPage++; renderTable(); }
  });

  // Export
  copyAllBtn.addEventListener('click', () => {
    const values = filteredData.map(item => item.value).join('\n');
    navigator.clipboard.writeText(values).then(() => {
      alert('Copied ' + filteredData.length + ' items to clipboard.');
    });
  });

  exportCsvBtn.addEventListener('click', () => {
    if (!filteredData.length) return alert('No data to export.');
    let csv = 'Contact,Type\n';
    filteredData.forEach(item => {
      csv += `"${item.value}","${item.type}"\n`;
    });
    downloadFile(csv, 'extracted_contacts.csv', 'text/csv');
  });

  exportJsonBtn.addEventListener('click', () => {
    if (!filteredData.length) return alert('No data to export.');
    const json = JSON.stringify(filteredData, null, 2);
    downloadFile(json, 'extracted_contacts.json', 'application/json');
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

  // Init
  updateCharWordCount();
  renderTable();
})();
