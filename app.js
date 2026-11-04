/**
 * Executive Tele-Dialer & Google Maps Lead Engine
 * Zero API Keys - Direct Sync with Data/data.csv
 */
(() => {
  'use strict';

  // --- APPLICATION STATE ---
  let leads = [];
  let filteredLeads = [];
  let selectedId = null;
  let activeFilter = 'all';
  let autoNext = false;
  let isServer = false;

  const STORAGE_KEY = 'exec_dialer_leads_gmaps_v2';

  // --- INITIALIZATION ---
  async function init() {
    registerEvents();
    await loadInitialLeads();
    renderQueue();
    updateMetrics();

    if (leads.length > 0) {
      selectLead(leads[0].id);
    }
    updateDiscoveryMapFrame();
  }

  // --- DATA LOADING & PERSISTENCE ---
  async function loadInitialLeads() {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          leads = data;
          isServer = true;
          return;
        }
      }
    } catch (e) {
      // Local server not active, fallback to localStorage
    }

    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      try {
        leads = JSON.parse(localData);
        return;
      } catch (e) {}
    }

    // Default fallback seed
    leads = [
      {
        id: '1',
        company: 'Civil Liberties Bar',
        name: 'General Manager',
        phone: '+1 (416) 546-5634',
        email: 'info@civillibertiesbar.com',
        city: 'Toronto',
        street_address: '878 Bloor St W',
        website: 'https://civillibertiesbar.com',
        stage: 'Fresh',
        notes: 'Verified cocktail bar'
      },
      {
        id: '2',
        company: 'BarChef',
        name: 'Bar Lead',
        phone: '+1 (416) 868-4800',
        email: 'info@barchef.com',
        city: 'Toronto',
        street_address: '472 Queen St W',
        website: 'https://barchef.com',
        stage: 'Fresh',
        notes: 'Queen West lounge'
      }
    ];
    persistLeads();
  }

  function persistLeads() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));

    if (isServer) {
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leads)
      }).catch(() => {});
    }
    updateMetrics();
  }

  // --- QUEUE RENDERING ---
  function renderQueue() {
    const queueEl = document.getElementById('queueList');
    queueEl.innerHTML = '';

    const query = document.getElementById('queueSearch').value.toLowerCase().trim();

    filteredLeads = leads.filter(l => {
      const matchFilter = (activeFilter === 'all') || (l.stage === activeFilter);
      const matchSearch = !query ||
        l.company.toLowerCase().includes(query) ||
        (l.city && l.city.toLowerCase().includes(query)) ||
        (l.phone && l.phone.includes(query)) ||
        (l.name && l.name.toLowerCase().includes(query));
      return matchFilter && matchSearch;
    });

    if (filteredLeads.length === 0) {
      queueEl.innerHTML = `<div style="text-align:center; padding:32px 10px; color:#9ca3af;">No accounts in view</div>`;
      return;
    }

    filteredLeads.forEach(lead => {
      const row = document.createElement('div');
      row.className = `queue-item ${lead.id === selectedId ? 'active' : ''}`;
      row.onclick = () => selectLead(lead.id);

      row.innerHTML = `
        <div>
          <div class="q-title">${escapeHtml(lead.company)}</div>
          <div class="q-sub">${escapeHtml(lead.city || 'ON')} &bull; ${escapeHtml(lead.phone || 'No phone')}</div>
        </div>
        <span class="tag ${escapeHtml(lead.stage || 'Fresh')}">${escapeHtml(lead.stage || 'Fresh')}</span>
      `;
      queueEl.appendChild(row);
    });
  }

  // --- LEAD SELECTION & GOOGLE MAPS EMBEDDING ---
  function selectLead(id) {
    selectedId = id;
    const lead = leads.find(l => l.id === id);

    const ph = document.getElementById('cockpitPlaceholder');
    const body = document.getElementById('cockpitBody');
    const mapFrame = document.getElementById('leadGMapFrame');
    const extLink = document.getElementById('btnOpenExternalGMap');

    if (!lead) {
      ph.classList.remove('hidden');
      body.classList.add('hidden');
      mapFrame.src = 'about:blank';
      renderQueue();
      return;
    }

    ph.classList.add('hidden');
    body.classList.remove('hidden');

    document.getElementById('leadCompany').textContent = lead.company;
    document.getElementById('leadSubtitle').textContent = `${lead.name || 'Decision Maker'} • ${lead.city || 'Ontario'}`;
    document.getElementById('leadPhone').textContent = lead.phone || 'No phone';

    const callBtn = document.getElementById('btnCallAction');
    callBtn.href = lead.phone ? `tel:${encodeURIComponent(lead.phone)}` : '#';

    const emailBtn = document.getElementById('btnEmailAction');
    emailBtn.href = lead.email ? `mailto:${encodeURIComponent(lead.email)}` : 'mailto:';
    document.getElementById('leadEmailSub').textContent = lead.email || 'No email recorded';

    document.getElementById('fieldLeadName').value = lead.name || '';
    document.getElementById('fieldLeadCity').value = lead.city || '';
    document.getElementById('fieldLeadAddress').value = lead.street_address || '';
    document.getElementById('fieldLeadWebsite').value = lead.website || '';
    document.getElementById('fieldLeadNotes').value = lead.notes || '';

    // Free Google Maps Search URL (Zero API Key)
    const mapQuery = `${lead.company} ${lead.street_address || ''} ${lead.city || 'Ontario'}`.trim();
    const encoded = encodeURIComponent(mapQuery);
    mapFrame.src = `https://maps.google.com/maps?q=${encoded}&t=&z=14&ie=UTF8&iwloc=&output=embed`;
    extLink.href = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

    renderQueue();
  }

  function updateMetrics() {
    document.getElementById('statTotal').textContent = leads.length;
    document.getElementById('statFresh').textContent = leads.filter(l => (l.stage || 'Fresh') === 'Fresh').length;
    document.getElementById('statConnected').textContent = leads.filter(l => l.stage === 'Connected').length;
    document.getElementById('statCallbacks').textContent = leads.filter(l => l.stage === 'Callback').length;
  }

  function setDisposition(stage) {
    const lead = leads.find(l => l.id === selectedId);
    if (!lead) return;

    lead.stage = stage;
    persistLeads();
    renderQueue();

    if (autoNext) {
      stepQueue(1);
    } else {
      selectLead(lead.id);
    }
  }

  function stepQueue(dir) {
    if (filteredLeads.length === 0) return;
    const curIdx = filteredLeads.findIndex(l => l.id === selectedId);
    let nextIdx = curIdx + dir;
    if (nextIdx >= filteredLeads.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = filteredLeads.length - 1;
    selectLead(filteredLeads[nextIdx].id);
  }

  // --- GOOGLE MAPS DISCOVERY PANEL ---
  function updateDiscoveryMapFrame() {
    const q = document.getElementById('mapSearchQuery').value || 'Cocktail Bars';
    const city = document.getElementById('mapCitySelect').value || 'Toronto';
    const frame = document.getElementById('discoveryGMapFrame');
    const label = document.getElementById('mapsStatusLabel');

    const fullQuery = `${q} in ${city} Ontario`;
    label.textContent = `Google Maps Explorer: "${fullQuery}"`;
    frame.src = `https://maps.google.com/maps?q=${encodeURIComponent(fullQuery)}&t=&z=13&ie=UTF8&iwloc=&output=embed`;
  }

  function openExternalGoogleMapsTab() {
    const q = document.getElementById('mapSearchQuery').value || 'Cocktail Bars';
    const city = document.getElementById('mapCitySelect').value || 'Toronto';
    const url = `https://www.google.com/maps/search/${encodeURIComponent(q + ' in ' + city + ' Ontario')}`;
    window.open(url, '_blank');
  }

  async function fetchMapsLeadsBackend() {
    const q = document.getElementById('mapSearchQuery').value || 'Cocktail Bars';
    const city = document.getElementById('mapCitySelect').value || 'Toronto';
    const btn = document.getElementById('btnFetchMapsLeads');

    btn.textContent = 'Mining Google Maps...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/scrape-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, city: city })
      });
      const data = await res.json();
      if (data && data.leads && data.leads.length > 0) {
        leads = [...data.leads, ...leads];
        persistLeads();
        renderQueue();

        const banner = document.getElementById('harvestCountBanner');
        const txt = document.getElementById('harvestCountText');
        banner.classList.remove('hidden');
        txt.textContent = `Extracted ${data.leads.length} leads!`;
        selectLead(data.leads[0].id);
      }
    } catch (e) {
      alert('Could not pull from server. Ensure python3 leadgen.py is running.');
    } finally {
      btn.textContent = '↓ Auto-Extract Leads From Maps (No Key)';
      btn.disabled = false;
    }
  }

  // --- GOOGLE MAPS BUSINESS CARD QUICK-PASTE PARSER ---
  function parsePastedCardText() {
    const raw = document.getElementById('rawCardPasteArea').value.trim();
    if (!raw) return alert('Please paste text copied from a Google Maps listing.');

    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const company = lines[0] || 'Unknown Business';

    // Regex for North American Phone Numbers
    const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
    const phoneMatch = raw.match(phoneRegex);
    const phone = phoneMatch ? `+1 (${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}` : '+1 (416) 555-0199';

    // Regex for Website
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(?:ca|com|org))/i;
    const urlMatch = raw.match(urlRegex);
    const website = urlMatch ? (urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`) : '';

    // Search for address-like string
    let streetAddress = '';
    const city = document.getElementById('mapCitySelect').value || 'Toronto';
    for (const line of lines) {
      if (/\b(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Way)\b/i.test(line)) {
        streetAddress = line;
        break;
      }
    }
    if (!streetAddress && lines.length > 2) {
      streetAddress = lines[2];
    }

    const newLead = {
      id: String(Date.now()),
      company: company,
      name: 'General Manager',
      phone: phone,
      email: `info@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.ca`,
      city: city,
      street_address: streetAddress || 'Ontario Street',
      website: website,
      stage: 'Fresh',
      notes: 'Pasted from Google Maps listing'
    };

    leads.unshift(newLead);
    persistLeads();
    renderQueue();
    selectLead(newLead.id);

    document.getElementById('rawCardPasteArea').value = '';
    document.getElementById('tabNavCockpit').click();
  }

  // --- CSV IMPORT & EXPORT ---
  function exportCsv() {
    if (leads.length === 0) return alert('No leads to export.');
    const headers = ['company', 'name', 'phone', 'email', 'city', 'street_address', 'website', 'stage', 'notes'];
    const rows = leads.map(l => headers.map(h => `"${String(l[h] || '').replace(/"/g, '""')}"`).join(','));
    const csvContent = [headers.join(','), ...rows].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCsv(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const parsed = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        const obj = { id: String(Date.now() + i) };
        headers.forEach((h, idx) => { obj[h] = cols[idx] || ''; });
        if (!obj.stage) obj.stage = 'Fresh';
        parsed.push(obj);
      }

      leads = [...parsed, ...leads];
      persistLeads();
      renderQueue();
      if (parsed.length > 0) selectLead(parsed[0].id);
    };
    reader.readAsText(file);
  }

  // --- EVENT REGISTRATION ---
  function registerEvents() {
    // Navigation tabs
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-panel').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.view).classList.add('active');
      };
    });

    document.getElementById('btnTransferToDialer').onclick = () => {
      document.getElementById('tabNavCockpit').click();
    };

    // Filter buttons
    document.querySelectorAll('.stage-filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.stage-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderQueue();
      };
    });

    document.getElementById('queueSearch').oninput = () => renderQueue();

    // Auto-Next toggle
    const btnAuto = document.getElementById('btnAutoNext');
    btnAuto.onclick = () => {
      autoNext = !autoNext;
      btnAuto.textContent = `Auto-Next: ${autoNext ? 'ON' : 'OFF'}`;
      btnAuto.classList.toggle('btn-primary', autoNext);
    };

    // Dispositions
    document.querySelectorAll('.btn-dispo').forEach(btn => {
      btn.onclick = () => setDisposition(btn.dataset.stage);
    });

    // Notes auto-save
    document.getElementById('fieldLeadNotes').oninput = (e) => {
      const lead = leads.find(l => l.id === selectedId);
      if (lead) {
        lead.notes = e.target.value;
        persistLeads();
      }
    };

    // Form inputs auto-save
    ['fieldLeadName', 'fieldLeadCity', 'fieldLeadAddress', 'fieldLeadWebsite'].forEach(fieldId => {
      document.getElementById(fieldId).onchange = (e) => {
        const lead = leads.find(l => l.id === selectedId);
        if (!lead) return;
        if (fieldId === 'fieldLeadName') lead.name = e.target.value;
        if (fieldId === 'fieldLeadCity') lead.city = e.target.value;
        if (fieldId === 'fieldLeadAddress') lead.street_address = e.target.value;
        if (fieldId === 'fieldLeadWebsite') lead.website = e.target.value;
        persistLeads();
      };
    });

    // Delete lead
    document.getElementById('btnDeleteCurrentLead').onclick = () => {
      if (!confirm('Remove this account?')) return;
      leads = leads.filter(l => l.id !== selectedId);
      persistLeads();
      selectedId = null;
      renderQueue();
      if (filteredLeads.length > 0) selectLead(filteredLeads[0].id);
      else selectLead(null);
    };

    // Discovery Google Maps buttons
    document.getElementById('mapSearchQuery').onchange = updateDiscoveryMapFrame;
    document.getElementById('mapCitySelect').onchange = updateDiscoveryMapFrame;
    document.getElementById('btnOpenGoogleMapsTab').onclick = openExternalGoogleMapsTab;
    document.getElementById('btnFetchMapsLeads').onclick = fetchMapsLeadsBackend;
    document.getElementById('btnParseCardText').onclick = parsePastedCardText;

    // Export & Import
    document.getElementById('btnExportCsv').onclick = exportCsv;
    document.getElementById('inputCsv').onchange = (e) => {
      if (e.target.files.length > 0) importCsv(e.target.files[0]);
    };

    // Manual Add Modal
    const modal = document.getElementById('addLeadModal');
    document.getElementById('btnShowAddModal').onclick = () => modal.classList.remove('hidden');
    document.getElementById('btnCloseModal').onclick = () => modal.classList.add('hidden');
    document.getElementById('btnCancelModal').onclick = () => modal.classList.add('hidden');

    document.getElementById('addLeadForm').onsubmit = (e) => {
      e.preventDefault();
      const newLead = {
        id: String(Date.now()),
        company: document.getElementById('newLeadCompany').value.trim(),
        name: document.getElementById('newLeadName').value.trim(),
        phone: document.getElementById('newLeadPhone').value.trim(),
        email: document.getElementById('newLeadEmail').value.trim(),
        city: document.getElementById('newLeadCity').value.trim(),
        street_address: document.getElementById('newLeadAddress').value.trim(),
        website: '',
        stage: 'Fresh',
        notes: ''
      };
      leads.unshift(newLead);
      persistLeads();
      modal.classList.add('hidden');
      document.getElementById('addLeadForm').reset();
      selectLead(newLead.id);
    };

    // Keyboard Shortcuts
    window.onkeydown = (e) => {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowDown') { e.preventDefault(); stepQueue(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); stepQueue(-1); }
      if (e.key === 'c' || e.key === 'C') {
        const lead = leads.find(l => l.id === selectedId);
        if (lead && lead.phone) window.location.href = `tel:${lead.phone}`;
      }
      if (e.key === '1') setDisposition('No Answer');
      if (e.key === '2') setDisposition('Callback');
      if (e.key === '3') setDisposition('Connected');
      if (e.key === '4') setDisposition('DNC');
    };
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  window.addEventListener('DOMContentLoaded', init);
})();