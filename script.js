/**
 * LIVING PAPER 2.0 — DESKTOP WIDESCREEN & MOBILE COMMAND ENGINE
 * Supports Dual-Pane Split Cockpit, Keyboard Shortcuts, WebRTC Simulator,
 * Timezone Clocks, and 100% Backward Compatibility with existing CSV schemas.
 */

(() => {
  'use strict';

  // --- 1. LEGACY TEMPLATES & AST TOKENS ---
  const DEFAULT_TEMPLATES = {
    hospitality_demo: {
      id: 'hospitality_demo',
      type: 'email',
      title: 'Interactive Demonstration Follow-Up',
      subject: 'Interactive training demonstration | {company}',
      body: 'Hello [First Name],\n\nThank you again for your time today regarding {company}.\n\nAs discussed, I’ve included a direct link to test our interactive hospitality training tool on your mobile device:\n\n👉 https://tileworksgamesstudio.github.io/86/\n\nTileworks Studio develops puzzle-based activities that train teams on products and service standards without thick paper manuals.\n\nI’d love to hear what you think after you try a puzzle.\n\nWarm regards,\nChristian J.\nFounder, Tileworks Studio'
    },
    quick_sms: {
      id: 'quick_sms',
      type: 'sms',
      title: 'Quick SMS Follow-Up',
      subject: 'SMS',
      body: 'Hi [First Name]! Following up from Tileworks Studio regarding our training demo for {company}: https://tileworksgamesstudio.github.io/86/'
    }
  };

  const US_CA_AREA_CODES = {
    '201':'America/New_York','202':'America/New_York','203':'America/New_York','212':'America/New_York','215':'America/New_York',
    '216':'America/New_York','305':'America/New_York','312':'America/Chicago','314':'America/Chicago','330':'America/New_York',
    '404':'America/New_York','415':'America/Los_Angeles','416':'America/Toronto','503':'America/Los_Angeles','512':'America/Chicago',
    '602':'America/Phoenix','604':'America/Vancouver','617':'America/New_York','702':'America/Los_Angeles','713':'America/Chicago',
    '718':'America/New_York','818':'America/Los_Angeles','858':'America/Los_Angeles','917':'America/New_York'
  };

  // --- 2. FOUNTAIN PEN AUDIO ENGINE ---
  class LivingPaperAudioEngine {
    constructor() {
      this.ctx = null;
    }

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    play(effect = 'nib') {
      const mode = state.settings.sensoryMode || 'all';
      if (navigator.vibrate && (mode === 'all' || mode === 'vibrate')) {
        if (effect === 'nib') navigator.vibrate(8);
        else if (effect === 'turn') navigator.vibrate([10, 16, 12]);
        else if (effect === 'seal') navigator.vibrate([16, 35, 18]);
        else if (effect === 'alert') navigator.vibrate([30, 30, 30]);
      }

      if (mode === 'all' || mode === 'sound') {
        try {
          this.init();
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          const now = this.ctx.currentTime;

          if (effect === 'nib') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.02);
            gain.gain.setValueAtTime(0.04, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.02);
            osc.start(now);
            osc.stop(now + 0.02);
          } else if (effect === 'turn') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
          } else if (effect === 'seal') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.05);
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
          } else if (effect === 'alert') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.linearRampToValueAtTime(140, now + 0.1);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.linearRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
          }
        } catch (e) {}
      }
    }
  }

  const paperSound = new LivingPaperAudioEngine();

  // --- 3. HARDWARE-ACCELERATED INDEXEDDB ---
  const DB_NAME = 'LivingPaperDB_v2';
  const DB_VERSION = 1;
  let db = null;

  function initDatabase() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('contacts')) {
          const s = d.createObjectStore('contacts', { keyPath: 'id' });
          s.createIndex('stage', 'stage', { unique: false });
          s.createIndex('phone', 'phone', { unique: false });
          s.createIndex('next_callback_at', 'next_callback_at', { unique: false });
        }
        if (!d.objectStoreNames.contains('interactions')) {
          const i = d.createObjectStore('interactions', { keyPath: 'id', autoIncrement: true });
          i.createIndex('contact_id', 'contact_id', { unique: false });
          i.createIndex('action', 'action', { unique: false });
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  function getStore(name, mode = 'readonly') {
    return db.transaction(name, mode).objectStore(name);
  }

  // --- 4. REACTIVE STATE ---
  const state = {
    contacts: [],
    filteredContacts: [],
    currentContactIndex: -1,
    activeQueue: 'uncontacted',
    searchQuery: '',
    sortBy: 'name',
    activeScreenId: 'screenPipeline',
    emailTemplates: { ...DEFAULT_TEMPLATES },
    activeTemplateId: 'hospitality_demo',
    pendingCallbackContact: null,
    activeCallSession: null,
    callConsoleActive: false,
    callConsoleTimerInterval: null,
    callWaveformAnimId: null,
    ledgerFilterAction: 'all',
    ledgerSearchQuery: '',
    undoAction: null,
    powerDialTimer: null,
    powerDialCount: 3,
    islandExpanded: false,
    settings: {
      dailyTarget: 10,
      interfaceDensity: 'density-normal',
      sensoryMode: 'all',
      wakeLockEnabled: true,
      powerDialerEnabled: false,
      dupRule: 'skip',
      currentStreak: 0,
      lastStreakDate: null
    }
  };

  // --- 5. TIMEZONE RADAR & TOKEN PARSER ---
  function getContactTimezone(phoneStr) {
    if (!phoneStr) return { localTime: '', isCallable: true, tzAbbr: '' };
    const cleanDigits = phoneStr.replace(/\D/g, '');
    let area = '';

    if (cleanDigits.length === 10) area = cleanDigits.substring(0, 3);
    else if (cleanDigits.length === 11 && cleanDigits.startsWith('1')) area = cleanDigits.substring(1, 4);

    const tzId = US_CA_AREA_CODES[area];
    if (!tzId) return { localTime: '', isCallable: true, tzAbbr: '' };

    try {
      const now = new Date();
      const timeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: tzId, hour: 'numeric', minute: '2-digit', hour12: true
      }).format(now);

      const hour24 = parseInt(new Intl.DateTimeFormat('en-US', {
        timeZone: tzId, hour: 'numeric', hour12: false
      }).format(now), 10);

      const isCallable = hour24 >= 9 && hour24 < 17;
      const tzAbbr = tzId.includes('New_York') ? 'EST' : tzId.includes('Chicago') ? 'CST' : tzId.includes('Los_Angeles') ? 'PST' : 'LCL';
      return { localTime: timeStr, isCallable, tzAbbr };
    } catch (e) {
      return { localTime: '', isCallable: true, tzAbbr: '' };
    }
  }

  function resolveTokens(tmplStr, contact) {
    if (!tmplStr) return '';
    const firstName = contact.name ? contact.name.trim().split(' ')[0] : 'there';
    const fullName = contact.name ? contact.name.trim() : 'there';
    const comp = contact.company ? contact.company.trim() : 'your team';
    const phone = contact.phone ? contact.phone.trim() : '';
    const email = contact.email ? contact.email.trim() : '';
    const jobTitle = contact.job_title ? contact.job_title.trim() : '';
    const notes = contact.notes ? contact.notes.trim() : '';
    const greeting = new Date().getHours() < 12 ? 'Good morning' : 'Good afternoon';

    return tmplStr
      .replace(/\[first[\s_]?name\]/gi, firstName)
      .replace(/\[company\]/gi, comp)
      .replace(/\[name\]/gi, fullName)
      .replace(/\[greeting\]/gi, greeting)
      .replace(/\{first_name\|?([^}]*)\}/gi, (m, fb) => firstName || fb || 'there')
      .replace(/\{company\|?([^}]*)\}/gi, (m, fb) => comp || fb || 'your team')
      .replace(/\{first_name\}/gi, firstName)
      .replace(/\{company\}/gi, comp)
      .replace(/\{phone\}/gi, phone)
      .replace(/\{email\}/gi, email)
      .replace(/\{job_title\}/gi, jobTitle)
      .replace(/\{notes\}/gi, notes)
      .replace(/\{greeting\}/gi, greeting);
  }

  function cleanPhone(str) {
    if (!str) return '';
    const hasPlus = str.trim().startsWith('+');
    const digits = str.replace(/\D/g, '');
    return hasPlus ? `+${digits}` : digits;
  }

  function getInitials(cName, pName) {
    const val = (cName || pName || '?').trim();
    const parts = val.split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  // --- 6. PERSISTENCE & AUDIT LEDGER ---
  async function loadAllContacts() {
    return new Promise((res) => {
      getStore('contacts', 'readonly').getAll().onsuccess = (e) => {
        state.contacts = e.target.result || [];
        res(state.contacts);
      };
    });
  }

  async function saveContact(c) {
    return new Promise((res) => {
      getStore('contacts', 'readwrite').put(c).onsuccess = () => res(true);
    });
  }

  async function deleteContact(id) {
    return new Promise((res) => {
      getStore('contacts', 'readwrite').delete(id).onsuccess = () => {
        state.contacts = state.contacts.filter(c => c.id !== id);
        res(true);
      };
    });
  }

  async function logLedger(contactId, action, outcome, note = '', durationSec = 0) {
    const record = {
      contact_id: contactId,
      action,
      outcome,
      note,
      duration_sec: durationSec,
      timestamp: new Date().toISOString()
    };
    return new Promise((res) => {
      getStore('interactions', 'readwrite').add(record).onsuccess = () => res(record);
    });
  }

  async function getAllLedgerLogs() {
    return new Promise((res) => {
      getStore('interactions', 'readonly').getAll().onsuccess = (e) => {
        const logs = e.target.result || [];
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res(logs);
      };
    });
  }

  async function getLedgerLogsForContact(contactId) {
    return new Promise((res) => {
      const idx = getStore('interactions', 'readonly').index('contact_id');
      idx.getAll(contactId).onsuccess = (e) => {
        const logs = e.target.result || [];
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res(logs);
      };
    });
  }

  async function loadSettings() {
    return new Promise((res) => {
      getStore('settings', 'readonly').get('paper_config').onsuccess = (e) => {
        if (e.target.result && e.target.result.val) {
          state.settings = { ...state.settings, ...e.target.result.val.settings };
          if (e.target.result.val.templates) {
            state.emailTemplates = { ...DEFAULT_TEMPLATES, ...e.target.result.val.templates };
          }
        }
        applyInterfaceDensity(state.settings.interfaceDensity);
        res(true);
      };
    });
  }

  async function persistSettings() {
    return new Promise((res) => {
      getStore('settings', 'readwrite').put({
        key: 'paper_config',
        val: { settings: state.settings, templates: state.emailTemplates }
      }).onsuccess = () => res(true);
    });
  }

  function applyInterfaceDensity(density) {
    document.body.classList.remove('density-compact', 'density-normal', 'density-large');
    document.body.classList.add(density || 'density-normal');
  }

  // --- 7. DYNAMIC ISLAND & CLOCK ---
  let callTimerInterval = null;

  function updateIslandClock() {
    const clock = document.getElementById('islandCurrentTime');
    if (clock) {
      const d = new Date();
      clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  function beginCallTracking(contact) {
    state.activeCallSession = {
      contactId: contact.id,
      phone: contact.phone,
      startTime: Date.now()
    };
    const badge = document.getElementById('islandActiveCallBadge');
    const digits = document.getElementById('islandCallTimerDigits');
    badge.classList.remove('hidden');

    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
      if (!state.activeCallSession) return;
      const sec = Math.floor((Date.now() - state.activeCallSession.startTime) / 1000);
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      digits.textContent = `${m}:${s}`;
    }, 1000);
  }

  async function checkCallCompletion() {
    if (!state.activeCallSession) return;
    const elapsedSec = Math.round((Date.now() - state.activeCallSession.startTime) / 1000);
    const session = { ...state.activeCallSession };
    state.activeCallSession = null;

    if (callTimerInterval) clearInterval(callTimerInterval);
    document.getElementById('islandActiveCallBadge').classList.add('hidden');

    if (elapsedSec >= 2) {
      await logLedger(session.contactId, 'call', 'Voice Call Completed', `Duration: ${elapsedSec}s`, elapsedSec);
      refreshTelemetry();
      showPostCallTray(session.contactId);
    }
  }

  function showPostCallTray(contactId) {
    const tray = document.getElementById('postCallTray');
    tray.dataset.contactId = contactId;
    tray.classList.remove('hidden');
    paperSound.play('seal');
  }

  async function refreshTelemetry() {
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const logs = await getAllLedgerLogs();

    const todayCalls = logs.filter(l => l.action === 'call' && new Date(l.timestamp).toLocaleDateString('en-CA') === todayStr).length;
    const target = state.settings.dailyTarget || 10;
    document.getElementById('islandPaceDisplay').textContent = `${todayCalls}/${target}`;
    document.getElementById('expTodayCalls').textContent = todayCalls;

    if (todayCalls >= target && state.settings.lastStreakDate !== todayStr) {
      state.settings.currentStreak = (state.settings.currentStreak || 0) + 1;
      state.settings.lastStreakDate = todayStr;
      persistSettings();
    }
    document.getElementById('expStreakCounter').textContent = `${state.settings.currentStreak || 0}d`;

    const spokenCount = logs.filter(l => l.action === 'disposition' && l.outcome.toLowerCase().includes('spoken') && new Date(l.timestamp).toLocaleDateString('en-CA') === todayStr).length;
    const convRate = todayCalls > 0 ? Math.round((spokenCount / todayCalls) * 100) : 0;
    document.getElementById('expContactRate').textContent = `${convRate}%`;

    const dueCount = state.contacts.filter(c => c.stage === 'callback' && c.next_callback_at && new Date(c.next_callback_at) <= now).length;
    const duePill = document.getElementById('islandCallbackAlert');
    document.getElementById('expPendingCbCount').textContent = dueCount;

    if (dueCount > 0) {
      duePill.textContent = `${dueCount} Due`;
      duePill.classList.remove('hidden');
    } else {
      duePill.classList.add('hidden');
    }

    document.getElementById('countPillFresh').textContent = state.contacts.filter(c => c.stage === 'uncontacted').length;
    document.getElementById('countPillDue').textContent = state.contacts.filter(c => c.stage === 'callback').length;
    document.getElementById('countPillSpoken').textContent = state.contacts.filter(c => c.stage === 'contacted').length;
    document.getElementById('islandStageLabel').textContent = state.activeQueue.toUpperCase() + ' QUEUE';
  }

  // --- 8. DESKTOP WEBRTC CALL SIMULATOR & WAVEFORM ---
  function openDesktopCallConsole(contact) {
    state.callConsoleActive = true;
    const modal = document.getElementById('callConsoleOverlay');
    modal.classList.remove('hidden');

    document.getElementById('consoleAvatar').textContent = getInitials(contact.company, contact.name);
    document.getElementById('consoleTargetName').textContent = contact.company || contact.name || 'Direct Contact';
    document.getElementById('consoleTargetPerson').textContent = (contact.company && contact.name) ? `${contact.name} • ${contact.job_title || 'Lead'}` : (contact.job_title || 'Lead');
    document.getElementById('consoleTargetPhone').textContent = `📞 ${contact.phone || 'No direct phone'}`;

    const tz = getContactTimezone(contact.phone);
    document.getElementById('consoleTargetTz').textContent = tz.localTime ? `${tz.tzAbbr} (${tz.localTime}) • ${tz.isCallable ? '🟢 Standard Hours' : '🌙 Outside Normal Hours'}` : 'Timezone Unavailable';

    beginCallTracking(contact);

    // Live wave simulator
    const canvas = document.getElementById('consoleWaveformCanvas');
    const ctx = canvas.getContext('2d');
    const timerEl = document.getElementById('consoleLiveTimer');
    let startTime = Date.now();

    if (state.callConsoleTimerInterval) clearInterval(state.callConsoleTimerInterval);
    state.callConsoleTimerInterval = setInterval(() => {
      const s = Math.floor((Date.now() - startTime) / 1000);
      const min = String(Math.floor(s / 60)).padStart(2, '0');
      const sec = String(s % 60).padStart(2, '0');
      timerEl.textContent = `${min}:${sec}`;
    }, 1000);

    let step = 0;
    function drawWave() {
      if (!state.callConsoleActive) return;
      step += 0.08;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#D4B062';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 4) {
        const y = (canvas.height / 2) + Math.sin(x * 0.05 + step) * 12 * Math.cos(step * 0.5);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      state.callWaveformAnimId = requestAnimationFrame(drawWave);
    }
    drawWave();
  }

  function closeDesktopCallConsole() {
    state.callConsoleActive = false;
    if (state.callWaveformAnimId) cancelAnimationFrame(state.callWaveformAnimId);
    if (state.callConsoleTimerInterval) clearInterval(state.callConsoleTimerInterval);
    document.getElementById('callConsoleOverlay').classList.add('hidden');
    checkCallCompletion();
  }

  // --- 9. UNDO TOAST BUFFER ---
  let undoTimer = null;
  function triggerUndo(msg, revertCallback) {
    if (undoTimer) clearTimeout(undoTimer);
    state.undoAction = revertCallback;

    const toast = document.getElementById('paperUndoToast');
    const bar = document.getElementById('toastBarProgress');
    document.getElementById('toastMessage').textContent = msg;

    toast.classList.remove('hidden');
    bar.style.transition = 'none';
    bar.style.width = '100%';

    setTimeout(() => {
      bar.style.transition = 'width 5000ms linear';
      bar.style.width = '0%';
    }, 20);

    undoTimer = setTimeout(() => {
      toast.classList.add('hidden');
      state.undoAction = null;
    }, 5000);
  }

  function executeUndo() {
    if (state.undoAction) {
      paperSound.play('seal');
      state.undoAction();
      state.undoAction = null;
      if (undoTimer) clearTimeout(undoTimer);
      document.getElementById('paperUndoToast').classList.add('hidden');
    }
  }

  // --- 10. CONTINUOUS POWER ADVANCE DIALER ---
  function startPowerDialCycle() {
    if (!state.settings.powerDialerEnabled || state.filteredContacts.length === 0) return;

    let nextIdx = state.currentContactIndex + 1;
    if (nextIdx >= state.filteredContacts.length) nextIdx = 0;
    const lead = state.filteredContacts[nextIdx];
    if (!lead) return;

    state.powerDialCount = 3;
    const overlay = document.getElementById('powerAdvanceOverlay');
    const numEl = document.getElementById('powerCountdownNumber');
    document.getElementById('powerNextTargetTitle').textContent = lead.company || lead.name || 'Next Contact';

    numEl.textContent = state.powerDialCount;
    overlay.classList.remove('hidden');

    if (state.powerDialTimer) clearInterval(state.powerDialTimer);
    state.powerDialTimer = setInterval(() => {
      state.powerDialCount--;
      if (state.powerDialCount > 0) {
        numEl.textContent = state.powerDialCount;
        paperSound.play('nib');
      } else {
        abortPowerDial();
        openCockpit(lead.id);
        dispatchLeadCall(lead);
      }
    }, 1000);
  }

  function abortPowerDial() {
    if (state.powerDialTimer) {
      clearInterval(state.powerDialTimer);
      state.powerDialTimer = null;
    }
    document.getElementById('powerAdvanceOverlay').classList.add('hidden');
  }

  function dispatchLeadCall(contact) {
    const cl = cleanPhone(contact.phone);
    // On wide desktop screens without native tel handler, open the simulator overlay
    if (window.innerWidth >= 1024) {
      openDesktopCallConsole(contact);
    } else {
      if (cl) {
        beginCallTracking(contact);
        window.location.href = `tel:${cl}`;
      } else {
        openDesktopCallConsole(contact);
      }
    }
  }

  // --- 11. PIPELINE FILTER & LIVING CARD STACK ---
  function applyPipelineFilter() {
    const q = state.searchQuery.toLowerCase().trim();
    const stage = state.activeQueue;

    state.filteredContacts = state.contacts.filter(c => {
      const matchSearch = !q ||
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q));

      if (!matchSearch) return false;
      if (stage === 'all') return true;
      return c.stage === stage;
    });

    // Sorting Engine
    state.filteredContacts.sort((a, b) => {
      if (state.sortBy === 'name') {
        return (a.company || a.name || '').localeCompare(b.company || b.name || '');
      } else if (state.sortBy === 'date_desc') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      } else if (state.sortBy === 'callback_due') {
        return new Date(a.next_callback_at || 0) - new Date(b.next_callback_at || 0);
      } else if (state.sortBy === 'attempts') {
        return (b.attempts || 0) - (a.attempts || 0);
      }
      return 0;
    });

    renderCardStack();
    refreshTelemetry();

    // Auto-select on desktop if nothing selected
    if (window.innerWidth >= 1024 && state.filteredContacts.length > 0) {
      if (state.currentContactIndex === -1 || !state.filteredContacts[state.currentContactIndex]) {
        openCockpit(state.filteredContacts[0].id, false);
      }
    }
  }

  function renderCardStack() {
    const container = document.getElementById('paperCardStack');
    if (state.filteredContacts.length === 0) {
      container.innerHTML = `
        <div class="paper-box" style="text-align: center; padding: 36px 16px;">
          <p style="color: var(--ink-secondary); font-size: 0.92rem; margin-bottom: 14px;">No contacts found in this filter.</p>
          <button id="btnEmptyCsvTrigger" class="paper-button paper-btn-gold">📥 Import Leads (.CSV)</button>
        </div>`;
      const btn = document.getElementById('btnEmptyCsvTrigger');
      if (btn) btn.onclick = () => document.getElementById('fileCsvPicker').click();
      return;
    }

    const frag = document.createDocumentFragment();

    state.filteredContacts.forEach((c, idx) => {
      const envelope = document.createElement('div');
      envelope.className = 'paper-swipe-envelope';
      envelope.dataset.id = c.id;

      const isCurrent = (state.currentContactIndex === idx);

      envelope.innerHTML = `
        <div class="swipe-reveal-underlay reveal-call">📞 Call Now</div>
        <div class="swipe-reveal-underlay reveal-schedule">📅 Schedule</div>
        <div class="paper-card ${isCurrent ? 'active-selected' : ''}">
          <div class="paper-avatar">${getInitials(c.company, c.name)}</div>
          <div class="card-center-info">
            <div class="card-company-title">${c.company || c.name || 'Unnamed Lead'}</div>
            <div class="card-person-subtitle">${c.company && c.name ? c.name : (c.job_title || 'Lead Contact')}</div>
            <div class="card-meta-line">
              <span class="paper-tz-tag" id="tz_${c.id}">...</span>
              ${c.phone ? `<span style="font-size:0.72rem; color:var(--ink-secondary);">📞 ${c.phone}</span>` : ''}
            </div>
          </div>
          <div class="card-right-status">
            <span class="paper-status-pill status-${c.stage}">${c.stage === 'uncontacted' ? (c.attempts > 0 ? `Att: ${c.attempts}` : 'Fresh') : c.stage}</span>
          </div>
        </div>
      `;

      const card = envelope.querySelector('.paper-card');
      const tzEl = envelope.querySelector(`#tz_${c.id}`);
      const tzInfo = getContactTimezone(c.phone);

      if (tzInfo.localTime) {
        tzEl.textContent = `${tzInfo.tzAbbr} ${tzInfo.localTime}`;
        tzEl.className = `paper-tz-tag ${tzInfo.isCallable ? 'open' : 'closed'}`;
      } else {
        tzEl.style.display = 'none';
      }

      card.addEventListener('click', () => {
        if (envelope.dataset.swiping === 'true') return;
        paperSound.play('turn');
        openCockpit(c.id);
      });

      attachCardSwipeGestures(envelope, card, c);
      frag.appendChild(envelope);
    });

    container.replaceChildren(frag);
  }

  // --- 12. TOUCH SWIPE PHYSICS ---
  function attachCardSwipeGestures(envelope, card, contact) {
    let startX = 0;
    let currentX = 0;
    let isTouching = false;

    card.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isTouching = true;
      envelope.dataset.swiping = 'false';
      card.style.transition = 'none';
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!isTouching) return;
      currentX = e.touches[0].clientX - startX;
      if (Math.abs(currentX) > 10) envelope.dataset.swiping = 'true';
      const damped = Math.sign(currentX) * Math.min(Math.abs(currentX), 130);
      card.style.transform = `translateX(${damped}px)`;
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (!isTouching) return;
      isTouching = false;
      card.style.transition = 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';

      if (currentX > 85) {
        paperSound.play('seal');
        card.style.transform = 'translateX(0px)';
        dispatchLeadCall(contact);
      } else if (currentX < -85) {
        paperSound.play('seal');
        card.style.transform = 'translateX(0px)';
        openCallbackSheet(contact);
      } else {
        card.style.transform = 'translateX(0px)';
      }
      setTimeout(() => { envelope.dataset.swiping = 'false'; }, 200);
    });
  }

  // --- 13. LEAD COCKPIT CONSOLE (DESKTOP MASTER-DETAIL) ---
  function openCockpit(contactId, shouldSwitchScreenOnMobile = true) {
    const idx = state.filteredContacts.findIndex(c => c.id === contactId);
    if (idx === -1) return;

    state.currentContactIndex = idx;
    renderCockpit(state.filteredContacts[idx]);

    // Update active highlight in pipeline list
    document.querySelectorAll('.paper-card').forEach((el, i) => {
      el.classList.toggle('active-selected', i === idx);
    });

    if (window.innerWidth < 1024 && shouldSwitchScreenOnMobile) {
      document.getElementById('paneCockpit').classList.add('mobile-active');
      document.getElementById('dockDefaultBar').classList.add('hidden');
      document.getElementById('dockCockpitBar').classList.remove('hidden');
    }
  }

  async function renderCockpit(c) {
    const container = document.getElementById('cockpitMountPoint');
    document.getElementById('cockpitEmptyState').classList.add('hidden');
    const tzInfo = getContactTimezone(c.phone);

    container.innerHTML = `
      <!-- Cockpit Hero -->
      <div class="cockpit-hero">
        <div class="hero-left-cluster">
          <div class="hero-large-avatar">${getInitials(c.company, c.name)}</div>
          <div class="hero-meta-body">
            <div class="hero-lead-title">${c.company || c.name || 'Unnamed Lead'}</div>
            <div class="hero-lead-person">${c.company && c.name ? c.name : ''} ${c.job_title ? `• ${c.job_title}` : ''}</div>
            <div class="hero-pills-row">
              ${tzInfo.localTime ? `<span class="paper-tz-tag ${tzInfo.isCallable ? 'open' : 'closed'}">${tzInfo.tzAbbr} ${tzInfo.localTime} • ${tzInfo.isCallable ? 'Working Hours' : 'After Hours'}</span>` : ''}
              ${c.phone ? `<span style="font-size:0.78rem; font-weight:700; color:var(--ink-secondary);">📞 ${c.phone}</span>` : ''}
              ${c.email ? `<span style="font-size:0.78rem; color:var(--ink-muted);">✉️ ${c.email}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="hero-right-tools">
          <button id="btnQuickEditLeadHeader" class="paper-button paper-btn-subtle" title="Edit Contact Details">✏️ Edit</button>
          <button id="btnOpenPrompterHeader" class="paper-button paper-btn-gold" title="View Full Pitch Script">💡 Pitch Script</button>
        </div>
      </div>

      <!-- Triad Trigger Actions with Keyboard Indicators -->
      <div class="cockpit-triad-row">
        <button id="btnTriadCall" class="paper-triad-tile tile-voice">
          <span class="triad-hotkey-hint">C</span>
          <span class="triad-glyph">📞</span>
          <span class="triad-name">VOICE CALL</span>
        </button>
        <button id="btnTriadEmail" class="paper-triad-tile tile-mail">
          <span class="triad-hotkey-hint">E</span>
          <span class="triad-glyph">✉️</span>
          <span class="triad-name">EMAIL DISPATCH</span>
        </button>
        <button id="btnTriadSms" class="paper-triad-tile tile-message">
          <span class="triad-hotkey-hint">S</span>
          <span class="triad-glyph">💬</span>
          <span class="triad-name">SMS DISPATCH</span>
        </button>
      </div>

      <!-- Quick Outcome Vellum Chips -->
      <div class="cockpit-chips-tray">
        <span class="chips-heading">Instant Outcome Micro-Chips</span>
        <div class="chips-wrapper">
          <button class="vellum-chip" data-chip="Left Voicemail">🎙️ Left Voicemail</button>
          <button class="vellum-chip" data-chip="Gatekeeper Screened">🛡️ Gatekeeper</button>
          <button class="vellum-chip" data-chip="Decision Maker Out">🚪 Boss Out</button>
          <button class="vellum-chip" data-chip="Send Presentation">📧 Send Presentation</button>
          <button class="vellum-chip" data-chip="Qualified / Meeting Set">⭐ Meeting Set</button>
        </div>
      </div>

      <!-- 4-Way Macro Outcomes -->
      <div class="macro-disposition-deck">
        <button id="btnMacroNA" class="macro-btn m-btn-na">
          <span class="triad-hotkey-hint">N</span>
          <span class="macro-title">🔕 NO ANSWER</span>
          <span class="macro-sub">Log Attempt</span>
        </button>
        <button id="btnMacroCB" class="macro-btn m-btn-cb">
          <span class="triad-hotkey-hint">B</span>
          <span class="macro-title">📅 CALL BACK</span>
          <span class="macro-sub">Schedule Date</span>
        </button>
        <button id="btnMacroSpoken" class="macro-btn m-btn-spoken">
          <span class="triad-hotkey-hint">D</span>
          <span class="macro-title">⭐ SPOKEN</span>
          <span class="macro-sub">Contacted</span>
        </button>
        <button id="btnMacroDNC" class="macro-btn m-btn-dnc">
          <span class="macro-title">🚫 D.N.C.</span>
          <span class="macro-sub">Scrub Record</span>
        </button>
      </div>

      <!-- Desktop Bento: Script Prompter & Call Notes -->
      <div class="cockpit-dual-grid">
        <!-- Live Pitch Hook Bento -->
        <div class="paper-box">
          <div class="row-between">
            <span class="paper-box-title">RAPID PITCH PROMPTER</span>
            <button id="btnExpandScriptFull" class="btn-dictate">Full Script ↗</button>
          </div>
          <div class="prompter-card" style="margin: 0; background: var(--paper-vellum-light);">
            <span class="card-caption">OPENING VALUE HOOK</span>
            <p id="cockpitLiveValueHook">${resolveTokens("Hi Christian here from Tileworks Studio. We developed a free puzzle-based tool for {company} that trains hospitality teams on menus and service standards without boring manuals.", c)}</p>
          </div>
        </div>

        <!-- Call Notes Bento -->
        <div class="paper-box">
          <div class="row-between">
            <span class="paper-box-title">SCRATCHPAD & CALL NOTES</span>
            <button id="btnEditNotesQuick" class="btn-dictate">✏️ Edit / Dictate</button>
          </div>
          <div class="cockpit-notes-canvas" id="cockpitNotesDisplay">${c.notes || '<span style="color:var(--ink-muted);font-style:italic;">No notes recorded yet. Click Edit to enter scratch notes.</span>'}</div>
        </div>
      </div>

      <!-- History Ledger Bento -->
      <div class="paper-box">
        <span class="paper-box-title">AUDIT ACTIVITY LOG FOR THIS LEAD</span>
        <div id="cockpitLedgerList" class="ledger-feed"></div>
      </div>
    `;

    // Event listeners
    container.querySelector('#btnTriadCall').onclick = () => {
      paperSound.play('seal');
      dispatchLeadCall(c);
    };
    container.querySelector('#btnTriadEmail').onclick = () => openDispatcherSheet(c, 'email');
    container.querySelector('#btnTriadSms').onclick = () => openDispatcherSheet(c, 'sms');
    container.querySelector('#btnQuickEditLeadHeader').onclick = () => openLeadProfileEditor(c);
    container.querySelector('#btnEditNotesQuick').onclick = () => openLeadProfileEditor(c);
    container.querySelector('#btnOpenPrompterHeader').onclick = () => {
      document.getElementById('sheetPitchPrompter').classList.remove('hidden');
    };
    container.querySelector('#btnExpandScriptFull').onclick = () => {
      document.getElementById('sheetPitchPrompter').classList.remove('hidden');
    };

    container.querySelector('#btnMacroNA').onclick = () => handleMacroOutcome(c, 'no_answer');
    container.querySelector('#btnMacroCB').onclick = () => openCallbackSheet(c);
    container.querySelector('#btnMacroSpoken').onclick = () => handleMacroOutcome(c, 'contacted');
    container.querySelector('#btnMacroDNC').onclick = () => handleMacroOutcome(c, 'dnc');

    container.querySelectorAll('.vellum-chip').forEach(btn => {
      btn.onclick = async () => {
        paperSound.play('nib');
        const tag = btn.dataset.chip;
        c.notes = c.notes ? `${c.notes}\n[${new Date().toLocaleTimeString()}]: ${tag}` : `[${new Date().toLocaleTimeString()}]: ${tag}`;
        await saveContact(c);
        await logLedger(c.id, 'disposition', tag, 'Tagged via Micro-Chip');
        renderCockpit(c);
      };
    });

    const feed = container.querySelector('#cockpitLedgerList');
    const logs = await getLedgerLogsForContact(c.id);
    if (logs.length > 0) {
      logs.slice(0, 6).forEach(l => {
        const item = document.createElement('div');
        item.className = 'ledger-item';
        item.innerHTML = `
          <div class="ledger-head">
            <span>${l.action.toUpperCase()}</span>
            <span>${formatDate(l.timestamp)}</span>
          </div>
          <div class="ledger-outcome">${l.outcome}</div>
          ${l.note ? `<div class="ledger-note">${l.note}</div>` : ''}
        `;
        feed.appendChild(item);
      });
    } else {
      feed.innerHTML = '<span style="color:var(--ink-muted);font-size:0.8rem;">No previous actions logged.</span>';
    }
  }

  // --- 14. MACRO OUTCOMES & WORKBENCH ADVANCEMENT ---
  async function handleMacroOutcome(contact, type) {
    paperSound.play(type === 'dnc' ? 'alert' : 'seal');
    const prevAttempts = contact.attempts || 0;
    const prevStage = contact.stage;
    const prevCb = contact.next_callback_at;

    if (type === 'no_answer') {
      contact.attempts = prevAttempts + 1;
      contact.stage = 'uncontacted';
      await saveContact(contact);
      await logLedger(contact.id, 'disposition', 'No Answer', `Attempt #${contact.attempts}`);

      triggerUndo(`Marked No Answer (${contact.company || contact.name})`, async () => {
        contact.attempts = prevAttempts;
        contact.stage = prevStage;
        await saveContact(contact);
        applyPipelineFilter();
      });
    } else if (type === 'contacted') {
      contact.stage = 'contacted';
      contact.next_callback_at = null;
      await saveContact(contact);
      await logLedger(contact.id, 'disposition', 'Spoken / Contacted');

      triggerUndo(`Marked Spoken (${contact.company || contact.name})`, async () => {
        contact.stage = prevStage;
        contact.next_callback_at = prevCb;
        await saveContact(contact);
        applyPipelineFilter();
      });
    } else if (type === 'dnc') {
      const copy = { ...contact };
      if (confirm(`Scrub "${contact.company || contact.name}" permanently from pipeline?`)) {
        await logLedger(contact.id, 'disposition', 'DNC / Scrubbed');
        await deleteContact(contact.id);

        triggerUndo(`Scrubbed "${copy.company || copy.name}"`, async () => {
          await saveContact(copy);
          state.contacts.push(copy);
          applyPipelineFilter();
        });
      } else return;
    }

    advanceWorkbench();
  }

  function advanceWorkbench() {
    applyPipelineFilter();
    if (state.settings.powerDialerEnabled) {
      startPowerDialCycle();
    } else {
      if (state.filteredContacts.length > 0) {
        if (state.currentContactIndex >= state.filteredContacts.length) {
          state.currentContactIndex = 0;
        }
        renderCockpit(state.filteredContacts[state.currentContactIndex]);
      } else {
        document.getElementById('cockpitMountPoint').innerHTML = '';
        document.getElementById('cockpitEmptyState').classList.remove('hidden');
      }
    }
  }

  // --- 15. KEYBOARD COMMAND ACCELERATOR ---
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Do not trigger hotkeys if user is currently typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }

      const c = state.filteredContacts[state.currentContactIndex];

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        document.getElementById('modalKeyboardShortcuts').classList.toggle('hidden');
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('inputSearchLeads');
        searchInput.focus();
        searchInput.select();
        return;
      }

      if (e.key === 'Escape') {
        document.querySelectorAll('.paper-sheet-scrim').forEach(s => s.classList.add('hidden'));
        document.getElementById('callConsoleOverlay').classList.add('hidden');
        document.getElementById('postCallTray').classList.add('hidden');
        abortPowerDial();
        return;
      }

      if (e.key === 'z' || e.key === 'Z') {
        executeUndo();
        return;
      }

      // Lead Cycling
      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown' || e.key === ']') {
        e.preventDefault();
        if (state.filteredContacts.length > 0) {
          const next = (state.currentContactIndex + 1) % state.filteredContacts.length;
          openCockpit(state.filteredContacts[next].id);
        }
        return;
      }

      if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp' || e.key === '[') {
        e.preventDefault();
        if (state.filteredContacts.length > 0) {
          const prev = (state.currentContactIndex - 1 + state.filteredContacts.length) % state.filteredContacts.length;
          openCockpit(state.filteredContacts[prev].id);
        }
        return;
      }

      // Actions on currently active lead
      if (!c) return;

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        dispatchLeadCall(c);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        openDispatcherSheet(c, 'email');
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        openDispatcherSheet(c, 'sms');
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleMacroOutcome(c, 'no_answer');
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        openCallbackSheet(c);
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleMacroOutcome(c, 'contacted');
      }
    });
  }

  // --- 16. MODALS: CALLBACK & DISPATCH ---
  function openCallbackSheet(contact) {
    state.pendingCallbackContact = contact;
    document.getElementById('customCallbackPicker').value = '';
    document.getElementById('sheetCallbackSchedule').classList.remove('hidden');
    paperSound.play('seal');
  }

  async function scheduleCallback(offsetHours, customIso = null) {
    paperSound.play('seal');
    const contact = state.pendingCallbackContact;
    if (!contact) return;

    const prevStage = contact.stage;
    const prevCb = contact.next_callback_at;

    const targetDate = customIso ? new Date(customIso) : new Date();
    if (!customIso) targetDate.setHours(targetDate.getHours() + offsetHours);

    contact.stage = 'callback';
    contact.next_callback_at = targetDate.toISOString();
    await saveContact(contact);
    await logLedger(contact.id, 'disposition', 'Callback Scheduled', `Due: ${formatDate(contact.next_callback_at)}`);

    document.getElementById('sheetCallbackSchedule').classList.add('hidden');
    state.pendingCallbackContact = null;

    triggerUndo(`Callback Set: ${formatDate(contact.next_callback_at)}`, async () => {
      contact.stage = prevStage;
      contact.next_callback_at = prevCb;
      await saveContact(contact);
      applyPipelineFilter();
    });

    advanceWorkbench();
  }

  function openDispatcherSheet(contact, mode = 'email') {
    const isEmail = mode === 'email';
    document.getElementById('dispatcherSheetTitle').textContent = isEmail ? 'Rapid Email Dispatch' : 'Rapid SMS Dispatch';
    document.getElementById('wrapDispatchSubject').style.display = isEmail ? 'flex' : 'none';
    document.getElementById('btnLaunchGmailWeb').style.display = isEmail ? 'inline-flex' : 'none';

    const select = document.getElementById('selectDispatchTemplate');
    select.replaceChildren();

    Object.values(state.emailTemplates).forEach(t => {
      if (isEmail && t.type === 'sms') return;
      if (!isEmail && t.type === 'email') return;
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.title;
      select.appendChild(opt);
    });

    state.activeTemplateId = select.value || Object.keys(state.emailTemplates)[0];
    updateDispatcherDraft(contact, state.activeTemplateId);

    select.onchange = (e) => {
      state.activeTemplateId = e.target.value;
      updateDispatcherDraft(contact, state.activeTemplateId);
    };

    document.getElementById('btnLaunchNativeMail').onclick = () => {
      paperSound.play('nib');
      if (isEmail) {
        const to = encodeURIComponent(contact.email || '');
        const s = encodeURIComponent(document.getElementById('inputDispatchSubject').value);
        const b = encodeURIComponent(document.getElementById('textareaDispatchBody').value);
        window.location.href = `mailto:${to}?subject=${s}&body=${b}`;
      } else {
        const cl = cleanPhone(contact.phone);
        const b = encodeURIComponent(document.getElementById('textareaDispatchBody').value);
        window.location.href = `sms:${cl}?body=${b}`;
      }
    };

    document.getElementById('btnLaunchGmailWeb').onclick = () => {
      paperSound.play('nib');
      const to = encodeURIComponent(contact.email || '');
      const s = encodeURIComponent(document.getElementById('inputDispatchSubject').value);
      const b = encodeURIComponent(document.getElementById('textareaDispatchBody').value);
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${s}&body=${b}`, '_blank');
    };

    document.getElementById('btnCopyDispatchClipboard').onclick = () => {
      paperSound.play('seal');
      const text = document.getElementById('textareaDispatchBody').value;
      navigator.clipboard.writeText(text);
      alert('Draft copied to clipboard!');
    };

    document.getElementById('btnMarkDispatchLogged').onclick = async () => {
      paperSound.play('seal');
      await logLedger(contact.id, isEmail ? 'email' : 'sms', `${isEmail ? 'Email' : 'SMS'} Dispatched`, document.getElementById('textareaDispatchBody').value);
      document.getElementById('sheetDispatcher').classList.add('hidden');
      renderCockpit(contact);
      refreshTelemetry();
    };

    document.getElementById('sheetDispatcher').classList.remove('hidden');
    paperSound.play('seal');
  }

  function updateDispatcherDraft(contact, tmplId) {
    const tmpl = state.emailTemplates[tmplId] || state.emailTemplates.hospitality_demo || Object.values(state.emailTemplates)[0];
    document.getElementById('inputDispatchSubject').value = resolveTokens(tmpl.subject, contact);
    document.getElementById('textareaDispatchBody').value = resolveTokens(tmpl.body, contact);
  }

  // --- 17. PROFILE EDITOR & SPEECH ---
  function openLeadProfileEditor(contact) {
    document.getElementById('editLeadId').value = contact ? contact.id : '';
    document.getElementById('editorSheetHeading').textContent = contact ? `Edit: ${contact.company || contact.name || 'Contact'}` : 'Create New Lead';
    document.getElementById('fieldEditCompany').value = contact ? (contact.company || '') : '';
    document.getElementById('fieldEditPersonName').value = contact ? (contact.name || '') : '';
    document.getElementById('fieldEditPhone').value = contact ? (contact.phone || '') : '';
    document.getElementById('fieldEditEmail').value = contact ? (contact.email || '') : '';
    document.getElementById('fieldEditJobTitle').value = contact ? (contact.job_title || '') : '';
    document.getElementById('fieldEditNotes').value = contact ? (contact.notes || '') : '';

    document.getElementById('sheetLeadEditor').classList.remove('hidden');
    paperSound.play('seal');
  }

  function setupSpeechEngine() {
    const btn = document.getElementById('btnDictateNotes');
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) { btn.style.display = 'none'; return; }

    const recognition = new Speech();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      btn.textContent = '🔴 Listening...';
      paperSound.play('alert');
    };
    recognition.onresult = (e) => {
      const text = e.results[0][0].transcript;
      const notes = document.getElementById('fieldEditNotes');
      notes.value = notes.value ? `${notes.value} ${text}` : text;
    };
    recognition.onerror = () => { btn.textContent = '🎙️ Dictate Voice'; };
    recognition.onend = () => { btn.textContent = '🎙️ Dictate Voice'; };

    btn.onclick = () => {
      try { recognition.start(); } catch (err) { recognition.stop(); }
    };
  }

  async function handleLeadFormSubmit(e) {
    e.preventDefault();
    paperSound.play('seal');
    const id = document.getElementById('editLeadId').value;
    let c = state.contacts.find(x => x.id === id);

    if (!c) {
      // New Contact creation
      c = {
        id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        stage: 'uncontacted',
        attempts: 0,
        last_contacted_at: null,
        next_callback_at: null,
        created_at: new Date().toISOString()
      };
      state.contacts.unshift(c);
    }

    c.company = document.getElementById('fieldEditCompany').value.trim();
    c.name = document.getElementById('fieldEditPersonName').value.trim();
    c.phone = document.getElementById('fieldEditPhone').value.trim();
    c.email = document.getElementById('fieldEditEmail').value.trim();
    c.job_title = document.getElementById('fieldEditJobTitle').value.trim();
    c.notes = document.getElementById('fieldEditNotes').value.trim();

    await saveContact(c);
    document.getElementById('sheetLeadEditor').classList.add('hidden');
    applyPipelineFilter();
    openCockpit(c.id);
  }

  // --- 18. SCREEN CONTROLLER ---
  function switchScreen(targetId) {
    paperSound.play('turn');
    state.activeScreenId = targetId;

    if (targetId === 'screenPipeline') {
      document.getElementById('panePipeline').classList.remove('hidden');
      document.getElementById('paneCockpit').classList.remove('hidden');
      document.getElementById('screenLedger').classList.add('hidden');
      document.getElementById('screenStudio').classList.add('hidden');
      applyPipelineFilter();
    } else if (targetId === 'screenLedger') {
      document.getElementById('panePipeline').classList.add('hidden');
      document.getElementById('paneCockpit').classList.add('hidden');
      document.getElementById('screenLedger').classList.remove('hidden');
      document.getElementById('screenStudio').classList.add('hidden');
      renderLedgerView();
    } else if (targetId === 'screenStudio') {
      document.getElementById('panePipeline').classList.add('hidden');
      document.getElementById('paneCockpit').classList.add('hidden');
      document.getElementById('screenLedger').classList.add('hidden');
      document.getElementById('screenStudio').classList.remove('hidden');
    }

    document.querySelectorAll('.dock-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.screen === targetId);
    });
  }

  async function renderLedgerView() {
    const feed = document.getElementById('ledgerItemsFeed');
    let logs = await getAllLedgerLogs();

    // KPIs
    const callLogs = logs.filter(l => l.action === 'call');
    document.getElementById('ledgerKpiCalls').textContent = callLogs.length;
    const spoken = logs.filter(l => l.action === 'disposition' && l.outcome.toLowerCase().includes('spoken')).length;
    document.getElementById('ledgerKpiSpoken').textContent = spoken;

    const totalSec = callLogs.reduce((acc, curr) => acc + (curr.duration_sec || 0), 0);
    const avgSec = callLogs.length > 0 ? Math.round(totalSec / callLogs.length) : 0;
    document.getElementById('ledgerKpiAvgDuration').textContent = `${avgSec}s`;

    if (state.ledgerFilterAction !== 'all') {
      logs = logs.filter(l => l.action === state.ledgerFilterAction);
    }
    if (state.ledgerSearchQuery) {
      const q = state.ledgerSearchQuery.toLowerCase();
      logs = logs.filter(l => (l.note && l.note.toLowerCase().includes(q)) || (l.outcome && l.outcome.toLowerCase().includes(q)));
    }

    if (logs.length === 0) {
      feed.innerHTML = '<div class="paper-box" style="text-align:center;"><p style="color:var(--ink-secondary);font-size:0.85rem;">No ledger records found.</p></div>';
      return;
    }

    feed.replaceChildren();
    logs.slice(0, 100).forEach(l => {
      const c = state.contacts.find(x => x.id === l.contact_id);
      const card = document.createElement('div');
      card.className = 'ledger-item';
      card.innerHTML = `
        <div class="ledger-head">
          <span>${c ? (c.company || c.name) : 'Archived Contact'} • ${l.action.toUpperCase()}</span>
          <span>${formatDate(l.timestamp)}</span>
        </div>
        <div class="ledger-outcome">${l.outcome} ${l.duration_sec ? `(${l.duration_sec}s)` : ''}</div>
        ${l.note ? `<div class="ledger-note">${l.note}</div>` : ''}
      `;
      feed.appendChild(card);
    });
  }

  // --- 19. CSV RFC 4180 PARSER & EXPORTER ---
  function parseCsvString(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let curRow = [];
    let curField = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const ch = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (ch === '"') {
          if (next === '"') { curField += '"'; i++; }
          else inQuotes = false;
        } else curField += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { curRow.push(curField.trim()); curField = ''; }
        else if (ch === '\r' || ch === '\n') {
          curRow.push(curField.trim());
          if (curRow.some(f => f.length > 0)) rows.push(curRow);
          curRow = [];
          curField = '';
          if (ch === '\r' && next === '\n') i++;
        } else curField += ch;
      }
      i++;
    }
    if (curField || curRow.length > 0) {
      curRow.push(curField.trim());
      if (curRow.some(f => f.length > 0)) rows.push(curRow);
    }
    return rows;
  }

  function handleCsvUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const rows = parseCsvString(e.target.result);
        if (rows.length < 2) { alert('CSV file is empty or missing headers.'); return; }

        const headers = rows[0].map(h => h.toLowerCase().replace(/[\s\-_]+/g, '_'));
        const findCol = (aliases) => headers.findIndex(h => aliases.includes(h));

        const cIdx = findCol(['company', 'business', 'business_name', 'account', 'organization']);
        const nIdx = findCol(['name', 'full_name', 'contact', 'client', 'contact_name']);
        const pIdx = findCol(['phone', 'tel', 'mobile', 'telephone', 'direct_phone']);
        const eIdx = findCol(['email', 'mail', 'email_address']);
        const rIdx = findCol(['title', 'role', 'job_title', 'position']);
        const ntIdx = findCol(['notes', 'comments', 'memo', 'note']);

        const dupPolicy = state.settings.dupRule || 'skip';
        let imported = 0;
        let skipped = 0;

        const tx = db.transaction('contacts', 'readwrite');
        const store = tx.objectStore('contacts');

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const company = (row[cIdx] || '').trim();
          const name = (row[nIdx] || '').trim();
          const phone = (row[pIdx] || '').trim();
          const email = (row[eIdx] || '').trim();

          if (!company && !name && !phone && !email) continue;

          const exists = state.contacts.find(x => (phone && x.phone === phone) || (email && x.email.toLowerCase() === email.toLowerCase()));
          if (exists) {
            if (dupPolicy === 'skip') {
              skipped++;
              continue;
            } else if (dupPolicy === 'update') {
              exists.company = company || exists.company;
              exists.name = name || exists.name;
              exists.job_title = (row[rIdx] || '').trim() || exists.job_title;
              exists.notes = (row[ntIdx] || '').trim() || exists.notes;
              store.put(exists);
              imported++;
              continue;
            }
          }

          store.put({
            id: 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            company,
            name,
            phone,
            email,
            job_title: (row[rIdx] || '').trim(),
            notes: (row[ntIdx] || '').trim(),
            stage: 'uncontacted',
            attempts: 0,
            last_contacted_at: null,
            next_callback_at: null,
            created_at: new Date().toISOString()
          });
          imported++;
        }

        tx.oncomplete = async () => {
          paperSound.play('seal');
          await loadAllContacts();
          applyPipelineFilter();
          alert(`CSV Ingestion Finished: ${imported} imported, ${skipped} duplicates skipped.`);
        };
      } catch (err) {
        alert('CSV Parse Error: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function exportLeadsCsv() {
    if (state.contacts.length === 0) { alert('No contacts to export.'); return; }
    const headers = ['company', 'name', 'phone', 'email', 'job_title', 'stage', 'attempts', 'notes'];
    const rows = [headers.join(',')];

    state.contacts.forEach(c => {
      const r = headers.map(h => `"${(c[h] || '').toString().replace(/"/g, '""')}"`);
      rows.push(r.join(','));
    });

    const blob = new Blob([rows.join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportLedgerCsv() {
    const logs = await getAllLedgerLogs();
    if (logs.length === 0) { alert('No ledger records to export.'); return; }

    const headers = ['timestamp', 'action', 'outcome', 'duration_sec', 'note'];
    const rows = [headers.join(',')];

    logs.forEach(l => {
      const r = [
        `"${l.timestamp}"`,
        `"${l.action}"`,
        `"${(l.outcome || '').replace(/"/g, '""')}"`,
        `"${l.duration_sec || 0}"`,
        `"${(l.note || '').replace(/"/g, '""')}"`
      ];
      rows.push(r.join(','));
    });

    const blob = new Blob([rows.join('\r\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportFullJsonSnapshot() {
    paperSound.play('nib');
    const logs = await getAllLedgerLogs();
    const payload = {
      contacts: state.contacts,
      interactions: logs,
      settings: state.settings,
      templates: state.emailTemplates
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FlipDialler_Snapshot_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleJsonRestore(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const snap = JSON.parse(e.target.result);
        if (!snap.contacts) { alert('Invalid snapshot file.'); return; }
        if (confirm(`Restore ${snap.contacts.length} leads? Current data will be replaced.`)) {
          const tx = db.transaction(['contacts', 'interactions'], 'readwrite');
          tx.objectStore('contacts').clear();
          tx.objectStore('interactions').clear();

          snap.contacts.forEach(c => tx.objectStore('contacts').put(c));
          if (snap.interactions) snap.interactions.forEach(l => tx.objectStore('interactions').put(l));

          tx.oncomplete = async () => {
            if (snap.settings) state.settings = { ...state.settings, ...snap.settings };
            if (snap.templates) state.emailTemplates = { ...state.emailTemplates, ...snap.templates };
            await persistSettings();
            await loadAllContacts();
            applyPipelineFilter();
            paperSound.play('seal');
            alert('Database verified and restored!');
          };
        }
      } catch (err) {
        alert('Restore error: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // --- 20. BOOTSTRAP INITIALIZATION ---
  async function initLivingPaperApp() {
    await initDatabase();
    await loadSettings();
    await loadAllContacts();

    setupSpeechEngine();
    setupKeyboardShortcuts();

    // Clock
    setInterval(updateIslandClock, 1000);
    updateIslandClock();

    // Visibility listener for auto-timing call wrap-up
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkCallCompletion();
      }
    });

    // Dynamic Island Expansion
    const island = document.getElementById('livingIsland');
    const tray = document.getElementById('islandExpandedTray');
    island.onclick = (e) => {
      if (e.target.closest('.paper-switch') || e.target.closest('#islandActiveCallBadge')) return;
      paperSound.play('nib');
      state.islandExpanded = !state.islandExpanded;
      tray.classList.toggle('hidden', !state.islandExpanded);
    };

    // Power Dialer Toggle
    const powerToggle = document.getElementById('togglePowerDial');
    powerToggle.checked = !!state.settings.powerDialerEnabled;
    powerToggle.onchange = async (e) => {
      state.settings.powerDialerEnabled = e.target.checked;
      await persistSettings();
      paperSound.play('seal');
    };

    // Call Console Close
    document.getElementById('btnCloseCallConsole').onclick = closeDesktopCallConsole;
    document.getElementById('btnEndVoiceCall').onclick = closeDesktopCallConsole;
    document.getElementById('btnConsoleOpenScript').onclick = () => {
      document.getElementById('sheetPitchPrompter').classList.remove('hidden');
    };

    // Post Call Tray Outcomes
    document.getElementById('btnDismissPostCallTray').onclick = () => {
      document.getElementById('postCallTray').classList.add('hidden');
    };
    document.querySelectorAll('.tray-btn').forEach(btn => {
      btn.onclick = () => {
        const cId = document.getElementById('postCallTray').dataset.contactId;
        const c = state.contacts.find(x => x.id === cId);
        document.getElementById('postCallTray').classList.add('hidden');
        if (!c) return;
        const disp = btn.dataset.outcome;
        if (disp === 'callback') openCallbackSheet(c);
        else handleMacroOutcome(c, disp);
      };
    });

    // Segment Strip Tabs
    document.querySelectorAll('.segment-tab').forEach(b => {
      b.onclick = () => {
        paperSound.play('nib');
        document.querySelectorAll('.segment-tab').forEach(t => t.classList.remove('active'));
        b.classList.add('active');
        state.activeQueue = b.dataset.queue;
        applyPipelineFilter();
      };
    });

    // Sorting
    document.getElementById('selectPipelineSort').onchange = (e) => {
      state.sortBy = e.target.value;
      applyPipelineFilter();
    };

    // Search Controls
    const searchInput = document.getElementById('inputSearchLeads');
    const clearBtn = document.getElementById('btnClearSearch');
    searchInput.oninput = (e) => {
      state.searchQuery = e.target.value;
      clearBtn.classList.toggle('hidden', !state.searchQuery);
      applyPipelineFilter();
    };
    clearBtn.onclick = () => {
      searchInput.value = '';
      state.searchQuery = '';
      clearBtn.classList.add('hidden');
      applyPipelineFilter();
    };

    // Masthead Buttons
    document.getElementById('btnOpenShortcutsHud').onclick = () => {
      document.getElementById('modalKeyboardShortcuts').classList.remove('hidden');
    };
    document.getElementById('btnQuickAddLead').onclick = () => openLeadProfileEditor(null);
    document.getElementById('btnToggleSoundEffects').onclick = () => {
      state.settings.sensoryMode = (state.settings.sensoryMode === 'mute' ? 'all' : 'mute');
      document.getElementById('soundEffectIcon').textContent = (state.settings.sensoryMode === 'mute' ? '🔇' : '🔊');
      persistSettings();
    };

    // Bottom Navigation (Mobile & Desktop)
    document.querySelectorAll('.dock-tab').forEach(btn => {
      btn.onclick = () => switchScreen(btn.dataset.screen);
    });

    // Mobile Cockpit Back Button
    document.getElementById('btnCockpitBack').onclick = () => {
      document.getElementById('paneCockpit').classList.remove('mobile-active');
      document.getElementById('dockDefaultBar').classList.remove('hidden');
      document.getElementById('dockCockpitBar').classList.add('hidden');
    };

    document.getElementById('btnCockpitObjections').onclick = () => {
      document.getElementById('sheetPitchPrompter').classList.remove('hidden');
    };
    document.getElementById('btnCockpitEditLead').onclick = () => {
      if (state.currentContactIndex !== -1) openLeadProfileEditor(state.filteredContacts[state.currentContactIndex]);
    };

    // Callback Sheet Pill Options
    document.querySelectorAll('.sheet-pill').forEach(b => {
      b.onclick = () => scheduleCallback(parseInt(b.dataset.hours, 10));
    });
    document.getElementById('btnConfirmCallbackSchedule').onclick = () => {
      const val = document.getElementById('customCallbackPicker').value;
      if (!val) { alert('Select a valid date & time.'); return; }
      scheduleCallback(0, val);
    };

    // Close Sheet Handlers
    document.querySelectorAll('[data-close-sheet]').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('.paper-sheet-scrim').forEach(m => m.classList.add('hidden'));
        paperSound.play('nib');
      };
    });

    // Forms & CSV Actions
    document.getElementById('formEditLeadProfile').onsubmit = handleLeadFormSubmit;
    document.getElementById('btnToastUndoAction').onclick = executeUndo;
    document.getElementById('btnCancelPowerAdvance').onclick = abortPowerDial;
    document.getElementById('btnSkipToNowPowerAdvance').onclick = () => {
      const lead = state.filteredContacts[state.currentContactIndex];
      abortPowerDial();
      if (lead) dispatchLeadCall(lead);
    };

    document.getElementById('btnPickCsvSheet').onclick = () => document.getElementById('fileCsvPicker').click();
    document.getElementById('btnBulkCsvImportTrigger').onclick = () => document.getElementById('fileCsvPicker').click();
    document.getElementById('btnEmptyStateCsv').onclick = () => document.getElementById('fileCsvPicker').click();
    document.getElementById('fileCsvPicker').onchange = (e) => { if (e.target.files.length) handleCsvUpload(e.target.files[0]); };

    document.getElementById('btnExportPipelineQuick').onclick = exportLeadsCsv;
    document.getElementById('btnExportLeadsCsv').onclick = exportLeadsCsv;
    document.getElementById('btnExportLedgerCsv').onclick = exportLedgerCsv;
    document.getElementById('btnExportLedgerCsvDirect').onclick = exportLedgerCsv;
    document.getElementById('btnExportFullJson').onclick = exportFullJsonSnapshot;
    document.getElementById('fileJsonRestorePicker').onchange = (e) => { if (e.target.files.length) handleJsonRestore(e.target.files[0]); };

    document.getElementById('btnSelectFirstLead').onclick = () => {
      if (state.filteredContacts.length > 0) openCockpit(state.filteredContacts[0].id);
    };

    // Settings Inputs
    document.getElementById('selectInterfaceDensity').value = state.settings.interfaceDensity || 'density-normal';
    document.getElementById('selectSensoryAudio').value = state.settings.sensoryMode || 'all';
    document.getElementById('checkWakeLockEnabled').checked = !!state.settings.wakeLockEnabled;

    document.getElementById('selectInterfaceDensity').onchange = async (e) => {
      state.settings.interfaceDensity = e.target.value;
      applyInterfaceDensity(e.target.value);
      await persistSettings();
    };
    document.getElementById('selectSensoryAudio').onchange = async (e) => {
      state.settings.sensoryMode = e.target.value;
      await persistSettings();
    };

    // Template Selector
    const tmplSelect = document.getElementById('templateChooser');
    tmplSelect.replaceChildren();
    Object.values(state.emailTemplates).forEach(t => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = `${t.title} [${t.type.toUpperCase()}]`;
      tmplSelect.appendChild(o);
    });
    const setTmplFields = (id) => {
      const t = state.emailTemplates[id] || state.emailTemplates.hospitality_demo;
      document.getElementById('templateSubjectLine').value = t.subject || '';
      document.getElementById('templateBodyText').value = t.body || '';
    };
    tmplSelect.onchange = (e) => setTmplFields(e.target.value);
    setTmplFields(tmplSelect.value);

    document.getElementById('btnSaveActiveTemplate').onclick = async () => {
      const id = tmplSelect.value;
      if (state.emailTemplates[id]) {
        state.emailTemplates[id].subject = document.getElementById('templateSubjectLine').value;
        state.emailTemplates[id].body = document.getElementById('templateBodyText').value;
        await persistSettings();
        paperSound.play('seal');
        alert('Template updated!');
      }
    };

    document.getElementById('btnPurgeEntireDatabase').onclick = async () => {
      if (confirm('Permanently purge entire database from this browser?')) {
        const tx = db.transaction(['contacts', 'interactions'], 'readwrite');
        tx.objectStore('contacts').clear();
        tx.objectStore('interactions').clear();
        tx.oncomplete = () => {
          state.contacts = [];
          applyPipelineFilter();
          alert('Database purged.');
        };
      }
    };

    applyPipelineFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLivingPaperApp);
  } else {
    initLivingPaperApp();
  }
})();