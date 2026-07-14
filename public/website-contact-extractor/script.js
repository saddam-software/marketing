// public/website-contact-extractor/script.js
(function() {
  'use strict';

  // ===== DOM রেফারেন্স =====
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
  const copyAllBtn = document.getElementById('websiteCopyAllBtn');
  const exportCsvBtn = document.getElementById('websiteExportCsv');

  // ===== স্টেট =====
  let currentData = { emails: [], phones: [] };
  let activeTab = 'emails';

  // ===== টোকেন জেনারেশন (ব্যাকএন্ডের সাথে সামঞ্জস্যপূর্ণ) =====
  const tokenPayload = {
    username: "developer_user",
    exp: Date.now() + (365 * 24 * 60 * 60 * 1000) // ১ বছর মেয়াদ
  };
  const token = btoa(JSON.stringify(tokenPayload));

  // ===== ট্যাব সুইচিং (সঠিক সিলেক্টর) =====
  const tabBtns = document.querySelectorAll('.we-tab-btn');
  const tabPanels = {
    emails: emailsTab,
    phones: phonesTab
  };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const tab = this.dataset.tab; // 'emails' বা 'phones'
      activeTab = tab;

      // সব বাটন থেকে active ক্লাস সরান
      tabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      // সব প্যানেল লুকান
      Object.values(tabPanels).forEach(panel => panel.classList.add('hidden'));

      // নির্বাচিত প্যানেল দেখান
      if (tab === 'emails') {
        tabPanels.emails.classList.remove('hidden');
        renderEmails();
      } else if (tab === 'phones') {
        tabPanels.phones.classList.remove('hidden');
        renderPhones();
      }
    });
  });

  // ===== রেন্ডার ফাংশন =====
  function renderEmails() {
    const emails = currentData.emails || [];
    if (!emails.length) {
      emailsTab.innerHTML = `
        <div class="we-empty-state">
          <svg class="we-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          No emails extracted yet.
        </div>
      `;
      return;
    }

    let html = `<table class="we-data-table"><thead><tr><th>#</th><th>Email</th><th>Action</th></tr></thead><tbody>`;
    emails.forEach((e, idx) => {
      html += `
        <tr class="we-data-row">
          <td class="text-slate-400 text-xs">${idx+1}</td>
          <td class="font-mono text-sm break-all">${e}</td>
          <td><button class="we-copy-btn" data-value="${e}">Copy</button></td>
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
      phonesTab.innerHTML = `
        <div class="we-empty-state">
          <svg class="we-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
          </svg>
          No phone numbers extracted yet.
        </div>
      `;
      return;
    }

    let html = `<table class="we-data-table"><thead><tr><th>#</th><th>Phone</th><th>Action</th></tr></thead><tbody>`;
    phones.forEach((p, idx) => {
      html += `
        <tr class="we-data-row">
          <td class="text-slate-400 text-xs">${idx+1}</td>
          <td class="font-mono text-sm break-all">${p}</td>
          <td><button class="we-copy-btn" data-value="${p}">Copy</button></td>
        </tr>
      `;
    });
    html += `</tbody></table>`;
    phonesTab.innerHTML = html;
    attachCopyEvents();
  }

  function attachCopyEvents() {
    document.querySelectorAll('#websiteEmailsTab .we-copy-btn, #websitePhonesTab .we-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.value).then(() => {
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = 'Copy', 1500);
        });
      });
    });
  }

  // ===== UI আপডেট =====
  function updateUI(data) {
    currentData = data;
    const total = (data.emails?.length || 0) + (data.phones?.length || 0);
    resultCount.textContent = `${total} items`;
    resultMeta.textContent = `Found ${data.emails?.length || 0} emails and ${data.phones?.length || 0} phones`;
    copyAllBtn.disabled = total === 0;
    exportCsvBtn.disabled = total === 0;

    // বর্তমান ট্যাব অনুযায়ী রেন্ডার
    if (activeTab === 'emails') renderEmails();
    else renderPhones();
  }

  // ===== স্ট্যাটাস মেসেজ =====
  function showStatus(msg, type = 'info') {
    statusDiv.textContent = msg;
    statusDiv.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700', 'bg-blue-50', 'text-blue-700');
    if (type === 'success') statusDiv.classList.add('bg-green-50', 'text-green-700');
    else if (type === 'error') statusDiv.classList.add('bg-red-50', 'text-red-700');
    else statusDiv.classList.add('bg-blue-50', 'text-blue-700');
    setTimeout(() => statusDiv.classList.add('hidden'), 5000);
  }

  // ===== এপিআই কল (স্ক্র্যাপিং) =====
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
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url, limit, depth, force, includeSubdomains })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Scraping failed');

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

  // ===== কপি অল ও এক্সপোর্ট =====
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

  // ===== ইভেন্ট লিসেনার =====
  scrapeBtn.addEventListener('click', handleWebsiteScrape);
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleWebsiteScrape();
  });

  // ===== ইনিশিয়ালাইজ =====
  updateUI({ emails: [], phones: [] });
})();
