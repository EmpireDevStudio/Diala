/**
 * FLIPDIALLER — LIVING PAPER 3.6 (MOBILE-FIRST OUTREACH ENGINE)
 * Pipeline stages:
 *  - 'leads'     : Uncontacted, No Answer, or Call Back (stays in Leads list)
 *  - 'partial'   : Pixar Pitch sent via website contact form
 *  - 'completed' : Prospecting Email sent
 */

(() => {
  'use strict';

  // --- 1. DEFAULT SETTINGS & EMPIRE DEV STUDIO PITCHES ---
  const SETTINGS_KEY = 'FlipDiallerSettings_v4';
  const DEFAULT_DEMO_URL = 'https://empiredevstudio.github.io/Demo-Home/';

  const DEFAULT_SETTINGS = {
    senderName: 'Christian J.',
    senderCompany: 'Empire Dev Studio',
    senderEmail: 'EmpireDevStudio@gmail.com',
    senderPhone: '',
    senderTitle: 'Founder',
    formSubject: 'Staff Training | A Pixar Pitch',

    pixar1:
      'Once upon a time, running a standout bar meant knowing your team could nail every cocktail spec, pour consistently, and upsell with confidence, even during a packed Friday night rush.',
    pixar2:
      'Every day, managers lost hours chasing recipes, formatting spec sheets, and training new hires, only for dusty binders and buried PDFs to get ignored the moment service got busy.',
    pixar3:
      'One day, we turned a venue\'s existing recipes, SOPs, and training videos into a pocket-ready web app. Giving every bartender instant, zero-friction access right from their phone.',
    pixar4:
      'Because of that, onboarding new staff got faster, pour consistency tightened up, and managers got their admin hours back to focus on the floor.',
    pixar5:
      'Because of that, staff training stopped being a chore, turning quick pre-shift moments into sharper product knowledge, smoother service, and higher check averages.',
    pixar6:
      'Until finally, technology stopped sitting in a back-office folder and started pulling its weight behind the bar.',
    pixarExtra:
`I'm {{senderName}}, founder of {{senderCompany}} I build custom, mobile-first training hubs for hospitality venues like {{company}} so your team actually uses the specs you work hard to create. Rather than pitch you a wall of text, I built a live 60-second interactive demo you can test on your phone: https://empiredevstudio.github.io/Demo-Home/ (one rule: don't tap the spinning record until you've finished exploring).

Worth a quick look? Take it for a spin and hit reply with your honest verdict. What's the #1 training headache at {{company}} right now?`,

    emailProvider: 'gmail',
    emailSubject: 'Christian John | The pocket training demo we spoke about',
    emailBody:
`Hi,

It was really great speaking with you earlier.

I'm {{senderFirstName}}, founder of {{senderCompany}}. We help hospitality venues turn their cocktail specs, SOPs, and training videos into a simple, pocket-ready web app, so new hires ramp up faster, pours stay consistent during a rush, and managers stop losing hours updating binders nobody reads.

Instead of sending a pitch deck, I put together an interactive demo so you can feel how it works in 60 seconds:
https://empiredevstudio.github.io/Demo-Home/

(One small catch: only tap the spinning record once you've finished exploring. The record will take you to a optional reply email that is just a dun way to engage further and "break the ice".)

When you've had a quick scroll, I'd love your unfiltered take:
1. Where does your team lose the most time with training or spec updates right now?
2. What feels genuinely useful or is missing from the demo?
Looking forward to hearing from you.

Best,

{{senderName}}
{{senderTitle}} | {{senderCompany}}`,

    autoStagePixar: true,
    autoStageEmail: true
  };

  let settings = loadSettings();

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettingsToStorage(next) {
    settings = { ...DEFAULT_SETTINGS, ...next };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  // --- 2. INDEXEDDB PERSISTENCE ---
  const DB_NAME = 'FlipDiallerLiteDB';
  const DB_VERSION = 2;
  let db = null;

  function initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('contacts')) {
          const store = database.createObjectStore('contacts', { keyPath: 'id' });
          store.createIndex('stage', 'stage', { unique: false });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  const dbAPI = {
    getAll: () => new Promise(res => {
      db.transaction('contacts', 'readonly').objectStore('contacts').getAll().onsuccess = (e) => {
        res((e.target.result || []).map(normalizeContact));
      };
    }),
    put: (item) => new Promise(res => {
      db.transaction('contacts', 'readwrite').objectStore('contacts').put(item).onsuccess = () => res(item);
    }),
    delete: (id) => new Promise(res => {
      db.transaction('contacts', 'readwrite').objectStore('contacts').delete(id).onsuccess = () => res(true);
    }),
    clear: () => new Promise(res => {
      db.transaction('contacts', 'readwrite').objectStore('contacts').clear().onsuccess = () => res(true);
    })
  };

  function normalizeStage(stage) {
    if (stage === 'partial' || stage === 'pixar_sent') return 'partial';
    if (stage === 'completed' || stage === 'contacted') return 'completed';
    return 'leads';
  }

  function normalizeContact(c) {
    return {
      ...c,
      stage: normalizeStage(c.stage),
      job_title: c.job_title || c.title || '',
      contact_form_url: c.contact_form_url || '',
      street_address: c.street_address || '',
      city: c.city || '',
      country: c.country || '',
      postal_code: c.postal_code || '',
      attempts: c.attempts || 0,
      callback_at: c.callback_at || null
    };
  }

  // --- 3. STATE ---
  const state = {
    contacts: [],
    filtered: [],
    activeId: null,
    stageFilter: 'leads',
    search: '',
    notesTimer: null,
    toastTimer: null
  };

  // --- 4. DOM REFERENCES ---
  const el = {
    list: document.getElementById('contactList'),
    inputSearch: document.getElementById('inputSearch'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    cockpitEmpty: document.getElementById('cockpitEmpty'),
    cockpitContent: document.getElementById('cockpitContent'),
    paneCockpit: document.getElementById('paneCockpit'),
    btnBackToList: document.getElementById('btnBackToList'),
    btnPrevLead: document.getElementById('btnPrevLead'),
    btnNextLead: document.getElementById('btnNextLead'),
    mobileNavTitle: document.getElementById('mobileNavTitle'),
    mobileQueueCounter: document.getElementById('mobileQueueCounter'),
    toast: document.getElementById('toast'),

    btnMobileMore: document.getElementById('btnMobileMore'),
    mobileHeaderMenu: document.getElementById('mobileHeaderMenu'),

    countLeads: document.getElementById('countLeads'),
    countPartial: document.getElementById('countPartial'),
    countCompleted: document.getElementById('countCompleted'),
    countAll: document.getElementById('countAll'),

    leadStageBadge: document.getElementById('leadStageBadge'),
    leadAttemptsBadge: document.getElementById('leadAttemptsBadge'),
    leadCallbackBadge: document.getElementById('leadCallbackBadge'),
    leadCompany: document.getElementById('leadCompany'),
    leadSubtitle: document.getElementById('leadSubtitle'),
    leadAddress: document.getElementById('leadAddress'),
    leadPhone: document.getElementById('leadPhone'),
    btnCallLead: document.getElementById('btnCallLead'),

    leadFormUrlDisplay: document.getElementById('leadFormUrlDisplay'),
    btnSendPixar: document.getElementById('btnSendPixar'),
    pixarStatusTag: document.getElementById('pixarStatusTag'),
    btnTogglePixarPreview: document.getElementById('btnTogglePixarPreview'),
    pixarPreviewDrawer: document.getElementById('pixarPreviewDrawer'),
    pixarCharCount: document.getElementById('pixarCharCount'),
    pixarPreviewBox: document.getElementById('pixarPreviewBox'),

    leadEmailDisplay: document.getElementById('leadEmailDisplay'),
    btnSendEmail: document.getElementById('btnSendEmail'),
    emailStatusTag: document.getElementById('emailStatusTag'),
    btnToggleEmailPreview: document.getElementById('btnToggleEmailPreview'),
    emailPreviewDrawer: document.getElementById('emailPreviewDrawer'),
    emailSubjectPreview: document.getElementById('emailSubjectPreview'),
    emailPreviewBox: document.getElementById('emailPreviewBox'),

    leadNotes: document.getElementById('leadNotes'),
    notesSaveIndicator: document.getElementById('notesSaveIndicator'),

    dialogForm: document.getElementById('dialogLeadForm'),
    leadForm: document.getElementById('leadForm'),
    btnDeleteFromModal: document.getElementById('btnDeleteFromModal'),
    dialogCallback: document.getElementById('dialogCallback'),
    dialogSettings: document.getElementById('dialogSettings')
  };

  // --- 5. TEMPLATE INTERPOLATION ---
  function interpolate(template, contact, activeSettings = settings) {
    const c = contact || {
      company: 'Library Bar',
      name: 'Jordan',
      job_title: 'General Manager',
      city: 'Toronto',
      street_address: '100 Front St W',
      phone: '+1 (249) 402-5312',
      email: 'team@librarybar.com'
    };

    const contactName = (c.name || '').trim();
    const firstName = contactName ? contactName.split(/\s+/)[0] : 'there';

    const sName = (activeSettings.senderName || '').trim();
    const sFirstName = sName ? sName.split(/\s+/)[0] : '';

    const vars = {
      company: c.company || c.name || 'your venue',
      name: contactName || 'there',
      first_name: firstName,
      title: c.job_title || '',
      city: c.city || 'your area',
      address: c.street_address || '',
      phone: c.phone || '',
      email: c.email || '',
      senderName: sName,
      senderFirstName: sFirstName,
      senderCompany: activeSettings.senderCompany || '',
      senderEmail: activeSettings.senderEmail || '',
      senderPhone: activeSettings.senderPhone || '',
      senderTitle: activeSettings.senderTitle || ''
    };

    return (template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => (
      Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : ''
    ));
  }

  function buildPixarPitch(contact, activeSettings = settings) {
    const beats = [
      activeSettings.pixar1,
      activeSettings.pixar2,
      activeSettings.pixar3,
      activeSettings.pixar4,
      activeSettings.pixar5,
      activeSettings.pixar6
    ]
      .map(line => interpolate(line, contact, activeSettings).trim())
      .filter(Boolean);

    const extra = interpolate(activeSettings.pixarExtra, contact, activeSettings).trim();
    if (extra) beats.push('', extra);
    return beats.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function buildEmailHref(contact, activeSettings = settings) {
    if (!contact || !contact.email) return '#';
    const to = encodeURIComponent(contact.email.trim());
    const su = encodeURIComponent(interpolate(activeSettings.emailSubject, contact, activeSettings));
    const body = encodeURIComponent(interpolate(activeSettings.emailBody, contact, activeSettings));

    switch (activeSettings.emailProvider) {
      case 'outlook':
        return `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${su}&body=${body}`;
      case 'office365':
        return `https://outlook.office.com/mail/deeplink/compose?to=${to}&subject=${su}&body=${body}`;
      case 'mailto':
        return `mailto:${to}?subject=${su}&body=${body}`;
      case 'gmail':
      default:
        return `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${body}`;
    }
  }

  function extractDemoUrl(activeSettings = settings) {
    const combined = `${activeSettings.emailBody || ''}\n${activeSettings.pixarExtra || ''}`;
    const match = combined.match(/https?:\/\/[^\s)]+/i);
    return match ? match[0] : DEFAULT_DEMO_URL;
  }

  function formatWordCharCount(text) {
    const clean = (text || '').trim();
    if (!clean) return '0 words • 0 chars';
    const words = clean.split(/\s+/).length;
    return `${words} words • ${clean.length.toLocaleString()} chars`;
  }

  // --- 6. UTILITIES ---
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.toast.classList.remove('visible'), 2500);
  }

  async function copyText(text, label = 'Copied', emptyMsg = 'Nothing to copy') {
    if (!text || !String(text).trim()) {
      showToast(emptyMsg);
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast(`✓ ${label} copied`);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(`✓ ${label} copied`);
      return true;
    }
  }

  function formatCallbackShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // --- 7. RENDERING & FILTERING ---
  function applyFilters() {
    const q = state.search.toLowerCase().trim();
    el.btnClearSearch.classList.toggle('hidden', !state.search);

    state.filtered = state.contacts.filter(c => {
      const matchesQuery = !q ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q));

      if (!matchesQuery) return false;
      if (state.stageFilter === 'all') return true;
      return c.stage === state.stageFilter;
    });

    updateCounts();
    renderList();

    if (state.activeId && !state.contacts.some(c => c.id === state.activeId)) {
      state.activeId = null;
    }
    if (!state.activeId && state.filtered.length > 0 && window.innerWidth > 820) {
      state.activeId = state.filtered[0].id;
    }

    renderActiveCockpit();
  }

  function updateCounts() {
    el.countLeads.textContent = state.contacts.filter(c => c.stage === 'leads').length;
    el.countPartial.textContent = state.contacts.filter(c => c.stage === 'partial').length;
    el.countCompleted.textContent = state.contacts.filter(c => c.stage === 'completed').length;
    el.countAll.textContent = state.contacts.length;
  }

  function renderList() {
    if (state.contacts.length === 0) {
      el.list.innerHTML = `
        <div class="list-empty-onboarding">
          <div class="empty-monogram">📜</div>
          <h3>Pipeline Ready</h3>
          <p>Import a CSV lead list or add your first venue to start dialing and sending pitches.</p>
          <div class="empty-actions">
            <label for="csvFileInput" class="btn btn-primary">📥 Import CSV</label>
            <button id="btnListEmptyAdd" class="btn btn-vellum" type="button">+ Add Lead</button>
          </div>
        </div>
      `;
      return;
    }

    if (state.filtered.length === 0) {
      const clearHtml = state.search
        ? `<button id="btnEmptyClearSearch" class="btn btn-vellum" type="button" style="margin-top:10px;">Clear Search</button>`
        : '';
      el.list.innerHTML = `<div class="list-empty"><div>No prospects in this queue.</div>${clearHtml}</div>`;
      return;
    }

    el.list.innerHTML = state.filtered.map(c => {
      const stageLabels = { leads: 'Lead', partial: 'Partial', completed: 'Done' };
      const title = c.company || c.name || 'Unnamed Prospect';
      const subParts = [c.company && c.name ? c.name : c.job_title, c.city].filter(Boolean);
      const tags = [];
      if (c.contact_form_url) tags.push('<span class="mini-tag">Form</span>');
      if (c.email) tags.push('<span class="mini-tag">Email</span>');
      if (c.attempts) tags.push(`<span class="mini-tag">Att:${c.attempts}</span>`);
      if (c.callback_at && c.stage === 'leads') {
        tags.push(`<span class="mini-tag mini-tag-cb">CB</span>`);
      }

      return `
        <div class="contact-card ${c.id === state.activeId ? 'active' : ''}" data-id="${esc(c.id)}" role="listitem">
          <div class="card-main">
            <div class="card-top">
              <div class="card-title">${esc(title)}</div>
              <span class="card-stage-dot dot-${c.stage}">${stageLabels[c.stage]}</span>
            </div>
            <div class="card-sub">${esc(subParts.join(' • ') || 'Prospect')}</div>
            <div class="card-meta">
              <span>${esc(c.phone || 'No phone')}</span>
              <span class="card-tags">${tags.join('')}</span>
            </div>
          </div>
          <span class="card-chevron" aria-hidden="true">›</span>
        </div>
      `;
    }).join('');
  }

  function selectLead(id, openMobile = true) {
    state.activeId = id;
    renderList();
    renderActiveCockpit();

    if (openMobile && window.innerWidth <= 820) {
      el.paneCockpit.classList.add('mobile-visible');
      el.cockpitContent.scrollTop = 0;
    }
  }

  function stepLead(delta) {
    if (state.filtered.length === 0) return;
    const idx = state.filtered.findIndex(c => c.id === state.activeId);
    if (idx === -1) {
      selectLead(state.filtered[0].id);
      return;
    }
    const target = idx + delta;
    if (target >= 0 && target < state.filtered.length) {
      selectLead(state.filtered[target].id, false);
      el.cockpitContent.scrollTop = 0;
    }
  }

  function renderActiveCockpit() {
    const c = state.contacts.find(x => x.id === state.activeId);
    const activeIdx = state.filtered.findIndex(x => x.id === state.activeId);

    el.btnPrevLead.disabled = activeIdx <= 0;
    el.btnNextLead.disabled = activeIdx === -1 || activeIdx >= state.filtered.length - 1;
    el.mobileQueueCounter.textContent = activeIdx !== -1
      ? `${activeIdx + 1} of ${state.filtered.length}`
      : `${state.filtered.length} in view`;
    el.mobileNavTitle.textContent = c ? (c.company || c.name || 'Prospect') : 'Prospect';

    if (!c) {
      el.cockpitEmpty.classList.remove('hidden');
      el.cockpitContent.classList.add('hidden');
      return;
    }

    el.cockpitEmpty.classList.add('hidden');
    el.cockpitContent.classList.remove('hidden');

    const stageMap = {
      leads: { text: 'Lead Queue', cls: '' },
      partial: { text: 'Partial • Pixar Sent', cls: 'is-partial' },
      completed: { text: 'Completed • Emailed', cls: 'is-completed' }
    };
    const st = stageMap[c.stage] || stageMap.leads;
    el.leadStageBadge.textContent = st.text;
    el.leadStageBadge.className = `stage-pill ${st.cls}`;

    if (c.attempts > 0) {
      el.leadAttemptsBadge.textContent = `${c.attempts} ${c.attempts === 1 ? 'attempt' : 'attempts'}`;
      el.leadAttemptsBadge.classList.remove('hidden');
    } else {
      el.leadAttemptsBadge.classList.add('hidden');
    }

    if (c.callback_at && c.stage === 'leads') {
      el.leadCallbackBadge.textContent = `📅 CB: ${formatCallbackShort(c.callback_at)}`;
      el.leadCallbackBadge.classList.remove('hidden');
    } else {
      el.leadCallbackBadge.classList.add('hidden');
    }

    el.leadCompany.textContent = c.company || c.name || 'Unnamed Prospect';
    el.leadSubtitle.textContent = [c.name, c.job_title].filter(Boolean).join(' • ');
    el.leadAddress.textContent = [c.street_address, c.city, c.country].filter(Boolean).join(', ');

    const cleanNum = (c.phone || '').replace(/[^\d+]/g, '');
    el.leadPhone.textContent = c.phone || 'No phone on file';
    el.btnCallLead.href = cleanNum ? `tel:${cleanNum}` : '#';
    el.btnCallLead.classList.toggle('is-disabled', !cleanNum);

    // Pixar Form Card
    const hasForm = Boolean(c.contact_form_url && c.contact_form_url.trim());
    el.leadFormUrlDisplay.textContent = hasForm ? c.contact_form_url : 'No contact URL on file (tap Edit)';
    el.btnSendPixar.disabled = !hasForm;
    el.btnSendPixar.classList.toggle('is-disabled', !hasForm);

    if (c.stage === 'partial' || c.pixar_sent_at) {
      el.pixarStatusTag.textContent = 'Sent ✓';
      el.pixarStatusTag.className = 'status-tag done';
    } else if (!hasForm) {
      el.pixarStatusTag.textContent = 'No URL';
      el.pixarStatusTag.className = 'status-tag warn';
    } else {
      el.pixarStatusTag.textContent = 'Ready';
      el.pixarStatusTag.className = 'status-tag';
    }

    const renderedPixar = buildPixarPitch(c);
    el.pixarCharCount.textContent = formatWordCharCount(renderedPixar);
    el.pixarPreviewBox.textContent = renderedPixar;

    // Email Card
    const hasEmail = Boolean(c.email && c.email.trim());
    el.leadEmailDisplay.textContent = hasEmail ? c.email : 'No email on file (tap Edit)';
    el.btnSendEmail.href = hasEmail ? buildEmailHref(c) : '#';
    el.btnSendEmail.classList.toggle('is-disabled', !hasEmail);
    if (settings.emailProvider === 'mailto') {
      el.btnSendEmail.removeAttribute('target');
    } else {
      el.btnSendEmail.setAttribute('target', '_blank');
    }

    if (c.stage === 'completed' || c.email_sent_at) {
      el.emailStatusTag.textContent = 'Sent ✓';
      el.emailStatusTag.className = 'status-tag done';
    } else if (!hasEmail) {
      el.emailStatusTag.textContent = 'No Email';
      el.emailStatusTag.className = 'status-tag warn';
    } else {
      el.emailStatusTag.textContent = 'Ready';
      el.emailStatusTag.className = 'status-tag';
    }

    el.emailSubjectPreview.textContent = interpolate(settings.emailSubject, c);
    el.emailPreviewBox.textContent = interpolate(settings.emailBody, c);
    el.leadNotes.value = c.notes || '';
  }

  // --- 8. OUTREACH LAUNCH & DISPOSITIONS ---
  async function launchPixarPitch() {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (!c || !c.contact_form_url) return;

    const pitch = buildPixarPitch(c);
    let url = c.contact_form_url.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    // Start clipboard copy and open tab synchronously inside user gesture for iOS Safari compatibility
    const copyPromise = copyText(pitch, 'Pixar Pitch');
    window.open(url, '_blank', 'noopener,noreferrer');
    await copyPromise;

    c.pixar_sent_at = new Date().toISOString();
    if (settings.autoStagePixar && c.stage === 'leads') {
      c.stage = 'partial';
      await dbAPI.put(c);
      applyFilters();
      showToast('✓ Pitch copied & moved to Partial');
    } else {
      await dbAPI.put(c);
      renderActiveCockpit();
    }
  }

  async function handleEmailLaunch(e) {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (!c || !c.email) {
      e.preventDefault();
      return;
    }

    c.email_sent_at = new Date().toISOString();
    if (settings.autoStageEmail) {
      c.stage = 'completed';
      await dbAPI.put(c);
      setTimeout(() => {
        applyFilters();
        showToast('✓ Email opened & marked Done');
      }, 150);
    } else {
      await dbAPI.put(c);
      renderActiveCockpit();
    }
  }

  async function setDisposition(type) {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (!c) return false;

    const currentFilteredIdx = state.filtered.findIndex(x => x.id === c.id);

    if (type === 'partial') {
      c.stage = 'partial';
      c.pixar_sent_at = c.pixar_sent_at || new Date().toISOString();
      await dbAPI.put(c);
      showToast('Moved to Partial (Pixar Sent)');
    } else if (type === 'completed') {
      c.stage = 'completed';
      c.email_sent_at = c.email_sent_at || new Date().toISOString();
      await dbAPI.put(c);
      showToast('Marked Done (Email Sent)');
    } else if (type === 'no_answer') {
      c.attempts = (c.attempts || 0) + 1;
      c.stage = 'leads';
      await dbAPI.put(c);
      showToast(`Attempt #${c.attempts} logged — kept in Leads`);
    } else if (type === 'delete') {
      if (!confirm(`Remove "${c.company || c.name}" permanently?`)) return false;
      await dbAPI.delete(c.id);
      state.contacts = state.contacts.filter(x => x.id !== c.id);
      state.activeId = null;
      showToast('Lead removed');
    }

    applyFilters();

    if (state.filtered.length > 0) {
      const nextIdx = Math.min(Math.max(currentFilteredIdx, 0), state.filtered.length - 1);
      if (type === 'no_answer' && state.filtered.length > 1) {
        const nextLead = state.filtered[(currentFilteredIdx + 1) % state.filtered.length];
        selectLead(nextLead.id, false);
      } else if (!state.filtered.some(x => x.id === state.activeId)) {
        selectLead(state.filtered[nextIdx].id, false);
      }
    } else if (window.innerWidth <= 820) {
      el.paneCockpit.classList.remove('mobile-visible');
    }

    return true;
  }

  // --- 9. NOTES AUTO-SAVE & MOBILE KEYBOARD HANDLING ---
  el.leadNotes.addEventListener('input', () => {
    clearTimeout(state.notesTimer);
    state.notesTimer = setTimeout(async () => {
      const c = state.contacts.find(x => x.id === state.activeId);
      if (!c) return;
      c.notes = el.leadNotes.value;
      await dbAPI.put(c);
      el.notesSaveIndicator.classList.add('visible');
      setTimeout(() => el.notesSaveIndicator.classList.remove('visible'), 1200);
    }, 350);
  });

  el.cockpitContent.addEventListener('focusin', (e) => {
    if (window.innerWidth <= 820 && ['TEXTAREA', 'INPUT'].includes(e.target.tagName)) {
      el.paneCockpit.classList.add('keyboard-open');
      setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 220);
    }
  });

  el.cockpitContent.addEventListener('focusout', () => {
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || !el.cockpitContent.contains(active) || !['TEXTAREA', 'INPUT'].includes(active.tagName)) {
        el.paneCockpit.classList.remove('keyboard-open');
      }
    }, 120);
  });

  // --- 10. CSV IMPORT & EXPORT ---
  function parseCSV(text) {
    const cleanText = text.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [''];
    let inQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const ch = cleanText[i];
      const next = cleanText[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push('');
      } else if ((ch === '\r' || ch === '\n') && !inQuotes) {
        if (ch === '\r' && next === '\n') i++;
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [''];
      } else {
        row[row.length - 1] += ch;
      }
    }
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  }

  function cleanField(val) {
    return (val || '')
      .replace(/[\uE000-\uF8FF]/g, '')
      .replace(/\s*\r?\n\s*/g, ' ')
      .trim();
  }

  document.getElementById('csvFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      e.target.value = '';
      return alert('CSV file is empty or missing headers.');
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const col = (aliases) => headers.findIndex(h => aliases.includes(h));

    const idx = {
      name: col(['name', 'contact', 'contact_name', 'full name']),
      phone: col(['phone', 'mobile', 'tel', 'telephone']),
      email: col(['email', 'e-mail', 'mail']),
      country: col(['country']),
      city: col(['city', 'town']),
      address: col(['street_address', 'address', 'street']),
      postal: col(['postal_code', 'zip', 'postcode']),
      company: col(['company', 'business', 'organization', 'venue']),
      title: col(['job_title', 'title', 'role']),
      formUrl: col(['contact_form_url', 'contact_url', 'website', 'url', 'form_url']),
      notes: col(['notes', 'comments', 'memo']),
      stage: col(['stage', 'status'])
    };

    let imported = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (k) => (idx[k] !== -1 ? cleanField(r[idx[k]]) : '');

      const company = get('company');
      const name = get('name');
      const phone = get('phone');
      const email = get('email');

      if (!company && !name && !phone && !email) continue;

      const contact = {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        company,
        name,
        phone,
        email,
        country: get('country'),
        city: get('city'),
        street_address: get('address'),
        postal_code: get('postal'),
        job_title: get('title'),
        contact_form_url: get('formUrl'),
        notes: get('notes'),
        stage: normalizeStage(get('stage')),
        attempts: 0,
        callback_at: null
      };

      await dbAPI.put(contact);
      state.contacts.push(contact);
      imported++;
    }

    e.target.value = '';
    applyFilters();
    showToast(`✓ Imported ${imported} prospects`);
  });

  function exportCsvLeads() {
    if (state.contacts.length === 0) return showToast('No leads to export');
    const cols = [
      'name', 'phone', 'email', 'country', 'city', 'street_address',
      'postal_code', 'company', 'job_title', 'contact_form_url',
      'notes', 'stage', 'attempts', 'callback_at'
    ];
    const lines = [cols.join(',')];
    state.contacts.forEach(c => {
      lines.push(cols.map(k => `"${String(c[k] ?? '').replace(/"/g, '""')}"`).join(','));
    });

    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flipdialler_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  document.getElementById('btnExportCsv').onclick = exportCsvLeads;

  // --- 11. ADD / EDIT LEAD MODAL ---
  function openLeadModal(contact = null) {
    document.getElementById('formTitle').textContent = contact ? 'Edit Prospect' : 'Add New Prospect';
    document.getElementById('formId').value = contact ? contact.id : '';
    document.getElementById('formCompany').value = contact ? (contact.company || '') : '';
    document.getElementById('formName').value = contact ? (contact.name || '') : '';
    document.getElementById('formTitleField').value = contact ? (contact.job_title || '') : '';
    document.getElementById('formPhone').value = contact ? (contact.phone || '') : '';
    document.getElementById('formEmail').value = contact ? (contact.email || '') : '';
    document.getElementById('formContactUrl').value = contact ? (contact.contact_form_url || '') : '';
    document.getElementById('formAddress').value = contact ? (contact.street_address || '') : '';
    document.getElementById('formCity').value = contact ? (contact.city || '') : '';
    document.getElementById('formLeadNotes').value = contact ? (contact.notes || '') : '';
    el.btnDeleteFromModal.classList.toggle('hidden', !contact);
    el.dialogForm.showModal();
  }

  el.leadForm.onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('formId').value;
    let c = state.contacts.find(x => x.id === id);

    if (!c) {
      c = {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        stage: 'leads',
        attempts: 0,
        callback_at: null,
        country: '',
        postal_code: ''
      };
      state.contacts.unshift(c);
    }

    c.company = document.getElementById('formCompany').value.trim();
    c.name = document.getElementById('formName').value.trim();
    c.job_title = document.getElementById('formTitleField').value.trim();
    c.phone = document.getElementById('formPhone').value.trim();
    c.email = document.getElementById('formEmail').value.trim();
    c.contact_form_url = document.getElementById('formContactUrl').value.trim();
    c.street_address = document.getElementById('formAddress').value.trim();
    c.city = document.getElementById('formCity').value.trim();
    c.notes = document.getElementById('formLeadNotes').value.trim();

    await dbAPI.put(c);
    el.dialogForm.close();
    applyFilters();
    selectLead(c.id);
    showToast('✓ Prospect saved');
  };

  el.btnDeleteFromModal.onclick = async () => {
    const id = document.getElementById('formId').value;
    if (!id) return;
    state.activeId = id;
    const deleted = await setDisposition('delete');
    if (deleted) el.dialogForm.close();
  };

  document.getElementById('btnNewLead').onclick = () => openLeadModal();
  document.getElementById('btnEmptyNewLead').onclick = () => openLeadModal();
  document.getElementById('btnEditLead').onclick = () => {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (c) openLeadModal(c);
  };
  document.getElementById('btnCancelForm').onclick = () => el.dialogForm.close();
  document.getElementById('btnCloseLeadX').onclick = () => el.dialogForm.close();

  // --- 12. CALLBACK SCHEDULER ---
  document.getElementById('btnDispCB').onclick = () => {
    document.getElementById('inputCustomCallback').value = '';
    el.dialogCallback.showModal();
  };
  document.getElementById('btnCancelCallback').onclick = () => el.dialogCallback.close();

  async function scheduleCallback(hours, isoCustom = null) {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (!c) return;
    const date = isoCustom ? new Date(isoCustom) : new Date(Date.now() + hours * 3600000);
    c.stage = 'leads';
    c.callback_at = date.toISOString();
    await dbAPI.put(c);
    el.dialogCallback.close();
    applyFilters();
    showToast('✓ Call Back scheduled — kept in Leads');
  }

  document.querySelectorAll('[data-cb-hours]').forEach(btn => {
    btn.onclick = () => scheduleCallback(parseInt(btn.dataset.cbHours, 10));
  });

  document.getElementById('btnConfirmCustomCallback').onclick = () => {
    const val = document.getElementById('inputCustomCallback').value;
    if (!val) return alert('Please select a date and time.');
    scheduleCallback(0, val);
  };

  // --- 13. SETTINGS MODAL & BOOKMARKLET ---
  const settingInputs = {
    senderName: document.getElementById('setSenderName'),
    senderCompany: document.getElementById('setSenderCompany'),
    senderEmail: document.getElementById('setSenderEmail'),
    senderPhone: document.getElementById('setSenderPhone'),
    senderTitle: document.getElementById('setSenderTitle'),
    formSubject: document.getElementById('setFormSubject'),
    pixar1: document.getElementById('setPixar1'),
    pixar2: document.getElementById('setPixar2'),
    pixar3: document.getElementById('setPixar3'),
    pixar4: document.getElementById('setPixar4'),
    pixar5: document.getElementById('setPixar5'),
    pixar6: document.getElementById('setPixar6'),
    pixarExtra: document.getElementById('setPixarExtra'),
    emailProvider: document.getElementById('setEmailProvider'),
    emailSubject: document.getElementById('setEmailSubject'),
    emailBody: document.getElementById('setEmailBody'),
    autoStagePixar: document.getElementById('setAutoStagePixar'),
    autoStageEmail: document.getElementById('setAutoStageEmail')
  };

  function collectDraftSettings() {
    return {
      senderName: settingInputs.senderName.value,
      senderCompany: settingInputs.senderCompany.value,
      senderEmail: settingInputs.senderEmail.value,
      senderPhone: settingInputs.senderPhone.value,
      senderTitle: settingInputs.senderTitle.value,
      formSubject: settingInputs.formSubject.value,
      pixar1: settingInputs.pixar1.value,
      pixar2: settingInputs.pixar2.value,
      pixar3: settingInputs.pixar3.value,
      pixar4: settingInputs.pixar4.value,
      pixar5: settingInputs.pixar5.value,
      pixar6: settingInputs.pixar6.value,
      pixarExtra: settingInputs.pixarExtra.value,
      emailProvider: settingInputs.emailProvider.value,
      emailSubject: settingInputs.emailSubject.value,
      emailBody: settingInputs.emailBody.value,
      autoStagePixar: settingInputs.autoStagePixar.checked,
      autoStageEmail: settingInputs.autoStageEmail.checked
    };
  }

  function buildBookmarkletHref(draft) {
    const activeLead = state.contacts.find(x => x.id === state.activeId);
    const subj = interpolate(draft.formSubject, activeLead, draft);
    const payload = JSON.stringify({
      name: draft.senderName || '',
      email: draft.senderEmail || '',
      phone: draft.senderPhone || '',
      company: draft.senderCompany || '',
      subject: subj || ''
    });

    const code = `(async()=>{const d=${payload};let msg='';try{msg=await navigator.clipboard.readText()}catch(e){}if(!msg){msg=prompt('Paste your Pixar Pitch if not auto-read from clipboard:')||''}const set=(el,v)=>{if(!v||el.value)return;const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const desc=Object.getOwnPropertyDescriptor(proto,'value');if(desc&&desc.set)desc.set.call(el,v);else el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};document.querySelectorAll('input,textarea').forEach(el=>{if(el.type==='hidden'||el.disabled)return;const lbl=(el.labels&&el.labels[0]?el.labels[0].innerText:'');const sig=((el.name||'')+' '+(el.id||'')+' '+(el.placeholder||'')+' '+(el.getAttribute('aria-label')||'')+' '+lbl).toLowerCase();if(el.tagName==='TEXTAREA'||/message|comment|inquiry|details|note|pitch/.test(sig))set(el,msg);else if(el.type==='email'||/email|e-mail/.test(sig))set(el,d.email);else if(el.type==='tel'||/phone|tel|mobile/.test(sig))set(el,d.phone);else if(/company|org|business|venue/.test(sig))set(el,d.company);else if(/subject|topic/.test(sig))set(el,d.subject);else if(/first/.test(sig))set(el,d.name.split(' ')[0]);else if(/last/.test(sig))set(el,d.name.split(' ').slice(1).join(' '));else if(/name/.test(sig))set(el,d.name);});})();`;
    return 'javascript:' + encodeURIComponent(code);
  }

  function refreshSettingsPreviews() {
    const draft = collectDraftSettings();
    const previewContact = state.contacts.find(x => x.id === state.activeId);
    const pixarRendered = buildPixarPitch(previewContact, draft);
    document.getElementById('settingsPixarPreview').textContent = pixarRendered;
    document.getElementById('settingsPixarCount').textContent = formatWordCharCount(pixarRendered);
    document.getElementById('settingsEmailSubjPreview').textContent = interpolate(draft.emailSubject, previewContact, draft);
    document.getElementById('settingsEmailBodyPreview').textContent = interpolate(draft.emailBody, previewContact, draft);
    document.getElementById('bookmarkletLink').href = buildBookmarkletHref(draft);
  }

  function populateSettingsModal(source = settings) {
    Object.keys(settingInputs).forEach(key => {
      const node = settingInputs[key];
      if (node.type === 'checkbox') node.checked = Boolean(source[key]);
      else node.value = source[key] ?? '';
    });
    refreshSettingsPreviews();
  }

  document.getElementById('btnOpenSettings').onclick = () => {
    populateSettingsModal(settings);
    el.dialogSettings.showModal();
  };

  document.getElementById('btnCancelSettings').onclick = () => el.dialogSettings.close();
  document.getElementById('btnCloseSettingsX').onclick = () => el.dialogSettings.close();

  document.getElementById('btnSaveSettings').onclick = () => {
    saveSettingsToStorage(collectDraftSettings());
    el.dialogSettings.close();
    renderActiveCockpit();
    showToast('✓ Settings saved');
  };

  document.getElementById('btnResetTemplates').onclick = () => {
    if (!confirm('Reset Pixar Pitch, Email templates, and Sender fields to defaults?')) return;
    populateSettingsModal(DEFAULT_SETTINGS);
    showToast('Templates reset (tap Save to apply)');
  };

  document.getElementById('btnClearAllLeads').onclick = async () => {
    if (!confirm('Delete ALL stored leads from this browser? This cannot be undone.')) return;
    await dbAPI.clear();
    state.contacts = [];
    state.activeId = null;
    applyFilters();
    el.dialogSettings.close();
    el.paneCockpit.classList.remove('mobile-visible');
    showToast('All leads cleared');
  };

  document.getElementById('btnCopyBookmarklet').onclick = () => {
    copyText(document.getElementById('bookmarkletLink').href, 'Bookmarklet script');
  };

  Object.values(settingInputs).forEach(node => {
    node.addEventListener('input', refreshSettingsPreviews);
    node.addEventListener('change', refreshSettingsPreviews);
  });

  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`stab-${tab.dataset.stab}`).classList.add('active');
    };
  });

  document.querySelectorAll('.var-chip').forEach(chip => {
    chip.onclick = () => copyText(chip.dataset.var, chip.dataset.var);
  });

  // --- 14. NAVIGATION, POPOVERS, GESTURES & ACTION LISTENERS ---
  el.list.addEventListener('click', (e) => {
    if (e.target.closest('#btnListEmptyAdd')) {
      openLeadModal();
      return;
    }
    if (e.target.closest('#btnEmptyClearSearch')) {
      state.search = '';
      el.inputSearch.value = '';
      applyFilters();
      return;
    }
    const card = e.target.closest('.contact-card');
    if (card) selectLead(card.dataset.id, true);
  });

  // Mobile Header More/CSV Menu
  function setMobileMoreOpen(open) {
    el.mobileHeaderMenu.classList.toggle('hidden', !open);
    el.btnMobileMore.setAttribute('aria-expanded', String(open));
  }

  el.btnMobileMore.onclick = (e) => {
    e.stopPropagation();
    const isClosed = el.mobileHeaderMenu.classList.contains('hidden');
    setMobileMoreOpen(isClosed);
  };

  document.getElementById('btnMenuImportCsv').onclick = () => {
    setMobileMoreOpen(false);
    document.getElementById('csvFileInput').click();
  };

  document.getElementById('btnMenuExportCsv').onclick = () => {
    setMobileMoreOpen(false);
    exportCsvLeads();
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.mobile-more-wrap')) {
      setMobileMoreOpen(false);
    }
  });

  // Preview Toggles
  el.btnTogglePixarPreview.onclick = () => {
    const isHidden = el.pixarPreviewDrawer.classList.toggle('hidden');
    el.btnTogglePixarPreview.setAttribute('aria-expanded', String(!isHidden));
    el.btnTogglePixarPreview.textContent = isHidden ? '👁 Preview' : 'Hide';
  };

  el.btnToggleEmailPreview.onclick = () => {
    const isHidden = el.emailPreviewDrawer.classList.toggle('hidden');
    el.btnToggleEmailPreview.setAttribute('aria-expanded', String(!isHidden));
    el.btnToggleEmailPreview.textContent = isHidden ? '👁 Preview' : 'Hide';
  };

  el.btnBackToList.onclick = () => el.paneCockpit.classList.remove('mobile-visible');
  el.btnPrevLead.onclick = () => stepLead(-1);
  el.btnNextLead.onclick = () => stepLead(1);

  // iOS-style left-edge swipe back gesture on mobile cockpit
  let touchStartX = 0;
  let touchStartY = 0;
  el.paneCockpit.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: true });

  el.paneCockpit.addEventListener('touchend', (e) => {
    if (window.innerWidth > 820) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = Math.abs(t.clientY - touchStartY);
    if (touchStartX <= 36 && dx > 72 && dy < 48) {
      el.paneCockpit.classList.remove('mobile-visible');
    }
  }, { passive: true });

  // Tap backdrop outside dialog sheet to dismiss
  [el.dialogForm, el.dialogCallback, el.dialogSettings].forEach(dlg => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) dlg.close();
    });
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.stageFilter = btn.dataset.stage;
      applyFilters();
    };
  });

  el.inputSearch.addEventListener('input', (e) => {
    state.search = e.target.value;
    applyFilters();
  });

  el.btnClearSearch.onclick = () => {
    state.search = '';
    el.inputSearch.value = '';
    applyFilters();
    el.inputSearch.focus();
  };

  el.btnSendPixar.onclick = launchPixarPitch;
  el.btnSendEmail.addEventListener('click', handleEmailLaunch);

  document.getElementById('btnCopyPhone').onclick = () => {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (c && c.phone) copyText(c.phone, 'Phone number');
    else showToast('No phone number on file');
  };

  document.querySelectorAll('.btn-copy-pill').forEach(btn => {
    btn.onclick = () => {
      const c = state.contacts.find(x => x.id === state.activeId);
      if (!c) return;
      const mode = btn.dataset.copy;
      if (mode === 'pitch') return copyText(buildPixarPitch(c), 'Pixar Pitch');
      if (mode === 'senderName') return copyText(settings.senderName, 'Your Name', 'Set your name in Settings ⚙️');
      if (mode === 'senderEmail') return copyText(settings.senderEmail, 'Your Email', 'Add your email in Settings ⚙️');
      if (mode === 'senderPhone') return copyText(settings.senderPhone, 'Your Phone', 'Add your phone in Settings ⚙️');
      if (mode === 'formSubject') return copyText(interpolate(settings.formSubject, c), 'Form Subject');
      if (mode === 'leadEmail') return copyText(c.email, 'Recipient Email', 'No recipient email on file');
      if (mode === 'emailSubject') return copyText(interpolate(settings.emailSubject, c), 'Email Subject');
      if (mode === 'emailBody') return copyText(interpolate(settings.emailBody, c), 'Email Body');
      if (mode === 'demoUrl') return copyText(extractDemoUrl(), 'Demo Link');
    };
  });

  document.getElementById('btnDispPartial').onclick = () => setDisposition('partial');
  document.getElementById('btnDispComplete').onclick = () => setDisposition('completed');
  document.getElementById('btnDispNA').onclick = () => setDisposition('no_answer');
  document.getElementById('btnDispDelete').onclick = () => setDisposition('delete');
  document.getElementById('btnMobileDeleteLead').onclick = () => setDisposition('delete');

  // --- 15. KEYBOARD SHORTCUTS ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMobileMoreOpen(false);
    if (el.dialogForm.open || el.dialogCallback.open || el.dialogSettings.open) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.key === '/') {
      e.preventDefault();
      el.inputSearch.focus();
    } else if (e.key === ',') {
      e.preventDefault();
      populateSettingsModal(settings);
      el.dialogSettings.showModal();
    } else if (e.key === 'j' || e.key === 'ArrowDown') {
      stepLead(1);
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      stepLead(-1);
    } else if (e.key === 'c' || e.key === 'C') {
      const c = state.contacts.find(x => x.id === state.activeId);
      if (c && c.phone) window.location.href = `tel:${c.phone.replace(/[^\d+]/g, '')}`;
    } else if (e.key === 'p' || e.key === 'P') {
      setDisposition('partial');
    } else if (e.key === 'e' || e.key === 'E') {
      setDisposition('completed');
    } else if (e.key === 'n' || e.key === 'N') {
      setDisposition('no_answer');
    }
  });

  // --- 16. BOOTSTRAP ---
  initDB().then(async () => {
    state.contacts = await dbAPI.getAll();
    applyFilters();
  });
})();