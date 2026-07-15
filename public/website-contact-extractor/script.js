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

  // ===== টোকেন জেনারেশন =====
  const tokenPayload = {
    username: "developer_user",
    exp: Date.now() + (365 * 24 * 60 * 60 * 1000)
  };
  const token = btoa(JSON.stringify(tokenPayload));

  // ===== ট্যাব সুইচিং =====
  const tabBtns = document.querySelectorAll('.we-tab-btn');
  const tabPanels = {
    emails: emailsTab,
    phones: phonesTab
  };

  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const tab = this.dataset.tab;
      activeTab = tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      Object.values(tabPanels).forEach(panel => panel.classList.add('hidden'));

      if (tab === 'emails') {
        tabPanels.emails.classList.remove('hidden');
        renderEmails();
      } else if (tab === 'phones') {
        tabPanels.phones.classList.remove('hidden');
        renderPhones();
      }
    });
  });

  // ===== হেল্পার ফাংশন =====
  function groupBy(array, key) {
    return array.reduce((result, currentValue) => {
      const groupKey = currentValue[key] || 'Unknown';
      (result[groupKey] = result[groupKey] || []).push(currentValue);
      return result;
    }, {});
  }

  // ===== রেন্ডার ফাংশন: Emails =====
  function renderEmails() {
    const emails = currentData.emails || [];
    if (!emails.length) {
      emailsTab.innerHTML = getEmptyStateHTML('No emails extracted yet.');
      return;
    }

    const groupedEmails = groupBy(emails, 'domain');
    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; padding: 0.5rem;">`;

    for (const [domain, items] of Object.entries(groupedEmails)) {
      html += `
        <div style="border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden; background: #fff;">
          <div style="background: #f8fafc; padding: 0.6rem 1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0;">
            <strong style="font-size: 0.75rem; color: #1e293b; display: flex; align-items: center; gap: 0.4rem;">
              <span style="background: #e2e8f0; padding: 0.1rem 0.4rem; border-radius: 999px;">${items.length}</span> ${domain}
            </strong>
            <button class="we-btn-tool we-verify-btn" data-type="emails" data-group="${domain}">Verify</button>
          </div>
          <div style="max-height: 250px; overflow-y: auto;">
            <table class="we-data-table">
              <tbody>
                ${items.map((item, idx) => `
                  <tr class="we-data-row">
                    <td class="font-mono text-sm break-all" style="width: 60%;">${item.email}</td>
                    <td style="font-size: 0.65rem; color: ${item.status === 'Verified' ? '#059669' : (item.status === 'Error' || item.status === 'Undeliverable' ? '#dc2626' : '#64748b')};">
                      ${item.status ? `<strong>${item.status}</strong><br><span style="font-size:0.55rem; color:#94a3b8;">${item.meta || ''}</span>` : '<span style="color:#cbd5e1;">Unverified</span>'}
                    </td>
                    <td style="text-align: right;"><button class="we-copy-btn" data-value="${item.email}">Copy</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
    emailsTab.innerHTML = html;
    attachCopyEvents();
    attachVerifyEvents();
  }

  // ===== রেন্ডার ফাংশন: Phones =====
  function renderPhones() {
    const phones = currentData.phones || [];
    if (!phones.length) {
      phonesTab.innerHTML = getEmptyStateHTML('No phone numbers extracted yet.');
      return;
    }

    const groupedPhones = groupBy(phones, 'country');
    let html = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; padding: 0.5rem;">`;

    for (const [country, items] of Object.entries(groupedPhones)) {
      html += `
        <div style="border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: hidden; background: #fff;">
          <div style="background: #f8fafc; padding: 0.6rem 1rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0;">
            <strong style="font-size: 0.75rem; color: #1e293b; display: flex; align-items: center; gap: 0.4rem;">
              <span style="background: #e2e8f0; padding: 0.1rem 0.4rem; border-radius: 999px;">${items.length}</span> ${country}
            </strong>
            <button class="we-btn-tool we-verify-btn" data-type="phones" data-group="${country}">Verify</button>
          </div>
          <div style="max-height: 250px; overflow-y: auto;">
            <table class="we-data-table">
              <tbody>
                ${items.map((item, idx) => `
                  <tr class="we-data-row">
                    <td class="font-mono text-sm break-all" style="width: 60%;">${item.phone}</td>
                    <td style="font-size: 0.65rem; color: ${item.status === 'Valid' ? '#059669' : (item.status === 'Error' || item.status === 'Invalid' ? '#dc2626' : '#64748b')};">
                      ${item.status ? `<strong>${item.status}</strong><br><span style="font-size:0.55rem; color:#94a3b8;">${item.meta || ''}</span>` : '<span style="color:#cbd5e1;">Unverified</span>'}
                    </td>
                    <td style="text-align: right;"><button class="we-copy-btn" data-value="${item.phone}">Copy</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
    phonesTab.innerHTML = html;
    attachCopyEvents();
    attachVerifyEvents();
  }

  function getEmptyStateHTML(message) {
    return `
      <div class="we-empty-state">
        <svg class="we-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
        ${message}
      </div>
    `;
  }

  // ===== ইভেন্ট লিসেনার: কপি ও ভেরিফাই =====
  function attachCopyEvents() {
    document.querySelectorAll('.we-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.value).then(() => {
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = 'Copy', 1500);
        });
      });
    });
  }

  function attachVerifyEvents() {
    document.querySelectorAll('.we-verify-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const type = this.dataset.type;
        const group = this.dataset.group;
        
        const originalText = this.textContent;
        this.textContent = 'Verifying...';
        this.disabled = true;

        let payloadItems = [];
        if (type === 'emails') {
          payloadItems = currentData.emails.filter(e => e.domain === group).map(e => e.email);
        } else {
          payloadItems = currentData.phones.filter(p => p.country === group).map(p => p.phone);
        }

        try {
          const actionName = type === 'emails' ? 'verify_emails' : 'verify_phones';
          const payload = { action: actionName };
          if (type === 'emails') payload.emails = payloadItems;
          else payload.phones = payloadItems;

          const response = await fetch('/api/finder-api/website-secret', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });
          
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Verification failed');

          if (result.success && result.data) {
            result.data.forEach(verifiedItem => {
              if (type === 'emails') {
                const target = currentData.emails.find(e => e.email === verifiedItem.email);
                if (target) { target.status = verifiedItem.status; target.meta = verifiedItem.meta; }
              } else {
                const target = currentData.phones.find(p => p.phone === verifiedItem.phone);
                if (target) { target.status = verifiedItem.status; target.meta = verifiedItem.meta; }
              }
            });
            showStatus(`${group} verification complete!`, 'success');
            
            if (type === 'emails') renderEmails();
            else renderPhones();
          }
        } catch (err) {
          showStatus('Verification Error: ' + err.message, 'error');
          this.textContent = originalText;
          this.disabled = false;
        }
      });
    });
  }

  // ===== UI আপডেট =====
  function updateUI(data) {
    currentData = data;
    const emailCount = data.emails?.length || 0;
    const phoneCount = data.phones?.length || 0;
    const total = emailCount + phoneCount;
    
    resultCount.textContent = `${total} items`;
    resultMeta.textContent = `Found ${emailCount} emails and ${phoneCount} phones`;
    copyAllBtn.disabled = total === 0;
    exportCsvBtn.disabled = total === 0;

    if (activeTab === 'emails') renderEmails();
    else renderPhones();
  }

  function showStatus(msg, type = 'info') {
    statusDiv.textContent = msg;
    statusDiv.classList.remove('hidden', 'bg-green-50', 'text-green-700', 'bg-red-50', 'text-red-700', 'bg-blue-50', 'text-blue-700');
    if (type === 'success') statusDiv.classList.add('bg-green-50', 'text-green-700');
    else if (type === 'error') statusDiv.classList.add('bg-red-50', 'text-red-700');
    else statusDiv.classList.add('bg-blue-50', 'text-blue-700');
    setTimeout(() => statusDiv.classList.add('hidden'), 5000);
  }

  // ======================================================
  // ===== মূল স্ক্র্যাপিং এপিআই কল (পরিবর্তিত অংশ) =====
  // ======================================================
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
    progressLabel.textContent = 'Analyzing context & scraping...';

    try {
      // ----- পরিবর্তিত অংশ শুরু -----
      const response = await fetch('/api/finder-api/website-secret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url, limit, depth, force, includeSubdomains })
      });

      let result;
      const contentType = response.headers.get("content-type");
      // সার্ভার যদি JSON না পাঠায়, তাহলে সুন্দর এরর মেসেজ দেখান
      if (contentType && contentType.indexOf("application/json") !== -1) {
        result = await response.json();
      } else {
        // HTTP স্ট্যাটাস কোডও মেসেজে যোগ করা হলো
        throw new Error(`Server returned an error (HTTP ${response.status}). The website might be too heavy or is blocking the scraper.`);
      }

      if (!response.ok) {
        throw new Error(result.error || `Scraping failed with status ${response.status}`);
      }
      // ----- পরিবর্তিত অংশ শেষ -----

      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      progressLabel.textContent = 'Done!';

      if (result.success && result.data) {
        updateUI({ emails: result.data.emails || [], phones: result.data.phones || [] });
        showStatus(`Extraction complete. Intelligent parsing applied.`, 'success');
      } else {
        // ফলব্যাক
        updateUI({ 
          emails: (result.emails || []).map(e => ({email: e, domain: `@${e.split('@')[1]||'unknown'}`})), 
          phones: (result.phones || []).map(p => ({phone: p, country: 'Unknown'})) 
        });
        showStatus(`Scraped items successfully`, 'success');
      }
    } catch (err) {
      // এখন এরর মেসেজ ক্লিন এবং ইউজার‑বান্ধব
      showStatus('Error: ' + err.message, 'error');
    } finally {
      scrapeBtn.disabled = false;
      setTimeout(() => progressContainer.classList.add('hidden'), 1500);
    }
  }

  // ===== কপি অল ও এক্সপোর্ট =====
  copyAllBtn.addEventListener('click', function() {
    const emailStrings = (currentData.emails || []).map(e => e.email);
    const phoneStrings = (currentData.phones || []).map(p => p.phone);
    const all = [...emailStrings, ...phoneStrings];
    if (!all.length) return;
    navigator.clipboard.writeText(all.join('\n')).then(() => {
      showStatus(`Copied ${all.length} items to clipboard`, 'success');
    });
  });

  exportCsvBtn.addEventListener('click', function() {
    const emails = currentData.emails || [];
    const phones = currentData.phones || [];
    if (!emails.length && !phones.length) return;
    
    let csv = 'Type,Contact,Category,Status,Meta\n';
    emails.forEach(e => csv += `Email,"${e.email}","${e.domain}","${e.status||'Unverified'}","${e.meta||''}"\n`);
    phones.forEach(p => csv += `Phone,"${p.phone}","${p.country}","${p.status||'Unverified'}","${p.meta||''}"\n`);
    
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
