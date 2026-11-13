/**
 * FLIPDIALLER — LIVING PAPER 3.7 (STAGE PIPELINE + ONBOARDED PROFILES)
 * Pipeline stages:
 *  - 'prospects' : Brand new / un-dispositioned leads (every lead starts here)
 *  - 'followup'  : No Answer or Call Back (moves out of Prospects once dispositioned)
 *  - 'partial'   : Pixar Pitch sent via website contact form
 *  - 'completed' : Prospecting Email sent
 *  - 'onboarded' : Onboarded client -> Full Business Profile, Website Logo & Employee Cards
 */

(() => {
  'use strict';

  // --- 1. DEFAULT SETTINGS & EMPIRE DEV STUDIO PITCHES ---
  const SETTINGS_KEY = 'FlipDiallerSettings_v5';
  const LEGACY_SETTINGS_KEY = 'FlipDiallerSettings_v4';
  const DEFAULT_DEMO_URL = 'https://empiredevstudio.github.io/Demo-Home/';

  const DEFAULT_SETTINGS = {
    senderName: 'Christian J.',
    senderCompany: 'Empire Dev Studio',
    senderEmail: 'EmpireDevStudio@gmail.com',
    senderPhone: '',
    senderTitle: 'Founder',
    formSubject: 'Staff Training | A Pixar Pitch',

    pixarIntro:
      'Hi, I\'m {{senderFirstName}}, founder of {{senderCompany}}. Thank you for your time and attention today. To be completely transparent, what\'s below is a "Pixar Pitch" it\'s designed to be short, fun, and engaging, and I hope it\'s a unique addition to your day:',

    pixar1:
      'Once upon a time, running a standout hospitality venue like {{company}} meant hoping your cocktail specs, SOPs, and training standards held up on every shift, even in the middle of a packed rush.',
    pixar2:
      'Every day, managers lost hours updating binders nobody reads, while new hires took too long to ramp up and pours drifted whenever service got busy.',
    pixar3:
      'One day, managers started turning their cocktail specs, SOPs, and training videos into one simple, pocket-ready web app right on their team\'s phones.',
    pixar4:
      'Because of that, new hires ramped up faster, pours stayed consistent during a rush, and managers stopped losing hours chasing paperwork.',
    pixar5:
      'Because of that, training stopped feeling like a chore—and started showing up in smoother service, sharper staff, and better guest experiences.',
    pixar6:
      'Until finally, instead of specs sitting in a back-office binder, venues had something their team actually wanted to open.',
    pixarExtra:
`Instead of sending a pitch deck, I put together a 60-second interactive demo so you can feel how it works firsthand.

Would you be open to me sending the demo link over and sharing a bit more info on how this could work for {{company}}?`,

    emailProvider: 'gmail',
    emailSubject: 'Christian John | The pocket training demo we spoke about',
    emailBody:
`Hi,

It was really great speaking with you earlier.

I'm {{senderFirstName}}, founder of {{senderCompany}}. We help hospitality venues turn their cocktail specs, SOPs, and training videos into a simple, pocket-ready web app, so new hires ramp up faster, pours stay consistent during a rush, and managers stop losing hours updating binders nobody reads.

Instead of sending a pitch deck, I put together an interactive demo so you can feel how it works in 60 seconds:
https://empiredevstudio.github.io/Demo-Home/

(One small catch: only tap the spinning record once you've finished exploring. The record will take you to a optional reply email that is just a fun way to engage further and "break the ice".)

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
      const savedRaw = localStorage.getItem(SETTINGS_KEY);
      if (savedRaw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(savedRaw) };
      }

      const legacyRaw = localStorage.getItem(LEGACY_SETTINGS_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw);
        const migrated = { ...DEFAULT_SETTINGS };
        [
          'senderName', 'senderCompany', 'senderEmail', 'senderPhone',
          'senderTitle', 'emailProvider', 'autoStagePixar', 'autoStageEmail'
        ].forEach((k) => {
          if (legacy[k] !== undefined) migrated[k] = legacy[k];
        });
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(migrated));
        return migrated;
      }

      return { ...DEFAULT_SETTINGS };
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

  function normalizeStage(stage, raw = {}) {
    const s = String(stage || '').toLowerCase().trim();
    if (s === 'partial' || s === 'pixar_sent') return 'partial';
    if (s === 'completed' || s === 'contacted' || s === 'emailed') return 'completed';
    if (s === 'onboarded' || s === 'client') return 'onboarded';
    if (s === 'followup' || s === 'follow-up' || s === 'callback' || s === 'no_answer') return 'followup';
    if (s === 'leads') {
      if ((raw.attempts && raw.attempts > 0) || raw.callback_at) return 'followup';
      return 'prospects';
    }
    return 'prospects';
  }

  function createEmployeeRecord(roleType = 'employee', seed = {}) {
    return {
      id: seed.id || ('emp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
      roleType: roleType === 'primary' || roleType === 'secondary' ? roleType : 'employee',
      name: seed.name || '',
      title: seed.title || '',
      phone: seed.phone || '',
      email: seed.email || '',
      dob: seed.dob || '',
      preferred_contact: seed.preferred_contact || '',
      availability: seed.availability || '',
      notes: seed.notes || ''
    };
  }

  function ensureDefaultEmployees(contact) {
    const list = Array.isArray(contact.employees)
      ? contact.employees.map(e => createEmployeeRecord(e.roleType, e))
      : [];

    let primary = list.find(e => e.roleType === 'primary');
    if (!primary) {
      primary = createEmployeeRecord('primary', {
        name: contact.name || '',
        title: contact.job_title || '',
        phone: contact.phone || '',
        email: contact.email || ''
      });
      list.unshift(primary);
    }

    let secondary = list.find(e => e.roleType === 'secondary');
    if (!secondary) {
      secondary = createEmployeeRecord('secondary');
      const pIdx = list.indexOf(primary);
      list.splice(pIdx + 1, 0, secondary);
    }

    const others = list.filter(e => e !== primary && e !== secondary);
    contact.employees = [primary, secondary, ...others];
    return contact.employees;
  }

  function normalizeWebsiteFromUrl(url) {
    if (!url || !url.trim()) return '';
    try {
      const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      return new URL(normalized).origin;
    } catch {
      return '';
    }
  }

  function normalizeContact(c) {
    const stage = normalizeStage(c.stage, c);
    const contact = {
      ...c,
      stage,
      job_title: c.job_title || c.title || '',
      website: c.website || '',
      contact_form_url: c.contact_form_url || '',
      app_url: c.app_url || '',
      custom_logo_url: c.custom_logo_url || '',
      business_type: c.business_type || '',
      account_status: c.account_status || 'active',
      onboarded_at: c.onboarded_at || '',
      street_address: c.street_address || '',
      city: c.city || '',
      country: c.country || '',
      postal_code: c.postal_code || '',
      attempts: c.attempts || 0,
      callback_at: c.callback_at || null,
      employees: Array.isArray(c.employees) ? c.employees : null
    };

    if (contact.stage === 'onboarded') {
      if (!contact.onboarded_at) contact.onboarded_at = new Date().toISOString().slice(0, 10);
      if (!contact.website && contact.contact_form_url) {
        contact.website = normalizeWebsiteFromUrl(contact.contact_form_url);
      }
      ensureDefaultEmployees(contact);
    }

    return contact;
  }

  // --- 3. STATE ---
  const state = {
    contacts: [],
    filtered: [],
    activeId: null,
    activeOnboardedId: null,
    stageFilter: 'prospects',
    search: '',
    onboardedSearch: '',
    notesTimer: null,
    profileSaveTimer: null,
    toastTimer: null
  };

  // --- 4. DOM REFERENCES ---
  const el = {
    workbench: document.getElementById('workbench'),
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

    countProspects: document.getElementById('countProspects'),
    countFollowup: document.getElementById('countFollowup'),
    countPartial: document.getElementById('countPartial'),
    countCompleted: document.getElementById('countCompleted'),
    countOnboarded: document.getElementById('countOnboarded'),
    countAll: document.getElementById('countAll'),

    onboardedCockpitBanner: document.getElementById('onboardedCockpitBanner'),
    btnJumpToBusinessProfile: document.getElementById('btnJumpToBusinessProfile'),

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

    // Onboarded Workspace
    paneOnboarded: document.getElementById('paneOnboarded'),
    onboardedDirectory: document.getElementById('onboardedDirectory'),
    inputOnboardedSearch: document.getElementById('inputOnboardedSearch'),
    btnClearOnboardedSearch: document.getElementById('btnClearOnboardedSearch'),
    onboardedDirCount: document.getElementById('onboardedDirCount'),
    btnNewOnboarded: document.getElementById('btnNewOnboarded'),
    onboardedGrid: document.getElementById('onboardedGrid'),

    onboardedProfileView: document.getElementById('onboardedProfileView'),
    btnBackToOnboardedDir: document.getElementById('btnBackToOnboardedDir'),
    onboardedNavTitle: document.getElementById('onboardedNavTitle'),
    onboardedSaveIndicator: document.getElementById('onboardedSaveIndicator'),
    onboardedStageSelect: document.getElementById('onboardedStageSelect'),
    btnPrevOnboarded: document.getElementById('btnPrevOnboarded'),
    btnNextOnboarded: document.getElementById('btnNextOnboarded'),
    btnDeleteOnboarded: document.getElementById('btnDeleteOnboarded'),
    profileScroll: document.getElementById('profileScroll'),

    profLogoImg: document.getElementById('profLogoImg'),
    profLogoFallback: document.getElementById('profLogoFallback'),
    profLogoUploadInput: document.getElementById('profLogoUploadInput'),
    btnEditLogoUrl: document.getElementById('btnEditLogoUrl'),
    btnRefreshLogo: document.getElementById('btnRefreshLogo'),

    profCompany: document.getElementById('profCompany'),
    profOnboardedDate: document.getElementById('profOnboardedDate'),
    profBusinessType: document.getElementById('profBusinessType'),
    profAccountStatus: document.getElementById('profAccountStatus'),
    profWebsite: document.getElementById('profWebsite'),
    btnOpenProfWebsite: document.getElementById('btnOpenProfWebsite'),
    profAppUrl: document.getElementById('profAppUrl'),
    btnOpenProfAppUrl: document.getElementById('btnOpenProfAppUrl'),
    profEmail: document.getElementById('profEmail'),
    btnEmailProf: document.getElementById('btnEmailProf'),
    profPhone: document.getElementById('profPhone'),
    btnCallProf: document.getElementById('btnCallProf'),
    profFormUrl: document.getElementById('profFormUrl'),
    btnOpenProfFormUrl: document.getElementById('btnOpenProfFormUrl'),
    profAddress: document.getElementById('profAddress'),
    profCity: document.getElementById('profCity'),
    profPostal: document.getElementById('profPostal'),
    profCountry: document.getElementById('profCountry'),
    profNotes: document.getElementById('profNotes'),

    employeeCountBadge: document.getElementById('employeeCountBadge'),
    btnAddEmployee: document.getElementById('btnAddEmployee'),
    employeeCardsList: document.getElementById('employeeCardsList'),

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
      activeSettings.pixarIntro,
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

  function renderLinkedText(element, text) {
    const content = String(text || '');
    const urlPattern = /https?:\/\/[^\s<>"']+/gi;
    let lastIndex = 0;
    let match;

    element.replaceChildren();

    while ((match = urlPattern.exec(content)) !== null) {
      const visibleUrl = match[0].replace(/[.,!?;:]+$/, '');
      let parsedUrl;
      try {
        parsedUrl = new URL(visibleUrl);
      } catch {
        continue;
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') continue;

      element.append(document.createTextNode(content.slice(lastIndex, match.index)));
      const link = document.createElement('a');
      link.href = parsedUrl.href;
      link.textContent = visibleUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      element.append(link);
      lastIndex = match.index + visibleUrl.length;
    }

    element.append(document.createTextNode(content.slice(lastIndex)));
  }

  // --- 6. UTILITIES & WEBSITE LOGO RESOLVER ---
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

  function formatDisplayDate(isoDate) {
    if (!isoDate) return '—';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDobPill(dobStr) {
    if (!dobStr) return '';
    const parts = dobStr.split('-');
    if (parts.length !== 3) return '';
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const day = Number(parts[2]);
    if (!y || !m || !day) return '';
    const now = new Date();
    let age = now.getFullYear() - y;
    const mDiff = (now.getMonth() + 1) - m;
    if (mDiff < 0 || (mDiff === 0 && now.getDate() < day)) age--;
    const monthShort = new Date(y, m - 1, day).toLocaleString([], { month: 'short' });
    return age >= 0 && age < 120 ? `🎂 ${monthShort} ${day} (${age})` : `🎂 ${monthShort} ${day}`;
  }

  function getMonogram(name) {
    const clean = (name || '').trim();
    if (!clean) return 'BZ';
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }

  const GENERIC_EMAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com',
    'hotmail.com', 'live.com', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com'
  ]);

  function getDomainFromContact(c) {
    const candidates = [c.website, c.contact_form_url];
    for (const raw of candidates) {
      if (!raw || !raw.trim()) continue;
      try {
        const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
        if (u.hostname && u.hostname.includes('.')) {
          return u.hostname.replace(/^www\./i, '');
        }
      } catch {}
    }

    if (c.email && c.email.includes('@')) {
      const domain = c.email.split('@')[1].trim().toLowerCase();
      if (domain && domain.includes('.') && !GENERIC_EMAIL_DOMAINS.has(domain)) {
        return domain;
      }
    }
    return '';
  }

  function getLogoCandidates(c) {
    const list = [];
    if (c.custom_logo_url && c.custom_logo_url.trim()) {
      list.push(c.custom_logo_url.trim());
    }
    const domain = getDomainFromContact(c);
    if (domain) {
      list.push(`https://logo.clearbit.com/${encodeURIComponent(domain)}`);
      list.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    }
    return list;
  }

  function applyLogoToElement(imgEl, fallbackEl, contact) {
    fallbackEl.textContent = getMonogram(contact.company || contact.name);
    const candidates = getLogoCandidates(contact);

    if (candidates.length === 0) {
      imgEl.classList.add('hidden');
      imgEl.removeAttribute('src');
      fallbackEl.classList.remove('hidden');
      return;
    }

    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) {
        imgEl.classList.add('hidden');
        fallbackEl.classList.remove('hidden');
        return;
      }
      const src = candidates[idx++];
      imgEl.classList.remove('hidden');
      fallbackEl.classList.add('hidden');
      imgEl.src = src;
    };

    imgEl.onerror = () => tryNext();
    imgEl.onload = () => {
      if (imgEl.naturalWidth <= 1 || imgEl.naturalHeight <= 1) {
        tryNext();
      } else {
        imgEl.classList.remove('hidden');
        fallbackEl.classList.add('hidden');
      }
    };
    tryNext();
  }

  function sanitizeHref(url) {
    if (!url || !url.trim()) return '#';
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  // --- 7. RENDERING & FILTERING ---
  function updateCounts() {
    el.countProspects.textContent = state.contacts.filter(c => c.stage === 'prospects').length;
    el.countFollowup.textContent = state.contacts.filter(c => c.stage === 'followup').length;
    el.countPartial.textContent = state.contacts.filter(c => c.stage === 'partial').length;
    el.countCompleted.textContent = state.contacts.filter(c => c.stage === 'completed').length;
    el.countOnboarded.textContent = state.contacts.filter(c => c.stage === 'onboarded').length;
    el.countAll.textContent = state.contacts.length;
  }

  function syncStageTabButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.stage === state.stageFilter);
    });
  }

  function applyFilters() {
    updateCounts();
    syncStageTabButtons();

    const isOnboardedMode = state.stageFilter === 'onboarded';
    el.workbench.classList.toggle('is-onboarded-mode', isOnboardedMode);
    el.paneOnboarded.classList.toggle('hidden', !isOnboardedMode);

    if (isOnboardedMode) {
      el.paneCockpit.classList.remove('mobile-visible');
      renderOnboardedWorkspace();
      return;
    }

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

    renderList();

    if (state.activeId && !state.contacts.some(c => c.id === state.activeId)) {
      state.activeId = null;
    }
    if (!state.activeId && state.filtered.length > 0 && window.innerWidth > 820) {
      state.activeId = state.filtered[0].id;
    }
    if (state.activeId && !state.filtered.some(c => c.id === state.activeId)) {
      state.activeId = state.filtered.length > 0 && window.innerWidth > 820 ? state.filtered[0].id : null;
    }

    renderActiveCockpit();
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

    const stageLabels = {
      prospects: 'Prospect',
      followup: 'Follow-Up',
      partial: 'Partial',
      completed: 'Emailed',
      onboarded: 'Onboarded'
    };

    el.list.innerHTML = state.filtered.map(c => {
      const title = c.company || c.name || 'Unnamed Prospect';
      const subParts = [c.company && c.name ? c.name : c.job_title, c.city].filter(Boolean);
      const tags = [];
      if (c.contact_form_url) tags.push('<span class="mini-tag">Form</span>');
      if (c.email) tags.push('<span class="mini-tag">Email</span>');
      if (c.attempts) tags.push(`<span class="mini-tag">Att:${c.attempts}</span>`);
      if (c.callback_at && c.stage === 'followup') {
        tags.push(`<span class="mini-tag mini-tag-cb">CB</span>`);
      }

      return `
        <div class="contact-card ${c.id === state.activeId ? 'active' : ''}" data-id="${esc(c.id)}" role="listitem">
          <div class="card-main">
            <div class="card-top">
              <div class="card-title">${esc(title)}</div>
              <span class="card-stage-dot dot-${c.stage}">${stageLabels[c.stage] || 'Prospect'}</span>
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

    el.onboardedCockpitBanner.classList.toggle('hidden', c.stage !== 'onboarded');

    const stageMap = {
      prospects: { text: 'Prospect Queue', cls: '' },
      followup: { text: 'Follow-Up Queue', cls: 'is-followup' },
      partial: { text: 'Partial • Pixar Sent', cls: 'is-partial' },
      completed: { text: 'Emailed • Outreach Sent', cls: 'is-completed' },
      onboarded: { text: 'Onboarded Client', cls: 'is-onboarded' }
    };
    const st = stageMap[c.stage] || stageMap.prospects;
    el.leadStageBadge.textContent = st.text;
    el.leadStageBadge.className = `stage-pill ${st.cls}`;

    if (c.attempts > 0) {
      el.leadAttemptsBadge.textContent = `${c.attempts} ${c.attempts === 1 ? 'attempt' : 'attempts'}`;
      el.leadAttemptsBadge.classList.remove('hidden');
    } else {
      el.leadAttemptsBadge.classList.add('hidden');
    }

    if (c.callback_at && c.stage === 'followup') {
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
    renderLinkedText(el.emailPreviewBox, interpolate(settings.emailBody, c));
    el.leadNotes.value = c.notes || '';
  }

  // --- 8. ONBOARDED DIRECTORY & FULL BUSINESS PROFILE ---
  function getOnboardedList() {
    const q = state.onboardedSearch.toLowerCase().trim();
    const list = state.contacts.filter(c => c.stage === 'onboarded');
    if (!q) return list;
    return list.filter(c => {
      const empMatch = (c.employees || []).some(emp =>
        (emp.name && emp.name.toLowerCase().includes(q)) ||
        (emp.email && emp.email.toLowerCase().includes(q)) ||
        (emp.phone && emp.phone.toLowerCase().includes(q)) ||
        (emp.title && emp.title.toLowerCase().includes(q))
      );
      return empMatch ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.city && c.city.toLowerCase().includes(q)) ||
        (c.website && c.website.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q));
    });
  }

  function renderOnboardedWorkspace() {
    const activeProfile = state.activeOnboardedId
      ? state.contacts.find(c => c.id === state.activeOnboardedId && c.stage === 'onboarded')
      : null;

    if (!activeProfile) {
      state.activeOnboardedId = null;
      el.onboardedDirectory.classList.remove('hidden');
      el.onboardedProfileView.classList.add('hidden');
      renderOnboardedDirectory();
    } else {
      el.onboardedDirectory.classList.add('hidden');
      el.onboardedProfileView.classList.remove('hidden');
      renderOnboardedProfile(activeProfile);
    }
  }

  function renderOnboardedDirectory() {
    const allOnboarded = state.contacts.filter(c => c.stage === 'onboarded');
    const filtered = getOnboardedList();
    el.onboardedDirCount.textContent = allOnboarded.length;
    el.btnClearOnboardedSearch.classList.toggle('hidden', !state.onboardedSearch);

    if (allOnboarded.length === 0) {
      el.onboardedGrid.innerHTML = `
        <div class="paper-card onboarded-empty">
          <div class="empty-monogram">🏆</div>
          <h3>No Onboarded Businesses Yet</h3>
          <p>When a prospect converts, click <strong>Onboard</strong> in the dialer cockpit—or create a new client profile directly to track their logo, business info, and team contacts.</p>
          <button id="btnEmptyAddOnboarded" class="btn btn-emerald" type="button">＋ Create First Business Profile</button>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      el.onboardedGrid.innerHTML = `
        <div class="paper-card onboarded-empty">
          <h3>No Matching Businesses</h3>
          <p>Try clearing your search filter to view all ${allOnboarded.length} onboarded accounts.</p>
          <button id="btnClearOnboardedEmpty" class="btn btn-vellum" type="button">Clear Search</button>
        </div>
      `;
      return;
    }

    const statusMap = {
      active: '🟢 Active',
      onboarding: '🟡 Onboarding',
      vip: '⭐ VIP',
      paused: '⏸ Paused'
    };

    el.onboardedGrid.innerHTML = filtered.map(c => {
      ensureDefaultEmployees(c);
      const primary = c.employees.find(e => e.roleType === 'primary');
      const filledTeam = c.employees.filter(e => e.name || e.phone || e.email).length;
      const domain = getDomainFromContact(c);
      const websiteLabel = c.website ? c.website.replace(/^https?:\/\/(www\.)?/i, '') : (domain || 'No website yet');
      const locationStr = [c.city, c.country].filter(Boolean).join(', ');

      return `
        <article class="paper-card profile-card" data-onboarded-id="${esc(c.id)}" tabindex="0" role="button">
          <div class="profile-card-head">
            <div class="profile-card-logo">
              <img class="card-logo-img hidden" data-logo-for="${esc(c.id)}" alt="${esc(c.company)} logo">
              <span class="logo-monogram-sm" data-fallback-for="${esc(c.id)}">${esc(getMonogram(c.company || c.name))}</span>
            </div>
            <div class="profile-card-title-wrap">
              <h3>${esc(c.company || c.name || 'Unnamed Business')}</h3>
              <div class="profile-card-badges">
                <span class="onboarded-date-pill">Onboarded ${esc(formatDisplayDate(c.onboarded_at))}</span>
                <span class="status-mini-pill">${statusMap[c.account_status] || '🟢 Active'}</span>
                ${c.business_type ? `<span class="status-mini-pill">${esc(c.business_type)}</span>` : ''}
              </div>
            </div>
          </div>

          <div class="profile-card-details">
            <div class="profile-detail-line"><span>🌐</span><span>${esc(websiteLabel)}</span></div>
            <div class="profile-detail-line"><span>📞</span><span>${esc(c.phone || 'No business phone')}</span></div>
            <div class="profile-detail-line"><span>✉️</span><span>${esc(c.email || 'No business email')}</span></div>
            ${locationStr ? `<div class="profile-detail-line"><span>📍</span><span>${esc(locationStr)}</span></div>` : ''}
          </div>

          <div class="profile-card-footer">
            <span class="profile-primary-chip">
              👤 ${primary && primary.name ? esc(primary.name) : 'Primary contact pending'} • 👥 ${filledTeam}/${c.employees.length}
            </span>
            <span class="profile-open-cta">Open Profile ›</span>
          </div>
        </article>
      `;
    }).join('');

    filtered.forEach(c => {
      const img = el.onboardedGrid.querySelector(`[data-logo-for="${CSS.escape(c.id)}"]`);
      const fb = el.onboardedGrid.querySelector(`[data-fallback-for="${CSS.escape(c.id)}"]`);
      if (img && fb) applyLogoToElement(img, fb, c);
    });
  }

  function renderOnboardedProfile(c) {
    ensureDefaultEmployees(c);

    const list = getOnboardedList();
    const idx = list.findIndex(x => x.id === c.id);
    el.btnPrevOnboarded.disabled = idx <= 0;
    el.btnNextOnboarded.disabled = idx === -1 || idx >= list.length - 1;

    el.onboardedNavTitle.textContent = c.company || 'Business Profile';
    el.onboardedStageSelect.value = c.stage;

    applyLogoToElement(el.profLogoImg, el.profLogoFallback, c);

    el.profCompany.value = c.company || '';
    el.profOnboardedDate.value = c.onboarded_at || '';
    el.profBusinessType.value = c.business_type || '';
    el.profAccountStatus.value = c.account_status || 'active';

    el.profWebsite.value = c.website || '';
    el.profAppUrl.value = c.app_url || '';
    el.profEmail.value = c.email || '';
    el.profPhone.value = c.phone || '';
    el.profFormUrl.value = c.contact_form_url || '';
    el.profAddress.value = c.street_address || '';
    el.profCity.value = c.city || '';
    el.profPostal.value = c.postal_code || '';
    el.profCountry.value = c.country || '';
    el.profNotes.value = c.notes || '';

    syncProfileActionLinks(c);
    renderEmployeeCards(c);
  }

  function syncProfileActionLinks(c) {
    const webHref = c.website && c.website.trim() ? sanitizeHref(c.website) : '#';
    el.btnOpenProfWebsite.href = webHref;
    el.btnOpenProfWebsite.classList.toggle('is-disabled', webHref === '#');

    const appHref = c.app_url && c.app_url.trim() ? sanitizeHref(c.app_url) : '#';
    el.btnOpenProfAppUrl.href = appHref;
    el.btnOpenProfAppUrl.classList.toggle('is-disabled', appHref === '#');

    const formHref = c.contact_form_url && c.contact_form_url.trim() ? sanitizeHref(c.contact_form_url) : '#';
    el.btnOpenProfFormUrl.href = formHref;
    el.btnOpenProfFormUrl.classList.toggle('is-disabled', formHref === '#');

    const emailHref = c.email && c.email.trim() ? `mailto:${c.email.trim()}` : '#';
    el.btnEmailProf.href = emailHref;
    el.btnEmailProf.classList.toggle('is-disabled', emailHref === '#');

    const cleanPhone = (c.phone || '').replace(/[^\d+]/g, '');
    el.btnCallProf.href = cleanPhone ? `tel:${cleanPhone}` : '#';
    el.btnCallProf.classList.toggle('is-disabled', !cleanPhone);
  }

  function renderEmployeeCards(c) {
    ensureDefaultEmployees(c);
    el.employeeCountBadge.textContent = c.employees.length;

    const roleMeta = {
      primary: { label: 'Primary Contact', cls: 'role-primary', cardCls: 'is-primary' },
      secondary: { label: 'Secondary Contact', cls: 'role-secondary', cardCls: 'is-secondary' },
      employee: { label: 'Employee', cls: 'role-employee', cardCls: 'is-employee' }
    };

    el.employeeCardsList.innerHTML = c.employees.map((emp, index) => {
      const rm = roleMeta[emp.roleType] || roleMeta.employee;
      const summaryText = [emp.name, emp.title].filter(Boolean).join(' — ');
      const cleanTel = (emp.phone || '').replace(/[^\d+]/g, '');
      const dobText = formatDobPill(emp.dob);

      return `
        <div class="paper-card employee-card ${rm.cardCls}" data-emp-card="${esc(emp.id)}">
          <div class="employee-card-head">
            <div class="employee-role-left">
              <span class="role-pill ${rm.cls}">${rm.label}</span>
              <span class="employee-header-summary ${summaryText ? '' : 'is-empty'}" data-emp-summary="${esc(emp.id)}">
                ${summaryText ? esc(summaryText) : `Awaiting ${rm.label.toLowerCase()} details...`}
              </span>
            </div>

            <div class="employee-quick-actions">
              <span class="dob-pill ${dobText ? '' : 'hidden'}" data-emp-dob-pill="${esc(emp.id)}">${esc(dobText)}</span>
              <a class="btn-chip ${cleanTel ? '' : 'is-disabled'}" data-emp-call="${esc(emp.id)}" href="${cleanTel ? `tel:${cleanTel}` : '#'}">📞 Call</a>
              <a class="btn-chip ${emp.email ? '' : 'is-disabled'}" data-emp-mail="${esc(emp.id)}" href="${emp.email ? `mailto:${emp.email}` : '#'}">✉️ Email</a>
              ${emp.roleType === 'employee'
                ? `<button type="button" class="btn-chip btn-chip-danger" data-remove-emp="${esc(emp.id)}" title="Remove Employee #${index + 1}">🗑️</button>`
                : ''
              }
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" data-emp-id="${esc(emp.id)}" data-emp-field="name" value="${esc(emp.name)}" placeholder="e.g. Jordan Taylor">
            </div>
            <div class="form-group">
              <label>Role / Job Title</label>
              <input type="text" data-emp-id="${esc(emp.id)}" data-emp-field="title" value="${esc(emp.title)}" placeholder="e.g. General Manager, Head Bartender">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Best Contact Number</label>
              <input type="tel" data-emp-id="${esc(emp.id)}" data-emp-field="phone" value="${esc(emp.phone)}" placeholder="+1 (555) 000-0000">
            </div>
            <div class="form-group">
              <label>Email Address</label>
              <input type="email" data-emp-id="${esc(emp.id)}" data-emp-field="email" value="${esc(emp.email)}" placeholder="name@venue.com">
            </div>
          </div>

          <div class="form-row form-row-3">
            <div class="form-group">
              <label>Date of Birth (DOB)</label>
              <input type="date" data-emp-id="${esc(emp.id)}" data-emp-field="dob" value="${esc(emp.dob)}">
            </div>
            <div class="form-group">
              <label>Preferred Contact Method</label>
              <select data-emp-id="${esc(emp.id)}" data-emp-field="preferred_contact">
                <option value="" ${!emp.preferred_contact ? 'selected' : ''}>Select preference...</option>
                <option value="phone" ${emp.preferred_contact === 'phone' ? 'selected' : ''}>📞 Phone Call</option>
                <option value="sms" ${emp.preferred_contact === 'sms' ? 'selected' : ''}>💬 SMS / Text</option>
                <option value="whatsapp" ${emp.preferred_contact === 'whatsapp' ? 'selected' : ''}>💚 WhatsApp</option>
                <option value="email" ${emp.preferred_contact === 'email' ? 'selected' : ''}>✉️ Email</option>
              </select>
            </div>
            <div class="form-group">
              <label>Shift / Best Time to Reach</label>
              <input type="text" data-emp-id="${esc(emp.id)}" data-emp-field="availability" value="${esc(emp.availability)}" placeholder="e.g. Tue–Sat 1–4 PM">
            </div>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label>Employee Notes</label>
            <textarea rows="2" data-emp-id="${esc(emp.id)}" data-emp-field="notes" placeholder="Preferences, training responsibilities, personal rapport notes...">${esc(emp.notes)}</textarea>
          </div>
        </div>
      `;
    }).join('');
  }

  function scheduleProfileSave(c) {
    el.onboardedSaveIndicator.textContent = 'Saving...';
    el.onboardedSaveIndicator.classList.remove('just-saved');
    clearTimeout(state.profileSaveTimer);
    state.profileSaveTimer = setTimeout(async () => {
      await dbAPI.put(c);
      updateCounts();
      el.onboardedSaveIndicator.textContent = 'Saved ✓';
      el.onboardedSaveIndicator.classList.add('just-saved');
      setTimeout(() => el.onboardedSaveIndicator.classList.remove('just-saved'), 1000);
    }, 280);
  }

  function openOnboardedProfileById(id) {
    const c = state.contacts.find(x => x.id === id);
    if (!c) return;
    if (c.stage !== 'onboarded') {
      c.stage = 'onboarded';
      c.onboarded_at = c.onboarded_at || new Date().toISOString().slice(0, 10);
      if (!c.website && c.contact_form_url) c.website = normalizeWebsiteFromUrl(c.contact_form_url);
      ensureDefaultEmployees(c);
      dbAPI.put(c);
    }
    state.stageFilter = 'onboarded';
    state.activeOnboardedId = id;
    applyFilters();
    el.profileScroll.scrollTop = 0;
  }

  function createNewOnboardedBusiness() {
    const name = prompt('Enter the Business / Venue Name:');
    if (!name || !name.trim()) return;
    const c = normalizeContact({
      id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      company: name.trim(),
      stage: 'onboarded',
      onboarded_at: new Date().toISOString().slice(0, 10),
      account_status: 'active',
      attempts: 0,
      callback_at: null
    });
    state.contacts.unshift(c);
    dbAPI.put(c).then(() => {
      state.stageFilter = 'onboarded';
      state.activeOnboardedId = c.id;
      applyFilters();
      showToast('✓ Onboarded business profile created');
    });
  }

  // --- 9. OUTREACH LAUNCH & DISPOSITIONS ---
  async function launchPixarPitch() {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (!c || !c.contact_form_url) return;

    const pitch = buildPixarPitch(c);
    let url = c.contact_form_url.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    const copyPromise = copyText(pitch, 'Pixar Pitch');
    window.open(url, '_blank', 'noopener,noreferrer');
    await copyPromise;

    c.pixar_sent_at = new Date().toISOString();
    if (settings.autoStagePixar && (c.stage === 'prospects' || c.stage === 'followup')) {
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
    if (settings.autoStageEmail && c.stage !== 'onboarded') {
      c.stage = 'completed';
      await dbAPI.put(c);
      setTimeout(() => {
        applyFilters();
        showToast('✓ Email opened & moved to Emailed');
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
      showToast('Moved to Emailed');
    } else if (type === 'no_answer') {
      c.attempts = (c.attempts || 0) + 1;
      c.last_attempt_at = new Date().toISOString();
      c.stage = 'followup';
      await dbAPI.put(c);
      showToast(`Attempt #${c.attempts} logged — moved to Follow-Up`);
    } else if (type === 'onboarded') {
      c.stage = 'onboarded';
      c.onboarded_at = c.onboarded_at || new Date().toISOString().slice(0, 10);
      if (!c.website && c.contact_form_url) c.website = normalizeWebsiteFromUrl(c.contact_form_url);
      ensureDefaultEmployees(c);
      await dbAPI.put(c);
      showToast('🏆 Moved to Onboarded! Business Profile ready');
    } else if (type === 'delete') {
      if (!confirm(`Remove "${c.company || c.name}" permanently?`)) return false;
      await dbAPI.delete(c.id);
      state.contacts = state.contacts.filter(x => x.id !== c.id);
      if (state.activeOnboardedId === c.id) state.activeOnboardedId = null;
      state.activeId = null;
      showToast('Lead removed');
    }

    applyFilters();

    if (state.filtered.length > 0) {
      const nextIdx = Math.min(Math.max(currentFilteredIdx, 0), state.filtered.length - 1);
      if (!state.filtered.some(x => x.id === state.activeId)) {
        selectLead(state.filtered[nextIdx].id, false);
      }
    } else if (window.innerWidth <= 820) {
      el.paneCockpit.classList.remove('mobile-visible');
    }

    return true;
  }

  // --- 10. NOTES AUTO-SAVE & MOBILE KEYBOARD HANDLING ---
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

  // --- 11. ONBOARDED PROFILE EVENT BINDINGS ---
  el.inputOnboardedSearch.addEventListener('input', (e) => {
    state.onboardedSearch = e.target.value;
    renderOnboardedDirectory();
  });

  el.btnClearOnboardedSearch.onclick = () => {
    state.onboardedSearch = '';
    el.inputOnboardedSearch.value = '';
    renderOnboardedDirectory();
    el.inputOnboardedSearch.focus();
  };

  el.btnNewOnboarded.onclick = createNewOnboardedBusiness;

  el.onboardedGrid.addEventListener('click', (e) => {
    if (e.target.closest('#btnEmptyAddOnboarded')) {
      createNewOnboardedBusiness();
      return;
    }
    if (e.target.closest('#btnClearOnboardedEmpty')) {
      state.onboardedSearch = '';
      el.inputOnboardedSearch.value = '';
      renderOnboardedDirectory();
      return;
    }
    const card = e.target.closest('.profile-card');
    if (card) openOnboardedProfileById(card.dataset.onboardedId);
  });

  el.onboardedGrid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.profile-card');
      if (card) {
        e.preventDefault();
        openOnboardedProfileById(card.dataset.onboardedId);
      }
    }
  });

  el.btnBackToOnboardedDir.onclick = () => {
    state.activeOnboardedId = null;
    renderOnboardedWorkspace();
  };

  el.btnPrevOnboarded.onclick = () => {
    const list = getOnboardedList();
    const idx = list.findIndex(x => x.id === state.activeOnboardedId);
    if (idx > 0) openOnboardedProfileById(list[idx - 1].id);
  };

  el.btnNextOnboarded.onclick = () => {
    const list = getOnboardedList();
    const idx = list.findIndex(x => x.id === state.activeOnboardedId);
    if (idx !== -1 && idx < list.length - 1) openOnboardedProfileById(list[idx + 1].id);
  };

  el.onboardedStageSelect.addEventListener('change', async (e) => {
    const c = state.contacts.find(x => x.id === state.activeOnboardedId);
    if (!c) return;
    c.stage = e.target.value;
    await dbAPI.put(c);
    if (c.stage !== 'onboarded') {
      state.activeOnboardedId = null;
      state.stageFilter = c.stage;
      state.activeId = c.id;
      applyFilters();
      showToast(`Moved to ${c.stage}`);
    }
  });

  el.btnDeleteOnboarded.onclick = async () => {
    const c = state.contacts.find(x => x.id === state.activeOnboardedId);
    if (!c) return;
    if (!confirm(`Delete "${c.company || c.name}" and all its employee records permanently?`)) return;
    await dbAPI.delete(c.id);
    state.contacts = state.contacts.filter(x => x.id !== c.id);
    state.activeOnboardedId = null;
    applyFilters();
    showToast('Business profile removed');
  };

  // Logo Upload / URL / Refresh
  el.profLogoUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    const c = state.contacts.find(x => x.id === state.activeOnboardedId);
    if (!file || !c) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const maxSide = 256;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        c.custom_logo_url = canvas.toDataURL('image/png');
        await dbAPI.put(c);
        applyLogoToElement(el.profLogoImg, el.profLogoFallback, c);
        showToast('✓ Custom logo saved');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  el.btnEditLogoUrl.onclick = async () => {
    const c = state.contacts.find(x => x.id === state.activeOnboardedId);
    if (!c) return;
    const current = c.custom_logo_url && !c.custom_logo_url.startsWith('data:') ? c.custom_logo_url : '';
    const next = prompt('Paste a direct image URL for the business logo (or leave blank to auto-fetch from website):', current);
    if (next === null) return;
    c.custom_logo_url = next.trim();
    await dbAPI.put(c);
    applyLogoToElement(el.profLogoImg, el.profLogoFallback, c);
    showToast(c.custom_logo_url ? '✓ Logo URL updated' : '✓ Using website logo');
  };

  el.btnRefreshLogo.onclick = async () => {
    const c = state.contacts.find(x => x.id === state.activeOnboardedId);
    if (!c) return;
    c.custom_logo_url = '';
    await dbAPI.put(c);
    applyLogoToElement(el.profLogoImg, el.profLogoFallback, c);
    showToast('↻ Refreshed logo from website');
  };

  // Auto-save Main Business Profile Inputs
  const profileBindings = [
    [el.profCompany, 'company'],
    [el.profOnboardedDate, 'onboarded_at'],
    [el.profBusinessType, 'business_type'],
    [el.profAccountStatus, 'account_status'],
    [el.profWebsite, 'website'],
    [el.profAppUrl, 'app_url'],
    [el.profEmail, 'email'],
    [el.profPhone, 'phone'],
    [el.profFormUrl, 'contact_form_url'],
    [el.profAddress, 'street_address'],
    [el.profCity, 'city'],
    [el.profPostal, 'postal_code'],
    [el.profCountry, 'country'],
    [el.profNotes, 'notes']
  ];

  let logoDebounceTimer = null;
  profileBindings.forEach(([inputEl, field]) => {
    const eventName = inputEl.tagName === 'SELECT' || inputEl.type === 'date' ? 'change' : 'input';
    inputEl.addEventListener(eventName, () => {
      const c = state.contacts.find(x => x.id === state.activeOnboardedId);
      if (!c) return;
      c[field] = inputEl.value;
      if (field === 'company') {
        el.onboardedNavTitle.textContent = c.company || 'Business Profile';
      }
      if (['website', 'app_url', 'contact_form_url', 'email', 'phone'].includes(field)) {
        syncProfileActionLinks(c);
      }
      if (field === 'website' || field === 'contact_form_url' || field === 'company') {
        clearTimeout(logoDebounceTimer);
        logoDebounceTimer = setTimeout(() => {
          applyLogoToElement(el.profLogoImg, el.profLogoFallback, c);
        }, 450);
      }
      scheduleProfileSave(c);
    });
  });

  // Add Employee Card
  el.btnAddEmployee.onclick = async () => {
    const c = state.contacts.find(x => x.id === state.activeOnboardedId);
    if (!c) return;
    ensureDefaultEmployees(c);
    const emp = createEmployeeRecord('employee');
    c.employees.push(emp);
    await dbAPI.put(c);
    renderEmployeeCards(c);
    const newCard = el.employeeCardsList.querySelector(`[data-emp-card="${CSS.escape(emp.id)}"]`);
    if (newCard) {
      newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = newCard.querySelector('input');
      if (firstInput) firstInput.focus();
    }
    showToast('✓ Employee card added');
  };

  // Delegate Employee Card Inputs & Deletes without losing focus
  el.employeeCardsList.addEventListener('input', handleEmployeeFieldEdit);
  el.employeeCardsList.addEventListener('change', handleEmployeeFieldEdit);

  function handleEmployeeFieldEdit(e) {
    const target = e.target;
    const empId = target.dataset.empId;
    const field = target.dataset.empField;
    if (!empId || !field) return;

    const c = state.contacts.find(x => x.id === state.activeOnboardedId);
    if (!c || !Array.isArray(c.employees)) return;
    const emp = c.employees.find(x => x.id === empId);
    if (!emp) return;

    emp[field] = target.value;

    if (emp.roleType === 'primary') {
      if (field === 'name') c.name = emp.name;
      if (field === 'title') c.job_title = emp.title;
    }

    if (field === 'name' || field === 'title') {
      const summaryEl = el.employeeCardsList.querySelector(`[data-emp-summary="${CSS.escape(empId)}"]`);
      if (summaryEl) {
        const text = [emp.name, emp.title].filter(Boolean).join(' — ');
        const roleTxt = emp.roleType === 'primary'
          ? 'primary contact'
          : (emp.roleType === 'secondary' ? 'secondary contact' : 'employee');
        summaryEl.textContent = text || `Awaiting ${roleTxt} details...`;
        summaryEl.classList.toggle('is-empty', !text);
      }
    }
    if (field === 'phone') {
      const callLink = el.employeeCardsList.querySelector(`[data-emp-call="${CSS.escape(empId)}"]`);
      if (callLink) {
        const cleanTel = (emp.phone || '').replace(/[^\d+]/g, '');
        callLink.href = cleanTel ? `tel:${cleanTel}` : '#';
        callLink.classList.toggle('is-disabled', !cleanTel);
      }
    }
    if (field === 'email') {
      const mailLink = el.employeeCardsList.querySelector(`[data-emp-mail="${CSS.escape(empId)}"]`);
      if (mailLink) {
        mailLink.href = emp.email ? `mailto:${emp.email}` : '#';
        mailLink.classList.toggle('is-disabled', !emp.email);
      }
    }
    if (field === 'dob') {
      const dobPill = el.employeeCardsList.querySelector(`[data-emp-dob-pill="${CSS.escape(empId)}"]`);
      if (dobPill) {
        const dobText = formatDobPill(emp.dob);
        dobPill.textContent = dobText;
        dobPill.classList.toggle('hidden', !dobText);
      }
    }

    scheduleProfileSave(c);
  }

  el.employeeCardsList.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('[data-remove-emp]');
    if (!removeBtn) return;
    const empId = removeBtn.dataset.removeEmp;
    const c = state.contacts.find(x => x.id === state.activeOnboardedId);
    if (!c || !Array.isArray(c.employees)) return;
    const emp = c.employees.find(x => x.id === empId);
    if (!emp || emp.roleType !== 'employee') return;
    if (!confirm(`Remove employee card "${emp.name || 'Unnamed Employee'}"?`)) return;
    c.employees = c.employees.filter(x => x.id !== empId);
    await dbAPI.put(c);
    renderEmployeeCards(c);
    showToast('Employee card removed');
  });

  // --- 12. CSV IMPORT & EXPORT ---
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
      website: col(['website', 'site', 'domain', 'homepage']),
      formUrl: col(['contact_form_url', 'contact_url', 'url', 'form_url']),
      notes: col(['notes', 'comments', 'memo']),
      stage: col(['stage', 'status']),
      onboardedAt: col(['onboarded_at', 'onboarded_date'])
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

      const rawStage = get('stage');
      const contact = normalizeContact({
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
        website: get('website'),
        contact_form_url: get('formUrl'),
        notes: get('notes'),
        stage: rawStage || 'prospects',
        onboarded_at: get('onboardedAt'),
        attempts: 0,
        callback_at: null
      });

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
      'postal_code', 'company', 'job_title', 'website', 'contact_form_url',
      'notes', 'stage', 'attempts', 'callback_at', 'onboarded_at', 'business_type', 'account_status'
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

  // --- 13. ADD / EDIT LEAD MODAL ---
  function openLeadModal(contact = null) {
    document.getElementById('formTitle').textContent = contact ? 'Edit Prospect' : 'Add New Prospect';
    document.getElementById('formId').value = contact ? contact.id : '';
    document.getElementById('formCompany').value = contact ? (contact.company || '') : '';
    document.getElementById('formStage').value = contact
      ? contact.stage
      : (state.stageFilter === 'onboarded' ? 'onboarded' : 'prospects');
    document.getElementById('formName').value = contact ? (contact.name || '') : '';
    document.getElementById('formTitleField').value = contact ? (contact.job_title || '') : '';
    document.getElementById('formPhone').value = contact ? (contact.phone || '') : '';
    document.getElementById('formEmail').value = contact ? (contact.email || '') : '';
    document.getElementById('formWebsite').value = contact ? (contact.website || '') : '';
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
      c = normalizeContact({
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        stage: 'prospects',
        attempts: 0,
        callback_at: null
      });
      state.contacts.unshift(c);
    }

    c.company = document.getElementById('formCompany').value.trim();
    c.stage = document.getElementById('formStage').value;
    c.name = document.getElementById('formName').value.trim();
    c.job_title = document.getElementById('formTitleField').value.trim();
    c.phone = document.getElementById('formPhone').value.trim();
    c.email = document.getElementById('formEmail').value.trim();
    c.website = document.getElementById('formWebsite').value.trim();
    c.contact_form_url = document.getElementById('formContactUrl').value.trim();
    c.street_address = document.getElementById('formAddress').value.trim();
    c.city = document.getElementById('formCity').value.trim();
    c.notes = document.getElementById('formLeadNotes').value.trim();

    if (c.stage === 'onboarded') {
      c.onboarded_at = c.onboarded_at || new Date().toISOString().slice(0, 10);
      if (!c.website && c.contact_form_url) c.website = normalizeWebsiteFromUrl(c.contact_form_url);
      ensureDefaultEmployees(c);
    }

    await dbAPI.put(c);
    el.dialogForm.close();

    if (c.stage === 'onboarded' && state.stageFilter === 'onboarded') {
      state.activeOnboardedId = c.id;
    }

    applyFilters();
    if (state.stageFilter !== 'onboarded') {
      selectLead(c.id);
    }
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

  // --- 14. CALLBACK SCHEDULER ---
  document.getElementById('btnDispCB').onclick = () => {
    document.getElementById('inputCustomCallback').value = '';
    el.dialogCallback.showModal();
  };
  document.getElementById('btnCancelCallback').onclick = () => el.dialogCallback.close();

  async function scheduleCallback(hours, isoCustom = null) {
    const c = state.contacts.find(x => x.id === state.activeId);
    if (!c) return;
    const date = isoCustom ? new Date(isoCustom) : new Date(Date.now() + hours * 3600000);
    c.stage = 'followup';
    c.callback_at = date.toISOString();
    await dbAPI.put(c);
    el.dialogCallback.close();
    applyFilters();
    showToast('✓ Call Back scheduled — moved to Follow-Up');
  }

  document.querySelectorAll('[data-cb-hours]').forEach(btn => {
    btn.onclick = () => scheduleCallback(parseInt(btn.dataset.cbHours, 10));
  });

  document.getElementById('btnConfirmCustomCallback').onclick = () => {
    const val = document.getElementById('inputCustomCallback').value;
    if (!val) return alert('Please select a date and time.');
    scheduleCallback(0, val);
  };

  // --- 15. SETTINGS MODAL & BOOKMARKLET ---
  const settingInputs = {
    senderName: document.getElementById('setSenderName'),
    senderCompany: document.getElementById('setSenderCompany'),
    senderEmail: document.getElementById('setSenderEmail'),
    senderPhone: document.getElementById('setSenderPhone'),
    senderTitle: document.getElementById('setSenderTitle'),
    formSubject: document.getElementById('setFormSubject'),
    pixarIntro: document.getElementById('setPixarIntro'),
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
      pixarIntro: settingInputs.pixarIntro.value,
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
    renderLinkedText(
      document.getElementById('settingsEmailBodyPreview'),
      interpolate(draft.emailBody, previewContact, draft)
    );
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
    state.activeOnboardedId = null;
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

  // --- 16. NAVIGATION, POPOVERS, GESTURES & ACTION LISTENERS ---
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

  el.btnJumpToBusinessProfile.onclick = () => {
    if (state.activeId) openOnboardedProfileById(state.activeId);
  };

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
      state.stageFilter = btn.dataset.stage;
      if (state.stageFilter === 'onboarded') {
        state.activeOnboardedId = null;
      }
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
  document.getElementById('btnDispOnboard').onclick = () => setDisposition('onboarded');
  document.getElementById('btnDispDelete').onclick = () => setDisposition('delete');
  document.getElementById('btnMobileDeleteLead').onclick = () => setDisposition('delete');

  // --- 17. KEYBOARD SHORTCUTS ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setMobileMoreOpen(false);
    if (el.dialogForm.open || el.dialogCallback.open || el.dialogSettings.open) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.key === '/') {
      e.preventDefault();
      if (state.stageFilter === 'onboarded' && !state.activeOnboardedId) {
        el.inputOnboardedSearch.focus();
      } else {
        el.inputSearch.focus();
      }
      return;
    }

    if (e.key === ',') {
      e.preventDefault();
      populateSettingsModal(settings);
      el.dialogSettings.showModal();
      return;
    }

    if (state.stageFilter === 'onboarded') return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
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
    } else if (e.key === 'o' || e.key === 'O') {
      setDisposition('onboarded');
    }
  });

  // --- 18. BOOTSTRAP ---
  initDB().then(async () => {
    state.contacts = await dbAPI.getAll();
    applyFilters();
  });
})();