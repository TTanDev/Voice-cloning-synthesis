const archiveList = document.querySelector("#historyArchiveList");
const searchInput = document.querySelector("#historySearch");
const groupFilter = document.querySelector("#historyGroupFilter");
const statusFilter = document.querySelector("#historyStatusFilter");
const historyStats = document.querySelector("#historyStats");
const historyPlayerStatus = document.querySelector("#historyPlayerStatus");
const confirmModal = document.querySelector("#confirmModal");
const confirmMsg = document.querySelector("#confirmMsg");
const confirmOk = document.querySelector("#confirmOk");
const confirmCancel = document.querySelector("#confirmCancel");
const langToggle = document.querySelector("#langToggle");
const historySelectAll = document.querySelector("#historySelectAll");
const historyBatchBar = document.querySelector("#historyBatchBar");
const historyBatchCount = document.querySelector("#historyBatchCount");
const historyBatchDownloadBtn = document.querySelector("#historyBatchDownloadBtn");
const historyBatchRestoreBtn = document.querySelector("#historyBatchRestoreBtn");
const historyBatchDeleteBtn = document.querySelector("#historyBatchDeleteBtn");

let allJobs = [];
let visibleJobs = [];
const selectedJobs = new Set();
let pendingConfirm = null;
let searchTimer = null;
let selectedGroup = "";
let selectedStatus = "all";
const audioUrlCache = new Map();
const durationCache = new Map();
let currentLang = localStorage.getItem("mimo-lang") || "zh";
let currentPlayingText = "";

const translations = {
  zh: {
    historyPageTitle: "历史合成结果",
    historyPageDesc: "集中管理已经收进历史的合成音频，可按文本、文件名和分组搜索。",
    backHome: "返回合成页面",
    manageCharacters: "管理角色",
    searchLabel: "搜索",
    searchPlaceholder: "输入文本、文件名或分组，实时搜索",
    groupLabel: "分组",
    statusLabel: "状态",
    synthAudioTitle: "合成音频",
    historyPlayerIdle: "选择一条历史结果播放。",
    cancelBtn: "取消",
    confirmDelete: "确认删除",
    selectAll: "全选",
    batchCount: "已选 0 项",
    batchDownloadBtn: "下载",
    batchRestoreBtn: "移回",
    batchDeleteBtn: "删除选中",
    allGroups: "全部分组",
    ungrouped: "未分组",
    all: "全部",
    unread: "未读",
    read: "已读",
    failed: "失败",
    queued: "排队中",
    running: "合成中",
    succeeded: "已完成",
    noName: "未命名文本",
    noCharacter: "无角色",
    character: "角色",
    group: "分组",
    loadingDuration: "读取时长中",
    noAudio: "无音频",
    audio: "音频",
    audioUnavailable: "音频不可用",
    durationUnknown: "音频时长未知",
    noMatched: "没有匹配的历史合成结果。",
    stats: "共 {total} 条，当前显示 {visible} 条，未读 {unread} 条，无角色 {noCharacter} 条。",
    play: "播放",
    download: "下载",
    restore: "移回",
    delete: "删除",
    viewing: "正在查看：{text}",
    restoreFailed: "移回合成结果失败",
    deleteConfirm: "确认删除这条历史记录？删除后无法恢复。",
    batchDeleteConfirm: "确认删除选中的 {n} 条历史记录？删除后无法恢复。",
    batchRestored: "已移回 {n} 条合成结果。",
    batchDownloaded: "已触发 {n} 条历史音频下载。",
    batchDownloadNoEligible: "选中的记录里没有可下载的已完成音频。",
    deleteFailed: "删除失败",
    batchDeleteFailed: "批量删除失败",
    loadFailed: "读取历史失败",
    langToggle: "EN",
    title: "历史合成结果 - MiMo 声音复刻合成"
  },
  en: {
    historyPageTitle: "Synthesis History",
    historyPageDesc: "Manage archived synthesis audio. Search by text, filename, character, or group.",
    backHome: "Synthesis",
    manageCharacters: "Characters",
    searchLabel: "Search",
    searchPlaceholder: "Search text, filename, character, or group",
    groupLabel: "Group",
    statusLabel: "Status",
    synthAudioTitle: "Synthesis Audio",
    historyPlayerIdle: "Select a history item to play.",
    cancelBtn: "Cancel",
    confirmDelete: "Confirm Delete",
    selectAll: "Select All",
    batchCount: "0 selected",
    batchDownloadBtn: "Download",
    batchRestoreBtn: "Move Back",
    batchDeleteBtn: "Delete Selected",
    allGroups: "All groups",
    ungrouped: "Ungrouped",
    all: "All",
    unread: "Unread",
    read: "Read",
    failed: "Failed",
    queued: "Queued",
    running: "Synthesizing",
    succeeded: "Completed",
    noName: "Untitled",
    noCharacter: "No character",
    character: "Character",
    group: "Group",
    loadingDuration: "Reading duration",
    noAudio: "No audio",
    audio: "Audio",
    audioUnavailable: "Audio unavailable",
    durationUnknown: "Duration unknown",
    noMatched: "No matching synthesis history.",
    stats: "{total} total, {visible} shown, {unread} unread, {noCharacter} without character.",
    play: "Play",
    download: "Download",
    restore: "Move back",
    delete: "Delete",
    viewing: "Viewing: {text}",
    restoreFailed: "Failed to move back",
    deleteConfirm: "Delete this history item? This cannot be undone.",
    batchDeleteConfirm: "Delete {n} selected history items? This cannot be undone.",
    batchRestored: "Moved back {n} synthesis results.",
    batchDownloaded: "Started {n} history audio downloads.",
    batchDownloadNoEligible: "No completed selected audio can be downloaded.",
    deleteFailed: "Delete failed",
    batchDeleteFailed: "Batch delete failed",
    loadFailed: "Failed to load history",
    langToggle: "中",
    title: "Synthesis History - MiMo Voice Cloning"
  }
};

