// public/website-contact-extractor/script.js
(function() {
  'use strict';

  // DOM refs
  const urlInput = document.getElementById('websiteUrl');
  const limitInput = document.getElementById('websiteLimit');
  const depthInput = document.getElementById('websiteDepth');
  const forceCheck = document.getElementById('forceWebsiteScrape');
  const subdomainCheck = document.getElementById('includeSubdomains');
  const scrapeBtn = document.getElementById('websiteScrapeBtn');
  const statusDiv = document.getElementById('websiteStatus');
  const progressContainer = document.getElementById('websiteProgressContainer');
  const progressBar = document.getElementById('websiteProgressBar');
  const progressText = document.getElementById('websiteProgressText');
  const progressLabel = document.getElementById('websiteProgressLabel');
  const resultCount = document.getElementById('websiteResultCount');
  const resultMeta = document.getElementById('websiteResultMeta');
  const emailsTab = document.getElementById('websiteEmailsTab');
  const phonesTab = document.getElementById('websitePhonesTab');
  const tabBtns = document.querySelectorAll('.website-tab-btn');
  const copyAllBtn = document.getElementById('websiteCopyAllBtn');
  const exportCsvBtn = document.getElementById('websiteExportCsv');

  // State
  let currentData = { emails: [], phones: [] };
  let activeTab = 'emails';

// ✅ টোকেন জেনারেট এবং অ্যাসাইন করা (টেস্টিংয়ের জন্য সাময়িক পরিবর্তন)
// পুরোনো লাইনটি কমেন্ট করে রাখা হলো:
// const token = localStorage.getItem('emailExtractorToken');

// ১. একটি পেলোড অবজেক্ট তৈরি করা হলো যার মেয়াদ (exp) বর্তমান সময় থেকে ১ বছর বেশি
const tokenPayload = {
  username: "developer_user",
  exp: Date.now() + (365 * 24 * 60 * 60 * 1000) // ১ বছর মেয়াদ (মিলিলেকেন্ডে)
};

// ২. অবজেক্টটিকে টেক্সটে রূপান্তর করে Base64 এনকোড করা হলো (যা ব্যাকএন্ড আশা করে)
const token = btoa(JSON.stringify(tokenPayload));
  // ========== Tab switching ==========
  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const tab = this.dataset.tab;
      activeTab = tab;
      tabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.querySelectorAll('.website-tab-content').forEach(el => el.classList.add('hidden'));
      if (tab === 'emails') {
        emailsTab.classList.remove('hidden');
        renderEmails();
      } else {
        phonesTab.classList.remove('hidden');
        renderPhones();
      }
    });
  });

  // ========== Render functions ==========
  function renderEmails() {
    const emails = currentData.emails || [];
    if (!emails.length) {
      emailsTab.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">No emails extracted yet.</div>';
      return;
    }
    let html = `<table class="data-table w-full"><thead><tr><th>#</th><th>Email</th><th>Action</th></tr></thead><tbody>`;
    emails.forEach((e, idx) => {
      html += `
        <tr class="result-row">
          <td class="text-slate-400 text-xs">${idx+1}</td>
          <td class="font-mono text-sm break-all">${e}</td>
          <td><button class="copy-btn text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-all" data-value="${e}">Copy</button></td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    emailsTab.innerHTML = html;
    attachCopyEvents();
  }

  function renderPhones() {
    const phones = currentData.phones || [];
    if (!phones.length) {
      phonesTab.innerHTML = '<div class="text-sm text-slate-500 text-center py-12">No phone numbers extracted yet.</div>';
      return;
    }
    let html = `<table class="data-table w-full"><thead><tr><th>#</th><th>Phone</th><th>Action</th></tr></thead><tbody>`;
    phones.forEach((p, idx) => {
      html += `
        <tr class="result-row">
          <td class="text-slate-400 text-xs">${idx+1}</td>
          <td class="font-mono text-sm break-all">${p}</td>
          <td><button class="copy-btn text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-all" data-value="${p}">Copy</button></td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    phonesTab.innerHTML = html;
    attachCopyEvents();
  }

  function attachCopyEvents() {
    document.querySelectorAll('#websiteEmailsTab .copy-btn, #websitePhonesTab .copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.value).then(() => {
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = 'Copy', 1500);
        });
      });
    });
  }

  function updateUI(data) {
    currentData = data;
    const total = (data.emails?.length || 0) + (data.phones?.length || 0);
    resultCount.textContent = `${total} items`;
    resultMeta.textContent = `Found ${data.emails?.length || 0} emails and ${data.phones?.length || 0} phones`;
    copyAllBtn.disabled = total === 0;
    exportCsvBtn.disabled = total === 0;
    // Re-render active tab
    if (activeTab === 'emails') renderEmails();
    else renderPhones();
  }

  // ========== Show status ==========
  function showStatus(msg, type = 'info') {
    statusDiv.textContent = msg;
    statusDiv.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700', 'bg-blue-50', 'text-blue-700');
    if (type === 'success') statusDiv.classList.add('bg-green-50', 'text-green-700');
    else if (type === 'error') statusDiv.classList.add('bg-red-50', 'text-red-700');
    else statusDiv.classList.add('bg-blue-50', 'text-blue-700');
    setTimeout(() => statusDiv.classList.add('hidden'), 5000);
  }

  // ========== API Call (টোকেন সহ) ==========
  async function handleWebsiteScrape() {
    const url = urlInput.value.trim();
    if (!url) {
      showStatus('Please enter a valid URL', 'error');
      return;
    }
    const limit = parseInt(limitInput.value, 10) || 100;
    const depth = parseInt(depthInput.value, 10) || 1;
    const force = forceCheck.checked;
    const includeSubdomains = subdomainCheck.checked;

    scrapeBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    progressLabel.textContent = 'Connecting...';

    try {
      const response = await fetch('/api/finder-api/website-secret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`   // ✅ টোকেন যোগ করা হলো
        },
        body: JSON.stringify({ url, limit, depth, force, includeSubdomains })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Scraping failed');

      // Simulate progress (backend may not provide real-time)
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      progressLabel.textContent = 'Done!';

      if (data.success) {
        updateUI({ emails: data.emails || [], phones: data.phones || [] });
        showStatus(`Scraped ${data.emails?.length || 0} emails and ${data.phones?.length || 0} phones`, 'success');
      } else {
        showStatus(data.error || 'Scraping failed', 'error');
      }
    } catch (err) {
      showStatus('Error: ' + err.message, 'error');
    } finally {
      scrapeBtn.disabled = false;
      setTimeout(() => progressContainer.classList.add('hidden'), 1000);
    }
  }

  // ========== Export ==========
  copyAllBtn.addEventListener('click', function() {
    const all = [...(currentData.emails || []), ...(currentData.phones || [])];
    if (!all.length) return;
    navigator.clipboard.writeText(all.join('\n')).then(() => {
      showStatus(`Copied ${all.length} items to clipboard`, 'success');
    });
  });

  exportCsvBtn.addEventListener('click', function() {
    const emails = currentData.emails || [];
    const phones = currentData.phones || [];
    if (!emails.length && !phones.length) return;
    let csv = 'Type,Contact\n';
    emails.forEach(e => csv += `Email,"${e}"\n`);
    phones.forEach(p => csv += `Phone,"${p}"\n`);
    downloadFile(csv, `website_scrape_${new Date().toISOString().slice(0,10)}.csv`, 'text/csv');
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

  // ========== Event listeners ==========
  scrapeBtn.addEventListener('click', handleWebsiteScrape);

  // Enter key on URL input
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleWebsiteScrape();
  });

  // ========== Init ==========
  updateUI({ emails: [], phones: [] });
})();
