/**
 * Executive Outbound Tele-Dialer & Lead Discovery Engine
 * 100% Client-Side Ready (Supports GitHub Pages & Local Server)
 */
(() => {
  'use strict';

  // ================= ONTARIO MUNICIPAL GEODESIC DATABASE =================
  const ONTARIO_CITIES = [
    { name: "Toronto", lat: 43.6532, lon: -79.3832 },
    { name: "Ottawa", lat: 45.4215, lon: -75.6972 },
    { name: "Mississauga", lat: 43.5890, lon: -79.6441 },
    { name: "Brampton", lat: 43.7315, lon: -79.7624 },
    { name: "Hamilton", lat: 43.2557, lon: -79.8711 },
    { name: "London", lat: 42.9849, lon: -81.2453 },
    { name: "Markham", lat: 43.8561, lon: -79.3370 },
    { name: "Vaughan", lat: 43.8563, lon: -79.5085 },
    { name: "Kitchener", lat: 43.4516, lon: -80.4925 },
    { name: "Waterloo", lat: 43.4643, lon: -80.5204 },
    { name: "Cambridge", lat: 43.3616, lon: -80.3144 },
    { name: "Windsor", lat: 42.3149, lon: -83.0364 },
    { name: "Burlington", lat: 43.3255, lon: -79.7990 },
    { name: "Oakville", lat: 43.4675, lon: -79.6877 },
    { name: "Oshawa", lat: 43.8971, lon: -78.8658 },
    { name: "Richmond Hill", lat: 43.8828, lon: -79.4403 },
    { name: "Barrie", lat: 44.3894, lon: -79.6903 },
    { name: "Guelph", lat: 43.5448, lon: -80.2482 },
    { name: "Whitby", lat: 43.8975, lon: -78.9429 },
    { name: "Ajax", lat: 43.8509, lon: -79.0204 },
    { name: "Pickering", lat: 43.8384, lon: -79.0868 },
    { name: "Kingston", lat: 44.2312, lon: -76.4860 },
    { name: "Milton", lat: 43.5183, lon: -79.8774 },
    { name: "Newmarket", lat: 44.0592, lon: -79.4613 },
    { name: "Greater Sudbury", lat: 46.4917, lon: -80.9930 },
    { name: "Thunder Bay", lat: 48.3809, lon: -89.2477 },
    { name: "St. Catharines", lat: 43.1594, lon: -79.2469 },
    { name: "Niagara Falls", lat: 43.0896, lon: -79.0849 },
    { name: "Peterborough", lat: 44.3091, lon: -78.3197 },
    { name: "Brantford", lat: 43.1394, lon: -80.2644 },
    { name: "Sault Ste. Marie", lat: 46.5136, lon: -84.3358 },
    { name: "Sarnia", lat: 42.9745, lon: -82.4066 },
    { name: "Welland", lat: 42.9922, lon: -79.2483 },
    { name: "Belleville", lat: 44.1628, lon: -77.3832 },
    { name: "North Bay", lat: 46.3091, lon: -79.4608 },
    { name: "Cornwall", lat: 45.0213, lon: -74.7303 },
    { name: "Chatham-Kent", lat: 42.4048, lon: -82.1910 },
    { name: "Woodstock", lat: 43.1315, lon: -80.7467 },
    { name: "St. Thomas", lat: 42.7788, lon: -81.1927 },
    { name: "Stratford", lat: 43.3700, lon: -80.9822 },
    { name: "Timmins", lat: 48.4758, lon: -81.3304 },
    { name: "Orillia", lat: 44.6082, lon: -79.4207 },
    { name: "Owen Sound", lat: 44.5678, lon: -80.9430 },
    { name: "Orangeville", lat: 43.9197, lon: -80.0943 },
    { name: "Brockville", lat: 44.5900, lon: -75.6842 },
    { name: "Pembroke", lat: 45.8267, lon: -77.1114 },
    { name: "Collingwood", lat: 44.5000, lon: -80.2167 },
    { name: "Cobourg", lat: 43.9598, lon: -78.1664 },
    { name: "Lindsay", lat: 44.3564, lon: -78.7410 },
    { name: "Huntsville", lat: 45.3269, lon: -79.2167 },
    { name: "Kenora", lat: 49.7670, lon: -94.4894 },
    { name: "Midland", lat: 44.7500, lon: -79.8833 },
    { name: "Port Hope", lat: 43.9500, lon: -78.3000 },
    { name: "Bowmanville", lat: 43.9133, lon: -78.6872 },
    { name: "Innisfil", lat: 44.3000, lon: -79.5833 },
    { name: "Bradford", lat: 44.1167, lon: -79.5667 },
    { name: "Grimsby", lat: 43.1933, lon: -79.5606 },
    { name: "Fort Erie", lat: 42.9000, lon: -78.9333 },
    { name: "Thorold", lat: 43.1233, lon: -79.1983 },
    { name: "Lincoln", lat: 43.1667, lon: -79.4333 }
  ];

  // ================= APPLICATION STATE =================
  const State = {
    activeListKey: 'data.csv',
    prospectLists: {}, // { 'data.csv': [leads], 'cannabis.csv': [leads] }
    leads: [],
    filteredLeads: [],
    selectedId: null,
    queueStage: 'uncontacted',
    searchQuery: '',
    autoNext: false,
    callActive: false,
    callStartTime: null,
    callTimer: null,
    
    // Scraper Builder State
    selectedCities: new Set(["Toronto", "Mississauga", "Hamilton", "Ottawa"]),
    isScraping: false,
    cancelScrape: false,
    harvestedLeads: [],
    mapInstance: null,
    mapGridLayer: null,
    mapPinsLayer: null
  };

  const STORAGE_PREFIX = 'exec_prospect_lists_';

  // ================= STORAGE & LIST MANAGEMENT =================
  function initLists() {
    // Scan localStorage for existing lists
    const storedKeys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    if (storedKeys.length > 0) {
      storedKeys.forEach(k => {
        const listName = k.replace(STORAGE_PREFIX, '');
        try {
          State.prospectLists[listName] = JSON.parse(localStorage.getItem(k));
        } catch (e) {
          State.prospectLists[listName] = [];
        }
      });
    }

    // Default to data.csv if empty, fetch initial Data/data.csv file
    if (!State.prospectLists['data.csv'] || State.prospectLists['data.csv'].length === 0) {
      fetchInitialCsv();
    } else {
      switchList('data.csv');
    }
    updateListSelectorDropdown();
  }

  async function fetchInitialCsv() {
    try {
      const response = await fetch('Data/data.csv');
      if (response.ok) {
        const text = await response.text();
        const parsed = parseRawCSV(text);
        State.prospectLists['data.csv'] = parsed;
        persistList('data.csv');
        switchList('data.csv');
      } else {
        // Fallback demo leads if Data/data.csv isn't reached yet
        State.prospectLists['data.csv'] = getSeedLeads();
        persistList('data.csv');
        switchList('data.csv');
      }
    } catch (err) {
      State.prospectLists['data.csv'] = getSeedLeads();
      persistList('data.csv');
      switchList('data.csv');
    }
  }

  function persistList(name) {
    if (!name) return;
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(State.prospectLists[name] || []));
  }

  function switchList(name) {
    State.activeListKey = name;
    State.leads = State.prospectLists[name] || [];
    State.selectedId = null;
    filterQueue();
    updateTelemetry();
    if (State.filteredLeads.length) {
      selectLead(State.filteredLeads[0].id);
    } else {
      renderCockpit(null);
    }
    updateListSelectorDropdown();
  }

  function updateListSelectorDropdown() {
    const sel = document.getElementById('listSelector');
    sel.innerHTML = '';
    const keys = Object.keys(State.prospectLists);
    if (!keys.includes('data.csv')) keys.unshift('data.csv');

    keys.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = `Data/${k} (${(State.prospectLists[k] || []).length})`;
      if (k === State.activeListKey) opt.selected = true;
      sel.appendChild(opt);
    });

    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ Create New Prospect List...';
    sel.appendChild(newOpt);
  }

  // ================= CSV PARSER & EXPORTER =================
  function parseRawCSV(text) {
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
    const findCol = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));

    const cIdx = findCol(['company', 'org', 'business', 'dispensary', 'bar']);
    const nIdx = findCol(['name', 'contact', 'person', 'owner']);
    const pIdx = findCol(['phone', 'tel', 'mobile']);
    const eIdx = findCol(['email', 'mail']);
    const rIdx = findCol(['job', 'title', 'role']);
    const aIdx = findCol(['street', 'address', 'location']);
    const ciIdx = findCol(['city']);
    const poIdx = findCol(['postal', 'zip']);
    const wIdx = findCol(['web', 'site', 'url']);
    const sIdx = findCol(['stage', 'status']);
    const noIdx = findCol(['note', 'comment']);

    const leads = [];
    const now = new Date().toISOString();

    for (let i = 1; i < lines.length; i++) {
      const r = lines[i];
      if (!r.length || !r.join('').trim()) continue;

      const comp = cIdx !== -1 && r[cIdx] ? r[cIdx].trim() : '';
      const rawPhone = pIdx !== -1 && r[pIdx] ? r[pIdx].trim() : '';
      if (!comp && !rawPhone) continue;

      leads.push({
        id: 'lead_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 4),
        company: comp || 'Unnamed Business',
        name: nIdx !== -1 && r[nIdx] ? r[nIdx].trim() : '',
        job_title: rIdx !== -1 && r[rIdx] ? r[rIdx].trim() : '',
        phone: normalizePhoneNANP(rawPhone),
        email: eIdx !== -1 && r[eIdx] ? r[eIdx].trim() : '',
        website: wIdx !== -1 && r[wIdx] ? r[wIdx].trim() : '',
        country: 'Canada',
        city: ciIdx !== -1 && r[ciIdx] ? r[ciIdx].trim() : 'Toronto',
        street_address: cleanAddressString(aIdx !== -1 && r[aIdx] ? r[aIdx].trim() : ''),
        postal_code: poIdx !== -1 && r[poIdx] ? r[poIdx].trim() : '',
        stage: sIdx !== -1 && r[sIdx] ? r[sIdx].trim() : 'uncontacted',
        attempts: 0,
        notes: noIdx !== -1 && r[noIdx] ? r[noIdx].trim() : '',
        history: [],
        created_at: now
      });
    }
    return leads;
  }

  function cleanAddressString(str) {
    if (!str) return '';
    return str.replace(/[\uE0C8\r\n]+/g, ' ').trim();
  }

  function exportLeadsToCsvFile(leads, filename = 'prospects.csv') {
    if (!leads.length) {
      notifyToast('No records to export');
      return;
    }
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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notifyToast(`Exported to Data/${link.download}`);
  }

  // ================= PHONE NORMALIZATION (NANP +1) =================
  function normalizePhoneNANP(raw) {
    if (!raw) return '';
    let s = String(raw).replace(/^(?:Phone|Tel|Call)[\s:]*/i, '').trim();
    const digits = s.replace(/\D/g, '');

    if (digits.length === 10) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return s;
  }

  // ================= CRM QUEUE & COCKPIT CONTROLLER =================
  function filterQueue() {
    const q = State.searchQuery.toLowerCase().trim();
    const stage = State.queueStage;

    State.filteredLeads = State.leads.filter(l => {
      const matchQuery = !q ||
        (l.company && l.company.toLowerCase().includes(q)) ||
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q));

      if (!matchQuery) return false;
      return stage === 'all' ? true : (l.stage || 'uncontacted') === stage;
    });

    renderQueueList();
    updateTelemetry();
  }

  function renderQueueList() {
    const container = document.getElementById('queueContainer');
    container.innerHTML = '';

    if (!State.filteredLeads.length) {
      container.innerHTML = `<div style="text-align:center; padding:32px 10px; color:var(--text-dim); font-size:0.75rem;">No prospects in this queue</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();

    State.filteredLeads.forEach(lead => {
      const row = document.createElement('div');
      row.className = `lead-item ${lead.id === State.selectedId ? 'active' : ''}`;
      row.onclick = () => selectLead(lead.id);

      const stg = lead.stage || 'uncontacted';
      let tagClass = '';
      if (stg === 'callback') tagClass = 'callback';
      else if (stg === 'contacted') tagClass = 'contacted';
      else if (stg === 'dnc') tagClass = 'dnc';

      row.innerHTML = `
        <div style="min-width:0; flex:1; padding-right:8px;">
          <div class="l-company">${escapeHtml(lead.company)}</div>
          <div class="l-sub">${escapeHtml(lead.city || 'Ontario')} &bull; ${escapeHtml(lead.name || lead.phone || 'General')}</div>
        </div>
        <span class="stage-badge ${tagClass}">${stg.slice(0, 4)}</span>
      `;
      fragment.appendChild(row);
    });

    container.appendChild(fragment);
  }

  function updateTelemetry() {
    const total = State.leads.length;
    const fresh = State.leads.filter(l => (l.stage || 'uncontacted') === 'uncontacted').length;
    const callbacks = State.leads.filter(l => l.stage === 'callback').length;
    const contacted = State.leads.filter(l => l.stage === 'contacted').length;
    const totalDials = State.leads.reduce((sum, l) => sum + (l.attempts || 0), 0);

    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiDials').textContent = totalDials;
    document.getElementById('kpiConnected').textContent = contacted;
    document.getElementById('kpiCallbacks').textContent = callbacks;

    document.getElementById('tagFresh').textContent = fresh;
    document.getElementById('tagCallback').textContent = callbacks;
    document.getElementById('tagContacted').textContent = contacted;
    document.getElementById('tagAll').textContent = total;
  }

  function selectLead(id) {
    State.selectedId = id;
    renderQueueList();

    const lead = State.leads.find(l => l.id === id);
    renderCockpit(lead);
    renderIntelPane(lead);
  }

  function renderCockpit(lead) {
    const cockpit = document.getElementById('cockpitContainer');
    if (!lead) {
      cockpit.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&phone;</div>
          <h3>Select a prospect to open cockpit</h3>
          <p>Choose an account from the left pipeline or run the Lead Generator to mine accounts.</p>
        </div>`;
      return;
    }

    cockpit.innerHTML = `
      <div class="cockpit-view">
        <div class="account-header">
          <div>
            <h2>${escapeHtml(lead.company)}</h2>
            <div class="account-meta">
              <span>${escapeHtml(lead.name || 'Decision Maker')}</span>
              ${lead.job_title ? `&bull; <span>${escapeHtml(lead.job_title)}</span>` : ''}
              &bull; <span>${escapeHtml(lead.city || 'Ontario')}, Canada</span>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button id="btnEditAccount" class="btn btn-sm btn-outline">Edit</button>
            <button id="btnDeleteAccount" class="btn btn-sm btn-outline text-danger">&times;</button>
          </div>
        </div>

        <div class="action-hero">
          <button id="btnDialTrigger" class="btn-hero-call">
            <span class="c-icon">&phone;</span>
            <div>
              <span class="c-title">Launch Call</span>
              <span class="c-phone">${escapeHtml(lead.phone || 'No direct phone')}</span>
            </div>
          </button>
          <button id="btnEmailTrigger" class="btn-hero-email">
            <span style="font-weight:700; font-size:0.8rem;">&commat; Send Email</span>
            <span style="font-size:0.68rem; color:var(--text-muted);">${escapeHtml(lead.email || 'No email')}</span>
          </button>
        </div>

        <div class="dispo-quad">
          <button class="dispo-btn dispo-noanswer" id="dispoNoAnswer">
            <span class="k-badge">1</span>
            <span class="d-label">No Answer</span>
          </button>
          <button class="dispo-btn dispo-callback" id="dispoCallback">
            <span class="k-badge">2</span>
            <span class="d-label">Callback</span>
          </button>
          <button class="dispo-btn dispo-contacted" id="dispoContacted">
            <span class="k-badge">3</span>
            <span class="d-label">Connected</span>
          </button>
          <button class="dispo-btn dispo-dnc" id="dispoDnc">
            <span class="k-badge">4</span>
            <span class="d-label">D.N.C.</span>
          </button>
        </div>

        <div class="account-details">
          <div class="detail-node">
            <span class="d-lbl">Direct Phone</span>
            <span class="d-val font-mono" style="color:var(--accent-blue);">${escapeHtml(lead.phone || '-')}</span>
          </div>
          <div class="detail-node">
            <span class="d-lbl">Email Address</span>
            <span class="d-val">${escapeHtml(lead.email || '-')}</span>
          </div>
          <div class="detail-node">
            <span class="d-lbl">Physical Address</span>
            <span class="d-val">${escapeHtml(lead.street_address || lead.city || '-')}</span>
          </div>
          <div class="detail-node">
            <span class="d-lbl">Postal Code</span>
            <span class="d-val">${escapeHtml(lead.postal_code || '-')}</span>
          </div>
        </div>

        <div class="notes-wrapper">
          <div class="notes-head">
            <span>Account Notes & Meeting Outcomes</span>
            <span id="saveStatusPill" class="save-pill hidden">Saved</span>
          </div>
          <textarea id="liveNotesInput" class="notes-area" rows="4" placeholder="Enter key decision points, objection details, or follow-up schedule...">${escapeHtml(lead.notes || '')}</textarea>
        </div>

        <div class="history-wrapper">
          <div class="notes-head">
            <span>Interaction History</span>
            <span>${(lead.history || []).length} Logs</span>
          </div>
          <div class="history-list">
            ${(lead.history && lead.history.length)
              ? lead.history.map(h => `
                  <div class="history-entry">
                    <div class="entry-head">
                      <span>${escapeHtml(h.action)}</span>
                      <span>${new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="entry-body">${escapeHtml(h.note || '')}</div>
                  </div>
                `).join('')
              : '<div style="text-align:center; padding:8px; color:var(--text-dim); font-size:0.75rem;">No previous interaction logged.</div>'
            }
          </div>
        </div>
      </div>
    `;

    // Hook listeners
    document.getElementById('btnDialTrigger').onclick = () => triggerCall(lead);
    document.getElementById('btnEmailTrigger').onclick = () => {
      if (!lead.email) return notifyToast('No email address on record');
      window.location.href = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent('Quick inquiry - ' + lead.company)}`;
      logActivity(lead, 'EMAIL', 'Opened email client');
    };
    document.getElementById('btnEditAccount').onclick = () => openEditModal(lead);
    document.getElementById('btnDeleteAccount').onclick = () => {
      if (confirm(`Remove ${lead.company} from this list?`)) {
        State.leads = State.leads.filter(l => l.id !== lead.id);
        State.prospectLists[State.activeListKey] = State.leads;
        persistList(State.activeListKey);
        filterQueue();
        if (State.filteredLeads.length) selectLead(State.filteredLeads[0].id);
        else renderCockpit(null);
      }
    };

    // Dispositions
    document.getElementById('dispoNoAnswer').onclick = () => applyDisposition(lead, 'uncontacted', 'No Answer / Left Voicemail');
    document.getElementById('dispoCallback').onclick = () => applyDisposition(lead, 'callback', 'Callback Scheduled');
    document.getElementById('dispoContacted').onclick = () => applyDisposition(lead, 'contacted', 'Connected / Qualified');
    document.getElementById('dispoDnc').onclick = () => applyDisposition(lead, 'dnc', 'Do Not Call (DNC)');

    // Auto-save notes
    const notesInput = document.getElementById('liveNotesInput');
    const saveTag = document.getElementById('saveStatusPill');
    let timer;
    notesInput.oninput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lead.notes = notesInput.value;
        State.prospectLists[State.activeListKey] = State.leads;
        persistList(State.activeListKey);
        saveTag.classList.remove('hidden');
        setTimeout(() => saveTag.classList.add('hidden'), 1200);
      }, 400);
    };
  }

  // ================= INTEL PANE =================
  function renderIntelPane(lead) {
    const urlTxt = document.getElementById('intelUrlText');
    const mapQuery = document.getElementById('intelMapQuery');
    const extLink = document.getElementById('extLinkUrl');
    const iframeWeb = document.getElementById('frameWebsite');
    const iframeMap = document.getElementById('frameMap');
    const fallback = document.getElementById('frameFallback');
    const launchExt = document.getElementById('btnLaunchExternal');

    if (!lead) {
      urlTxt.textContent = 'about:blank';
      mapQuery.textContent = 'Location';
      iframeWeb.src = 'about:blank';
      iframeMap.src = 'about:blank';
      fallback.classList.add('hidden');
      return;
    }

    let rawWeb = (lead.website || '').trim();
    if (rawWeb && !rawWeb.startsWith('http://') && !rawWeb.startsWith('https://')) {
      rawWeb = 'https://' + rawWeb;
    }

    const webTarget = rawWeb || `https://duckduckgo.com/?q=${encodeURIComponent(lead.company + ' ' + (lead.city || 'Ontario'))}`;
    urlTxt.textContent = webTarget;
    extLink.href = webTarget;
    launchExt.href = webTarget;

    fallback.classList.add('hidden');
    iframeWeb.src = webTarget;
    iframeWeb.onerror = () => fallback.classList.remove('hidden');

    const addressSearch = `${lead.company} ${lead.street_address || ''} ${lead.city || 'Ontario'} Canada`.trim();
    mapQuery.textContent = addressSearch;
    iframeMap.src = `https://maps.google.com/maps?q=${encodeURIComponent(addressSearch)}&t=&z=14&ie=UTF8&iwloc=&output=embed`;

    // Deep shortcuts
    document.getElementById('btnSearchGoogle').href = `https://www.google.com/search?q=${encodeURIComponent(lead.company + ' ' + (lead.city || 'Ontario'))}`;
    document.getElementById('btnSearchLinkedIn').href = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(lead.company + ' ' + (lead.name || ''))}`;
    document.getElementById('btnSearchNews').href = `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(lead.company)}`;
  }

  // ================= CALL FLOW & TELEMETRY =================
  function triggerCall(lead) {
    if (!lead.phone) return notifyToast('Lead has no phone number');

    State.callActive = true;
    State.callStartTime = Date.now();

    const hud = document.getElementById('callHud');
    document.getElementById('hudEntityName').textContent = `${lead.company} (${lead.phone})`;
    document.getElementById('hudCallTimer').textContent = '00:00';
    hud.classList.remove('hidden');

    clearInterval(State.callTimer);
    State.callTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - State.callStartTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      document.getElementById('hudCallTimer').textContent = `${m}:${s}`;
    }, 1000);

    window.location.href = `tel:${encodeURIComponent(lead.phone)}`;
  }

  function terminateCall(reason = 'Completed') {
    if (!State.callActive) return;
    State.callActive = false;
    clearInterval(State.callTimer);
    document.getElementById('callHud').classList.add('hidden');

    const lead = State.leads.find(l => l.id === State.selectedId);
    if (lead) {
      const duration = Math.floor((Date.now() - State.callStartTime) / 1000);
      logActivity(lead, 'CALL', `${reason} (${duration}s)`);
    }
  }

  function applyDisposition(lead, stage, note) {
    terminateCall('Call Logged');
    lead.stage = stage;
    lead.attempts = (lead.attempts || 0) + 1;
    logActivity(lead, 'STATUS', note);

    State.prospectLists[State.activeListKey] = State.leads;
    persistList(State.activeListKey);
    notifyToast(`Saved: ${note}`);
    filterQueue();

    if (State.autoNext) {
      stepQueue(1);
    } else {
      selectLead(lead.id);
    }
  }

  function logActivity(lead, action, note) {
    if (!lead.history) lead.history = [];
    lead.history.unshift({ action, note, time: new Date().toISOString() });
    State.prospectLists[State.activeListKey] = State.leads;
    persistList(State.activeListKey);
  }

  function stepQueue(step) {
    if (!State.filteredLeads.length) return;
    const curIdx = State.filteredLeads.findIndex(l => l.id === State.selectedId);
    let nextIdx = curIdx + step;
    if (nextIdx >= State.filteredLeads.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = State.filteredLeads.length - 1;
    selectLead(State.filteredLeads[nextIdx].id);
  }

  // ================= CLIENT-SIDE LEAD BUILDER & MINER =================
  function initBuilder() {
    renderCityChecklist();
    initLeafletMap();
  }

  function renderCityChecklist() {
    const container = document.getElementById('citiesListContainer');
    const filter = (document.getElementById('cityFilterInput').value || '').toLowerCase().trim();
    container.innerHTML = '';

    const filtered = ONTARIO_CITIES.filter(c => c.name.toLowerCase().includes(filter));
    filtered.forEach(c => {
      const row = document.createElement('div');
      row.className = 'city-check-row';
      const isChecked = State.selectedCities.has(c.name);

      row.innerHTML = `
        <label style="display:flex; align-items:center; cursor:pointer; flex:1;">
          <input type="checkbox" value="${c.name}" ${isChecked ? 'checked' : ''}>
          <span>${c.name}, ON</span>
        </label>
        <button class="btn-micro" style="font-size:0.65rem;" onclick="event.stopPropagation(); zoomToCity('${c.name}')">Map</button>
      `;
      row.querySelector('input').onchange = (e) => {
        if (e.target.checked) State.selectedCities.add(c.name);
        else State.selectedCities.delete(c.name);
        document.getElementById('citiesSelectedCount').textContent = `${State.selectedCities.size} municipalities selected`;
      };
      container.appendChild(row);
    });

    document.getElementById('citiesSelectedCount').textContent = `${State.selectedCities.size} municipalities selected`;
  }

  window.zoomToCity = (cityName) => {
    const c = ONTARIO_CITIES.find(x => x.name === cityName);
    if (c && State.mapInstance) {
      State.mapInstance.flyTo([c.lat, c.lon], 12);
    }
  };

  function initLeafletMap() {
    if (State.mapInstance) return;
    State.mapInstance = L.map('leafletMap').setView([43.6532, -79.3832], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap, © CARTO'
    }).addTo(State.mapInstance);

    State.mapGridLayer = L.layerGroup().addTo(State.mapInstance);
    State.mapPinsLayer = L.layerGroup().addTo(State.mapInstance);
  }

  async function runLeadScraper() {
    if (State.selectedCities.size === 0) {
      alert('Please select at least one Ontario municipality.');
      return;
    }

    State.isScraping = true;
    State.cancelScrape = false;
    State.harvestedLeads = [];

    document.getElementById('btnStartScrape').classList.add('hidden');
    document.getElementById('btnStopScrape').classList.remove('hidden');
    document.getElementById('trackerStatusBadge').textContent = 'Scanner Active';

    const rawKw = document.getElementById('builderKeywords').value;
    const keywords = rawKw.split(',').map(s => s.trim()).filter(Boolean);
    const chosenCities = ONTARIO_CITIES.filter(c => State.selectedCities.has(c.name));

    const gridWidth = parseFloat(document.getElementById('gridWidthKm').value) || 20;
    const gridHeight = parseFloat(document.getElementById('gridHeightKm').value) || 20;
    const gridCols = parseInt(document.getElementById('gridCols').value) || 2;
    const gridRows = parseInt(document.getElementById('gridRows').value) || 2;

    logTerminal(`Starting multi-city mining across ${chosenCities.length} municipalities...`, 'info');

    let totalDiscovered = 0;
    let totalEnriched = 0;
    let totalEmails = 0;

    for (let i = 0; i < chosenCities.length; i++) {
      if (State.cancelScrape) break;
      const city = chosenCities[i];
      const progress = Math.round((i / chosenCities.length) * 100);
      document.getElementById('scrapeProgressBar').style.width = `${progress}%`;

      logTerminal(`Targeting Municipality: [${city.name}, Ontario]`, 'info');
      State.mapInstance.flyTo([city.lat, city.lon], 11, { duration: 1.0 });

      // Generate Geodesic Grid
      const cells = calculateGridCells(city.lat, city.lon, gridWidth, gridHeight, gridCols, gridRows);
      drawGridBoxes(cells);

      for (const cell of cells) {
        if (State.cancelScrape) break;

        for (const kw of keywords) {
          if (State.cancelScrape) break;
          logTerminal(`Scanning Cell (${cell.row},${cell.col}) for "${kw}" in ${city.name}...`, 'info');

          try {
            const found = await queryOverpassPlaces(cell, kw, city.name);
            totalDiscovered += found.length;
            document.getElementById('bStatDiscovered').textContent = totalDiscovered;

            for (const biz of found) {
              if (biz.phone) {
                totalEnriched++;
                document.getElementById('bStatEnriched').textContent = totalEnriched;
              }
              if (biz.email) {
                totalEmails++;
                document.getElementById('bStatEmails').textContent = totalEmails;
              }

              State.harvestedLeads.push(biz);
              dropMapPin(biz);
              document.getElementById('bStatAdded').textContent = State.harvestedLeads.length;

              logTerminal(`[FOUND] ${biz.company} | ${biz.phone || 'No direct phone'} | ${biz.city}`, 'success');
            }
          } catch (e) {
            logTerminal(`Cell query warning: ${e.message}`, 'warn');
          }

          // Gentle rate-limiting to honor open data servers
          await new Promise(r => setTimeout(r, 600));
        }
      }
    }

    document.getElementById('scrapeProgressBar').style.width = '100%';
    State.isScraping = false;
    document.getElementById('btnStartScrape').classList.remove('hidden');
    document.getElementById('btnStopScrape').classList.add('hidden');
    document.getElementById('trackerStatusBadge').textContent = 'Finished';
    logTerminal(`Harvest complete: ${State.harvestedLeads.length} leads gathered.`, 'success');
  }

  function calculateGridCells(lat, lon, widthKm, heightKm, cols, rows) {
    const latDegKm = 1.0 / 110.574;
    const lonDegKm = 1.0 / (111.320 * Math.cos(lat * Math.PI / 180.0));

    const halfH = (heightKm / 2) * latDegKm;
    const halfW = (widthKm / 2) * lonDegKm;

    const minLat = lat - halfH;
    const maxLat = lat + halfH;
    const minLon = lon - halfW;
    const maxLon = lon + halfW;

    const stepLat = (maxLat - minLat) / rows;
    const stepLon = (maxLon - minLon) / cols;

    const cells = [];
    for (let r = 0; r < rows; r++) {
      const cMaxLat = maxLat - (r * stepLat);
      const cMinLat = cMaxLat - stepLat;
      for (let c = 0; c < cols; c++) {
        const cMinLon = minLon + (c * stepLon);
        const cMaxLon = cMinLon + stepLon;
        cells.push({
          row: r, col: c,
          minLat: cMinLat, minLon: cMinLon,
          maxLat: cMaxLat, maxLon: cMaxLon
        });
      }
    }
    return cells;
  }

  function drawGridBoxes(cells) {
    if (!State.mapGridLayer) return;
    State.mapGridLayer.clearLayers();
    cells.forEach(c => {
      L.rectangle([[c.minLat, c.minLon], [c.maxLat, c.maxLon]], {
        color: '#3b82f6', weight: 1.5, fillOpacity: 0.05
      }).addTo(State.mapGridLayer);
    });
  }

  function dropMapPin(biz) {
    if (!State.mapPinsLayer || !biz.lat || !biz.lon) return;
    const marker = L.circleMarker([biz.lat, biz.lon], {
      radius: 6,
      fillColor: '#10b981',
      color: '#fff',
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(State.mapPinsLayer);

    marker.bindPopup(`<b>${escapeHtml(biz.company)}</b><br>${escapeHtml(biz.phone || 'No phone')}<br>${escapeHtml(biz.city)}`);
  }

  async function queryOverpassPlaces(cell, keyword, cityName) {
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ];

    const ql = `