function t(key) {
  return translations[currentLang][key] || translations.zh[key] || key;
}

const historyPlayer = window.createWavePlayer("#historyWavePlayer", {
  defaultText: currentLang === "zh" ? "历史合成音频会在这里显示波形。" : "History audio waveform appears here.",
  onBeforePlay: async (jobId) => markJobRead(jobId)
});

function applyLanguage() {
  document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (translations[currentLang][key] !== undefined) {
      el.textContent = translations[currentLang][key];
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[currentLang][key] !== undefined) {
      el.placeholder = translations[currentLang][key];
    }
  });
  if (langToggle) {
    langToggle.textContent = t("langToggle");
  }
  if (!historyPlayer.audio.src) {
    historyPlayer.clear();
    const playerText = document.querySelector("#historyWavePlayer [data-player-text]");
    if (playerText) {
      playerText.textContent = currentLang === "zh" ? "历史合成音频会在这里显示波形。" : "History audio waveform appears here.";
    }
  } else if (currentPlayingText) {
    historyPlayerStatus.textContent = t("viewing").replace("{text}", textPreview(currentPlayingText, 34));
  }
  renderFilters();
  applyFilters();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textPreview(text, limit = 58) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit)}...` : compact || t("noName");
}

function statusLabel(status) {
  return { QUEUED: t("queued"), RUNNING: t("running"), SUCCEEDED: t("succeeded"), FAILED: t("failed") }[status] || status;
}

function statusClass(status) {
  return String(status || "").toLowerCase();
}

function formatAudioDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const rest = totalSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function buildDownloadFileName(text) {
  const chineseChars = Array.from(String(text || "").matchAll(/\p{Script=Han}/gu), (match) => match[0]);
  const prefix = chineseChars.slice(0, 5).join("") || "合成音频";
  return `${prefix}.wav`;
}

function debounceApplyFilters() {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(applyFilters, 250);
}

async function loadJobs() {
  const response = await fetch("/api/synthesize/jobs");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || t("loadFailed"));
  allJobs = data.filter((job) => job.archived);
  renderFilters();
  applyFilters();
}

function renderFilters() {
  const groups = Array.from(new Set(allJobs.map((job) => job.groupName || t("ungrouped")))).sort((a, b) => a.localeCompare(b, currentLang === "zh" ? "zh-CN" : "en"));
  groupFilter.innerHTML = [
    chipButton(t("allGroups"), "", selectedGroup === ""),
    ...groups.map((group) => chipButton(group, group, selectedGroup === group))
  ].join("");
  const statusItems = [
    [t("all"), "all"],
    [t("unread"), "unread"],
    [t("read"), "read"],
    [t("failed"), "FAILED"]
  ];
  statusFilter.innerHTML = statusItems.map(([label, value]) => chipButton(label, value, selectedStatus === value)).join("");
}

function chipButton(label, value, selected) {
  return `<button type="button" class="filter-chip ${selected ? "selected" : ""}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
}

