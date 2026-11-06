/**
 * FLIPDIALLER LITE — ESSENTIALS ONLY
 * Core calling loop, stage tracking, auto-notes & CSV engine.
 */

(() => {
  'use strict';

  // --- 1. LOCAL PERSISTENCE (INDEXEDDB) ---
  const DB_NAME = 'FlipDiallerLiteDB';
  let db = null;

  function initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const store = e.target.result.createObjectStore('contacts', { keyPath: 'id' });
        store.createIndex('stage', 'stage', { unique: false });
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  const dbAPI = {
    getAll: () => new Promise(res => {
      db.transaction('contacts', 'readonly').objectStore('contacts').getAll().onsuccess = (e) => res(e.target.result || []);
    }),
    put: (item) => new Promise(res => {
      db.transaction('contacts', 'readwrite').objectStore('contacts').put(item).onsuccess = () => res(item);
    }),
    delete: (id) => new Promise(res => {
      db.transaction('contacts', 'readwrite').objectStore('contacts').delete(id).onsuccess = () => res(true);
    })
  };

  // --- 2. STATE ---
  const state = {
    contacts: [],
    filtered: [],
    activeId: null,
    stageFilter: 'fresh',
    search: '',
    notesTimer: null
  };

  // --- 3. DOM NODES ---
  const el = {
    list: document.getElementById('contactList'),
    cockpitEmpty: document.getElementById('cockpitEmpty'),
    cockpitContent: document.getElementById('cockpitContent'),
    paneCockpit: document.getElementById('paneCockpit'),
    btnBackToList: document.getElementById('btnBackToList'),
    // Lead Elements
    leadCompany: document.getElementById('leadCompany'),
    leadSubtitle: document.getElementById('leadSubtitle'),
    leadPhone: document.getElementById('leadPhone'),
    btnCallLead: document.getElementById('btnCallLead'),
    leadNotes: document.getElementById('leadNotes'),
    notesSaveIndicator: document.getElementById('notesSaveIndicator'),
    leadEmail: document.getElementById('leadEmail'),
    btnEmailLead: document.getElementById('btnEmailLead'),
    // Counts
    countFresh: document.getElementById('countFresh'),
    countCallback: document.getElementById('countCallback'),
    countContacted: document.getElementById('countContacted'),
    // Modals
    dialogForm: document.getElementById('dialogLeadForm'),
    dialogCallback: document.getElementById('dialogCallback'),
    leadForm: document.getElementById('leadForm')
  };

  // --- 4. RENDER & FILTER ---
  function applyFilters() {
    const q = state.search.toLowerCase().trim();
    const now = new Date();

    state.filtered = state.contacts.filter(c => {
      const matchSearch = !q ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q));

      if (!matchSearch) return false;
      if (state.stageFilter === 'all') return true;
      if (state.stageFilter === 'callback') {
        return c.stage === 'callback' && (!c.callback_at || new Date(c.callback_at) <= now);
      }
      return c.stage === state.stageFilter;
    });

    renderList();
    updateCounts();

    // Preserve or reset selected lead
    if (state.activeId && !state.contacts.some(c => c.id === state.activeId)) {
      state.activeId = null;
    }
    if (!state.activeId && state.filtered.length > 0 && window.innerWidth >= 800) {
      selectLead(state.filtered[0].id);
    } else {
      renderActiveCockpit();
    }
  }

  function renderList() {
    if (state.filtered.length === 0) {
      el.list.innerHTML = `<div style="padding:24px; text-align:center; color:var(--ink-muted); font-size:0.85rem;">No contacts found.</div>`;
      return;
    }

    el.list.innerHTML = state.filtered.map(c => `
      <div class="contact-card ${c.id === state.activeId ? 'active' : ''}" data-id="${c.id}">
        <div class="card-title">${c.company || c.name || 'Unnamed Contact'}</div>
        <div class="card-sub">${c.company && c.name ? c.name : (c.title || 'Lead')}</div>
        <div class="card-meta">
          <span>${c.phone || 'No Phone'}</span>
          <span>${c.attempts ? 'Att: ' + c.attempts : ''}</span>
        </div>
      </div>
    `).join('');
  }

  function updateCounts() {
    const now = new Date();
    el.countFresh.textContent = state.contacts.filter(c => c.stage === 'fresh').length;
    el.countCallback.textContent = state.contacts.filter(c => c.stage === 'callback' && (!c.callback_at || new Date(c.callback_at) <= now)).length;
    el.countContacted.textContent = state.contacts.filter(c => c.stage === 'contacted').length;
  }

  function selectLead(id) {
    state.activeId = id;
    renderActiveCockpit();
    renderList();

    if (window.innerWidth < 800) {
      el.paneCockpit.classList.add('mobile-visible');
    }
  }

  function renderActiveCockpit() {
    const c = state.contacts.find(x => x.id === state.activeId);

    if (!c) {
      el.cockpitEmpty.classList.remove('hidden');
      el.cockpitContent.classList.add('hidden');
      return;
    }

    el.cockpitEmpty.classList.add('hidden');
    el.cockpitContent.classList.remove('hidden');

    el.leadCompany.textContent = c.company || c.name || 'Unnamed Lead';
    el.leadSubtitle.textContent = [c.name, c.title].filter(Boolean).join(' • ') || 'Lead Contact';
    el.leadPhone.textContent = c.phone || 'No phone recorded';

    const cleanNumber = (c.phone || '').replace(/[^\d+]/g, '');
    el.btnCallLead.href = cleanNumber ? `tel:${cleanNumber}` : '#';

    el.leadNotes.value = c.notes || '';
    el.leadEmail.textContent = c.email || 'None';

    if (c.email) {
      el.btnEmailLead.href = `mailto:${c.email}`;
      el.btnEmailLead.style.display = 'inline-block';
    } else {
      el.btnEmailLead.style.display = 'none';
    }
  }

  // --- 5. DISPOSITIONS & ACTIONS ---
  async function markOutcome(type) {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (!c) return;

    if (type === 'no_answer') {
      c.attempts = (c.attempts || 0) + 1;
      c.stage = 'fresh';
      await dbAPI.put(c);
    } else if (type === 'contacted') {
      c.stage = 'contacted';
      await dbAPI.put(c);
    } else if (type === 'delete') {
      if (!confirm(`Delete ${c.company || c.name}?`)) return;
      await dbAPI.delete(c.id);
      state.contacts = state.contacts.filter(x => x.id !== c.id);
      state.activeId = null;
    }

    advanceToNextLead();
  }

  function advanceToNextLead() {
    applyFilters();
    if (state.filtered.length > 0) {
      selectLead(state.filtered[0].id);
    } else {
      state.activeId = null;
      renderActiveCockpit();
    }
  }

  // --- 6. AUTO-SAVING SCRATCHPAD ---
  el.leadNotes.addEventListener('input', () => {
    clearTimeout(state.notesTimer);
    state.notesTimer = setTimeout(async () => {
      const c = state.contacts.find(x => x.id === state.activeId);
      if (c) {
        c.notes = el.leadNotes.value;
        await dbAPI.put(c);
        el.notesSaveIndicator.classList.add('visible');
        setTimeout(() => el.notesSaveIndicator.classList.remove('visible'), 1200);
      }
    }, 400);
  });

  // --- 7. CSV IMPORT / EXPORT (RFC 4180 COMPATIBLE) ---
  function parseCSV(text) {
    const rows = [];
    let curRow = [''];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === '"') {
        if (inQuotes && n === '"') { curRow[curRow.length - 1] += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (c === ',' && !inQuotes) {
        curRow.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && n === '\n') i++;
        if (curRow.length > 1 || curRow[0] !== '') rows.push(curRow);
        curRow = [''];
      } else {
        curRow[curRow.length - 1] += c;
      }
    }
    if (curRow.length > 1 || curRow[0] !== '') rows.push(curRow);
    return rows;
  }

  document.getElementById('csvFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return alert('Invalid or empty CSV.');

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const findCol = (keys) => headers.findIndex(h => keys.includes(h));

    const cIdx = findCol(['company', 'business', 'business name', 'organization']);
    const nIdx = findCol(['name', 'contact', 'contact name', 'full name']);
    const pIdx = findCol(['phone', 'mobile', 'tel', 'phone number']);
    const eIdx = findCol(['email', 'mail']);
    const tIdx = findCol(['title', 'role', 'job title']);
    const ntIdx = findCol(['notes', 'comments', 'memo']);

    let added = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const company = (cIdx !== -1 ? r[cIdx] : '') || '';
      const name = (nIdx !== -1 ? r[nIdx] : '') || '';
      const phone = (pIdx !== -1 ? r[pIdx] : '') || '';

      if (!company && !name && !phone) continue;

      const contact = {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        company: company.trim(),
        name: name.trim(),
        phone: phone.trim(),
        email: (eIdx !== -1 ? r[eIdx] : '').trim(),
        title: (tIdx !== -1 ? r[tIdx] : '').trim(),
        notes: (ntIdx !== -1 ? r[ntIdx] : '').trim(),
        stage: 'fresh',
        attempts: 0,
        callback_at: null
      };

      await dbAPI.put(contact);
      state.contacts.push(contact);
      added++;
    }

    e.target.value = '';
    applyFilters();
    alert(`Imported ${added} contacts.`);
  });

  document.getElementById('btnExportCsv').onclick = () => {
    if (state.contacts.length === 0) return alert('No contacts to export.');
    const cols = ['company', 'name', 'phone', 'email', 'title', 'stage', 'attempts', 'notes'];
    const lines = [cols.join(',')];

    state.contacts.forEach(c => {
      lines.push(cols.map(key => `"${(c[key] || '').toString().replace(/"/g, '""')}"`).join(','));
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // --- 8. LEAD ADD / EDIT MODAL ---
  function openLeadModal(contact = null) {
    document.getElementById('formTitle').textContent = contact ? 'Edit Contact' : 'Add New Contact';
    document.getElementById('formId').value = contact ? contact.id : '';
    document.getElementById('formCompany').value = contact ? (contact.company || '') : '';
    document.getElementById('formName').value = contact ? (contact.name || '') : '';
    document.getElementById('formTitleField').value = contact ? (contact.title || '') : '';
    document.getElementById('formPhone').value = contact ? (contact.phone || '') : '';
    document.getElementById('formEmail').value = contact ? (contact.email || '') : '';
    el.dialogForm.showModal();
  }

  el.leadForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('formId').value;
    let c = state.contacts.find(x => x.id === id);

    if (!c) {
      c = { id: 'c_' + Date.now(), stage: 'fresh', attempts: 0, notes: '', callback_at: null };
      state.contacts.unshift(c);
    }

    c.company = document.getElementById('formCompany').value.trim();
    c.name = document.getElementById('formName').value.trim();
    c.title = document.getElementById('formTitleField').value.trim();
    c.phone = document.getElementById('formPhone').value.trim();
    c.email = document.getElementById('formEmail').value.trim();

    await dbAPI.put(c);
    el.dialogForm.close();
    applyFilters();
    selectLead(c.id);
  };

  document.getElementById('btnNewLead').onclick = () => openLeadModal();
  document.getElementById('btnEditLead').onclick = () => {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (c) openLeadModal(c);
  };
  document.getElementById('btnCancelForm').onclick = () => el.dialogForm.close();

  // --- 9. CALLBACK PICKER ---
  document.getElementById('btnDispCB').onclick = () => {
    document.getElementById('inputCustomCallback').value = '';
    el.dialogCallback.showModal();
  };
  document.getElementById('btnCancelCallback').onclick = () => el.dialogCallback.close();

  async function scheduleCallback(hours, isoCustom = null) {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (!c) return;

    const date = isoCustom ? new Date(isoCustom) : new Date(Date.now() + hours * 3600000);
    c.stage = 'callback';
    c.callback_at = date.toISOString();

    await dbAPI.put(c);
    el.dialogCallback.close();
    advanceToNextLead();
  }

  document.querySelectorAll('[data-cb-hours]').forEach(btn => {
    btn.onclick = () => scheduleCallback(parseInt(btn.dataset.cbHours, 10));
  });

  document.getElementById('btnConfirmCustomCallback').onclick = () => {
    const val = document.getElementById('inputCustomCallback').value;
    if (!val) return alert('Select date/time.');
    scheduleCallback(0, val);
  };

  // --- 10. EVENT HANDLERS & SHORTCUTS ---
  el.list.addEventListener('click', (e) => {
    const card = e.target.closest('.contact-card');
    if (card) selectLead(card.dataset.id);
  });

  el.btnBackToList.onclick = () => el.paneCockpit.classList.remove('mobile-visible');

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.stageFilter = btn.dataset.stage;
      applyFilters();
    };
  });

  document.getElementById('inputSearch').addEventListener('input', (e) => {
    state.search = e.target.value;
    applyFilters();
  });

  document.getElementById('btnDispNA').onclick = () => markOutcome('no_answer');
  document.getElementById('btnDispSpoken').onclick = () => markOutcome('contacted');
  document.getElementById('btnDispDNC').onclick = () => markOutcome('delete');

  // Keybindings (J/K next/prev, C call, N no answer, D spoken)
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('inputSearch').focus();
    } else if (e.key === 'j' || e.key === 'ArrowDown') {
      const idx = state.filtered.findIndex(c => c.id === state.activeId);
      if (idx !== -1 && idx < state.filtered.length - 1) selectLead(state.filtered[idx + 1].id);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      const idx = state.filtered.findIndex(c => c.id === state.activeId);
      if (idx > 0) selectLead(state.filtered[idx - 1].id);
    } else if (e.key === 'c' || e.key === 'C') {
      const c = state.contacts.find(x => x.id === state.activeId);
      if (c && c.phone) window.location.href = `tel:${c.phone.replace(/[^\d+]/g, '')}`;
    } else if (e.key === 'n' || e.key === 'N') {
      markOutcome('no_answer');
    } else if (e.key === 'd' || e.key === 'D') {
      markOutcome('contacted');
    }
  });

  // --- BOOTSTRAP ---
  initDB().then(async () => {
    state.contacts = await dbAPI.getAll();
    applyFilters();
  });

})();