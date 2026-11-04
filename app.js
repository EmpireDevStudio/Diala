/**
 * Executive Tele-Dialer & Lead Engine - Rock Solid Edition
 */
(() => {
  'use strict';

  // --- STATE ---
  let leads = [];
  let filteredLeads = [];
  let selectedId = null;
  let activeFilter = 'all';
  let autoNext = false;
  let isServerConnected = false;

  const STORAGE_KEY = 'exec_dialer_leads_v1';

  // City Area Codes for realistic telephone generation
  const AREA_CODES = {
    'Toronto': '416',
    'Mississauga': '905',
    'Hamilton': '905',
    'Ottawa': '613',
    'London': '519',
    'Waterloo': '519'
  };

  // --- INITIALIZATION ---
  async function init() {
    setupEventListeners();
    await loadLeads();
    renderQueue();
    updateStats();

    if (leads.length > 0) {
      selectLead(leads[0].id);
    }
  }

  // --- DATA LOADING & PERSISTENCE ---
  async function loadLeads() {
    // 1. Try Python API first
    try {
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          leads = data;
          isServerConnected = true;
          return;
        }
      }
    } catch (e) {
      // Python server not running, fallback to localStorage
    }

    // 2. Try LocalStorage
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        leads = JSON.parse(local);
        return;
      } catch (e) {}
    }

    // 3. Fallback Seed
    leads = [
      {
        id: '1',
        company: '6ix Dispensary',
        name: 'Store Manager',
        phone: '+1 (647) 222-7770',
        email: 'admin@6ixdispensary.com',
        city: 'Toronto',
        street_address: '863 Bloor St W',
        stage: 'Fresh',
        notes: 'Bloorcourt location'
      },
      {
        id: '2',
        company: 'Civil Liberties',
        name: 'Bar Lead',
        phone: '+1 (416) 546-5634',
        email: 'info@civillibertiesbar.com',
        city: 'Toronto',
        street_address: '878 Bloor St W',
        stage: 'Fresh',
        notes: 'Cocktail lounge on Bloor'
      }
    ];
    persistLeads();
  }

  function persistLeads() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));

    // Also sync to server if running
    if (isServerConnected) {
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leads)
      }).catch(() => {});
    }
    updateStats();
  }

  // --- UI RENDERING ---
  function renderQueue() {
    const listEl = document.getElementById('leadList');
    listEl.innerHTML = '';

    const query = document.getElementById('searchInput').value.toLowerCase().trim();

    filteredLeads = leads.filter(l => {
      const matchFilter = (activeFilter === 'all') || (l.stage === activeFilter);
      const matchQuery = !query ||
        l.company.toLowerCase().includes(query) ||
        (l.city && l.city.toLowerCase().includes(query)) ||
        (l.phone && l.phone.includes(query)) ||
        (l.name && l.name.toLowerCase().includes(query));
      return matchFilter && matchQuery;
    });

    if (filteredLeads.length === 0) {
      listEl.innerHTML = `<div style="text-align:center; padding:30px 10px; color:#9ca3af;">No prospects match</div>`;
      return;
    }

    filteredLeads.forEach(lead => {
      const item = document.createElement('div');
      item.className = `lead-item ${lead.id === selectedId ? 'active' : ''}`;
      item.onclick = () => selectLead(lead.id);

      item.innerHTML = `
        <div>
          <div class="lead-item-name">${escapeHtml(lead.company)}</div>
          <div class="lead-item-sub">${escapeHtml(lead.city || 'Ontario')} &bull; ${escapeHtml(lead.phone)}</div>
        </div>
        <span class="stage-tag ${escapeHtml(lead.stage || 'Fresh')}">${escapeHtml(lead.stage || 'Fresh')}</span>
      `;
      listEl.appendChild(item);
    });
  }

  function selectLead(id) {
    selectedId = id;
    const lead = leads.find(l => l.id === id);

    const empty = document.getElementById('emptyState');
    const detail = document.getElementById('leadDetail');

    if (!lead) {
      empty.classList.remove('hidden');
      detail.classList.add('hidden');
      renderQueue();
      return;
    }

    empty.classList.add('hidden');
    detail.classList.remove('hidden');

    document.getElementById('leadCompany').textContent = lead.company;
    document.getElementById('leadSub').textContent = `${lead.name || 'Decision Maker'} • ${lead.city || 'Ontario'}`;
    document.getElementById('leadPhone').textContent = lead.phone || 'No phone';

    const callBtn = document.getElementById('btnCallLead');
    callBtn.href = lead.phone ? `tel:${encodeURIComponent(lead.phone)}` : '#';

    const emailBtn = document.getElementById('btnEmailLead');
    emailBtn.href = lead.email ? `mailto:${encodeURIComponent(lead.email)}?subject=Direct Inquiry` : 'mailto:';

    document.getElementById('fieldLeadName').value = lead.name || '';
    document.getElementById('fieldLeadCity').value = lead.city || '';
    document.getElementById('fieldLeadAddress').value = lead.street_address || '';
    document.getElementById('fieldLeadNotes').value = lead.notes || '';

    renderQueue();
  }

  function updateStats() {
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
      navigateQueue(1);
    } else {
      selectLead(lead.id);
    }
  }

  function navigateQueue(direction) {
    if (filteredLeads.length === 0) return;
    const curIdx = filteredLeads.findIndex(l => l.id === selectedId);
    let nextIdx = curIdx + direction;
    if (nextIdx >= filteredLeads.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = filteredLeads.length - 1;
    selectLead(filteredLeads[nextIdx].id);
  }

  // --- LEAD GENERATOR ---
  function generateLeads() {
    const city = document.getElementById('genCity').value;
    const industry = document.getElementById('genIndustry').value;
    const count = parseInt(document.getElementById('genCount').value, 10) || 5;

    const areaCode = AREA_CODES[city] || '416';
    const prefixes = ['The Royal', 'Pinnacle', 'Apex', 'Crown', 'Silver', 'Craft', 'Heritage', 'Northern'];
    const streets = ['King St W', 'Queen St E', 'Dundas St', 'Richmond St', 'Main St', 'Wellington St'];

    const newItems = [];
    for (let i = 0; i < count; i++) {
      const pfx = prefixes[Math.floor(Math.random() * prefixes.length)];
      const street = streets[Math.floor(Math.random() * streets.length)];
      const num = Math.floor(Math.random() * 800) + 12;
      const comp = `${pfx} ${industry} of ${city}`;
      const phone = `+1 (${areaCode}) ${Math.floor(Math.random() * 700 + 200)}-${Math.floor(Math.random() * 8999 + 1000)}`;

      newItems.push({
        id: String(Date.now() + i),
        company: comp,
        name: 'General Manager',
        phone: phone,
        email: `contact@${pfx.toLowerCase()}${city.toLowerCase()}.ca`,
        city: city,
        street_address: `${num} ${street}`,
        stage: 'Fresh',
        notes: `Generated list: ${industry}`
      });
    }

    leads = [...newItems, ...leads];
    persistLeads();
    renderQueue();
    selectLead(newItems[0].id);
  }

  // --- CSV IMPORT & EXPORT ---
  function exportCsv() {
    if (leads.length === 0) return alert('No leads to export.');
    const headers = ['company', 'name', 'phone', 'email', 'city', 'street_address', 'stage', 'notes'];
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

  function importCsvFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) return alert('Invalid CSV format.');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const parsed = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length === 0 || !cols[0]) continue;

        const obj = { id: String(Date.now() + i) };
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] || '';
        });
        if (!obj.stage) obj.stage = 'Fresh';
        parsed.push(obj);
      }

      if (parsed.length > 0) {
        leads = [...parsed, ...leads];
        persistLeads();
        renderQueue();
        selectLead(parsed[0].id);
        alert(`Imported ${parsed.length} leads successfully!`);
      }
    };
    reader.readAsText(file);
  }

  // --- EVENTS ---
  function setupEventListeners() {
    // Filter tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderQueue();
      };
    });

    // Search
    document.getElementById('searchInput').oninput = () => renderQueue();

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

    // Inline field updates
    ['fieldLeadName', 'fieldLeadCity', 'fieldLeadAddress'].forEach(fieldId => {
      document.getElementById(fieldId).onchange = (e) => {
        const lead = leads.find(l => l.id === selectedId);
        if (!lead) return;
        if (fieldId === 'fieldLeadName') lead.name = e.target.value;
        if (fieldId === 'fieldLeadCity') lead.city = e.target.value;
        if (fieldId === 'fieldLeadAddress') lead.street_address = e.target.value;
        persistLeads();
      };
    });

    // Delete lead
    document.getElementById('btnDeleteLead').onclick = () => {
      if (!confirm('Delete this prospect?')) return;
      leads = leads.filter(l => l.id !== selectedId);
      persistLeads();
      selectedId = null;
      renderQueue();
      if (filteredLeads.length > 0) selectLead(filteredLeads[0].id);
      else selectLead(null);
    };

    // Generator
    document.getElementById('btnGenerateLeads').onclick = generateLeads;

    // Export & Import
    document.getElementById('btnExportCsv').onclick = exportCsv;
    const inputCsv = document.getElementById('inputCsv');
    inputCsv.onchange = (e) => {
      if (e.target.files.length > 0) importCsvFile(e.target.files[0]);
    };

    // Add Lead Modal
    const modal = document.getElementById('addModal');
    document.getElementById('btnShowAddModal').onclick = () => modal.classList.remove('hidden');
    document.getElementById('btnCancelAdd').onclick = () => modal.classList.add('hidden');

    document.getElementById('addLeadForm').onsubmit = (e) => {
      e.preventDefault();
      const newLead = {
        id: String(Date.now()),
        company: document.getElementById('newCompany').value.trim(),
        name: document.getElementById('newName').value.trim(),
        phone: document.getElementById('newPhone').value.trim(),
        email: document.getElementById('newEmail').value.trim(),
        city: document.getElementById('newCity').value.trim(),
        street_address: document.getElementById('newAddress').value.trim(),
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

      if (e.key === 'ArrowDown') { e.preventDefault(); navigateQueue(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); navigateQueue(-1); }
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