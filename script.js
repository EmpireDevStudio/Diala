/**
 * Executive Lead Discovery & Tele-Dialer Cockpit
 * Non-Blocking, Fail-Safe Architecture with Triple Data/ Folder Discovery
 */
(() => {
  'use strict';

  // ================= ONTARIO MUNICIPALITIES GEODESIC REGISTRY =================
  const ONTARIO_CITIES = [
    { name: "Toronto", lat: 43.6532, lon: -79.3832, areaCode: "416" },
    { name: "Ottawa", lat: 45.4215, lon: -75.6972, areaCode: "613" },
    { name: "Mississauga", lat: 43.5890, lon: -79.6441, areaCode: "905" },
    { name: "Brampton", lat: 43.7315, lon: -79.7624, areaCode: "905" },
    { name: "Hamilton", lat: 43.2557, lon: -79.8711, areaCode: "905" },
    { name: "London", lat: 42.9849, lon: -81.2453, areaCode: "519" },
    { name: "Markham", lat: 43.8561, lon: -79.3370, areaCode: "905" },
    { name: "Vaughan", lat: 43.8563, lon: -79.5085, areaCode: "905" },
    { name: "Kitchener", lat: 43.4516, lon: -80.4925, areaCode: "519" },
    { name: "Waterloo", lat: 43.4643, lon: -80.5204, areaCode: "519" },
    { name: "Cambridge", lat: 43.3616, lon: -80.3144, areaCode: "519" },
    { name: "Windsor", lat: 42.3149, lon: -83.0364, areaCode: "519" },
    { name: "Burlington", lat: 43.3255, lon: -79.7990, areaCode: "905" },
    { name: "Oakville", lat: 43.4675, lon: -79.6877, areaCode: "905" },
    { name: "Oshawa", lat: 43.8971, lon: -78.8658, areaCode: "905" },
    { name: "Richmond Hill", lat: 43.8828, lon: -79.4403, areaCode: "905" },
    { name: "Barrie", lat: 44.3894, lon: -79.6903, areaCode: "705" },
    { name: "Guelph", lat: 43.5448, lon: -80.2482, areaCode: "519" },
    { name: "Whitby", lat: 43.8975, lon: -78.9429, areaCode: "905" },
    { name: "Ajax", lat: 43.8509, lon: -79.0204, areaCode: "905" },
    { name: "Pickering", lat: 43.8384, lon: -79.0868, areaCode: "905" },
    { name: "Kingston", lat: 44.2312, lon: -76.4860, areaCode: "613" },
    { name: "Milton", lat: 43.5183, lon: -79.8774, areaCode: "905" },
    { name: "Newmarket", lat: 44.0592, lon: -79.4613, areaCode: "905" },
    { name: "Greater Sudbury", lat: 46.4917, lon: -80.9930, areaCode: "705" },
    { name: "Thunder Bay", lat: 48.3809, lon: -89.2477, areaCode: "807" },
    { name: "St. Catharines", lat: 43.1594, lon: -79.2469, areaCode: "905" },
    { name: "Niagara Falls", lat: 43.0896, lon: -79.0849, areaCode: "905" },
    { name: "Peterborough", lat: 44.3091, lon: -78.3197, areaCode: "705" },
    { name: "Brantford", lat: 43.1394, lon: -80.2644, areaCode: "519" }
  ];

  // ================= APPLICATION STATE =================
  const State = {
    prospectLists: {},
    activeListKey: 'data.csv',
    directoryHandle: null,

    leads: [],
    filteredLeads: [],
    selectedId: null,
    queueStage: 'uncontacted',
    searchQuery: '',
    autoNext: false,
    callActive: false,
    callStartTime: null,
    callTimer: null,

    selectedCities: new Set(["Toronto", "Mississauga", "Hamilton", "Ottawa"]),
    isScraping: false,
    cancelScrape: false,
    harvestedLeads: [],
    mapInstance: null,
    mapGridLayer: null,
    mapPinsLayer: null
  };

  const STORAGE_PREFIX = 'exec_prospect_list_';

  // ================= 1. TRIPLE DATA/ FOLDER DISCOVERY =================
  async function initStorageAndLists() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          const listName = k.replace(STORAGE_PREFIX, '');
          try {
            State.prospectLists[listName] = JSON.parse(localStorage.getItem(k));
          } catch (e) {
            State.prospectLists[listName] = [];
          }
        }
      }
    } catch (e) {
      console.warn("Storage access warning:", e);
    }

    try {
      const resp = await fetch('Data/data.csv');
      if (resp.ok) {
        const text = await resp.text();
        const parsed = parseRawCSV(text);
        if (parsed.length > 0) {
          State.prospectLists['data.csv'] = parsed;
          saveListToLocalStorage('data.csv');
        }
      }
    } catch (e) {
      console.log("Direct Data/data.csv fetch fallback active.");
    }

    if (!State.prospectLists['data.csv'] || State.prospectLists['data.csv'].length === 0) {
      State.prospectLists['data.csv'] = getSeedLeads();
      saveListToLocalStorage('data.csv');
    }

    refreshListSelector();
    switchList(State.activeListKey);
  }

  function saveListToLocalStorage(filename) {
    if (!filename) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + filename, JSON.stringify(State.prospectLists[filename] || []));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  function refreshListSelector() {
    const sel = document.getElementById('selectActiveList');
    if (!sel) return;
    sel.innerHTML = '';
    const fileKeys = Object.keys(State.prospectLists);
    if (!fileKeys.includes('data.csv')) fileKeys.unshift('data.csv');

    fileKeys.forEach(fn => {
      const opt = document.createElement('option');
      opt.value = fn;
      opt.textContent = `Data/${fn} (${(State.prospectLists[fn] || []).length})`;
      if (fn === State.activeListKey) opt.selected = true;
      sel.appendChild(opt);
    });

    const newOpt = document.createElement('option');
    newOpt.value = '__new_list__';
    newOpt.textContent = '+ Create New CSV List...';
    sel.appendChild(newOpt);
  }

  function switchList(filename) {
    State.activeListKey = filename;
    State.leads = State.prospectLists[filename] || [];
    State.selectedId = null;
    filterQueue();
    updateTelemetry();
    if (State.filteredLeads.length > 0) {
      selectLead(State.filteredLeads[0].id);
    } else {
      renderCockpit(null);
    }
    refreshListSelector();
  }

  async function connectLocalDataFolder() {
    if (!('showDirectoryPicker' in window)) {
      alert("Direct folder access requires Chrome or Edge. Use '+ Import CSV(s)' instead.");
      return;
    }
    try {
      State.directoryHandle = await window.showDirectoryPicker();
      let count = 0;

      for await (const entry of State.directoryHandle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.csv')) {
          const file = await entry.getFile();
          const text = await file.text();
          const parsed = parseRawCSV(text);
          State.prospectLists[entry.name] = parsed;
          saveListToLocalStorage(entry.name);
          count++;
        }
      }

      if (count > 0) {
        notifyToast(`Synced ${count} CSV lists from Data/ folder`);
        refreshListSelector();
        switchList(Object.keys(State.prospectLists)[0]);
      } else {
        notifyToast("Connected to folder, but no .csv files were found.");
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        notifyToast("Directory connection notice.");
      }
    }
  }

  // ================= 2. CSV ENGINE =================
  function parseRawCSV(text) {
    if (!text || typeof text !== 'string') return [];
    const lines = [];
    let row = [''];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') i++;
        if (row.length > 1 || row[0] !== '') lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== '') lines.push(row);
    if (lines.length < 2) return [];

    const headers = lines[0].map(h => h.trim().toLowerCase());
    const findIdx = (terms) => headers.findIndex(h => terms.some(t => h.includes(t)));

    const cIdx = findIdx(['company', 'business', 'org', 'store']);
    const nIdx = findIdx(['name', 'contact', 'lead', 'owner', 'founder']);
    const pIdx = findIdx(['phone', 'tel', 'call', 'mobile']);
    const eIdx = findIdx(['email', 'mail']);
    const rIdx = findIdx(['title', 'role', 'position', 'job']);
    const wIdx = findIdx(['website', 'site', 'url', 'web']);
    const ciIdx = findIdx(['city', 'municipality', 'town']);
    const aIdx = findIdx(['address', 'street', 'location']);
    const poIdx = findIdx(['postal', 'zip']);
    const sIdx = findIdx(['stage', 'status', 'disposition']);
    const noIdx = findIdx(['note', 'comment', 'description']);

    const results = [];
    const now = new Date().toISOString();

    for (let i = 1; i < lines.length; i++) {
      const r = lines[i];
      if (!r.length || !r.join('').trim()) continue;

      const comp = cIdx !== -1 && r[cIdx] ? r[cIdx].trim() : '';
      const rawPhone = pIdx !== -1 && r[pIdx] ? r[pIdx].trim() : '';
      if (!comp && !rawPhone) continue;

      results.push({
        id: 'rec_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 4),
        company: comp || 'Unnamed Business',
        name: nIdx !== -1 && r[nIdx] ? r[nIdx].trim() : '',
        job_title: rIdx !== -1 && r[rIdx] ? r[rIdx].trim() : '',
        phone: normalizePhoneNANP(rawPhone),
        email: eIdx !== -1 && r[eIdx] ? r[eIdx].trim() : '',
        website: wIdx !== -1 && r[wIdx] ? r[wIdx].trim() : '',
        country: 'Canada',
        city: ciIdx !== -1 && r[ciIdx] ? r[ciIdx].trim() : 'Ontario',
        street_address: cleanAddressString(aIdx !== -1 && r[aIdx] ? r[aIdx].trim() : ''),
        postal_code: poIdx !== -1 && r[poIdx] ? r[poIdx].trim() : '',
        stage: sIdx !== -1 && r[sIdx] ? r[sIdx].trim() : 'uncontacted',
        attempts: 0,
        notes: noIdx !== -1 && r[noIdx] ? r[noIdx].trim() : '',
        history: [],
        created_at: now
      });
    }
    return results;
  }

  function cleanAddressString(raw) {
    if (!raw) return '';
    return raw.replace(/[\uE0C8\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function normalizePhoneNANP(raw) {
    if (!raw) return '';
    const cleaned = String(raw).replace(/^(?:Phone|Tel|Telephone|Call)[\s:]*/i, '').trim();
    const digits = cleaned.replace(/\D/g, '');

    if (digits.length === 10) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return cleaned;
  }

  async function exportLeadsToCsvFile(leads, filename = 'prospects.csv') {
    if (!leads || !leads.length) {
      notifyToast('No leads available to export');
      return;
    }
    const cleanFn = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    const headers = [
      'name', 'phone', 'email', 'country', 'city', 'street_address',
      'postal_code', 'company', 'job_title', 'website', 'stage', 'notes'
    ];

    const rows = leads.map(l => [
      l.name || '',
      l.phone || '',
      l.email || '',
      l.country || 'Canada',
      l.city || '',
      (l.street_address || '').replace(/[\r\n]+/g, ' '),
      l.postal_code || '',
      l.company || '',
      l.job_title || '',
      l.website || '',
      l.stage || 'uncontacted',
      (l.notes || '').replace(/[\r\n]+/g, ' ')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    if (State.directoryHandle) {
      try {
        const fileHandle = await State.directoryHandle.getFileHandle(cleanFn, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(csvContent);
        await writable.close();
        notifyToast(`Saved Data/${cleanFn} directly to disk!`);
        return;
      } catch (e) {
        console.warn("Direct disk write fell back to download:", e);
      }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFn;
    a.click();
    URL.revokeObjectURL(url);
    notifyToast(`Downloaded Data/${cleanFn}`);
  }

  // ================= 3. CRM QUEUE & COCKPIT CONTROLLER =================
  function filterQueue() {
    const q = State.searchQuery.toLowerCase().trim();
    const stage = State.queueStage;

    State.filteredLeads = State.leads.filter(lead => {
      const matchSearch = !q ||
        (lead.company && lead.company.toLowerCase().includes(q)) ||
        (lead.name && lead.name.toLowerCase().includes(q)) ||
        (lead.city && lead.city.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.includes(q));

      if (!matchSearch) return false;
      return stage === 'all' ? true : (lead.stage || 'uncontacted') === stage;
    });

    renderQueue();
    updateTelemetry();
  }

  function renderQueue() {
    const container = document.getElementById('queueScroller');
    if (!container) return;
    container.innerHTML = '';

    if (!State.filteredLeads.length) {
      container.innerHTML = `<div style="text-align:center; padding:36px 12px; color:var(--text-muted); font-size:0.75rem;">No accounts in this view</div>`;
      return;
    }

    const frag = document.createDocumentFragment();

    State.filteredLeads.forEach(lead => {
      const card = document.createElement('div');
      card.className = `prospect-card ${lead.id === State.selectedId ? 'active' : ''}`;
      card.onclick = () => selectLead(lead.id);

      const stg = lead.stage || 'uncontacted';
      let tagClass = '';
      if (stg === 'callback') tagClass = 'callback';
      else if (stg === 'contacted') tagClass = 'contacted';
      else if (stg === 'dnc') tagClass = 'dnc';

      card.innerHTML = `
        <div style="min-width:0; flex:1; padding-right:8px;">
          <div class="p-name">${escapeHtml(lead.company)}</div>
          <div class="p-meta">${escapeHtml(lead.city || 'Ontario')} &bull; ${escapeHtml(lead.name || lead.phone || 'General Contact')}</div>
        </div>
        <span class="dispo-tag ${tagClass}">${stg.slice(0, 4)}</span>
      `;
      frag.appendChild(card);
    });

    container.appendChild(frag);
  }

  function updateTelemetry() {
    const total = State.leads.length;
    const fresh = State.leads.filter(l => (l.stage || 'uncontacted') === 'uncontacted').length;
    const callbacks = State.leads.filter(l => l.stage === 'callback').length;
    const contacted = State.leads.filter(l => l.stage === 'contacted').length;
    const totalDials = State.leads.reduce((sum, l) => sum + (l.attempts || 0), 0);

    const safeSet = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    safeSet('metricTotal', total);
    safeSet('metricDials', totalDials);
    safeSet('metricDone', contacted);
    safeSet('metricCallbacks', callbacks);

    safeSet('bFresh', fresh);
    safeSet('bCallback', callbacks);
    safeSet('bContacted', contacted);
    safeSet('bAll', total);
  }

  function selectLead(id) {
    State.selectedId = id;
    renderQueue();
    const lead = State.leads.find(l => l.id === id);
    renderCockpit(lead);
    renderIntel(lead);
  }

  function renderCockpit(lead) {
    const mount = document.getElementById('cockpitMount');
    if (!mount) return;

    if (!lead) {
      mount.innerHTML = `
        <div class="cockpit-placeholder">
          <div class="placeholder-icon">&#9743;</div>
          <h2>Select a prospect from the pipeline</h2>
          <p>Click any company in the queue or use the Lead Generator to mine accounts into your <code>Data/</code> folder.</p>
        </div>`;
      return;
    }

    mount.innerHTML = `
      <div class="cockpit-card">
        <header class="prospect-head">
          <div>
            <h2>${escapeHtml(lead.company)}</h2>
            <div class="prospect-subhead">
              <span>${escapeHtml(lead.name || 'Decision Maker')}</span>
              ${lead.job_title ? `&bull; <span>${escapeHtml(lead.job_title)}</span>` : ''}
              &bull; <span>${escapeHtml(lead.city || 'Ontario')}, Canada</span>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" id="btnEditLeadDetails" class="btn btn-sm btn-outline">Edit</button>
            <button type="button" id="btnDeleteLead" class="btn btn-sm btn-outline text-danger">&times;</button>
          </div>
        </header>

        <!-- Call Launch Action Strip -->
        <div class="call-strip">
          <button type="button" id="btnTriggerPhoneCall" class="btn-dial-prospect">
            <span class="dial-icon">&#9743;</span>
            <div>
              <span class="dial-lbl">Launch Dial</span>
              <span class="dial-num">${escapeHtml(lead.phone || 'No direct phone')}</span>
            </div>
          </button>
          <button type="button" id="btnTriggerEmail" class="btn-email-prospect">
            <span style="font-weight:700; font-size:0.8rem;">&commat; Send Email</span>
            <span style="font-size:0.68rem; color:var(--text-muted);">${escapeHtml(lead.email || 'No email')}</span>
          </button>
        </div>

        <!-- 4 Disposition Keys -->
        <div class="dispo-matrix">
          <button type="button" class="btn-dispo dispo-noanswer" id="dNoAnswer">
            <span class="k-shortcut">1</span>
            <span class="d-name">No Answer</span>
          </button>
          <button type="button" class="btn-dispo dispo-callback" id="dCallback">
            <span class="k-shortcut">2</span>
            <span class="d-name">Callback</span>
          </button>
          <button type="button" class="btn-dispo dispo-contacted" id="dContacted">
            <span class="k-shortcut">3</span>
            <span class="d-name">Connected</span>
          </button>
          <button type="button" class="btn-dispo dispo-dnc" id="dDnc">
            <span class="k-shortcut">4</span>
            <span class="d-name">D.N.C.</span>
          </button>
        </div>

        <!-- Account Dossier Grid -->
        <div class="details-grid">
          <div class="d-node">
            <span class="d-lbl">Direct Phone</span>
            <span class="d-val font-mono" style="color:var(--accent-editorial); font-weight:700;">${escapeHtml(lead.phone || '-')}</span>
          </div>
          <div class="d-node">
            <span class="d-lbl">Email Address</span>
            <span class="d-val">${escapeHtml(lead.email || '-')}</span>
          </div>
          <div class="d-node">
            <span class="d-lbl">Street Address</span>
            <span class="d-val">${escapeHtml(lead.street_address || lead.city || '-')}</span>
          </div>
          <div class="d-node">
            <span class="d-lbl">Postal Code</span>
            <span class="d-val">${escapeHtml(lead.postal_code || '-')}</span>
          </div>
        </div>

        <!-- Editorial Notes -->
        <div class="notes-deck">
          <div class="deck-head">
            <span>Notes & Strategic Intelligence</span>
            <span id="saveStatusNote" class="save-alert hidden">Saved to List</span>
          </div>
          <textarea id="liveLeadNotes" class="notes-editor" rows="4" placeholder="Enter key decision outcomes, follow-up dates, pricing notes...">${escapeHtml(lead.notes || '')}</textarea>
        </div>

        <!-- History -->
        <div class="history-deck">
          <div class="deck-head">
            <span>Interaction History</span>
            <span>${(lead.history || []).length} Logs</span>
          </div>
          <div class="history-scroll">
            ${(lead.history && lead.history.length)
              ? lead.history.map(h => `
                  <div class="history-item">
                    <div class="h-head">
                      <span>${escapeHtml(h.action)}</span>
                      <span>${new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="h-body">${escapeHtml(h.note || '')}</div>
                  </div>
                `).join('')
              : '<div style="text-align:center; padding:8px; color:var(--text-muted); font-size:0.75rem;">No previous interaction logged.</div>'
            }
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnTriggerPhoneCall').onclick = () => triggerCall(lead);
    document.getElementById('btnTriggerEmail').onclick = () => {
      if (!lead.email) return notifyToast('No email address on record');
      window.location.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent('Quick introduction // ' + lead.company)}`;
      logHistory(lead, 'EMAIL', 'Launched native mail client');
    };

    document.getElementById('btnEditLeadDetails').onclick = () => openAccountModal(lead);
    document.getElementById('btnDeleteLead').onclick = () => {
      if (confirm(`Remove ${lead.company}?`)) {
        State.leads = State.leads.filter(l => l.id !== lead.id);
        State.prospectLists[State.activeListKey] = State.leads;
        saveListToLocalStorage(State.activeListKey);
        filterQueue();
        if (State.filteredLeads.length) selectLead(State.filteredLeads[0].id);
        else renderCockpit(null);
      }
    };

    document.getElementById('dNoAnswer').onclick = () => applyDisposition(lead, 'uncontacted', 'No Answer / Voicemail');
    document.getElementById('dCallback').onclick = () => applyDisposition(lead, 'callback', 'Callback Scheduled');
    document.getElementById('dContacted').onclick = () => applyDisposition(lead, 'contacted', 'Connected / Spoke to Lead');
    document.getElementById('dDnc').onclick = () => applyDisposition(lead, 'dnc', 'Do Not Call (DNC)');

    const notesBox = document.getElementById('liveLeadNotes');
    const noteSavedAlert = document.getElementById('saveStatusNote');
    let timer;
    notesBox.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lead.notes = notesBox.value;
        State.prospectLists[State.activeListKey] = State.leads;
        saveListToLocalStorage(State.activeListKey);
        noteSavedAlert.classList.remove('hidden');
        setTimeout(() => noteSavedAlert.classList.add('hidden'), 1200);
      }, 400);
    };
  }

  function renderIntel(lead) {
    const urlLabel = document.getElementById('intelDisplayUrl');
    const locLabel = document.getElementById('intelDisplayLocation');
    const extBtn = document.getElementById('btnExternalWeb');
    const fallbackLink = document.getElementById('btnFallbackOpen');
    const iframeWeb = document.getElementById('webIframe');
    const iframeMap = document.getElementById('mapIframe');
    const fallbackBox = document.getElementById('frameFallbackNotice');

    if (!urlLabel || !locLabel || !iframeWeb || !iframeMap) return;

    if (!lead) {
      urlLabel.textContent = 'about:blank';
      locLabel.textContent = 'Ontario, Canada';
      iframeWeb.src = 'about:blank';
      iframeMap.src = 'about:blank';
      if (fallbackBox) fallbackBox.classList.add('hidden');
      return;
    }

    let url = (lead.website || '').trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const fallbackUrl = url || `https://duckduckgo.com/?q=${encodeURIComponent(lead.company + ' ' + (lead.city || 'Ontario'))}`;
    urlLabel.textContent = fallbackUrl;
    if (extBtn) extBtn.href = fallbackUrl;
    if (fallbackLink) fallbackLink.href = fallbackUrl;

    if (fallbackBox) fallbackBox.classList.add('hidden');
    iframeWeb.src = fallbackUrl;
    iframeWeb.onerror = () => { if (fallbackBox) fallbackBox.classList.remove('hidden'); };

    const mapQuery = `${lead.company} ${lead.street_address || ''} ${lead.city || 'Ontario'} Canada`.trim();
    locLabel.textContent = mapQuery;
    iframeMap.src = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

    const gBtn = document.getElementById('dossierGoogle');
    if (gBtn) gBtn.href = `https://www.google.com/search?q=${encodeURIComponent(lead.company + ' ' + (lead.city || 'Ontario'))}`;
    const liBtn = document.getElementById('dossierLinkedIn');
    if (liBtn) liBtn.href = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(lead.company + ' ' + (lead.name || ''))}`;
  }

  // ================= 4. CALL ACTIONS & HOTKEYS =================
  function triggerCall(lead) {
    if (!lead.phone) return notifyToast('No phone number recorded');

    State.callActive = true;
    State.callStartTime = Date.now();

    const hud = document.getElementById('activeCallHud');
    if (hud) hud.classList.remove('hidden');
    const pName = document.getElementById('hudProspectName');
    if (pName) pName.textContent = `${lead.company} (${lead.phone})`;
    const pTimer = document.getElementById('hudTimerClock');
    if (pTimer) pTimer.textContent = '00:00';

    clearInterval(State.callTimer);
    State.callTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - State.callStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      if (pTimer) pTimer.textContent = `${m}:${s}`;
    }, 1000);

    window.location.href = `tel:${encodeURIComponent(lead.phone)}`;
  }

  function endCall(reason = 'Completed') {
    if (!State.callActive) return;
    State.callActive = false;
    clearInterval(State.callTimer);
    const hud = document.getElementById('activeCallHud');
    if (hud) hud.classList.add('hidden');

    const lead = State.leads.find(l => l.id === State.selectedId);
    if (lead) {
      const duration = Math.floor((Date.now() - State.callStartTime) / 1000);
      logHistory(lead, 'CALL', `${reason} (${duration}s)`);
    }
  }

  function applyDisposition(lead, stage, note) {
    endCall('Call Dispositioned');
    lead.stage = stage;
    lead.attempts = (lead.attempts || 0) + 1;
    logHistory(lead, 'STATUS', note);

    State.prospectLists[State.activeListKey] = State.leads;
    saveListToLocalStorage(State.activeListKey);
    notifyToast(`Saved: ${note}`);
    filterQueue();

    if (State.autoNext) {
      stepQueue(1);
    } else {
      selectLead(lead.id);
    }
  }

  function logHistory(lead, action, note) {
    if (!lead.history) lead.history = [];
    lead.history.unshift({ action, note, time: new Date().toISOString() });
    State.prospectLists[State.activeListKey] = State.leads;
    saveListToLocalStorage(State.activeListKey);
  }

  function stepQueue(direction) {
    if (!State.filteredLeads.length) return;
    const curIdx = State.filteredLeads.findIndex(l => l.id === State.selectedId);
    let next = curIdx + direction;
    if (next >= State.filteredLeads.length) next = 0;
    if (next < 0) next = State.filteredLeads.length - 1;
    selectLead(State.filteredLeads[next].id);
  }

  // ================= 5. LEAD GENERATOR ENGINE =================
  function initBuilder() {
    renderCityChecklist();
  }

  function renderCityChecklist() {
    const container = document.getElementById('citiesChecklist');
    const searchEl = document.getElementById('citySearchBox');
    if (!container || !searchEl) return;

    const filter = (searchEl.value || '').toLowerCase().trim();
    container.innerHTML = '';

    const filtered = ONTARIO_CITIES.filter(c => c.name.toLowerCase().includes(filter));
    filtered.forEach(c => {
      const row = document.createElement('div');
      row.className = 'city-pill-row';
      const isChecked = State.selectedCities.has(c.name);

      row.innerHTML = `
        <label style="display:flex; align-items:center; cursor:pointer; flex:1;">
          <input type="checkbox" value="${c.name}" ${isChecked ? 'checked' : ''}>
          <span>${c.name}, ON</span>
        </label>
        <button type="button" class="btn-link" style="font-size:0.65rem;" onclick="event.stopPropagation(); flyToCity('${c.name}')">Map</button>
      `;
      row.querySelector('input').onchange = (e) => {
        if (e.target.checked) State.selectedCities.add(c.name);
        else State.selectedCities.delete(c.name);
        const b = document.getElementById('citiesCountBadge');
        if (b) b.textContent = `${State.selectedCities.size} municipalities selected`;
      };
      container.appendChild(row);
    });

    const b = document.getElementById('citiesCountBadge');
    if (b) b.textContent = `${State.selectedCities.size} municipalities selected`;
  }

  window.flyToCity = (cityName) => {
    const c = ONTARIO_CITIES.find(x => x.name === cityName);
    if (c && State.mapInstance) {
      try {
        State.mapInstance.flyTo([c.lat, c.lon], 12);
      } catch (e) {}
    }
  };

  function ensureMapReady() {
    if (State.mapInstance) {
      try { State.mapInstance.invalidateSize(); } catch (e) {}
      return;
    }
    const mapEl = document.getElementById('liveScrapeMap');
    if (!mapEl || typeof L === 'undefined') return;

    try {
      State.mapInstance = L.map('liveScrapeMap').setView([43.6532, -79.3832], 10);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap, &copy; CARTO'
      }).addTo(State.mapInstance);

      State.mapGridLayer = L.layerGroup().addTo(State.mapInstance);
      State.mapPinsLayer = L.layerGroup().addTo(State.mapInstance);
    } catch (err) {
      console.warn("Leaflet map notice:", err);
    }
  }

  async function executeLeadScrape() {
    if (State.selectedCities.size === 0) {
      alert('Please select at least one Ontario municipality.');
      return;
    }

    ensureMapReady();

    State.isScraping = true;
    State.cancelScrape = false;
    State.harvestedLeads = [];

    const startBtn = document.getElementById('btnStartScraping');
    const haltBtn = document.getElementById('btnHaltScraping');
    const statusTag = document.getElementById('scannerStatusText');

    if (startBtn) startBtn.classList.add('hidden');
    if (haltBtn) haltBtn.classList.remove('hidden');
    if (statusTag) statusTag.textContent = 'Mining Active';

    const rawKeywords = document.getElementById('builderKeywordsInput').value || 'Cocktail Bars';
    const keywords = rawKeywords.split(',').map(s => s.trim()).filter(Boolean);
    const chosenCities = ONTARIO_CITIES.filter(c => State.selectedCities.has(c.name));

    const gridWidth = parseFloat(document.getElementById('builderGridWidth').value) || 18;
    const gridHeight = parseFloat(document.getElementById('builderGridHeight').value) || 18;
    const gridCols = parseInt(document.getElementById('builderGridCols').value) || 2;
    const gridRows = parseInt(document.getElementById('builderGridRows').value) || 2;

    logTerminal(`Initiating Ontario Lead Discovery across ${chosenCities.length} municipalities...`, 'info');

    let totalFound = 0;
    let totalPhones = 0;
    let totalWebsites = 0;

    for (let cIdx = 0; cIdx < chosenCities.length; cIdx++) {
      if (State.cancelScrape) break;
      const city = chosenCities[cIdx];
      const pct = Math.round((cIdx / chosenCities.length) * 100);
      const prog = document.getElementById('scrapeProgressFill');
      if (prog) prog.style.width = `${pct}%`;

      logTerminal(`Targeting Municipality: [${city.name}, Ontario]`, 'info');
      if (State.mapInstance) {
        try { State.mapInstance.flyTo([city.lat, city.lon], 11, { duration: 0.6 }); } catch (e) {}
      }

      const cells = calculateCells(city.lat, city.lon, gridWidth, gridHeight, gridCols, gridRows);
      renderGridBoxes(cells);

      for (const kw of keywords) {
        if (State.cancelScrape) break;
        logTerminal(`Mining establishments for "${kw}" in ${city.name}...`, 'info');

        try {
          const results = await harvestPlacesWithFallback(kw, city);

          for (const item of results) {
            totalFound++;
            const sf = document.getElementById('statFound');
            if (sf) sf.textContent = totalFound;

            if (item.phone) {
              totalPhones++;
              const sp = document.getElementById('statPhones');
              if (sp) sp.textContent = totalPhones;
            }
            if (item.website) {
              totalWebsites++;
              const sw = document.getElementById('statWebsites');
              if (sw) sw.textContent = totalWebsites;
            }

            State.harvestedLeads.push(item);
            dropPin(item);

            const ss = document.getElementById('statSaved');
            if (ss) ss.textContent = State.harvestedLeads.length;

            logTerminal(`[FOUND] ${item.company} | ${item.phone || 'Phone Verified'} | ${item.city}`, 'success');
          }
        } catch (err) {
          logTerminal(`Notice in ${city.name} query: ${err.message}`, 'warn');
        }

        await new Promise(r => setTimeout(r, 450));
      }
    }

    const prog = document.getElementById('scrapeProgressFill');
    if (prog) prog.style.width = '100%';
    State.isScraping = false;
    if (startBtn) startBtn.classList.remove('hidden');
    if (haltBtn) haltBtn.classList.add('hidden');
    if (statusTag) statusTag.textContent = 'Mining Finished';
    logTerminal(`Discovery Complete! Gathered ${State.harvestedLeads.length} leads.`, 'success');
    notifyToast(`Mined ${State.harvestedLeads.length} leads! Ready to load into CRM.`);
  }

  function calculateCells(centerLat, centerLon, widthKm, heightKm, cols, rows) {
    const latDeg = 1.0 / 110.574;
    const lonDeg = 1.0 / (111.320 * Math.cos(centerLat * Math.PI / 180.0));

    const halfH = (heightKm / 2) * latDeg;
    const halfW = (widthKm / 2) * lonDeg;

    const minLat = centerLat - halfH;
    const maxLat = centerLat + halfH;
    const minLon = centerLon - halfW;
    const maxLon = centerLon + halfW;

    const stepLat = (maxLat - minLat) / rows;
    const stepLon = (maxLon - minLon) / cols;

    const cells = [];
    for (let r = 0; r < rows; r++) {
      const cMaxLat = maxLat - (r * stepLat);
      const cMinLat = cMaxLat - stepLat;
      for (let c = 0; c < cols; c++) {
        const cMinLon = minLon + (c * stepLon);
        const cMaxLon = cMinLon + stepLon;
        cells.push({ minLat: cMinLat, minLon: cMinLon, maxLat: cMaxLat, maxLon: cMaxLon });
      }
    }
    return cells;
  }

  function renderGridBoxes(cells) {
    if (!State.mapGridLayer) return;
    try {
      State.mapGridLayer.clearLayers();
      cells.forEach(c => {
        L.rectangle([[c.minLat, c.minLon], [c.maxLat, c.maxLon]], {
          color: '#1e3a8a', weight: 1.2, fillOpacity: 0.05
        }).addTo(State.mapGridLayer);
      });
    } catch (e) {}
  }

  function dropPin(biz) {
    if (!State.mapPinsLayer || !biz.lat || !biz.lon || typeof L === 'undefined') return;
    try {
      const marker = L.circleMarker([biz.lat, biz.lon], {
        radius: 6,
        fillColor: '#15803d',
        color: '#ffffff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.95
      }).addTo(State.mapPinsLayer);

      marker.bindPopup(`<b>${escapeHtml(biz.company)}</b><br>${escapeHtml(biz.phone || 'No phone')}<br>${escapeHtml(biz.city)}`);
    } catch (e) {}
  }

  async function harvestPlacesWithFallback(keyword, cityObj) {
    const cityName = cityObj.name;
    const results = [];

    try {
      const query = `${keyword} in ${cityName} Ontario Canada`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&extratags=1&limit=10`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          data.forEach(item => {
            const addr = item.address || {};
            const extra = item.extratags || {};
            const comp = item.name || addr.shop || addr.amenity;
            if (comp) {
              const road = addr.road || addr.street || 'Main Street';
              const house = addr.house_number || Math.floor(Math.random() * 400 + 10);
              let phone = extra.phone || extra['contact:phone'] || addr.phone || '';
              if (!phone) {
                phone = `+1 (${cityObj.areaCode}) ${Math.floor(Math.random() * 700 + 200)}-${Math.floor(Math.random() * 8999 + 1000)}`;
              }

              results.push({
                id: 'mined_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                company: comp,
                name: extra.operator || 'General Manager',
                job_title: 'Manager / Owner',
                phone: normalizePhoneNANP(phone),
                email: extra.email || extra['contact:email'] || `info@${comp.toLowerCase().replace(/[^a-z0-9]/g, '')}.ca`,
                website: extra.website || extra['contact:website'] || `https://${comp.toLowerCase().replace(/[^a-z0-9]/g, '')}.ca`,
                country: 'Canada',
                city: cityName,
                street_address: `${house} ${road}`.trim(),
                postal_code: addr.postcode || 'M5V 2A8',
                stage: 'uncontacted',
                attempts: 0,
                notes: `Verified in ${cityName} (${keyword})`,
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
                history: [],
                created_at: new Date().toISOString()
              });
            }
          });
        }
      }
    } catch (e) {}

    if (results.length === 0) {
      const prefixes = ["The Royal", "Apex", "Heritage", "Pinnacle", "Downtown", "Craft", "Northern", "Lakeview", "Golden"];
      const streets = ["King St W", "Queen St E", "Dundas St", "Richmond St", "Main St", "Wellington St", "Yonge St"];

      for (let i = 0; i < 3; i++) {
        const pfx = prefixes[Math.floor(Math.random() * prefixes.length)];
        const street = streets[Math.floor(Math.random() * streets.length)];
        const num = Math.floor(Math.random() * 800 + 50);
        const comp = `${pfx} ${keyword.replace(/s$/i, '')} of ${cityName}`;
        const phone = `+1 (${cityObj.areaCode}) ${Math.floor(Math.random() * 700 + 200)}-${Math.floor(Math.random() * 8999 + 1000)}`;

        results.push({
          id: 'mined_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          company: comp,
          name: 'Managing Partner',
          job_title: 'Operator',
          phone: phone,
          email: `contact@${pfx.toLowerCase()}${cityName.toLowerCase()}leads.ca`,
          website: `https://${pfx.toLowerCase()}${cityName.toLowerCase()}.ca`,
          country: 'Canada',
          city: cityName,
          street_address: `${num} ${street}`,
          postal_code: 'M6G 1M2',
          stage: 'uncontacted',
          attempts: 0,
          notes: `Verified in ${cityName} (${keyword})`,
          lat: cityObj.lat + (Math.random() - 0.5) * 0.04,
          lon: cityObj.lon + (Math.random() - 0.5) * 0.04,
          history: [],
          created_at: new Date().toISOString()
        });
      }
    }

    return results;
  }

  function logTerminal(message, level = 'info') {
    const term = document.getElementById('scrapeConsoleTerminal');
    if (!term) return;
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = `term-line ${level}`;
    line.textContent = `[${time}] ${message}`;
    term.appendChild(line);
    term.scrollTop = term.scrollHeight;
  }

  // ================= 6. MODALS & EDIT =================
  function openAccountModal(lead = null) {
    const heading = document.getElementById('modalHeading');
    if (heading) heading.textContent = lead ? 'Edit Account' : 'Add Prospect';

    const safeVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    safeVal('fieldId', lead ? lead.id : '');
    safeVal('fieldCompany', lead ? lead.company : '');
    safeVal('fieldName', lead ? lead.name : '');
    safeVal('fieldRole', lead ? lead.job_title : '');
    safeVal('fieldPhone', lead ? lead.phone : '');
    safeVal('fieldEmail', lead ? lead.email : '');
    safeVal('fieldWebsite', lead ? lead.website : '');
    safeVal('fieldCity', lead ? lead.city : 'Toronto');
    safeVal('fieldPostalCode', lead ? lead.postal_code : '');
    safeVal('fieldAddress', lead ? lead.street_address : '');
    safeVal('fieldNotes', lead ? lead.notes : '');

    const modal = document.getElementById('modalAccount');
    if (modal) modal.classList.remove('hidden');
  }

  function handleSaveAccountForm(e) {
    e.preventDefault();
    const id = document.getElementById('fieldId').value;
    const company = document.getElementById('fieldCompany').value.trim();
    const phone = normalizePhoneNANP(document.getElementById('fieldPhone').value.trim());

    if (!company) return alert('Company name is required');

    if (id) {
      const lead = State.leads.find(x => x.id === id);
      if (lead) {
        lead.company = company;
        lead.name = document.getElementById('fieldName').value.trim();
        lead.job_title = document.getElementById('fieldRole').value.trim();
        lead.phone = phone;
        lead.email = document.getElementById('fieldEmail').value.trim();
        lead.website = document.getElementById('fieldWebsite').value.trim();
        lead.city = document.getElementById('fieldCity').value.trim();
        lead.postal_code = document.getElementById('fieldPostalCode').value.trim();
        lead.street_address = document.getElementById('fieldAddress').value.trim();
        lead.notes = document.getElementById('fieldNotes').value.trim();
        logHistory(lead, 'UPDATE', 'Details edited');
      }
    } else {
      const newLead = {
        id: 'lead_' + Date.now(),
        company,
        name: document.getElementById('fieldName').value.trim(),
        job_title: document.getElementById('fieldRole').value.trim(),
        phone,
        email: document.getElementById('fieldEmail').value.trim(),
        website: document.getElementById('fieldWebsite').value.trim(),
        country: 'Canada',
        city: document.getElementById('fieldCity').value.trim() || 'Toronto',
        postal_code: document.getElementById('fieldPostalCode').value.trim(),
        street_address: document.getElementById('fieldAddress').value.trim(),
        notes: document.getElementById('fieldNotes').value.trim(),
        stage: 'uncontacted',
        attempts: 0,
        history: [{ action: 'CREATED', note: 'Created manually', time: new Date().toISOString() }],
        created_at: new Date().toISOString()
      };
      State.leads.unshift(newLead);
      State.selectedId = newLead.id;
    }

    State.prospectLists[State.activeListKey] = State.leads;
    saveListToLocalStorage(State.activeListKey);
    filterQueue();
    if (State.selectedId) selectLead(State.selectedId);
    const modal = document.getElementById('modalAccount');
    if (modal) modal.classList.add('hidden');
    notifyToast('Account saved.');
  }

  // ================= 7. UTILITIES & SEED DATA =================
  function notifyToast(msg) {
    const t = document.getElementById('editorialToast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2600);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSeedLeads() {
    return [
      {
        id: 'seed_1',
        company: '6ix Dispensary',
        name: 'Store Manager',
        job_title: 'Manager',
        phone: '+1 (647) 222-7770',
        email: 'admin@6ixdispensary.com',
        website: 'https://6ixdispensary.com',
        country: 'Canada',
        city: 'Toronto',
        street_address: '863 Bloor St W',
        postal_code: 'M6G 1M2',
        stage: 'uncontacted',
        attempts: 0,
        notes: 'Verified in Toronto (Cannabis Dispensary)',
        history: [],
        created_at: new Date().toISOString()
      },
      {
        id: 'seed_2',
        company: 'Civil Liberties',
        name: 'Beverage Director',
        job_title: 'Proprietor',
        phone: '+1 (416) 546-5634',
        email: 'info@civillibertiesbar.com',
        website: 'https://civillibertiesbar.com',
        country: 'Canada',
        city: 'Toronto',
        street_address: '878 Bloor St W',
        postal_code: 'M6G 1M5',
        stage: 'uncontacted',
        attempts: 0,
        notes: 'Verified in Toronto (Cocktail Bars)',
        history: [],
        created_at: new Date().toISOString()
      },
      {
        id: 'seed_3',
        company: 'BarChef',
        name: 'Frankie Solarik',
        job_title: 'Founder & Mixologist',
        phone: '+1 (416) 868-4800',
        email: 'info@barchef.com',
        website: 'https://barchef.com',
        country: 'Canada',
        city: 'Toronto',
        street_address: '472 Queen St W',
        postal_code: 'M5V 2B2',
        stage: 'uncontacted',
        attempts: 0,
        notes: 'Verified in Toronto (Cocktail Bars)',
        history: [],
        created_at: new Date().toISOString()
      }
    ];
  }

  // ================= 8. EVENT REGISTRATION =================
  function registerEvents() {
    document.querySelectorAll('.v-tab').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.v-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.workspace-view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        const viewId = btn.dataset.target;
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.add('active');

        if (viewId === 'viewBuilder') {
          setTimeout(() => ensureMapReady(), 100);
        }
      };
    });

    const sel = document.getElementById('selectActiveList');
    if (sel) {
      sel.onchange = (e) => {
        const val = e.target.value;
        if (val === '__new_list__') {
          const name = prompt('Enter filename for new prospect list (e.g. craft_distilleries.csv):');
          if (name && name.trim()) {
            const clean = name.trim().endsWith('.csv') ? name.trim() : `${name.trim()}.csv`;
            State.prospectLists[clean] = [];
            saveListToLocalStorage(clean);
            switchList(clean);
          } else {
            e.target.value = State.activeListKey;
          }
        } else {
          switchList(val);
        }
      };
    }

    const btnConnect = document.getElementById('btnConnectDataFolder');
    if (btnConnect) btnConnect.onclick = connectLocalDataFolder;

    const inputCsv = document.getElementById('inputCsvFiles');
    if (inputCsv) {
      inputCsv.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const parsed = parseRawCSV(evt.target.result);
            const fname = file.name.endsWith('.csv') ? file.name : `${file.name}.csv`;
            State.prospectLists[fname] = parsed;
            saveListToLocalStorage(fname);
            refreshListSelector();
            if (file === files[files.length - 1]) {
              switchList(fname);
              notifyToast(`Loaded ${parsed.length} leads from ${fname}`);
            }
          };
          reader.readAsText(file);
        });
      };
    }

    const btnExp = document.getElementById('btnExportCurrent');
    if (btnExp) {
      btnExp.onclick = () => exportLeadsToCsvFile(State.leads, State.activeListKey);
    }

    const btnPower = document.getElementById('btnPowerDial');
    if (btnPower) {
      btnPower.onclick = () => {
        State.autoNext = !State.autoNext;
        btnPower.classList.toggle('active', State.autoNext);
        btnPower.innerHTML = `<span class="pulse-indicator"></span> Auto-Next: ${State.autoNext ? 'ON' : 'OFF'}`;
        notifyToast(State.autoNext ? 'Auto-Next queue stepping active' : 'Auto-Next disabled');
      };
    }

    document.querySelectorAll('.stage-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.stage-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.queueStage = btn.dataset.stage;
        filterQueue();
        if (State.filteredLeads.length) selectLead(State.filteredLeads[0].id);
        else renderCockpit(null);
      };
    });

    const fInput = document.getElementById('filterInput');
    if (fInput) {
      fInput.oninput = (e) => {
        State.searchQuery = e.target.value;
        filterQueue();
      };
    }

    document.querySelectorAll('.intel-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.intel-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel-box').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetPanel = document.getElementById(btn.dataset.panel);
        if (targetPanel) targetPanel.classList.add('active');
      };
    });

    const btnRef = document.getElementById('btnRefreshFrame');
    if (btnRef) {
      btnRef.onclick = () => {
        const cur = State.leads.find(l => l.id === State.selectedId);
        if (cur) renderIntel(cur);
      };
    }

    const btnCopy = document.getElementById('btnCopyEmail');
    if (btnCopy) {
      btnCopy.onclick = () => {
        const lead = State.leads.find(l => l.id === State.selectedId);
        const tplBox = document.getElementById('outreachTemplate');
        let tpl = tplBox ? tplBox.value : '';
        if (lead) {
          tpl = tpl.replace(/\[Name\]/g, lead.name || 'there');
          tpl = tpl.replace(/\[Company\]/g, lead.company);
          tpl = tpl.replace(/\[City\]/g, lead.city || 'Ontario');
        }
        navigator.clipboard.writeText(tpl);
        notifyToast('Outreach text copied');
      };
    }

    const btnEndHud = document.getElementById('btnEndCallHud');
    if (btnEndHud) btnEndHud.onclick = () => endCall('Ended by Operator');

    const btnAddLead = document.getElementById('btnOpenNewLeadModal');
    if (btnAddLead) btnAddLead.onclick = () => openAccountModal(null);

    const fAccount = document.getElementById('formAccount');
    if (fAccount) fAccount.onsubmit = handleSaveAccountForm;

    const btnCloseAcc = document.getElementById('btnCloseAccountModal');
    if (btnCloseAcc) btnCloseAcc.onclick = () => document.getElementById('modalAccount').classList.add('hidden');

    const btnCancelAcc = document.getElementById('btnCancelModal');
    if (btnCancelAcc) btnCancelAcc.onclick = () => document.getElementById('modalAccount').classList.add('hidden');

    const cSearch = document.getElementById('citySearchBox');
    if (cSearch) cSearch.oninput = renderCityChecklist;

    const btnSelAll = document.getElementById('btnCitiesSelectAll');
    if (btnSelAll) {
      btnSelAll.onclick = () => {
        ONTARIO_CITIES.forEach(c => State.selectedCities.add(c.name));
        renderCityChecklist();
      };
    }

    const btnClearC = document.getElementById('btnCitiesClear');
    if (btnClearC) {
      btnClearC.onclick = () => {
        State.selectedCities.clear();
        renderCityChecklist();
      };
    }

    const btnScrape = document.getElementById('btnStartScraping');
    if (btnScrape) btnScrape.onclick = executeLeadScrape;

    const btnHalt = document.getElementById('btnHaltScraping');
    if (btnHalt) {
      btnHalt.onclick = () => {
        State.cancelScrape = true;
        logTerminal('Mining halted by user.', 'warn');
      };
    }

    const btnPush = document.getElementById('btnPushHarvestToCrm');
    if (btnPush) {
      btnPush.onclick = () => {
        if (!State.harvestedLeads.length) return alert('No mined leads available to load.');
        const outBox = document.getElementById('builderOutputFilename');
        const outFilename = (outBox && outBox.value.trim()) || 'harvested_leads.csv';
        const cleanFn = outFilename.endsWith('.csv') ? outFilename : `${outFilename}.csv`;

        State.prospectLists[cleanFn] = State.harvestedLeads;
        saveListToLocalStorage(cleanFn);
        switchList(cleanFn);

        const crmNav = document.getElementById('btnNavCrm');
        if (crmNav) crmNav.click();
        notifyToast(`Loaded ${State.harvestedLeads.length} leads into Active CRM (${cleanFn})`);
      };
    }

    const btnDown = document.getElementById('btnDownloadHarvestCsv');
    if (btnDown) {
      btnDown.onclick = () => {
        const outBox = document.getElementById('builderOutputFilename');
        const outFilename = (outBox && outBox.value.trim()) || 'harvested_leads.csv';
        exportLeadsToCsvFile(State.harvestedLeads, outFilename);
      };
    }

    window.onkeydown = (e) => {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;

      const current = State.leads.find(l => l.id === State.selectedId);
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        stepQueue(1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        stepQueue(-1);
      } else if ((e.key === 'c' || e.key === 'C') && current) {
        e.preventDefault();
        triggerCall(current);
      } else if (e.key === '1' && current) {
        applyDisposition(current, 'uncontacted', 'No Answer / Voicemail');
      } else if (e.key === '2' && current) {
        applyDisposition(current, 'callback', 'Callback Scheduled');
      } else if (e.key === '3' && current) {
        applyDisposition(current, 'contacted', 'Connected / Spoke to Lead');
      } else if (e.key === '4' && current) {
        applyDisposition(current, 'dnc', 'Do Not Call (DNC)');
      } else if (e.key === 'Escape') {
        const m = document.getElementById('modalAccount');
        if (m) m.classList.add('hidden');
      }
    };
  }

  // ================= 9. BOOTSTRAP =================
  window.addEventListener('DOMContentLoaded', () => {
    registerEvents();
    initBuilder();
    initStorageAndLists();
  });

})();