function applyFilters() {
  const keyword = searchInput.value.trim().toLowerCase();
  visibleJobs = allJobs.filter((job) => {
    const groupName = job.groupName || t("ungrouped");
    const characterName = job.characterName || t("noCharacter");
    const searchText = [job.text, groupName, characterName, statusLabel(job.status)].join(" ").toLowerCase();
    const matchesKeyword = !keyword || searchText.includes(keyword);
    const matchesGroup = !selectedGroup || groupName === selectedGroup;
    const matchesStatus =
      selectedStatus === "all"
      || (selectedStatus === "unread" && job.status === "SUCCEEDED" && !job.read)
      || (selectedStatus === "read" && job.status === "SUCCEEDED" && job.read)
      || job.status === selectedStatus;
    return matchesKeyword && matchesGroup && matchesStatus;
  });
  pruneSelection();
  renderHistory();
}

function renderHistory() {
  const unreadCount = allJobs.filter((job) => job.status === "SUCCEEDED" && !job.read).length;
  const noCharacterCount = allJobs.filter((job) => !job.characterName).length;
  historyStats.textContent = t("stats")
    .replace("{total}", allJobs.length)
    .replace("{visible}", visibleJobs.length)
    .replace("{unread}", unreadCount)
    .replace("{noCharacter}", noCharacterCount);
  updateBatchBar();
  updateSelectAllCheckbox();

  if (!visibleJobs.length) {
    archiveList.innerHTML = `<div class="empty-history">${t("noMatched")}</div>`;
    return;
  }

  archiveList.innerHTML = visibleJobs.map((job) => {
    const canUseAudio = job.status === "SUCCEEDED";
    const checked = selectedJobs.has(job.id);
    const itemClass = [
      "history-row",
      job.status === "RUNNING" ? "is-running" : "",
      job.status === "SUCCEEDED" && !job.read ? "is-unread" : ""
    ].filter(Boolean).join(" ");
    return `
      <article class="${itemClass}" data-job-id="${escapeHtml(job.id)}">
        <input type="checkbox" class="history-checkbox" data-job-id="${escapeHtml(job.id)}" ${checked ? "checked" : ""} />
        <div class="history-row-main">
          <div class="history-row-head">
            <div class="history-row-title" title="${escapeHtml(job.text)}">${escapeHtml(textPreview(job.text))}</div>
            <span class="status-badge ${statusClass(job.status)}">${statusLabel(job.status)}</span>
          </div>
          <div class="history-row-meta">
            <span>${escapeHtml(new Date(job.createdAt).toLocaleString())}</span>
            <span data-duration-job-id="${escapeHtml(job.id)}">${canUseAudio ? t("loadingDuration") : t("noAudio")}</span>
            <span>${t("character")}：${escapeHtml(job.characterName || t("noCharacter"))}</span>
            <span>${t("group")}：${escapeHtml(job.groupName || t("ungrouped"))}</span>
          </div>
          <div class="history-row-preview">${escapeHtml(textPreview(job.text, 120))}</div>
        </div>
        <div class="history-row-actions">
          <button type="button" data-action="play" data-job-id="${escapeHtml(job.id)}" data-job-text="${escapeHtml(job.text)}" class="${canUseAudio ? "" : "disabled"}">${t("play")}</button>
          <button type="button" data-action="download" data-job-id="${escapeHtml(job.id)}" data-job-text="${escapeHtml(job.text)}" class="${canUseAudio ? "" : "disabled"}">${t("download")}</button>
          <button type="button" data-action="restore" data-job-id="${escapeHtml(job.id)}">${t("restore")}</button>
          <button type="button" data-action="delete" data-job-id="${escapeHtml(job.id)}" class="danger-action">${t("delete")}</button>
        </div>
      </article>
    `;
  }).join("");
  hydrateDurations(visibleJobs.filter((job) => job.status === "SUCCEEDED"));
}

