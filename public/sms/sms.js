// public/sms-campaign/script.js
(function() {
  'use strict';

  // DOM refs
  const dropZone = document.getElementById('smsDropZone');
  const fileInput = document.getElementById('smsFileInput');
  const fileInfo = document.getElementById('smsFileInfo');
  const fileName = document.getElementById('smsFileName');
  const fileCount = document.getElementById('smsFileCount');
  const clearFileBtn = document.getElementById('smsClearFileBtn');
  const messageText = document.getElementById('smsMessage');
  const charCounter = document.getElementById('smsCharCounter');
  const segmentCounter = document.getElementById('smsSegmentCounter');
  const charProgress = document.getElementById('smsCharProgress');
  const senderId = document.getElementById('smsSenderId');
  const providerSelect = document.getElementById('smsProvider');
  const sendBtn = document.getElementById('sendSmsBtn');
  const statusDiv = document.getElementById('smsStatus');
  const progressContainer = document.getElementById('smsProgressContainer');
  const progressBar = document.getElementById('smsProgressBar');
  const progressText = document.getElementById('smsProgressText');
  const progressLabel = document.getElementById('smsProgressLabel');
  const resultBody = document.getElementById('smsResultBody');
  const resultCount = document.getElementById('smsResultCount');
  const resultMeta = document.getElementById('smsResultMeta');
  const totalStat = document.getElementById('smsTotalStat');
  const successStat = document.getElementById('smsSuccessStat');
  const failedStat = document.getElementById('smsFailedStat');
  const pendingStat = document.getElementById('smsPendingStat');
  const exportLogBtn = document.getElementById('smsExportLogBtn');

  // State
  let selectedFile = null;
  let smsLogs = [];
  let isSending = false;

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
      const lines = e.target.result.split('\n').filter(line => line.trim());
      fileCount.textContent = `${lines.length} contacts`;
    };
    reader.readAsText(file);
    showStatus(`File "${file.name}" loaded`, 'success');
  }

  clearFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInfo.classList.add('hidden');
    fileInput.value = '';
    showStatus('File cleared', 'info');
  });

  // ========== SMS character counter ==========
  function updateSmsCounter() {
    const text = messageText.value;
    const len = text.length;
    const maxPerSms = 160;
    const segments = len <= maxPerSms ? 1 : Math.ceil(len / 153);
    const remaining = maxPerSms - (len % maxPerSms || maxPerSms);
    const pct = Math.min(100, (len / (maxPerSms * 3)) * 100);

    charCounter.textContent = `${len} / ${maxPerSms}`;
    segmentCounter.textContent = `${segments} segment${segments > 1 ? 's' : ''}`;
    charProgress.style.width = pct + '%';

    // Color coding
    charProgress.className = 'h-1.5 rounded-full transition-all duration-300';
    if (pct > 80) charProgress.classList.add('bg-red-500');
    else if (pct > 50) charProgress.classList.add('bg-amber-500');
    else charProgress.classList.add('bg-emerald-500');
  }

  messageText.addEventListener('input', updateSmsCounter);

  // ========== Show status ==========
  function showStatus(msg, type = 'info') {
    statusDiv.textContent = msg;
    statusDiv.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700', 'bg-blue-50', 'text-blue-700');
    if (type === 'success') statusDiv.classList.add('bg-green-50', 'text-green-700');
    else if (type === 'error') statusDiv.classList.add('bg-red-50', 'text-red-700');
    else statusDiv.classList.add('bg-blue-50', 'text-blue-700');
    setTimeout(() => statusDiv.classList.add('hidden'), 5000);
  }

  // ========== Send SMS ==========
  sendBtn.addEventListener('click', async function() {
    if (isSending) return;

    // Validate
    const message = messageText.value.trim();
    if (!message) {
      showStatus('Please enter a message', 'error');
      return;
    }
    const sender = senderId.value.trim() || 'Marketing';
    if (sender.length > 11) {
      showStatus('Sender ID cannot exceed 11 characters', 'error');
      return;
    }
    if (!selectedFile) {
      showStatus('Please upload a contact list file', 'error');
      return;
    }

    // Parse contacts
    let contacts = [];
    try {
      const text = await selectedFile.text();
      contacts = text.split('\n').map(line => line.trim()).filter(line => line && line.length >= 10);
      if (contacts.length === 0) {
        showStatus('No valid phone numbers found in file', 'error');
        return;
      }
    } catch (err) {
      showStatus('Error reading file: ' + err.message, 'error');
      return;
    }

    // Confirm
    if (!confirm(`Send SMS to ${contacts.length} contacts?`)) return;

    // Start sending
    isSending = true;
    sendBtn.disabled = true;
    smsLogs = [];
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    progressLabel.textContent = 'Sending messages...';
    resultMeta.textContent = 'Sending...';

    // Prepare payload
    const payload = {
      contacts,
      message,
      sender,
      provider: providerSelect.value,
    };

    try {
      const response = await fetch('/api/campaigns-api/sms-api', {
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
        smsLogs = data.results;
        updateStats(smsLogs);
        renderLogs(smsLogs);
        resultCount.textContent = `${smsLogs.length} messages`;
        resultMeta.textContent = `Completed at ${new Date().toLocaleTimeString()}`;
        exportLogBtn.disabled = false;
        showStatus(`Sent ${data.successCount} of ${data.total} messages successfully`, 'success');
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
    const success = logs.filter(l => l.status === 'success').length;
    const failed = logs.filter(l => l.status === 'failed').length;
    const pending = logs.filter(l => l.status === 'pending').length;
    totalStat.textContent = total;
    successStat.textContent = success;
    failedStat.textContent = failed;
    pendingStat.textContent = pending;
  }

  // ========== Render logs ==========
  function renderLogs(logs) {
    if (!logs || logs.length === 0) {
      resultBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-8">No messages sent yet.</td></tr>`;
      return;
    }
    let html = '';
    logs.forEach(log => {
      const status = log.success ? 'success' : 'failed';
      const badge = status === 'success' ? 'success' : 'failed';
      const statusLabel = status === 'success' ? 'Delivered' : 'Failed';
      const msgId = log.messageId || '—';
      const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—';
      html += `
        <tr>
          <td class="font-mono text-sm">${log.phone}</td>
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
    if (!smsLogs.length) return;
    let csv = 'Phone,Status,MessageID,Timestamp\n';
    smsLogs.forEach(log => {
      csv += `"${log.phone}","${log.success ? 'Success' : 'Failed'}","${log.messageId || ''}","${log.timestamp || ''}"\n`;
    });
    downloadFile(csv, `sms_log_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
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
  updateSmsCounter();
  resultMeta.textContent = 'Ready';
  exportLogBtn.disabled = true;
})();
