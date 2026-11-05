/**
 * AURELIUS PROSPECT CRM
 * Editorial Single-Page Application Controller
 * Automatically loads CSV data files located in the /Data repository folder
 */

const CRM = (() => {
  const STORAGE_KEY = "aurelius_crm_db_v4";
  const PREFS_KEY = "aurelius_crm_prefs_v4";

  // Application State — Initialized completely empty (zero mock leads)
  let lists = {};
  let currentListName = "";
  let currentLeadId = null;
  let activeFilter = "ALL";
  let activeSort = "default";
  let searchQuery = "";

  // Granular Application Preferences
  let prefs = {
    theme: "theme-light",
    density: "density-default",
    autoAdvance: true,
    advanceDelay: 200,
    autoTimestamp: true,
    workspaceTableRatio: 1 / 3,
    dialPrefix: "",
    csvDelimiter: ",",
    exportScope: "all",
    excelBom: true,
    emailSubject: "Quick inquiry regarding {business_name}",
    emailBody: "Hi,\n\nI was reviewing {business_name} and wanted to reach out regarding your operations.\n\nBest regards,\n{sender_name}",
    emailAction: "mailto",
    senderName: ""
  };

  const el = {};

  async function init() {
    cacheDom();
    bindEvents();
    loadPreferences();
    loadDatabase();

    // Check /Data folder automatically upon launch
    await scanDataFolder();

    renderAll();
  }

  function cacheDom() {
    el.dockButtons = document.querySelectorAll(".dock-item[data-view]");
    el.views = document.querySelectorAll(".app-view");
    el.topbarActiveListTitle = document.getElementById("topbar-active-list-title");
    el.topbarSyncStatus = document.getElementById("topbar-sync-status");
    el.globalSearch = document.getElementById("global-search-input");
    el.btnClearSearch = document.getElementById("btn-clear-search");
    el.btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
    el.workspaceGrid = document.getElementById("workspace-grid");
    el.workspaceResizer = document.getElementById("workspace-resizer");
    el.panelTable = document.querySelector(".panel-table");
    el.panelDesk = document.getElementById("panel-calling-desk");

    // Drawer & Table
    el.listsContainer = document.getElementById("lists-container");
    el.dispFiltersContainer = document.getElementById("disp-filters-container");
    el.tableHeadline = document.getElementById("table-headline-title");
    el.tableCountBadge = document.getElementById("table-lead-count-badge");
    el.tableSort = document.getElementById("select-table-sort");
    el.masterTbody = document.getElementById("leads-master-tbody");
    el.tableEmptyNotice = document.getElementById("table-empty-notice");

    // Desk
    el.emptyDeskState = document.getElementById("empty-desk-state");
    el.deskContent = document.getElementById("desk-content");
    el.leadPosCounter = document.getElementById("lead-pos-counter");
    el.dispActiveTag = document.getElementById("disp-active-tag");
    el.deskName = document.getElementById("desk-input-name");
    el.deskPhone = document.getElementById("desk-input-phone");
    el.deskEmail = document.getElementById("desk-input-email");
    el.deskWebsite = document.getElementById("desk-input-website");
    el.deskAddress = document.getElementById("desk-input-address");
    el.deskCallbackView = document.getElementById("desk-input-callback-view");
    el.deskNotes = document.getElementById("desk-input-notes");
    el.actionDial = document.getElementById("action-dial-btn");
    el.actionSubPhone = document.getElementById("action-sub-phone");
    el.actionEmail = document.getElementById("action-email-btn");
    el.actionSubEmail = document.getElementById("action-sub-email");
    el.btnDeskVisitSite = document.getElementById("btn-desk-visit-site");
    el.btnDeskViewMap = document.getElementById("btn-desk-view-map");
    el.callbackTray = document.getElementById("callback-tray");
    el.inputCallbackDt = document.getElementById("input-callback-dt");

    // Email Outgoing Template Form
    el.tplSubject = document.getElementById("tpl-subject");
    el.tplBody = document.getElementById("tpl-body");
    el.tplActionType = document.getElementById("tpl-action-type");
    el.tplSender = document.getElementById("tpl-sender");
    el.prevEmailTo = document.getElementById("prev-email-to");
    el.prevEmailSubject = document.getElementById("prev-email-subject");
    el.prevEmailBody = document.getElementById("prev-email-body");

    // Modals
    el.fileCsvLoader = document.getElementById("file-csv-loader");
    el.toast = document.getElementById("app-toast");
  }

  function bindEvents() {
    // Dock Navigation
    el.dockButtons.forEach(btn => {
      btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    document.getElementById("btn-open-settings").addEventListener("click", () => openModal("modal-settings"));
    document.getElementById("btn-open-hotkeys").addEventListener("click", () => openModal("modal-hotkeys"));

    // Sidebar Toggle
    el.btnToggleSidebar.addEventListener("click", toggleSidebar);

    // Workspace column resizing
    el.workspaceResizer.addEventListener("pointerdown", startWorkspaceResize);
    el.workspaceResizer.addEventListener("pointermove", resizeWorkspace);
    el.workspaceResizer.addEventListener("pointerup", endWorkspaceResize);
    el.workspaceResizer.addEventListener("pointercancel", endWorkspaceResize);
    el.workspaceResizer.addEventListener("keydown", handleWorkspaceResizeKeydown);

    // Global Search
    el.globalSearch.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      el.btnClearSearch.classList.toggle("hidden", searchQuery.length === 0);
      renderTable();
    });

    el.btnClearSearch.addEventListener("click", () => {
      el.globalSearch.value = "";
      searchQuery = "";
      el.btnClearSearch.classList.add("hidden");
      renderTable();
    });

    // Keyboard Shortcuts
    window.addEventListener("keydown", handleGlobalKeydown);

    // Sorting
    el.tableSort.addEventListener("change", (e) => {
      activeSort = e.target.value;
      renderTable();
    });

    // Lead Navigation in Desk
    document.getElementById("btn-step-prev").addEventListener("click", () => stepLead(-1));
    document.getElementById("btn-step-next").addEventListener("click", () => stepLead(1));

    // Live Field Auto-Save
    [el.deskName, el.deskPhone, el.deskEmail, el.deskWebsite, el.deskAddress, el.deskNotes].forEach(input => {
      input.addEventListener("input", saveLeadFromDesk);
    });

    // Dispositions (1-Click)
    document.querySelectorAll(".disp-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const disp = btn.dataset.disp;
        if (disp === "Callback Scheduled") {
          el.callbackTray.classList.toggle("hidden");
          const defaultDt = new Date();
          defaultDt.setDate(defaultDt.getDate() + 1);
          defaultDt.setHours(10, 0, 0, 0);
          el.inputCallbackDt.value = defaultDt.toISOString().slice(0, 16);
        } else {
          el.callbackTray.classList.add("hidden");
          applyDisposition(disp);
        }
      });
    });

    document.getElementById("btn-save-callback").addEventListener("click", () => {
      const dt = el.inputCallbackDt.value;
      el.callbackTray.classList.add("hidden");
      applyDisposition("Callback Scheduled", dt);
    });

    // Timestamp insertion
    document.getElementById("btn-desk-timestamp").addEventListener("click", insertTimestamp);

    // Delete Lead
    document.getElementById("btn-delete-lead").addEventListener("click", deleteCurrentLead);

    // Email Outgoing
    el.actionEmail.addEventListener("click", triggerOutgoingEmail);
    document.getElementById("btn-save-email-settings").addEventListener("click", saveEmailPreferences);
    [el.tplSubject, el.tplBody, el.tplSender].forEach(inp => inp.addEventListener("input", updateEmailPreview));

    // File Management
    document.getElementById("btn-trigger-import").addEventListener("click", () => el.fileCsvLoader.click());
    el.fileCsvLoader.addEventListener("change", handleCsvUpload);
    document.getElementById("btn-trigger-export").addEventListener("click", exportCsvFile);
    document.getElementById("file-backup-restore").addEventListener("change", handleRestoreBackup);

    // Re-scan buttons
    document.getElementById("btn-scan-repo").addEventListener("click", scanDataFolder);
    document.getElementById("btn-rescan-data-top").addEventListener("click", scanDataFolder);

    // List Creation
    document.getElementById("btn-create-list").addEventListener("click", promptNewList);

    // Lead Modal
    document.getElementById("btn-add-lead-modal").addEventListener("click", openAddLeadModal);
    document.getElementById("form-create-lead").addEventListener("submit", handleCreateNewLead);
  }

  // --- Keyboard Handler ---

  function handleGlobalKeydown(e) {
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName);

    if (e.key === "/" && !isTyping) {
      e.preventDefault();
      el.globalSearch.focus();
      return;
    }

    if ((e.key === "b" || e.key === "B") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    if (!isTyping) {
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); stepLead(1); }
      if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); stepLead(-1); }

      const keyMap = {
        "1": "No Answer",
        "2": "Left Voicemail",
        "3": "Gatekeeper",
        "4": "Not Interested",
        "5": "Callback Scheduled",
        "6": "Interested",
        "7": "Meeting Booked",
        "8": "Bad / Closed"
      };

      if (keyMap[e.key]) {
        if (keyMap[e.key] === "Callback Scheduled") {
          el.callbackTray.classList.remove("hidden");
          el.inputCallbackDt.focus();
        } else {
          applyDisposition(keyMap[e.key]);
        }
      }
    }
  }

  // --- Layout & View Navigation ---

  function switchView(viewId) {
    el.views.forEach(v => v.classList.remove("active"));
    el.dockButtons.forEach(b => b.classList.remove("active"));

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add("active");

    const targetBtn = document.querySelector(`.dock-item[data-view="${viewId}"]`);
    if (targetBtn) targetBtn.classList.add("active");

    if (viewId === "view-email") updateEmailPreview();
    if (viewId === "view-analytics") renderAnalytics();
  }

  function toggleSidebar() {
    el.workspaceGrid.classList.toggle("drawer-collapsed");
  }

  function startWorkspaceResize(event) {
    if (event.button !== 0) return;
    el.workspaceResizer.setPointerCapture(event.pointerId);
    el.workspaceGrid.classList.add("is-resizing");
    resizeWorkspace(event);
  }

  function resizeWorkspace(event) {
    if (!el.workspaceResizer.hasPointerCapture(event.pointerId)) return;

    const availableWidth = el.panelTable.clientWidth + el.panelDesk.clientWidth;
    if (availableWidth <= 0) return;

    const gridGap = parseFloat(getComputedStyle(el.workspaceGrid).columnGap) || 0;
    const dividerOffset = el.workspaceResizer.offsetWidth / 2 + gridGap;
    const tableWidth = event.clientX - el.panelTable.getBoundingClientRect().left - dividerOffset;
    const minRatio = Math.min(0.65, Math.max(0.2, 140 / availableWidth));
    const maxRatio = Math.max(minRatio, Math.min(0.65, 1 - 240 / availableWidth));
    const ratio = Math.max(minRatio, Math.min(maxRatio, tableWidth / availableWidth));
    setWorkspaceTableRatio(ratio, false);
  }

  function endWorkspaceResize(event) {
    if (el.workspaceResizer.hasPointerCapture(event.pointerId)) {
      el.workspaceResizer.releasePointerCapture(event.pointerId);
    }
    el.workspaceGrid.classList.remove("is-resizing");
    prefs.workspaceTableRatio = getWorkspaceTableRatio();
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  function handleWorkspaceResizeKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    const ratio = event.key === "Home"
      ? 0.2
      : event.key === "End"
        ? 0.65
        : getWorkspaceTableRatio() + (event.key === "ArrowRight" ? 0.02 : -0.02);
    setWorkspaceTableRatio(ratio, true);
  }

  function getWorkspaceTableRatio() {
    return parseFloat(el.workspaceGrid.style.getPropertyValue("--table-track")) || prefs.workspaceTableRatio;
  }

  function setWorkspaceTableRatio(ratio, persist) {
    const boundedRatio = Math.max(0.2, Math.min(0.65, ratio));
    const deskRatio = 1 - boundedRatio;
    el.workspaceGrid.style.setProperty("--table-track", `${boundedRatio}fr`);
    el.workspaceGrid.style.setProperty("--desk-track", `${deskRatio}fr`);
    el.workspaceResizer.setAttribute("aria-valuenow", String(Math.round(boundedRatio * 100)));

    if (persist) {
      prefs.workspaceTableRatio = boundedRatio;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }
  }

  // --- Data Loading & Preferences ---

  function loadPreferences() {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) prefs = { ...prefs, ...JSON.parse(saved) };
    } catch (e) {}

    const savedRatio = prefs.workspaceTableRatio;
    prefs.workspaceTableRatio = Number.isFinite(savedRatio)
      ? Math.max(0.2, Math.min(0.65, savedRatio))
      : 1 / 3;
    setWorkspaceTableRatio(prefs.workspaceTableRatio, false);

    applyThemeAndDensity();

    document.getElementById("setting-theme").value = prefs.theme;
    document.getElementById("setting-density").value = prefs.density;
    document.getElementById("setting-auto-advance").checked = prefs.autoAdvance;
    document.getElementById("setting-advance-delay").value = prefs.advanceDelay || 200;
    document.getElementById("setting-auto-timestamp").checked = prefs.autoTimestamp;
    document.getElementById("setting-dial-prefix").value = prefs.dialPrefix || "";
    document.getElementById("setting-csv-delimiter").value = prefs.csvDelimiter || ",";
    document.getElementById("setting-export-scope").value = prefs.exportScope || "all";
    document.getElementById("setting-excel-bom").checked = prefs.excelBom;

    el.tplSubject.value = prefs.emailSubject;
    el.tplBody.value = prefs.emailBody;
    el.tplActionType.value = prefs.emailAction;
    el.tplSender.value = prefs.senderName || "";
  }

  function applyThemeAndDensity() {
    document.body.className = `${prefs.theme} ${prefs.density}`;
  }

  function savePreferencesFromModal() {
    prefs.theme = document.getElementById("setting-theme").value;
    prefs.density = document.getElementById("setting-density").value;
    prefs.autoAdvance = document.getElementById("setting-auto-advance").checked;
    prefs.advanceDelay = parseInt(document.getElementById("setting-advance-delay").value, 10) || 200;
    prefs.autoTimestamp = document.getElementById("setting-auto-timestamp").checked;
    prefs.dialPrefix = document.getElementById("setting-dial-prefix").value.trim();
    prefs.csvDelimiter = document.getElementById("setting-csv-delimiter").value;
    prefs.exportScope = document.getElementById("setting-export-scope").value;
    prefs.excelBom = document.getElementById("setting-excel-bom").checked;

    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    applyThemeAndDensity();
    closeModal("modal-settings");
    renderTable();
    showToast("Preferences saved.");
  }

  function loadDatabase() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        lists = JSON.parse(raw);
      } else {
        lists = {}; // Absolutely no mock data
      }
    } catch (e) {
      lists = {};
    }
    currentListName = Object.keys(lists)[0] || "";
  }

  function persistDatabase() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
      el.topbarSyncStatus.textContent = "Saved " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {}
  }

  /**
   * Proactively queries the repository's /Data folder for CSV files
   */
  async function scanDataFolder() {
    el.topbarSyncStatus.textContent = "Checking /Data...";

    // Broad matrix of possible files and casings in /Data/
    const candidateFiles = [
      "Plumbers.csv", "plumbers.csv",
      "Electricians.csv", "electricians.csv",
      "Commercial Electricians.csv", "commercial electricians.csv",
      "Commercial_Electricians.csv", "commercial_electricians.csv",
      "Accountants.csv", "accountants.csv",
      "Dentists.csv", "dentists.csv",
      "Leads.csv", "leads.csv",
      "Prospects.csv", "prospects.csv",
      "Data.csv", "data.csv",
      "Clients.csv", "clients.csv",
      "Contacts.csv", "contacts.csv"
    ];

    let foundCount = 0;

    for (const fileName of candidateFiles) {
      // Probing relative variants
      const candidatePaths = [
        `Data/${fileName}`,
        `/Data/${fileName}`,
        `./Data/${fileName}`
      ];

      for (const path of candidatePaths) {
        try {
          const resp = await fetch(path, { cache: "no-store" });
          if (resp.ok) {
            const csvText = await resp.text();
            // Derive clean list name (e.g., "Plumbers")
            const cleanTitle = fileName
              .replace(/\.csv$/i, "")
              .replace(/_/g, " ")
              .replace(/\b\w/g, l => l.toUpperCase());

            const parsedLeads = parseCsvToLeads(csvText);
            if (parsedLeads.length > 0) {
              // If list doesn't exist, or has no leads yet, load it in
              if (!lists[cleanTitle] || lists[cleanTitle].length === 0) {
                lists[cleanTitle] = parsedLeads;
                foundCount++;
              }
            }
            break; // Stop testing other path variants for this file once resolved
          }
        } catch (err) {
          // fetch error on file:// or 404 handled silently
        }
      }
    }

    if (foundCount > 0) {
      if (!currentListName || !lists[currentListName]) {
        currentListName = Object.keys(lists)[0];
      }
      persistDatabase();
      renderAll();
      showToast(`Successfully imported ${foundCount} lists from /Data folder.`);
    } else {
      if (Object.keys(lists).length === 0) {
        el.topbarSyncStatus.textContent = "No /Data files found";
      } else {
        el.topbarSyncStatus.textContent = "Up to date";
      }
    }
  }

  // --- Smart Robust CSV Parser & Exporter ---

  function parseCsvToLeads(csvText) {
    const rows = parseCsvRows(csvText);
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idxName = headers.findIndex(h => h.includes("name") || h.includes("company") || h.includes("business"));
    const idxPhone = headers.findIndex(h => h.includes("phone") || h.includes("tel") || h.includes("mobile") || h.includes("number"));
    const idxEmail = headers.findIndex(h => h.includes("email") || h.includes("mail"));
    const idxWebsite = headers.findIndex(h => h.includes("web") || h.includes("site") || h.includes("url"));
    const idxAddress = headers.findIndex(h => h.includes("address") || h.includes("city") || h.includes("location") || h.includes("postcode"));
    const idxNotes = headers.findIndex(h => h.includes("note") || h.includes("comment") || h.includes("desc"));
    const idxDisp = headers.findIndex(h => h.includes("status") || h.includes("disp") || h.includes("stage"));
    const idxCallback = headers.findIndex(h => h.includes("callback") || h.includes("followup"));

    const leads = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || !row.some(val => val.trim())) continue;

      leads.push({
        id: "l_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        name: (idxName !== -1 && row[idxName]) ? row[idxName].trim() : (row[0] || `Lead ${i}`),
        phone: (idxPhone !== -1 && row[idxPhone]) ? row[idxPhone].trim() : "",
        email: (idxEmail !== -1 && row[idxEmail]) ? row[idxEmail].trim() : "",
        website: (idxWebsite !== -1 && row[idxWebsite]) ? row[idxWebsite].trim() : "",
        address: (idxAddress !== -1 && row[idxAddress]) ? row[idxAddress].trim() : "",
        notes: (idxNotes !== -1 && row[idxNotes]) ? row[idxNotes].trim() : "",
        disposition: (idxDisp !== -1 && row[idxDisp]) ? row[idxDisp].trim() : "New",
        callback_date: (idxCallback !== -1 && row[idxCallback]) ? row[idxCallback].trim() : ""
      });
    }
    return leads;
  }

  function parseCsvRows(text) {
    const lines = [];
    let row = [""];
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
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== '') lines.push(row);
    return lines;
  }

  function handleCsvUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const listName = file.name.replace(/\.csv$/i, "");
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target.result;
        const leads = parseCsvToLeads(text);
        if (leads.length > 0) {
          lists[listName] = leads;
          currentListName = listName;
          persistDatabase();
          renderAll();
          showToast(`Imported ${leads.length} records into "${listName}".`);
        } else {
          showToast(`No lead records identified in "${file.name}".`);
        }
      };
      reader.readAsText(file);
    });
    el.fileCsvLoader.value = "";
  }

  function exportCsvFile() {
    const leadsToExport = (prefs.exportScope === "filtered") ? getFilteredLeads() : (lists[currentListName] || []);
    if (leadsToExport.length === 0) {
      showToast("No leads available to export.");
      return;
    }

    const delim = prefs.csvDelimiter || ",";
    const headers = ["Business Name", "Telephone", "Email", "Website", "Full Address", "Disposition", "Callback Date", "Notes"];
    const rows = [headers.join(delim)];

    leadsToExport.forEach(l => {
      rows.push([
        formatCsvCell(l.name, delim),
        formatCsvCell(l.phone, delim),
        formatCsvCell(l.email, delim),
        formatCsvCell(l.website, delim),
        formatCsvCell(l.address, delim),
        formatCsvCell(l.disposition, delim),
        formatCsvCell(l.callback_date, delim),
        formatCsvCell(l.notes, delim)
      ].join(delim));
    });

    let csvContent = rows.join("\r\n");
    if (prefs.excelBom) csvContent = "\uFEFF" + csvContent;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentListName || "prospects"}_export.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${leadsToExport.length} prospects.`);
  }

  function formatCsvCell(val, delim) {
    if (!val) return '""';
    const str = String(val).replace(/"/g, '""');
    if (str.includes(delim) || str.includes('\n') || str.includes('"')) {
      return `"${str}"`;
    }
    return `"${str}"`;
  }

  // --- Render Views ---

  function renderAll() {
    renderSidebarDrawer();
    renderTable();
    updateEmailPreview();
  }

  function renderSidebarDrawer() {
    const listNames = Object.keys(lists);
    if (!currentListName || !lists[currentListName]) currentListName = listNames[0] || "";

    el.topbarActiveListTitle.textContent = currentListName || "No Active List";

    // Folders
    let listHtml = "";
    if (listNames.length === 0) {
      listHtml = `<div style="padding: 10px 8px; font-size: 11px; color: var(--text-light); text-align: center;">No lists loaded.<br>Click "Scan /Data" or import a CSV.</div>`;
    } else {
      listNames.forEach(name => {
        const activeCls = name === currentListName ? "active" : "";
        listHtml += `
          <button class="nav-list-item ${activeCls}" data-name="${escapeHtml(name)}">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📁 ${escapeHtml(name)}</span>
            <span class="count-tag">${lists[name].length}</span>
          </button>
        `;
      });
    }
    el.listsContainer.innerHTML = listHtml;

    el.listsContainer.querySelectorAll(".nav-list-item").forEach(btn => {
      btn.addEventListener("click", () => {
        currentListName = btn.dataset.name;
        renderSidebarDrawer();
        renderTable();
      });
    });

    // Dispositions Counts
    const activeList = lists[currentListName] || [];
    const counts = {
      ALL: activeList.length,
      "New": 0,
      "Callback Scheduled": 0,
      "Interested": 0,
      "Meeting Booked": 0,
      "Left Voicemail": 0,
      "No Answer": 0,
      "Gatekeeper": 0,
      "Not Interested": 0,
      "Bad / Closed": 0
    };

    activeList.forEach(l => {
      if (counts[l.disposition] !== undefined) counts[l.disposition]++;
    });

    const dispKeys = ["ALL", "New", "Callback Scheduled", "Interested", "Meeting Booked", "Left Voicemail", "No Answer", "Gatekeeper", "Not Interested", "Bad / Closed"];
    let dispHtml = "";
    dispKeys.forEach(key => {
      const activeCls = key === activeFilter ? "active" : "";
      const label = key === "ALL" ? "All Records" : key;
      dispHtml += `
        <button class="nav-disp-item ${activeCls}" data-disp="${key}">
          <span>${label}</span>
          <span class="count-tag">${counts[key] || 0}</span>
        </button>
      `;
    });
    el.dispFiltersContainer.innerHTML = dispHtml;

    el.dispFiltersContainer.querySelectorAll(".nav-disp-item").forEach(btn => {
      btn.addEventListener("click", () => {
        activeFilter = btn.dataset.disp;
        renderSidebarDrawer();
        renderTable();
      });
    });
  }

  function getFilteredLeads() {
    const list = lists[currentListName] || [];
    let res = [...list];

    if (activeFilter !== "ALL") {
      res = res.filter(l => (l.disposition || "New") === activeFilter);
    }

    if (searchQuery) {
      res = res.filter(l => 
        (l.name || "").toLowerCase().includes(searchQuery) ||
        (l.phone || "").toLowerCase().includes(searchQuery) ||
        (l.email || "").toLowerCase().includes(searchQuery) ||
        (l.address || "").toLowerCase().includes(searchQuery) ||
        (l.notes || "").toLowerCase().includes(searchQuery)
      );
    }

    if (activeSort === "name_asc") res.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (activeSort === "name_desc") res.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    else if (activeSort === "disposition") res.sort((a, b) => (a.disposition || "").localeCompare(b.disposition || ""));
    else if (activeSort === "callback") res.sort((a, b) => (b.callback_date || "").localeCompare(a.callback_date || ""));

    return res;
  }

  function renderTable() {
    const leads = getFilteredLeads();
    el.tableHeadline.textContent = currentListName || "Leads";
    el.tableCountBadge.textContent = leads.length;

    if (leads.length === 0) {
      el.masterTbody.innerHTML = "";
      el.tableEmptyNotice.classList.remove("hidden");
      populateDesk(null);
      return;
    }

    el.tableEmptyNotice.classList.add("hidden");

    let rowsHtml = "";
    leads.forEach((l, idx) => {
      const isSelected = l.id === currentLeadId ? "selected" : "";
      const dispCls = "disp-" + (l.disposition || "New").replace(/[^a-zA-Z]/g, "");
      rowsHtml += `
        <tr class="${isSelected}" data-id="${l.id}">
          <td style="color:var(--text-light); font-family:var(--font-mono); font-size:11px;">${idx + 1}</td>
          <td><strong>${escapeHtml(l.name)}</strong></td>
          <td><span style="font-family:var(--font-mono);">${escapeHtml(l.phone || "—")}</span></td>
          <td><span class="badge-status ${dispCls}">${escapeHtml(l.disposition || "New")}</span></td>
          <td>${escapeHtml(l.address || "—")}</td>
        </tr>
      `;
    });

    el.masterTbody.innerHTML = rowsHtml;

    el.masterTbody.querySelectorAll("tr").forEach(tr => {
      tr.addEventListener("click", () => selectLead(tr.dataset.id));
    });

    if (!currentLeadId || !leads.some(l => l.id === currentLeadId)) {
      selectLead(leads[0].id);
    } else {
      populateDesk(currentLeadId);
    }
  }

  function selectLead(leadId) {
    currentLeadId = leadId;
    el.masterTbody.querySelectorAll("tr").forEach(r => {
      r.classList.toggle("selected", r.dataset.id === leadId);
    });
    populateDesk(leadId);
    updateEmailPreview();
  }

  function populateDesk(leadId) {
    const activeList = lists[currentListName] || [];
    const lead = activeList.find(l => l.id === leadId);

    if (!lead) {
      el.emptyDeskState.classList.remove("hidden");
      el.deskContent.classList.add("hidden");
      return;
    }

    el.emptyDeskState.classList.add("hidden");
    el.deskContent.classList.remove("hidden");

    const filtered = getFilteredLeads();
    const currIdx = filtered.findIndex(l => l.id === leadId);
    el.leadPosCounter.textContent = `${currIdx + 1} of ${filtered.length}`;

    el.deskName.value = lead.name || "";
    el.deskPhone.value = lead.phone || "";
    el.deskEmail.value = lead.email || "";
    el.deskWebsite.value = lead.website || "";
    el.deskAddress.value = lead.address || "";
    el.deskNotes.value = lead.notes || "";
    el.deskCallbackView.value = lead.callback_date ? new Date(lead.callback_date).toLocaleString() : "None";
    el.dispActiveTag.textContent = lead.disposition || "New";

    // Telephony link
    if (lead.phone) {
      const dialNum = (prefs.dialPrefix && !lead.phone.startsWith("+")) ? prefs.dialPrefix + lead.phone : lead.phone;
      el.actionDial.href = `tel:${dialNum.replace(/\s+/g, "")}`;
      el.actionSubPhone.textContent = lead.phone;
      el.actionDial.style.opacity = "1";
      el.actionDial.style.pointerEvents = "auto";
    } else {
      el.actionDial.removeAttribute("href");
      el.actionSubPhone.textContent = "No number provided";
      el.actionDial.style.opacity = "0.4";
      el.actionDial.style.pointerEvents = "none";
    }

    el.actionSubEmail.textContent = lead.email ? lead.email : "Compose email";

    if (lead.website) {
      let url = lead.website.trim();
      if (!url.startsWith("http")) url = "https://" + url;
      el.btnDeskVisitSite.href = url;
    } else {
      el.btnDeskVisitSite.removeAttribute("href");
    }

    if (lead.address || lead.name) {
      el.btnDeskViewMap.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.name + " " + lead.address)}`;
    }
  }

  function saveLeadFromDesk() {
    const activeList = lists[currentListName];
    if (!activeList || !currentLeadId) return;

    const lead = activeList.find(l => l.id === currentLeadId);
    if (!lead) return;

    lead.name = el.deskName.value.trim() || "Untitled Lead";
    lead.phone = el.deskPhone.value.trim();
    lead.email = el.deskEmail.value.trim();
    lead.website = el.deskWebsite.value.trim();
    lead.address = el.deskAddress.value.trim();
    lead.notes = el.deskNotes.value;

    persistDatabase();

    const row = el.masterTbody.querySelector(`tr[data-id="${lead.id}"]`);
    if (row) {
      const cells = row.querySelectorAll("td");
      if (cells[1]) cells[1].innerHTML = `<strong>${escapeHtml(lead.name)}</strong>`;
      if (cells[2]) cells[2].innerHTML = `<span style="font-family:var(--font-mono);">${escapeHtml(lead.phone || "—")}</span>`;
      if (cells[4]) cells[4].textContent = lead.address || "—";
    }

    updateEmailPreview();
  }

  function applyDisposition(status, callbackDt = "") {
    const activeList = lists[currentListName];
    if (!activeList || !currentLeadId) return;

    const lead = activeList.find(l => l.id === currentLeadId);
    if (!lead) return;

    lead.disposition = status;
    if (callbackDt) {
      lead.callback_date = callbackDt;
      el.deskCallbackView.value = new Date(callbackDt).toLocaleString();
    }

    if (prefs.autoTimestamp) {
      const stamp = `\n[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] Status: ${status}`;
      lead.notes = (lead.notes ? lead.notes + stamp : stamp.trim());
      el.deskNotes.value = lead.notes;
    }

    el.dispActiveTag.textContent = status;
    persistDatabase();
    renderSidebarDrawer();
    renderTable();
    showToast(`Logged: ${status}`);

    if (prefs.autoAdvance) {
      setTimeout(() => stepLead(1), prefs.advanceDelay || 200);
    }
  }

  function insertTimestamp() {
    const stamp = `\n[${new Date().toLocaleString()}] `;
    el.deskNotes.value = (el.deskNotes.value ? el.deskNotes.value + stamp : stamp.trim());
    saveLeadFromDesk();
    el.deskNotes.focus();
  }

  function stepLead(delta) {
    const leads = getFilteredLeads();
    if (leads.length === 0) return;

    let idx = leads.findIndex(l => l.id === currentLeadId);
    if (idx === -1) idx = 0;

    let target = idx + delta;
    if (target < 0) target = 0;
    if (target >= leads.length) target = leads.length - 1;

    selectLead(leads[target].id);

    const tr = el.masterTbody.querySelector(`tr[data-id="${leads[target].id}"]`);
    if (tr) tr.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function deleteCurrentLead() {
    if (!currentLeadId || !confirm("Delete this lead record permanently?")) return;

    const activeList = lists[currentListName];
    const idx = activeList.findIndex(l => l.id === currentLeadId);
    if (idx !== -1) {
      activeList.splice(idx, 1);
      persistDatabase();
      renderSidebarDrawer();
      renderTable();
      showToast("Prospect removed.");
    }
  }

  function promptNewList() {
    const name = prompt("Enter title for the new prospect list:");
    if (!name || !name.trim()) return;
    const clean = name.trim();
    if (lists[clean]) {
      showToast("A list with that name already exists.");
      return;
    }
    lists[clean] = [];
    currentListName = clean;
    persistDatabase();
    renderSidebarDrawer();
    renderTable();
    showToast(`Created "${clean}".`);
  }

  // --- Outreach Email System ---

  function updateEmailPreview() {
    const activeList = lists[currentListName] || [];
    const lead = activeList.find(l => l.id === currentLeadId) || activeList[0] || {
      name: "Acme Industrial",
      phone: "029 2012 3456",
      email: "director@acme.com",
      address: "10 High St, Cardiff"
    };

    const renderedSubject = renderTemplateTags(el.tplSubject.value || prefs.emailSubject, lead);
    const renderedBody = renderTemplateTags(el.tplBody.value || prefs.emailBody, lead);

    el.prevEmailTo.textContent = lead.email || "No email on record";
    el.prevEmailSubject.textContent = renderedSubject;
    el.prevEmailBody.textContent = renderedBody;
  }

  function renderTemplateTags(str, lead) {
    if (!str) return "";
    return str
      .replace(/{business_name}/gi, lead.name || "your business")
      .replace(/{phone}/gi, lead.phone || "")
      .replace(/{email}/gi, lead.email || "")
      .replace(/{address}/gi, lead.address || "")
      .replace(/{sender_name}/gi, prefs.senderName || "");
  }

  function saveEmailPreferences() {
    prefs.emailSubject = el.tplSubject.value.trim();
    prefs.emailBody = el.tplBody.value;
    prefs.emailAction = el.tplActionType.value;
    prefs.senderName = el.tplSender.value.trim();
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    updateEmailPreview();
    showToast("Email template saved.");
  }

  function triggerOutgoingEmail() {
    const activeList = lists[currentListName] || [];
    const lead = activeList.find(l => l.id === currentLeadId);
    if (!lead || !lead.email) {
      showToast("Please provide an email address for this prospect first.");
      return;
    }

    const subject = renderTemplateTags(prefs.emailSubject, lead);
    const body = renderTemplateTags(prefs.emailBody, lead);

    if (prefs.emailAction === "clipboard") {
      navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).then(() => {
        showToast("Email content copied to clipboard.");
      });
    } else {
      const mailtoUrl = `mailto:${encodeURIComponent(lead.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailtoUrl;
    }
  }

  // --- Analytics ---

  function renderAnalytics() {
    const allLeads = Object.values(lists).flat();
    document.getElementById("stat-all-leads").textContent = allLeads.length;

    let meetings = 0;
    let callbacks = 0;
    let interested = 0;
    const stages = {};

    allLeads.forEach(l => {
      const disp = l.disposition || "New";
      stages[disp] = (stages[disp] || 0) + 1;
      if (disp === "Meeting Booked") meetings++;
      if (disp === "Callback Scheduled") callbacks++;
      if (disp === "Interested") interested++;
    });

    document.getElementById("stat-meetings").textContent = meetings;
    document.getElementById("stat-callbacks").textContent = callbacks;
    document.getElementById("stat-interested").textContent = interested;

    const max = Math.max(...Object.values(stages), 1);
    let html = "";
    Object.keys(stages).forEach(stage => {
      const count = stages[stage];
      const pct = Math.round((count / max) * 100);
      html += `
        <div class="funnel-bar-line">
          <span class="funnel-tag">${stage}</span>
          <div class="funnel-rail"><div class="funnel-fill" style="width:${pct}%"></div></div>
          <span class="funnel-qty">${count}</span>
        </div>
      `;
    });
    document.getElementById("analytics-funnel-bars").innerHTML = html;
  }

  // --- Backup & Restore ---

  function downloadFullBackup() {
    const backupObj = {
      format: "AURELIUS_CRM_BACKUP",
      version: 4,
      timestamp: new Date().toISOString(),
      lists,
      prefs
    };

    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Aurelius_CRM_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup exported.");
  }

  function handleRestoreBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.lists) {
          lists = parsed.lists;
          if (parsed.prefs) prefs = { ...prefs, ...parsed.prefs };
          persistDatabase();
          localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
          loadPreferences();
          renderAll();
          closeModal("modal-settings");
          showToast("Database restored successfully.");
        }
      } catch (err) {
        showToast("Invalid JSON backup file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function resetLocalDatabase() {
    if (confirm("Reset local storage and re-scan the /Data folder?")) {
      localStorage.removeItem(STORAGE_KEY);
      lists = {};
      currentListName = "";
      currentLeadId = null;
      scanDataFolder().then(() => {
        renderAll();
        closeModal("modal-settings");
        showToast("Database reset. Checked /Data folder.");
      });
    }
  }

  // --- Add Prospect Modal ---

  function openAddLeadModal() {
    const select = document.getElementById("new-lead-target-list");
    select.innerHTML = "";

    const names = Object.keys(lists);
    if (names.length === 0) {
      lists["Prospects"] = [];
      currentListName = "Prospects";
    }

    Object.keys(lists).forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === currentListName) opt.selected = true;
      select.appendChild(opt);
    });
    document.getElementById("form-create-lead").reset();
    openModal("modal-add-lead");
  }

  function handleCreateNewLead(e) {
    e.preventDefault();
    const targetList = document.getElementById("new-lead-target-list").value;
    if (!targetList || !lists[targetList]) return;

    const newLead = {
      id: "lead_" + Date.now(),
      name: document.getElementById("new-lead-name").value.trim(),
      phone: document.getElementById("new-lead-phone").value.trim(),
      email: document.getElementById("new-lead-email").value.trim(),
      website: document.getElementById("new-lead-website").value.trim(),
      address: document.getElementById("new-lead-address").value.trim(),
      disposition: document.getElementById("new-lead-disposition").value,
      notes: document.getElementById("new-lead-notes").value.trim(),
      callback_date: ""
    };

    lists[targetList].unshift(newLead);
    currentListName = targetList;
    persistDatabase();
    closeModal("modal-add-lead");
    renderSidebarDrawer();
    renderTable();
    selectLead(newLead.id);
    showToast("Prospect added.");
  }

  // --- Helpers ---

  function openModal(id) { document.getElementById(id).classList.remove("hidden"); }
  function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    el.toast.style.opacity = "1";
    setTimeout(() => {
      el.toast.style.opacity = "0";
      setTimeout(() => el.toast.classList.add("hidden"), 300);
    }, 2400);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return {
    init,
    scanDataFolder,
    openModal,
    closeModal,
    stepLead,
    savePreferencesFromModal,
    downloadFullBackup,
    resetLocalDatabase,
    triggerOutgoingEmail
  };
})();

document.addEventListener("DOMContentLoaded", CRM.init);