async function getJobAudioUrl(jobId) {
  if (audioUrlCache.has(jobId)) return audioUrlCache.get(jobId);
  const response = await fetch(`/api/synthesize/jobs/${encodeURIComponent(jobId)}/audio`);
  if (!response.ok) return "";
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  audioUrlCache.set(jobId, url);
  return url;
}

async function hydrateDurations(jobs) {
  await Promise.all(jobs.map(async (job) => {
    const target = archiveList.querySelector(`[data-duration-job-id="${CSS.escape(job.id)}"]`);
    if (!target) return;
    if (durationCache.has(job.id)) {
      target.textContent = `${t("audio")} ${formatAudioDuration(durationCache.get(job.id))}`;
      return;
    }
    const url = await getJobAudioUrl(job.id);
    if (!url) {
      target.textContent = t("audioUnavailable");
      return;
    }
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = url;
    await new Promise((resolve) => {
      audio.addEventListener("loadedmetadata", resolve, { once: true });
      audio.addEventListener("error", resolve, { once: true });
    });
    if (Number.isFinite(audio.duration)) {
      durationCache.set(job.id, audio.duration);
      target.textContent = `${t("audio")} ${formatAudioDuration(audio.duration)}`;
    } else {
      target.textContent = t("durationUnknown");
    }
  }));
}

async function markJobRead(jobId) {
  const job = allJobs.find((item) => item.id === jobId);
  if (!job || job.read) return;
  try {
    const response = await fetch(`/api/synthesize/jobs/${encodeURIComponent(jobId)}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true })
    });
    if (!response.ok) return;
    job.read = true;
    const item = archiveList.querySelector(`[data-job-id="${CSS.escape(jobId)}"]`);
    if (item) item.classList.remove("is-unread");
    renderFilters();
  } catch (error) {
    // Playback should not fail because the read marker cannot be persisted.
  }
}

async function playJob(jobId, text) {
  const url = await getJobAudioUrl(jobId);
  if (!url) return;
  currentPlayingText = text;
  historyPlayer.setSource(url, text, jobId);
  historyPlayerStatus.textContent = t("viewing").replace("{text}", textPreview(text, 34));
}

async function downloadJob(jobId, text) {
  const url = await getJobAudioUrl(jobId);
  if (!url) return;
  await markJobRead(jobId);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildDownloadFileName(text);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function batchDownloadJobs() {
  const jobs = [...selectedJobs]
    .map((id) => allJobs.find((item) => item.id === id))
    .filter((job) => job && job.status === "SUCCEEDED");
  if (!jobs.length) {
    historyStats.textContent = t("batchDownloadNoEligible");
    return;
  }
  for (const job of jobs) {
    await downloadJob(job.id, job.text);
  }
  historyStats.textContent = t("batchDownloaded").replace("{n}", jobs.length);
}

async function restoreJob(jobId) {
  const response = await fetch(`/api/synthesize/jobs/${encodeURIComponent(jobId)}/archive`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archived: false, groupName: "" })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || t("restoreFailed"));
  await loadJobs();
}

async function batchRestoreJobs() {
  const ids = [...selectedJobs];
  if (!ids.length) return;
  await Promise.all(ids.map((id) => fetch(`/api/synthesize/jobs/${encodeURIComponent(id)}/archive`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archived: false, groupName: "" })
  }).then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t("restoreFailed"));
  })));
  ids.forEach((id) => selectedJobs.delete(id));
  historyStats.textContent = t("batchRestored").replace("{n}", ids.length);
  await loadJobs();
}

function showConfirm(message, onConfirm) {
  pendingConfirm = onConfirm;
  confirmMsg.textContent = message;
  confirmModal.showModal();
}

async function deleteJob(jobId) {
  showConfirm(t("deleteConfirm"), async () => {
    const response = await fetch(`/api/synthesize/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || t("deleteFailed"));
    }
    if (audioUrlCache.has(jobId)) {
      URL.revokeObjectURL(audioUrlCache.get(jobId));
      audioUrlCache.delete(jobId);
    }
    durationCache.delete(jobId);
    await loadJobs();
  });
}

async function batchDeleteJobs() {
  const ids = [...selectedJobs];
  if (!ids.length) return;
  showConfirm(t("batchDeleteConfirm").replace("{n}", ids.length), async () => {
    const response = await fetch("/api/synthesize/jobs/batch", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids)
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || t("batchDeleteFailed"));
    }
    ids.forEach((id) => {
      if (audioUrlCache.has(id)) {
        URL.revokeObjectURL(audioUrlCache.get(id));
        audioUrlCache.delete(id);
      }
      durationCache.delete(id);
      selectedJobs.delete(id);
    });
    await loadJobs();
  });
}

