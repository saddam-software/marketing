// public/call-campaign/script.js
(function() {
  'use strict';

  // DOM refs
  const dropZone = document.getElementById('callDropZone');
  const fileInput = document.getElementById('callFileInput');
  const fileInfo = document.getElementById('callFileInfo');
  const fileName = document.getElementById('callFileName');
  const fileCount = document.getElementById('callFileCount');
  const clearFileBtn = document.getElementById('callClearFileBtn');
  const scriptText = document.getElementById('callScript');
  const scriptCounter = document.getElementById('callScriptCounter');
  const scriptWarn = document.getElementById('callScriptWarn');
  const audioFile = document.getElementById('callAudioFile');
  const callerId = document.getElementById('callCallerId');
  const startBtn = document.getElementById('startCallBtn');
  const statusDiv = document.getElementById('callStatus');
  const progressContainer = document.getElementById('callProgressContainer');
  const progressBar = document.getElementById('callProgressBar');
  const progressText = document.getElementById('callProgressText');
  const progressLabel = document.getElementById('callProgressLabel');
  const resultBody = document.getElementById('callResultBody');
  const resultCount = document.getElementById('callResultCount');
  const resultMeta = document.getElementById('callResultMeta');
  const totalStat = document.getElementById('callTotalStat');
  const successStat = document.getElementById('callSuccessStat');
  const failedStat = document.getElementById('callFailedStat');
  const pendingStat = document.getElementById('callPendingStat');
  const exportLogBtn = document.getElementById('callExportLogBtn');

  // State
  let selectedFile = null;
  let callLogs = [];
  let isRunning = false;

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
    // Count lines/contacts
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

  // ========== Script counter ==========
  scriptText.addEventListener('input', function() {
    const len = this.value.length;
    scriptCounter.textContent = `${len} / 300`;
    if (len > 300) {
      scriptWarn.classList.remove('hidden');
      this.style.borderColor = '#ef4444';
    } else {
      scriptWarn.classList.add('hidden');
      this.style.borderColor = '';
    }
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

  // ========== Start Broadcast ==========
  startBtn.addEventListener('click', async function() {
    if (isRunning) return;

    // Validate
    const script = scriptText.value.trim();
    const audio = audioFile.files[0];
    if (!script && !audio) {
      showStatus('Please provide either a voice script or upload an audio file', 'error');
      return;
    }
    if (script && script.length > 300) {
      showStatus('Voice script is too long (max 300 characters)', 'error');
      return;
    }
    const caller = callerId.value.trim();
    if (!caller) {
      showStatus('Caller ID is required', 'error');
      return;
    }
    if (!selectedFile) {
      showStatus('Please upload a contact list file', 'error');
      return;
    }

    // Prepare payload
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
    if (!confirm(`Start broadcast to ${contacts.length} contacts?`)) return;

    // Start
    isRunning = true;
    startBtn.disabled = true;
    callLogs = [];
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    progressLabel.textContent = 'Initiating calls...';
    resultMeta.textContent = 'Calling...';

    // Prepare form data
    const formData = new FormData();
    formData.append('contacts', JSON.stringify(contacts));
    formData.append('script', script);
    formData.append('callerId', caller);
    if (audio) {
      formData.append('audio', audio);
    }

    try {
      const response = await fetch('/api/campaigns-api/call-api', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('emailExtractorToken')}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'API error');

      // Process results
      if (data.success && data.results) {
        callLogs = data.results;
        updateStats(callLogs);
        renderLogs(callLogs);
        resultCount.textContent = `${callLogs.length} calls`;
        resultMeta.textContent = `Completed at ${new Date().toLocaleTimeString()}`;
        exportLogBtn.disabled = false;
        showStatus(`Broadcast complete: ${data.successCount} successful`, 'success');
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        progressLabel.textContent = 'Done!';
      } else {
        showStatus(data.error || 'Broadcast failed', 'error');
      }
    } catch (err) {
      showStatus('Error: ' + err.message, 'error');
    } finally {
      isRunning = false;
      startBtn.disabled = false;
      setTimeout(() => progressContainer.classList.add('hidden'), 1500);
    }
  });

  // ========== Update stats ==========
  function updateStats(logs) {
    const total = logs.length;
    const success = logs.filter(l => l.status === 'completed').length;
    const failed = logs.filter(l => ['failed', 'busy', 'no-answer'].includes(l.status)).length;
    const pending = logs.filter(l => l.status === 'pending').length;
    totalStat.textContent = total;
    successStat.textContent = success;
    failedStat.textContent = failed;
    pendingStat.textContent = pending;
  }

  // ========== Render logs ==========
  function renderLogs(logs) {
    if (!logs || logs.length === 0) {
      resultBody.innerHTML = `<tr><td colspan="4" class="text-center text-slate-500 py-8">No calls made yet.</td></tr>`;
      return;
    }
    let html = '';
    logs.forEach(log => {
      const status = log.status || 'pending';
      const badgeMap = {
        'completed': 'success',
        'failed': 'failed',
        'pending': 'pending',
        'busy': 'busy',
        'no-answer': 'no-answer'
      };
      const badge = badgeMap[status] || 'pending';
      const statusLabel = status === 'no-answer' ? 'No Answer' : status.charAt(0).toUpperCase() + status.slice(1);
      const duration = log.duration ? `${log.duration}s` : '—';
      const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—';
      html += `
        <tr>
          <td class="font-mono text-sm">${log.phone}</td>
          <td><span class="status-badge ${badge}">${statusLabel}</span></td>
          <td class="text-sm">${duration}</td>
          <td class="text-xs text-slate-500">${time}</td>
        </tr>
      `;
    });
    resultBody.innerHTML = html;
  }

  // ========== Export Log ==========
  exportLogBtn.addEventListener('click', function() {
    if (!callLogs.length) return;
    let csv = 'Phone,Status,Duration,Timestamp\n';
    callLogs.forEach(log => {
      csv += `"${log.phone}","${log.status}","${log.duration || 0}","${log.timestamp || ''}"\n`;
    });
    downloadFile(csv, `call_log_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
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
  resultMeta.textContent = 'Ready';
  exportLogBtn.disabled = true;
})();