[out:json][timeout:15];
(
  nwr["name"~"${keyword}",i](${cell.minLat},${cell.minLon},${cell.maxLat},${cell.maxLon});
  nwr["shop"~"${keyword}",i](${cell.minLat},${cell.minLon},${cell.maxLat},${cell.maxLon});
  nwr["amenity"~"${keyword}",i](${cell.minLat},${cell.minLon},${cell.maxLat},${cell.maxLon});
);
out center 15;
`;

    let data = null;
    for (const ep of endpoints) {
      try {
        const resp = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(ql)
        });
        if (resp.ok) {
          data = await resp.json();
          break;
        }
      } catch (e) {
        // Try fallback endpoint
      }
    }

    if (!data || !data.elements) return [];

    return data.elements.map(el => {
      const tags = el.tags || {};
      const company = tags.name || tags.brand || 'Local Business';
      const phone = tags.phone || tags['contact:phone'] || '';
      const email = tags.email || tags['contact:email'] || '';
      const web = tags.website || tags['contact:website'] || '';
      const street = tags['addr:street'] ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim() : '';

      return {
        id: 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        company,
        name: tags.operator || '',
        job_title: 'Manager / Operator',
        phone: normalizePhoneNANP(phone),
        email,
        website: web,
        country: 'Canada',
        city: cityName,
        street_address: street,
        postal_code: tags['addr:postcode'] || '',
        stage: 'uncontacted',
        attempts: 0,
        notes: `Harvested in ${cityName} (${keyword})`,
        lat: el.lat || (el.center && el.center.lat) || 0,
        lon: el.lon || (el.center && el.center.lon) || 0,
        history: [],
        created_at: new Date().toISOString()
      };
    });
  }

  function logTerminal(msg, level = 'info') {
    const term = document.getElementById('builderTerminal');
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = `t-line ${level}`;
    div.textContent = `[${time}] ${msg}`;
    term.appendChild(div);
    term.scrollTop = term.scrollHeight;
  }

  // ================= MODALS & EDITING =================
  function openEditModal(lead = null) {
    document.getElementById('modalTitle').textContent = lead ? 'Edit Lead' : 'Add Lead';
    document.getElementById('fId').value = lead ? lead.id : '';
    document.getElementById('fCompany').value = lead ? lead.company : '';
    document.getElementById('fName').value = lead ? lead.name : '';
    document.getElementById('fJobTitle').value = lead ? lead.job_title : '';
    document.getElementById('fPhone').value = lead ? lead.phone : '';
    document.getElementById('fEmail').value = lead ? lead.email : '';
    document.getElementById('fWebsite').value = lead ? lead.website : '';
    document.getElementById('fCity').value = lead ? lead.city : 'Toronto';
    document.getElementById('fPostalCode').value = lead ? lead.postal_code : '';
    document.getElementById('fAddress').value = lead ? lead.street_address : '';
    document.getElementById('fNotes').value = lead ? lead.notes : '';

    document.getElementById('leadModal').classList.remove('hidden');
  }

  function handleSaveForm(e) {
    e.preventDefault();
    const id = document.getElementById('fId').value;
    const company = document.getElementById('fCompany').value.trim();
    const phone = normalizePhoneNANP(document.getElementById('fPhone').value.trim());

    if (!company) return alert('Company name is required');

    if (id) {
      const l = State.leads.find(x => x.id === id);
      if (l) {
        l.company = company;
        l.name = document.getElementById('fName').value.trim();
        l.job_title = document.getElementById('fJobTitle').value.trim();
        l.phone = phone;
        l.email = document.getElementById('fEmail').value.trim();
        l.website = document.getElementById('fWebsite').value.trim();
        l.city = document.getElementById('fCity').value.trim();
        l.postal_code = document.getElementById('fPostalCode').value.trim();
        l.street_address = document.getElementById('fAddress').value.trim();
        l.notes = document.getElementById('fNotes').value.trim();
        logActivity(l, 'UPDATE', 'Details updated via form');
      }
    } else {
      const newLead = {
        id: 'lead_' + Date.now(),
        company,
        name: document.getElementById('fName').value.trim(),
        job_title: document.getElementById('fJobTitle').value.trim(),
        phone,
        email: document.getElementById('fEmail').value.trim(),
        website: document.getElementById('fWebsite').value.trim(),
        country: 'Canada',
        city: document.getElementById('fCity').value.trim() || 'Toronto',
        postal_code: document.getElementById('fPostalCode').value.trim(),
        street_address: document.getElementById('fAddress').value.trim(),
        notes: document.getElementById('fNotes').value.trim(),
        stage: 'uncontacted',
        attempts: 0,
        history: [{ action: 'CREATED', note: 'Created manually', time: new Date().toISOString() }],
        created_at: new Date().toISOString()
      };
      State.leads.unshift(newLead);
      State.selectedId = newLead.id;
    }

    State.prospectLists[State.activeListKey] = State.leads;
    persistList(State.activeListKey);
    filterQueue();
    if (State.selectedId) selectLead(State.selectedId);
    document.getElementById('leadModal').classList.add('hidden');
    notifyToast('Lead record saved successfully.');
  }

  // ================= UTILITIES & HELPERS =================
  function notifyToast(msg) {
    const t = document.getElementById('toastMessage');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
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
        job_title: 'Owner',
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
      }
    ];
  }

  // ================= EVENT HOOKS =================
  function bindGlobalEvents() {
    // Mode Switcher
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        btn.classList.add('active');
        const targetView = btn.dataset.view;
        document.getElementById(targetView).classList.add('active');

        if (targetView === 'viewBuilder') {
          setTimeout(() => {
            if (State.mapInstance) State.mapInstance.invalidateSize();
          }, 200);
        }
      };
    });

    // List Switcher Dropdown
    document.getElementById('listSelector').onchange = (e) => {
      const val = e.target.value;
      if (val === '__new__') {
        const name = prompt('Enter new prospect list filename (e.g., breweries_ontario.csv):');
        if (name) {
          const cleanName = name.trim().endsWith('.csv') ? name.trim() : `${name.trim()}.csv`;
          State.prospectLists[cleanName] = [];
          persistList(cleanName);
          switchList(cleanName);
        } else {
          e.target.value = State.activeListKey;
        }
      } else {
        switchList(val);
      }
    };

    // Queue Stage Tabs
    document.querySelectorAll('.q-tab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.q-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        State.queueStage = tab.dataset.stage;
        filterQueue();
        if (State.filteredLeads.length) selectLead(State.filteredLeads[0].id);
        else renderCockpit(null);
      };
    });

    // Intel tabs
    document.querySelectorAll('.itab').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.itab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.intel-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.target).classList.add('active');
      };
    });

    // Search input
    document.getElementById('queueSearch').oninput = (e) => {
      State.searchQuery = e.target.value;
      filterQueue();
    };

    // Auto-Next button
    const btnAutoNext = document.getElementById('btnAutoNext');
    btnAutoNext.onclick = () => {
      State.autoNext = !State.autoNext;
      btnAutoNext.classList.toggle('active', State.autoNext);
      btnAutoNext.innerHTML = `<span class="dot-beacon"></span> Auto-Next: ${State.autoNext ? 'ON' : 'OFF'}`;
      notifyToast(State.autoNext ? 'Auto-Next queue stepping enabled' : 'Auto-Next disabled');
    };

    // Import CSV button
    document.getElementById('fileCsvPicker').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const parsed = parseRawCSV(evt.target.result);
        if (parsed.length > 0) {
          const listName = file.name.endsWith('.csv') ? file.name : `${file.name}.csv`;
          State.prospectLists[listName] = parsed;
          persistList(listName);
          switchList(listName);
          notifyToast(`Loaded ${parsed.length} records into Data/${listName}`);
        } else {
          notifyToast('Unable to parse CSV records');
        }
      };
      reader.readAsText(file);
    };

    // Export Active CSV
    document.getElementById('btnExportActiveCsv').onclick = () => {
      exportLeadsToCsvFile(State.leads, State.activeListKey);
    };

    // Add Lead modal
    document.getElementById('btnAddNewLead').onclick = () => openEditModal(null);
    document.getElementById('leadForm').onsubmit = handleSaveForm;
    document.getElementById('btnCloseModal').onclick = () => document.getElementById('leadModal').classList.add('hidden');
    document.getElementById('btnCancelModal').onclick = () => document.getElementById('leadModal').classList.add('hidden');

    // In-Call HUD End
    document.getElementById('btnEndHudCall').onclick = () => terminateCall('Terminated by Operator');

    // Builder Events
    document.getElementById('cityFilterInput').oninput = renderCityChecklist;
    document.getElementById('btnSelectAllCities').onclick = () => {
      ONTARIO_CITIES.forEach(c => State.selectedCities.add(c.name));
      renderCityChecklist();
    };
    document.getElementById('btnClearCities').onclick = () => {
      State.selectedCities.clear();
      renderCityChecklist();
    };
    document.getElementById('btnStartScrape').onclick = runLeadScraper;
    document.getElementById('btnStopScrape').onclick = () => {
      State.cancelScrape = true;
      logTerminal('User cancelled mining.', 'warn');
    };

    // Builder Results Actions
    document.getElementById('btnPushToCrm').onclick = () => {
      if (!State.harvestedLeads.length) return alert('No mined leads available to push');
      const targetName = document.getElementById('targetCsvFileName').value.trim() || 'harvested_leads.csv';
      const cleanTarget = targetName.endsWith('.csv') ? targetName : `${targetName}.csv`;

      State.prospectLists[cleanTarget] = State.harvestedLeads;
      persistList(cleanTarget);
      switchList(cleanTarget);

      // Switch to CRM View
      document.getElementById('viewBtnCrm').click();
      notifyToast(`Loaded ${State.harvestedLeads.length} leads into Active CRM (${cleanTarget})`);
    };

    document.getElementById('btnDownloadHarvestCsv').onclick = () => {
      const targetName = document.getElementById('targetCsvFileName').value.trim() || 'harvested_leads.csv';
      exportLeadsToCsvFile(State.harvestedLeads, targetName);
    };

    // Template copy
    document.getElementById('btnCopyEmailTemplate').onclick = () => {
      const lead = State.leads.find(l => l.id === State.selectedId);
      let tpl = document.getElementById('quickEmailTemplate').value;
      if (lead) {
        tpl = tpl.replace(/\[Name\]/g, lead.name || 'there');
        tpl = tpl.replace(/\[City\]/g, lead.city || 'Ontario');
      }
      navigator.clipboard.writeText(tpl);
      notifyToast('Template copied to clipboard');
    };

    // Global Hotkeys
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
        applyDisposition(current, 'uncontacted', 'No Answer / Left Voicemail');
      } else if (e.key === '2' && current) {
        applyDisposition(current, 'callback', 'Callback Scheduled');
      } else if (e.key === '3' && current) {
        applyDisposition(current, 'contacted', 'Connected / Qualified');
      } else if (e.key === '4' && current) {
        applyDisposition(current, 'dnc', 'Do Not Call (DNC)');
      } else if (e.key === 'Escape') {
        document.getElementById('leadModal').classList.add('hidden');
      }
    };
  }

  // ================= START APPLICATION =================
  window.addEventListener('DOMContentLoaded', () => {
    initLists();
    initBuilder();
    bindGlobalEvents();
  });

})();