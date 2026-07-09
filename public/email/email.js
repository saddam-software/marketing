// public/email-campaign/script.js
(function() {
  'use strict';

  // DOM refs
  const dropZone = document.getElementById('emailDropZone');
  const fileInput = document.getElementById('emailFileInput');
  const fileInfo = document.getElementById('emailFileInfo');
  const fileName = document.getElementById('emailFileName');
  const fileCount = document.getElementById('emailFileCount');
  const clearFileBtn = document.getElementById('emailClearFileBtn');
  const filterSelect = document.getElementById('emailFilter');
  const subjectInput = document.getElementById('emailSubject');
  const htmlContent = document.getElementById('emailHtmlContent');
  const htmlLength = document.getElementById('emailHtmlLength');
  const previewBtn = document.getElementById('emailPreviewBtn');
  const previewModal = document.getElementById('emailPreviewModal');
  const previewContent = document.getElementById('emailPreviewContent');
  const previewClose = document.getElementById('emailPreviewClose');
  const senderInput = document.getElementById('emailSender');
  const providerSelect = document.getElementById('emailProvider');
  const sendBtn = document.getElementById('sendEmailBtn');
  const statusDiv = document.getElementById('emailStatus');
  const progressContainer = document.getElementById('emailProgressContainer');
  const progressBar = document.getElementById('emailProgressBar');
  const progressText = document.getElementById('emailProgressText');
  const progressLabel = document.getElementById('emailProgressLabel');
  const resultBody = document.getElementById('emailResultBody');
  const resultCount = document.getElementById('emailResultCount');
  const resultMeta = document.getElementById('emailResultMeta');
  const totalStat = document.getElementById('emailTotalStat');
  const successStat = document.getElementById('emailSuccessStat');
  const failedStat = document.getElementById('emailFailedStat');
  const pendingStat = document.getElementById('emailPendingStat');
  const exportLogBtn = document.getElementById('emailExportLogBtn');

  // State
  let selectedFile = null;
  let emailLogs = [];
  let isSending = false;
  let rawContacts = [];

  // ========== File handling ==========
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
    if (files.length > 0) handleFile(files[0]);
  });
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  });

  function handleFile(file) {
    const validTypes = ['text/plain', 'text/csv'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(txt|csv)$/i)) {
      showStatus('Please upload a .txt or .csv file', 'error');
      return;
    }
    selectedFile = file;
    fileInfo.classList.remove('hidden');
    fileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      rawContacts = e.target.result.split('\n').map(line => line.trim()).filter(line => line && line.includes('@'));
      fileCount.textContent = `${rawContacts.length} contacts`;
      // Auto-apply filter
      applyFilter();
    };
    reader.readAsText(file);
    showStatus(`File "${file.name}" loaded`, 'success');
  }

  clearFileBtn.addEventListener('click', () => {
    selectedFile = null;
    rawContacts = [];
    fileInfo.classList.add('hidden');
    fileInput.value = '';
    fileCount.textContent = '0 contacts';
    resultBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-8">No contacts loaded.</td></tr>`;
    resultCount.textContent = '0 emails';
    showStatus('File cleared', 'info');
  });

  // ========== Smart Filter ==========
  function applyFilter() {
    if (!rawContacts.length) return;
    const filter = filterSelect.value;
    let filtered = [...rawContacts];
    if (filter === 'b2b') {
      filtered = rawContacts.filter(email => 
        email.includes('@') && !email.match(/@(gmail|yahoo|hotmail|outlook|aol|protonmail|icloud)/i)
      );
    } else if (filter === 'b2c') {
      filtered = rawContacts.filter(email => 
        email.includes('@') && email.match(/@(gmail|yahoo|hotmail|outlook|aol|protonmail|icloud)/i)
      );
    } else if (filter === 'verified') {
      // Demo: assume emails ending with .com are verified
      filtered = rawContacts.filter(email => email.endsWith('.com'));
    }
    fileCount.textContent = `${filtered.length} contacts (filtered)`;
    // Store filtered for sending
    window._filteredContacts = filtered;
  }

  filterSelect.addEventListener('change', applyFilter);

  // ========== HTML Editor ==========
  function updateHtmlLength() {
    htmlLength.textContent = `${htmlContent.value.length} characters`;
  }
  htmlContent.addEventListener('input', updateHtmlLength);

  // Toolbar commands
  document.querySelectorAll('#emailCampaign .email-editor-toolbar button').forEach(btn => {
    btn.addEventListener('click', function() {
      const cmd = this.dataset.cmd;
      const textarea = htmlContent;
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
        case 'variable': {
          const varName = prompt('Enter variable name (e.g., name):', 'name');
          if (varName) replacement = `{{${varName}}}`;
          else return;
          break;
        }
        default: return;
      }
      textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
      textarea.focus();
      textarea.selectionStart = start;
      textarea.selectionEnd = start + replacement.length;
      updateHtmlLength();
    });
  });

  // ========== Preview ==========
  previewBtn.addEventListener('click', function() {
    const html = htmlContent.value || '<p><em>Empty content</em></p>';
    previewContent.innerHTML = html;
    previewModal.classList.remove('hidden');
  });
  previewClose.addEventListener('click', () => previewModal.classList.add('hidden'));
  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) previewModal.classList.add('hidden');
  });

  // ========== Show status ==========
  function showStatus(msg, type = 'info') {
    statusDiv.textContent = msg;
    statusDiv.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700', 'bg-blue-50', 'text-blue-700');
    if (type === 'success') statusDiv.classList.add('bg-green-50', 'text-green-700');
    else if (type === 'error') statusDiv.classList.add('bg-red-50', 'text-red-700');
    else statusDiv.classList.add('bg-blue-50', 'text-blue-700');
    setTimeout(() => statusDiv.classList.add('hidden'), 5000);
  }

  // ========== Send Email ==========
  sendBtn.addEventListener('click', async function() {
    if (isSending) return;

    // Validate
    const subject = subjectInput.value.trim();
    if (!subject) {
      showStatus('Please enter a subject', 'error');
      return;
    }
    const html = htmlContent.value.trim();
    if (!html) {
      showStatus('Please enter HTML content', 'error');
      return;
    }
    const sender = senderInput.value.trim();
    if (!sender || !sender.includes('@')) {
      showStatus('Please enter a valid sender email', 'error');
      return;
    }
    const contacts = window._filteredContacts || rawContacts;
    if (!contacts || contacts.length === 0) {
      showStatus('Please upload a contact list', 'error');
      return;
    }

    // Confirm
    if (!confirm(`Send email to ${contacts.length} contacts?`)) return;

    // Start sending
    isSending = true;
    sendBtn.disabled = true;
    emailLogs = [];
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    progressLabel.textContent = 'Sending emails...';
    resultMeta.textContent = 'Sending...';

    // Prepare payload
    const payload = {
      contacts,
      subject,
      htmlContent: html,
      sender,
      provider: providerSelect.value,
      filter: filterSelect.value,
    };

    try {
      const response = await fetch('/api/campaigns-api/email-api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('emailExtractorToken')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'API error');

      if (data.success && data.results) {
        emailLogs = data.results;
        updateStats(emailLogs);
        renderLogs(emailLogs);
        resultCount.textContent = `${emailLogs.length} emails`;
        resultMeta.textContent = `Completed at ${new Date().toLocaleTimeString()}`;
        exportLogBtn.disabled = false;
        showStatus(`Sent ${data.successCount} of ${data.total} emails successfully`, 'success');
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        progressLabel.textContent = 'Done!';
      } else {
        showStatus(data.error || 'Sending failed', 'error');
      }
    } catch (err) {
      showStatus('Error: ' + err.message, 'error');
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      setTimeout(() => progressContainer.classList.add('hidden'), 1500);
    }
  });

  // ========== Update stats ==========
  function updateStats(logs) {
    const total = logs.length;
    const success = logs.filter(l => l.success).length;
    const failed = logs.filter(l => !l.success && l.status !== 'pending').length;
    const pending = logs.filter(l => l.status === 'pending').length;
    totalStat.textContent = total;
    successStat.textContent = success;
    failedStat.textContent = failed;
    pendingStat.textContent = pending;
  }

  // ========== Render logs ==========
  function renderLogs(logs) {
    if (!logs || logs.length === 0) {
      resultBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-8">No emails sent yet.</td></tr>`;
      return;
    }
    let html = '';
    logs.forEach(log => {
      const status = log.success ? 'success' : (log.status || 'failed');
      const badge = status === 'success' ? 'success' : (status === 'pending' ? 'pending' : 'failed');
      const statusLabel = status === 'success' ? 'Delivered' : (status === 'pending' ? 'Pending' : 'Failed');
      const msgId = log.messageId || '—';
      const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—';
      html += `
        <tr>
          <td class="font-mono text-sm break-all">${log.email}</td>
          <td><span class="status-badge ${badge}">${statusLabel}</span></td>
          <td class="text-xs text-slate-500">${msgId}</td>
          <td class="text-xs text-slate-500">${time}</td>
        </tr>
      `;
    });
    resultBody.innerHTML = html;
  }

  // ========== Export Log ==========
  exportLogBtn.addEventListener('click', function() {
    if (!emailLogs.length) return;
    let csv = 'Email,Status,MessageID,Timestamp\n';
    emailLogs.forEach(log => {
      const status = log.success ? 'Success' : (log.status || 'Failed');
      csv += `"${log.email}","${status}","${log.messageId || ''}","${log.timestamp || ''}"\n`;
    });
    downloadFile(csv, `email_log_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
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

  // ========== Init ==========
  updateHtmlLength();
  resultMeta.textContent = 'Ready';
  exportLogBtn.disabled = true;
  window._filteredContacts = [];
})();
