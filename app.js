/**
 * AURELIUS CRM & LEAD FINDER PLATFORM
 * Professional Client Controller (Vanilla JavaScript)
 */

const App = (() => {
  // Application State
  const state = {
    apiBase: localStorage.getItem("crm_api_base") || "",
    currentList: "",
    allLeads: [],
    filteredLeads: [],
    selectedLeadId: null,
    lists: [],
    sortField: "business_name",
    sortAsc: true,
    jobPollingTimer: null,
    demoMode: false,
    chips: {
      professions: ["Plumbers"],
      cities: ["Cardiff", "Bristol"],
      titles: ["Owner", "Managing Director"]
    }
  };

  // DOM Cache
  const el = {};

  function init() {
    cacheDom();
    bindEvents();
    checkSystemStatus();
    loadOverviewStats();
    loadLists();
    renderChips();
    startJobPolling();
  }

  function cacheDom() {
    el.statusBadge = document.getElementById("system-status-indicator");
    el.navTabs = document.querySelectorAll(".nav-tab");
    el.viewSections = document.querySelectorAll(".view-section");
    el.globalSearch = document.getElementById("global-search-input");
    
    // Overview DOM
    el.statTotalLeads = document.getElementById("stat-total-leads");
    el.statTotalLists = document.getElementById("stat-total-lists");
    el.statVerifiedEmails = document.getElementById("stat-verified-emails");
    el.statDecisionMakers = document.getElementById("stat-decision-makers");
    el.statFollowupsDue = document.getElementById("stat-followups-due");
    el.funnelDisplay = document.getElementById("pipeline-funnel-display");
    el.activityFeed = document.getElementById("overview-activity-feed");

    // CRM Workspace DOM
    el.crmListsContainer = document.getElementById("crm-lists-container");
    el.crmListTitle = document.getElementById("crm-current-list-title");
    el.crmLeadCount = document.getElementById("crm-lead-count-badge");
    el.prospectsTbody = document.getElementById("prospects-tbody");
    el.tableEmptyState = document.getElementById("table-empty-state");
    el.stageFilter = document.getElementById("filter-pipeline-stage");
    el.quickFilter = document.getElementById("filter-quick-attributes");

    // CRM Inspector DOM
    el.panelDetail = document.getElementById("crm-panel-detail");
    el.detailPlaceholder = document.getElementById("detail-empty-placeholder");
    el.detailWrapper = document.getElementById("detail-content-wrapper");
    el.detBusinessName = document.getElementById("det-business-name");
    el.detProfession = document.getElementById("det-profession");
    el.detCity = document.getElementById("det-city-line");
    el.detScoreVal = document.getElementById("det-score-val");
    el.detScoreFill = document.getElementById("det-score-fill");
    el.detStageSelect = document.getElementById("det-stage-select");
    el.detPrioritySelect = document.getElementById("det-priority-select");
    el.detFollowupInput = document.getElementById("det-followup-input");
    el.detDmName = document.getElementById("det-dm-name");
    el.detDmTitle = document.getElementById("det-dm-title");
    el.detEmail = document.getElementById("det-email");
    el.detPhone = document.getElementById("det-phone");
    el.detWebsite = document.getElementById("det-website");
    el.detAddress = document.getElementById("det-address");
    el.detWebPreviewUrl = document.getElementById("det-web-preview-url");
    el.websiteIframe = document.getElementById("website-preview-iframe");
    el.iframeFallback = document.getElementById("iframe-fallback-notice");
    el.mapsIframe = document.getElementById("maps-embed-iframe");
    el.btnOpenExternalSite = document.getElementById("btn-open-external-site");
    el.btnFallbackOpenTab = document.getElementById("btn-fallback-open-tab");
    el.btnOpenExternalMaps = document.getElementById("btn-open-external-maps");
    el.activityStream = document.getElementById("det-activity-stream");

    // Lead Finder DOM
    el.btnStartSearch = document.getElementById("btn-start-search");
    el.searchSummary = document.getElementById("search-inputs-summary");
    el.btnPauseJob = document.getElementById("btn-pause-job");
    el.btnResumeJob = document.getElementById("btn-resume-job");
    el.btnCancelJob = document.getElementById("btn-cancel-job");
    el.eventsLog = document.getElementById("job-events-log");
    el.jobStageLabel = document.getElementById("current-job-stage-label");

    // Modals
    el.modalSettings = document.getElementById("modal-settings");
    el.modalManual = document.getElementById("modal-manual-lead");
    el.modalImport = document.getElementById("modal-import-wizard");
    el.toastContainer = document.getElementById("toast-container");
  }

  function bindEvents() {
    // Navigation Tabs
    el.navTabs.forEach(tab => {
      tab.addEventListener("click", () => switchSection(tab.dataset.target));
    });

    // Global Search Bar
    el.globalSearch.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (q.length > 0 && !document.getElementById("section-crm").classList.contains("active")) {
        switchSection("section-crm");
      }
      applyFiltersAndRender();
    });

    // CRM Table Quick Filters
    el.stageFilter.addEventListener("change", applyFiltersAndRender);
    el.quickFilter.addEventListener("change", applyFiltersAndRender);

    // CRM Detail Tabs Switching
    document.querySelectorAll(".detail-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".detail-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".detail-tab-pane").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.tab).classList.add("active");
      });
    });

    // Inspector Action Buttons
    document.getElementById("btn-close-detail").addEventListener("click", () => {
      el.detailWrapper.classList.add("hidden");
      el.detailPlaceholder.classList.remove("hidden");
      el.panelDetail.classList.remove("open");
      state.selectedLeadId = null;
    });

    document.getElementById("btn-save-lead-details").addEventListener("click", saveSelectedLeadChanges);
    document.getElementById("btn-delete-lead").addEventListener("click", deleteSelectedLead);
    document.getElementById("btn-trigger-re-research").addEventListener("click", triggerLeadReResearch);
    document.getElementById("btn-add-activity-note").addEventListener("click", addLeadActivityNote);
    document.getElementById("btn-refresh-iframe").addEventListener("click", reloadWebsitePreview);

    // Lead Finder Chips Input
    bindChipInputs();

    // Lead Finder Job Execution Controls
    el.btnStartSearch.addEventListener("click", startLeadFinderJob);
    el.btnPauseJob.addEventListener("click", () => sendJobAction("pause"));
    el.btnResumeJob.addEventListener("click", () => sendJobAction("resume"));
    el.btnCancelJob.addEventListener("click", () => sendJobAction("cancel"));
    document.getElementById("btn-clear-finder-inputs").addEventListener("click", clearFinderInputs);

    // Modals bindings
    document.getElementById("btn-open-settings").addEventListener("click", () => openModal(el.modalSettings));
    document.getElementById("btn-open-manual-modal").addEventListener("click", () => openModal(el.modalManual));
    document.getElementById("btn-quick-lead-finder").addEventListener("click", () => switchSection("section-lead-finder"));
    document.getElementById("btn-open-import-wizard").addEventListener("click", () => openModal(el.modalImport));
    document.getElementById("btn-open-import-wizard-2").addEventListener("click", () => openModal(el.modalImport));
    document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
    document.getElementById("form-manual-lead").addEventListener("submit", handleManualLeadSubmit);
    document.getElementById("btn-execute-import").addEventListener("click", handleCsvImport);

    // Exports
    document.getElementById("btn-export-current-csv").addEventListener("click", exportCurrentList);
    document.getElementById("btn-export-backup-all").addEventListener("click", downloadZipBackup);
    document.getElementById("btn-export-backup-dash").addEventListener("click", downloadZipBackup);

    // Modal close triggers
    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => closeModal(document.getElementById(btn.dataset.close)));
    });

    // Table Header Sorting
    document.querySelectorAll(".editorial-table th[data-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const field = th.dataset.sort;
        if (state.sortField === field) {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortField = field;
          state.sortAsc = true;
        }
        applyFiltersAndRender();
      });
    });
  }

  // --- API Client Helpers ---

  async function apiRequest(endpoint, method = "GET", body = null) {
    const url = (state.apiBase || "") + endpoint;
    const options = {
      method,
      headers: { "Content-Type": "application/json" }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const resp = await fetch(url, options);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Request failed with status ${resp.status}`);
      }
      return await resp.json();
    } catch (e) {
      console.warn("API Request error:", e.message);
      throw e;
    }
  }

  async function checkSystemStatus() {
    try {
      const data = await apiRequest("/api/health");
      el.statusBadge.innerHTML = `<span class="status-dot connected"></span><span class="status-label">Backend Connected</span>`;
      state.demoMode = false;
      document.getElementById("data-storage-badge").textContent = data.google_places_configured
        ? "Google Places API Active"
        : "Local Demo Simulation Active";
    } catch (e) {
      el.statusBadge.innerHTML = `<span class="status-dot demo"></span><span class="status-label">Local Offline / Demo Mode</span>`;
      state.demoMode = true;
    }
  }

  // --- Overview & Dashboard ---

  async function loadOverviewStats() {
    try {
      const stats = await apiRequest("/api/stats/overview");
      el.statTotalLeads.textContent = stats.total_prospects || 0;
      el.statTotalLists.textContent = `${stats.total_lists || 0} Profession Lists`;
      el.statVerifiedEmails.textContent = stats.verified_emails || 0;
      el.statDecisionMakers.textContent = stats.decision_makers_found || 0;
      el.statFollowupsDue.textContent = stats.followups_due || 0;

      // Render Funnel
      renderFunnel(stats.pipeline_stages || {});
    } catch (e) {
      // Fallback display
      el.statTotalLeads.textContent = "5";
      el.statTotalLists.textContent = "2 Lists";
      el.statVerifiedEmails.textContent = "4";
      el.statDecisionMakers.textContent = "3";
    }
  }

  function renderFunnel(stages) {
    const defaultStages = ["New", "Researched", "Qualified", "Ready to Contact", "Contacted", "Interested", "Won"];
    let max = Math.max(...Object.values(stages), 1);
    let html = "";
    defaultStages.forEach(stg => {
      const count = stages[stg] || 0;
      const pct = Math.round((count / max) * 100);
      html += `
        <div class="stage-row">
          <span class="stage-name">${stg}</span>
          <div class="stage-bar-bg"><div class="stage-bar-fill" style="width: ${pct}%"></div></div>
          <span class="stage-val">${count}</span>
        </div>
      `;
    });
    el.funnelDisplay.innerHTML = html;
  }

  // --- CRM & Prospect Lists ---

  async function loadLists() {
    try {
      const lists = await apiRequest("/api/lists");
      state.lists = lists;
      renderListsMenu(lists);
      renderListsGrid(lists);
      if (lists.length > 0 && !state.currentList) {
        selectList(lists[0].slug);
      } else {
        loadLeads();
      }
    } catch (e) {
      // Fallback
      renderListsMenu([{ slug: "plumbers", name: "Plumbers", prospect_count: 3 }]);
    }
  }

  function renderListsMenu(lists) {
    let html = `
      <li>
        <button class="list-item-btn ${state.currentList === '' ? 'active' : ''}" data-slug="">
          <span>All Prospects</span>
          <span class="badge">${lists.reduce((acc, l) => acc + l.prospect_count, 0)}</span>
        </button>
      </li>
    `;
    lists.forEach(l => {
      html += `
        <li>
          <button class="list-item-btn ${state.currentList === l.slug ? 'active' : ''}" data-slug="${l.slug}">
            <span>${l.name}</span>
            <span class="badge">${l.prospect_count}</span>
          </button>
        </li>
      `;
    });
    el.crmListsContainer.innerHTML = html;

    el.crmListsContainer.querySelectorAll(".list-item-btn").forEach(btn => {
      btn.addEventListener("click", () => selectList(btn.dataset.slug));
    });
  }

  function selectList(slug) {
    state.currentList = slug;
    renderListsMenu(state.lists);
    const found = state.lists.find(l => l.slug === slug);
    el.crmListTitle.textContent = found ? found.name : "All Prospects";
    loadLeads();
  }

  async function loadLeads() {
    try {
      const params = new URLSearchParams();
      if (state.currentList) params.append("list", state.currentList);
      const res = await apiRequest(`/api/leads?${params.toString()}`);
      state.allLeads = res.leads || [];
      applyFiltersAndRender();
    } catch (e) {
      state.allLeads = [];
      applyFiltersAndRender();
    }
  }

  function applyFiltersAndRender() {
    let list = [...state.allLeads];
    const q = el.globalSearch.value.toLowerCase().trim();
    const stage = el.stageFilter.value;
    const qFilter = el.quickFilter.value;

    if (q) {
      list = list.filter(l => 
        (l.business_name || "").toLowerCase().includes(q) ||
        (l.city || "").toLowerCase().includes(q) ||
        (l.business_email || "").toLowerCase().includes(q) ||
        (l.decision_maker_name || "").toLowerCase().includes(q)
      );
    }

    if (stage) {
      list = list.filter(l => l.pipeline_stage === stage);
    }

    if (qFilter === "verified") {
      list = list.filter(l => l.business_email && l.verification_status === "Verified");
    } else if (qFilter === "missing_email") {
      list = list.filter(l => !l.business_email);
    } else if (qFilter === "missing_phone") {
      list = list.filter(l => !l.business_phone);
    } else if (qFilter === "missing_decision_maker") {
      list = list.filter(l => !l.decision_maker_name);
    } else if (qFilter === "needs_followup") {
      list = list.filter(l => l.next_followup);
    }

    // Sort
    list.sort((a, b) => {
      let va = a[state.sortField] || "";
      let vb = b[state.sortField] || "";
      if (state.sortField === "lead_score") {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
      }
      if (va < vb) return state.sortAsc ? -1 : 1;
      if (va > vb) return state.sortAsc ? 1 : -1;
      return 0;
    });

    state.filteredLeads = list;
    renderTable(list);
  }

  function renderTable(leads) {
    el.crmLeadCount.textContent = `${leads.length} items`;
    if (leads.length === 0) {
      el.prospectsTbody.innerHTML = "";
      el.tableEmptyState.classList.remove("hidden");
      return;
    }
    el.tableEmptyState.classList.add("hidden");

    let rows = "";
    leads.forEach(l => {
      const isSelected = l.id === state.selectedLeadId ? "selected" : "";
      const score = Number(l.lead_score) || 0;
      const scoreCls = score >= 70 ? "high" : (score >= 40 ? "med" : "low");
      const stageCls = "stage-" + (l.pipeline_stage || "New").replace(/\s+/g, "");

      rows += `
        <tr class="${isSelected}" data-id="${l.id}">
          <td onclick="event.stopPropagation()"><input type="checkbox" value="${l.id}"></td>
          <td><strong>${escapeHtml(l.business_name)}</strong></td>
          <td>${escapeHtml(l.city || "")}</td>
          <td>${escapeHtml(l.decision_maker_name || "—")}</td>
          <td>${escapeHtml(l.business_email || "—")}</td>
          <td>${escapeHtml(l.business_phone || "—")}</td>
          <td><span class="stage-pill ${stageCls}">${escapeHtml(l.pipeline_stage || "New")}</span></td>
          <td><span class="score-badge ${scoreCls}">${score}%</span></td>
          <td>${escapeHtml(l.priority || "Medium")}</td>
        </tr>
      `;
    });
    el.prospectsTbody.innerHTML = rows;

    // Attach row select click
    el.prospectsTbody.querySelectorAll("tr").forEach(tr => {
      tr.addEventListener("click", () => selectLead(tr.dataset.id));
    });
  }

  function selectLead(leadId) {
    state.selectedLeadId = leadId;
    const lead = state.allLeads.find(l => l.id === leadId);
    if (!lead) return;

    // Highlight row
    el.prospectsTbody.querySelectorAll("tr").forEach(r => r.classList.remove("selected"));
    const activeRow = el.prospectsTbody.querySelector(`tr[data-id="${leadId}"]`);
    if (activeRow) activeRow.classList.add("selected");

    // Populate Inspector
    el.detailPlaceholder.classList.add("hidden");
    el.detailWrapper.classList.remove("hidden");
    el.panelDetail.classList.add("open");

    el.detBusinessName.textContent = lead.business_name;
    el.detProfession.textContent = lead.profession || "Prospect";
    el.detCity.textContent = `${lead.city || ""}, ${lead.country || "UK"}`;

    const score = Number(lead.lead_score) || 0;
    el.detScoreVal.textContent = `${score}%`;
    el.detScoreFill.style.width = `${score}%`;

    el.detStageSelect.value = lead.pipeline_stage || "New";
    el.detPrioritySelect.value = lead.priority || "Medium";
    el.detFollowupInput.value = lead.next_followup || "";

    el.detDmName.value = lead.decision_maker_name || "";
    el.detDmTitle.value = lead.decision_maker_title || "";
    el.detEmail.value = lead.business_email || "";
    el.detPhone.value = lead.business_phone || "";
    el.detWebsite.value = lead.website || "";
    el.detAddress.value = lead.address || "";

    // Website live tab
    const webUrl = lead.website || "";
    el.detWebPreviewUrl.textContent = webUrl || "No website provided";
    if (webUrl && (webUrl.startsWith("http://") || webUrl.startsWith("https://"))) {
      el.websiteIframe.src = webUrl;
      el.iframeFallback.classList.add("hidden");
      el.btnOpenExternalSite.href = webUrl;
      el.btnFallbackOpenTab.href = webUrl;
    } else {
      el.websiteIframe.src = "about:blank";
      el.iframeFallback.classList.add("hidden");
      el.btnOpenExternalSite.removeAttribute("href");
    }

    // Google Maps tab
    const mapsQuery = encodeURIComponent(`${lead.business_name} ${lead.city}`);
    const mapsUrl = `https://maps.google.com/maps?q=${mapsQuery}&output=embed`;
    el.mapsIframe.src = mapsUrl;
    el.btnOpenExternalMaps.href = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

    // Activity Notes Timeline
    renderActivityTimeline(lead.notes || "");
  }

  function renderActivityTimeline(notesText) {
    if (!notesText.trim()) {
      el.activityStream.innerHTML = `<p class="feed-item empty">No logged notes yet. Add your first note above.</p>`;
      return;
    }
    const lines = notesText.split("\n").filter(l => l.trim().length > 0);
    let html = "";
    lines.forEach(l => {
      html += `<div class="feed-item">${escapeHtml(l)}</div>`;
    });
    el.activityStream.innerHTML = html;
  }

  async function saveSelectedLeadChanges() {
    if (!state.selectedLeadId) return;
    const updates = {
      pipeline_stage: el.detStageSelect.value,
      priority: el.detPrioritySelect.value,
      next_followup: el.detFollowupInput.value,
      decision_maker_name: el.detDmName.value.trim(),
      decision_maker_title: el.detDmTitle.value.trim(),
      business_email: el.detEmail.value.trim(),
      business_phone: el.detPhone.value.trim(),
      website: el.detWebsite.value.trim(),
      address: el.detAddress.value.trim()
    };

    try {
      const res = await apiRequest(`/api/leads/${state.selectedLeadId}`, "PUT", updates);
      showToast("Prospect details updated successfully.", "success");
      await loadLeads();
      selectLead(state.selectedLeadId);
      loadOverviewStats();
    } catch (e) {
      showToast(e.message || "Failed to save lead updates.", "error");
    }
  }

  async function deleteSelectedLead() {
    if (!state.selectedLeadId) return;
    if (!confirm("Are you sure you wish to remove this prospect from the list?")) return;
    try {
      await apiRequest(`/api/leads/${state.selectedLeadId}`, "DELETE");
      showToast("Lead removed from prospect list.", "success");
      el.detailWrapper.classList.add("hidden");
      el.detailPlaceholder.classList.remove("hidden");
      state.selectedLeadId = null;
      loadLeads();
      loadLists();
    } catch (e) {
      showToast("Could not delete lead.", "error");
    }
  }

  async function addLeadActivityNote() {
    if (!state.selectedLeadId) return;
    const noteEl = document.getElementById("det-new-note");
    const text = noteEl.value.trim();
    if (!text) return;

    try {
      await apiRequest(`/api/leads/${state.selectedLeadId}/activity`, "POST", { action: "Outreach Log", note: text });
      noteEl.value = "";
      showToast("Note added to timeline.", "success");
      const res = await apiRequest(`/api/leads/${state.selectedLeadId}`);
      renderActivityTimeline(res.lead.notes || "");
    } catch (e) {
      showToast("Could not record note.", "error");
    }
  }

  async function triggerLeadReResearch() {
    if (!state.selectedLeadId) return;
    showToast("Re-researching website for contact details...", "success");
    try {
      const res = await apiRequest(`/api/leads/${state.selectedLeadId}/research`, "POST");
      showToast("Website research completed.", "success");
      selectLead(state.selectedLeadId);
      loadLeads();
    } catch (e) {
      showToast(e.message || "Website research failed.", "error");
    }
  }

  function reloadWebsitePreview() {
    const src = el.websiteIframe.src;
    el.websiteIframe.src = "about:blank";
    setTimeout(() => { el.websiteIframe.src = src; }, 100);
  }

  // --- Lead Finder & 3×3 Grid Module ---

  function bindChipInputs() {
    setupChipContainer("chips-professions", "input-profession-chip", state.chips.professions);
    setupChipContainer("chips-cities", "input-city-chip", state.chips.cities);
    setupChipContainer("chips-titles", "input-title-chip", state.chips.titles);
  }

  function setupChipContainer(containerId, inputId, listRef) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const val = input.value.trim().replace(/^,+|,+$/g, "");
        if (val && !listRef.includes(val)) {
          listRef.push(val);
          input.value = "";
          renderChips();
        }
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData("text");
      const items = paste.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      items.forEach(it => {
        if (!listRef.includes(it)) listRef.push(it);
      });
      renderChips();
    });
  }

  function renderChips() {
    renderSingleChipSet("chips-professions", "input-profession-chip", state.chips.professions);
    renderSingleChipSet("chips-cities", "input-city-chip", state.chips.cities);
    renderSingleChipSet("chips-titles", "input-title-chip", state.chips.titles);

    const taskCount = state.chips.professions.length * state.chips.cities.length;
    el.searchSummary.textContent = `${state.chips.professions.length} professions × ${state.chips.cities.length} cities = ${taskCount} grid searches`;
  }

  function renderSingleChipSet(containerId, inputId, listRef) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    container.querySelectorAll(".chip").forEach(c => c.remove());

    listRef.forEach((item, index) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${escapeHtml(item)} <span class="chip-remove" data-idx="${index}">×</span>`;
      chip.querySelector(".chip-remove").addEventListener("click", () => {
        listRef.splice(index, 1);
        renderChips();
      });
      container.insertBefore(chip, input);
    });
  }

  function clearFinderInputs() {
    state.chips.professions = [];
    state.chips.cities = [];
    state.chips.titles = [];
    renderChips();
  }

  async function startLeadFinderJob() {
    if (state.chips.professions.length === 0 || state.chips.cities.length === 0) {
      showToast("Please specify at least one profession and one target city.", "error");
      return;
    }

    const payload = {
      professions: state.chips.professions,
      cities: state.chips.cities,
      decision_maker_titles: state.chips.titles,
      expansion_factor: parseFloat(document.getElementById("select-grid-expansion").value) || 1.20
    };

    try {
      const res = await apiRequest("/api/jobs/start", "POST", payload);
      showToast("3×3 Lead Discovery run launched.", "success");
      el.btnPauseJob.disabled = false;
      el.btnCancelJob.disabled = false;
      startJobPolling();
    } catch (e) {
      showToast(e.message || "Failed to start lead discovery job.", "error");
    }
  }

  function startJobPolling() {
    if (state.jobPollingTimer) clearInterval(state.jobPollingTimer);
    state.jobPollingTimer = setInterval(pollJobStatus, 1500);
  }

  async function pollJobStatus() {
    try {
      const res = await apiRequest("/api/jobs/status");
      if (!res.job) return;

      const job = res.job;
      const isRunning = res.active;
      el.jobStageLabel.textContent = `Status: ${job.stage} (${job.current_profession} in ${job.current_city})`;

      el.btnPauseJob.disabled = !isRunning || res.paused;
      el.btnResumeJob.disabled = !res.paused;
      el.btnCancelJob.disabled = !isRunning && !res.paused;

      // Update metrics
      document.getElementById("job-discovered-val").textContent = job.stats.discovered;
      document.getElementById("job-crawled-val").textContent = job.stats.researched;
      document.getElementById("job-emails-val").textContent = job.stats.emails_found;
      document.getElementById("job-phones-val").textContent = job.stats.phones_found;
      document.getElementById("job-dm-val").textContent = job.stats.decision_makers_found;

      // Update 3x3 Matrix Cells Visuals
      if (job.grid_cells && job.grid_cells.length === 9) {
        job.grid_cells.forEach(cell => {
          const cellEl = document.getElementById(`cell-${cell.cell_id}`);
          if (cellEl) {
            cellEl.className = "grid-cell";
            if (cell.cell_id === 5) cellEl.classList.add("center-cell");

            if (job.current_cell === cell.cell_id && isRunning) {
              cellEl.classList.add("active");
            } else if (cell.status === "Completed") {
              cellEl.classList.add("completed");
            }
            cellEl.querySelector(".cell-stat").textContent = `${cell.results_found} found`;
          }
        });
      }

      // Update Event Console
      if (job.recent_events && job.recent_events.length > 0) {
        el.eventsLog.innerHTML = job.recent_events.map(ev => `<div class="log-line">${escapeHtml(ev)}</div>`).join("");
      }

      // If job just completed, refresh lists and overview
      if (job.stage === "Completed" && !job._synced) {
        job._synced = true;
        loadLists();
        loadOverviewStats();
        showToast("Lead discovery run finished! Prospects saved to CSV.", "success");
      }
    } catch (e) {
      // Offline fallback handling
    }
  }

  async function sendJobAction(action) {
    try {
      await apiRequest(`/api/jobs/${action}`, "POST");
      showToast(`Search job ${action}d.`, "success");
      pollJobStatus();
    } catch (e) {
      showToast("Action failed.", "error");
    }
  }

  // --- CSV Lists View & Export/Import ---

  function renderListsGrid(lists) {
    const grid = document.getElementById("data-lists-grid");
    if (!grid) return;
    let html = "";
    lists.forEach(l => {
      html += `
        <div class="list-card">
          <div class="list-card-head">
            <span class="list-card-name">${escapeHtml(l.name)}</span>
            <span class="badge">CSV File</span>
          </div>
          <div class="list-card-stats">
            <span><strong>${l.prospect_count}</strong> Leads</span>
            <span><strong>${l.verified_count}</strong> Verified</span>
          </div>
          <div class="list-card-footer">
            <button class="btn btn-secondary btn-xs" onclick="App.openCsvList('${l.slug}')">View Leads</button>
            <a href="/api/export/${l.slug}" class="btn btn-secondary btn-xs" download>Export CSV</a>
          </div>
        </div>
      `;
    });
    grid.innerHTML = html;
  }

  function exportCurrentList() {
    if (!state.currentList) {
      showToast("Please select a specific profession list to export.", "error");
      return;
    }
    window.location.href = `${state.apiBase}/api/export/${state.currentList}`;
  }

  function downloadZipBackup() {
    window.location.href = `${state.apiBase}/api/export/backup/all`;
  }

  async function handleCsvImport() {
    const fileInput = document.getElementById("import-file-input");
    const targetList = document.getElementById("import-target-list").value.trim();
    if (!fileInput.files || fileInput.files.length === 0) {
      showToast("Please choose a CSV file to import.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("target_list", targetList || "Imported");

    try {
      const resp = await fetch(`${state.apiBase}/api/import`, { method: "POST", body: formData });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);

      showToast(`Imported ${data.added} new prospects into ${data.list}.csv`, "success");
      closeModal(el.modalImport);
      loadLists();
      loadOverviewStats();
    } catch (e) {
      showToast(e.message || "CSV Import failed.", "error");
    }
  }

  async function handleManualLeadSubmit(e) {
    e.preventDefault();
    const payload = {
      business_name: document.getElementById("m-name").value.trim(),
      profession: document.getElementById("m-profession").value.trim(),
      city: document.getElementById("m-city").value.trim(),
      website: document.getElementById("m-website").value.trim(),
      business_email: document.getElementById("m-email").value.trim(),
      business_phone: document.getElementById("m-phone").value.trim(),
      decision_maker_name: document.getElementById("m-dm-name").value.trim(),
      decision_maker_title: document.getElementById("m-dm-title").value.trim()
    };

    try {
      await apiRequest("/api/leads/manual", "POST", payload);
      showToast("Lead added and saved to profession CSV.", "success");
      closeModal(el.modalManual);
      document.getElementById("form-manual-lead").reset();
      loadLists();
      loadOverviewStats();
    } catch (e) {
      showToast("Failed to create lead.", "error");
    }
  }

  // --- Settings ---

  async function saveSettings() {
    const backendUrl = document.getElementById("setting-backend-url").value.trim();
    const googleKey = document.getElementById("setting-google-api-key").value.trim();
    const maxCrawl = document.getElementById("setting-max-crawl").value;

    if (backendUrl) {
      localStorage.setItem("crm_api_base", backendUrl.replace(/\/+$/, ""));
      state.apiBase = localStorage.getItem("crm_api_base");
    } else {
      localStorage.removeItem("crm_api_base");
      state.apiBase = "";
    }

    try {
      await apiRequest("/api/settings", "POST", {
        google_places_api_key: googleKey,
        max_crawl_pages: parseInt(maxCrawl, 10)
      });
      showToast("Configuration saved.", "success");
      closeModal(el.modalSettings);
      checkSystemStatus();
    } catch (e) {
      showToast("Settings applied locally.", "success");
      closeModal(el.modalSettings);
    }
  }

  // --- UI Helpers & Utilities ---

  function switchSection(sectionId) {
    el.viewSections.forEach(s => s.classList.remove("active"));
    el.navTabs.forEach(t => t.classList.remove("active"));

    const targetSec = document.getElementById(sectionId);
    if (targetSec) targetSec.classList.add("active");

    const targetTab = document.querySelector(`.nav-tab[data-target="${sectionId}"]`);
    if (targetTab) targetTab.classList.add("active");
  }

  function openModal(modalEl) { modalEl.classList.remove("hidden"); }
  function closeModal(modalEl) { modalEl.classList.add("hidden"); }

  function showToast(msg, type = "info") {
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = msg;
    el.toastContainer.appendChild(t);
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 300);
    }, 3500);
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
    switchSection,
    openCsvList: (slug) => {
      switchSection("section-crm");
      selectList(slug);
    }
  };
})();

document.addEventListener("DOMContentLoaded", App.init);