function pruneSelection() {
  const visibleIds = new Set(visibleJobs.map((job) => job.id));
  for (const id of selectedJobs) {
    if (!visibleIds.has(id)) {
      selectedJobs.delete(id);
    }
  }
}

function updateBatchBar() {
  const count = selectedJobs.size;
  if (count > 0) {
    historyBatchBar.classList.add("visible");
    historyBatchCount.textContent = currentLang === "zh" ? `已选 ${count} 项` : `${count} selected`;
  } else {
    historyBatchBar.classList.remove("visible");
  }
}

function updateSelectAllCheckbox() {
  if (!visibleJobs.length) {
    historySelectAll.checked = false;
    historySelectAll.indeterminate = false;
    return;
  }
  const allSelected = visibleJobs.every((job) => selectedJobs.has(job.id));
  const someSelected = visibleJobs.some((job) => selectedJobs.has(job.id));
  historySelectAll.checked = allSelected;
  historySelectAll.indeterminate = !allSelected && someSelected;
}

archiveList.addEventListener("click", async (event) => {
  const checkbox = event.target.closest(".history-checkbox");
  if (checkbox) {
    if (checkbox.checked) {
      selectedJobs.add(checkbox.dataset.jobId);
    } else {
      selectedJobs.delete(checkbox.dataset.jobId);
    }
    updateBatchBar();
    updateSelectAllCheckbox();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button || button.classList.contains("disabled")) return;
  try {
    if (button.dataset.action === "play") await playJob(button.dataset.jobId, button.dataset.jobText);
    if (button.dataset.action === "download") await downloadJob(button.dataset.jobId, button.dataset.jobText);
    if (button.dataset.action === "restore") await restoreJob(button.dataset.jobId);
    if (button.dataset.action === "delete") await deleteJob(button.dataset.jobId);
  } catch (error) {
    historyStats.textContent = error.message;
  }
});

historySelectAll.addEventListener("change", () => {
  if (historySelectAll.checked) {
    visibleJobs.forEach((job) => selectedJobs.add(job.id));
  } else {
    visibleJobs.forEach((job) => selectedJobs.delete(job.id));
  }
  archiveList.querySelectorAll(".history-checkbox").forEach((checkbox) => {
    checkbox.checked = selectedJobs.has(checkbox.dataset.jobId);
  });
  updateBatchBar();
  updateSelectAllCheckbox();
});

historyBatchDownloadBtn.addEventListener("click", () => batchDownloadJobs().catch((error) => {
  historyStats.textContent = error.message;
}));

historyBatchRestoreBtn.addEventListener("click", () => batchRestoreJobs().catch((error) => {
  historyStats.textContent = error.message;
}));

historyBatchDeleteBtn.addEventListener("click", () => batchDeleteJobs().catch((error) => {
  historyStats.textContent = error.message;
}));

groupFilter.addEventListener("click", (event) => {
  const chip = event.target.closest(".filter-chip");
  if (!chip) return;
  selectedGroup = chip.dataset.value || "";
  renderFilters();
  applyFilters();
});

statusFilter.addEventListener("click", (event) => {
  const chip = event.target.closest(".filter-chip");
  if (!chip) return;
  selectedStatus = chip.dataset.value || "all";
  renderFilters();
  applyFilters();
});

confirmOk.addEventListener("click", async () => {
  confirmModal.close();
  if (typeof pendingConfirm === "function") {
    const fn = pendingConfirm;
    pendingConfirm = null;
    try {
      await fn();
    } catch (error) {
      historyStats.textContent = error.message;
    }
  }
});

confirmCancel.addEventListener("click", () => {
  confirmModal.close();
  pendingConfirm = null;
});

searchInput.addEventListener("input", debounceApplyFilters);

langToggle.addEventListener("click", () => {
  currentLang = currentLang === "zh" ? "en" : "zh";
  localStorage.setItem("mimo-lang", currentLang);
  applyLanguage();
});

applyLanguage();
loadJobs().catch((error) => {
  archiveList.innerHTML = `<div class="empty-history">${escapeHtml(error.message)}</div>`;
});
