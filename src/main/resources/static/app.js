const form = document.querySelector("#synthesisForm");
const voiceFile = document.querySelector("#voiceFile");
const fileName = document.querySelector("#fileName");
const dropZone = document.querySelector("#dropZone");
const submitButton = document.querySelector("#submitButton");
const statusText = document.querySelector("#statusText");
const keyState = document.querySelector("#keyState");
const audioPlayer = document.querySelector("#audioPlayer");
const downloadLink = document.querySelector("#downloadLink");
const clearButton = document.querySelector("#clearButton");
const settingsModal = document.querySelector("#settingsModal");
const openSettings = document.querySelector("#openSettings");
const closeSettings = document.querySelector("#closeSettings");
const cancelSettings = document.querySelector("#cancelSettings");
const settingsForm = document.querySelector("#settingsForm");
const apiKey = document.querySelector("#apiKey");
const baseUrl = document.querySelector("#baseUrl");
const settingsNote = document.querySelector("#settingsNote");
const stylePrompt = document.querySelector("#stylePrompt");
const styleButtons = document.querySelectorAll("[data-style-prompt]");
const historyList = document.querySelector("#historyList");
const enableNotifications = document.querySelector("#enableNotifications");
const selectAllJobs = document.querySelector("#selectAllJobs");
const batchBar = document.querySelector("#batchBar");
const batchCount = document.querySelector("#batchCount");
const batchDeleteBtn = document.querySelector("#batchDeleteBtn");
const confirmModal = document.querySelector("#confirmModal");
const confirmMsg = document.querySelector("#confirmMsg");
const confirmOk = document.querySelector("#confirmOk");
const confirmCancel = document.querySelector("#confirmCancel");

let currentAudioUrl = "";
let activeJobId = "";
let pollTimer = null;
let historyInitialized = false;
let pendingDeleteIds = null;
const knownStatuses = new Map();
const selectedJobs = new Set();
const audioUrlCache = new Map();
const durationCache = new Map();

const waveContainer = document.querySelector("#waveContainer");
const waveCanvas = document.querySelector("#waveCanvas");
const customPlayer = document.querySelector("#customPlayer");
const playerPlayBtn = document.querySelector("#playerPlayBtn");
const playerPlayIcon = document.querySelector("#playerPlayIcon");
const playerPauseIcon = document.querySelector("#playerPauseIcon");
const playerProgress = document.querySelector("#playerProgress");
const playerProgressFill = document.querySelector("#playerProgressFill");
const playerTime = document.querySelector("#playerTime");
const playerText = document.querySelector("#playerText");
const defaultPlayerTextHtml = playerText ? playerText.innerHTML : "";

let waveAudioContext = null;
let wavePeaks = null;
let waveAnimFrame = null;
const peaksCache = new Map();

const DEFAULT_BARS = [0.3, 0.5, 0.7, 0.4, 0.8, 0.6, 0.9, 0.35, 0.75, 0.55, 0.65, 0.85, 0.45, 0.7, 0.3, 0.6, 0.8, 0.5, 0.9, 0.4, 0.7, 0.55, 0.85, 0.65, 0.35, 0.75, 0.5, 0.8, 0.45, 0.6];
const BAR_COUNT = 30;
const PEAK_SAMPLES = 1500;

const steps = {
  upload: document.querySelector("#stepUpload"),
  request: document.querySelector("#stepRequest"),
  result: document.querySelector("#stepResult")
};

function setStatus(message, type = "normal") {
  statusText.textContent = message;
  statusText.style.color = type === "error" ? "var(--red)" : "var(--muted)";
}

function setSteps(activeStep) {
  Object.values(steps).forEach((step) => {
    step.classList.remove("active", "done");
  });
  if (activeStep === "upload") {
    steps.upload.classList.add("active");
  }
  if (activeStep === "request") {
    steps.upload.classList.add("done");
    steps.request.classList.add("active");
  }
  if (activeStep === "result") {
    steps.upload.classList.add("done");
    steps.request.classList.add("done");
    steps.result.classList.add("active");
  }
  if (activeStep === "done") {
    Object.values(steps).forEach((step) => step.classList.add("done"));
  }
}

function resetAudio() {
  clearWaveform();
  if (currentAudioUrl && !Array.from(audioUrlCache.values()).includes(currentAudioUrl)) {
    URL.revokeObjectURL(currentAudioUrl);
  }
  currentAudioUrl = "";
  audioPlayer.removeAttribute("src");
  audioPlayer.load();
  downloadLink.removeAttribute("href");
  downloadLink.setAttribute("download", "mimo-voiceclone.wav");
  downloadLink.classList.add("disabled");
}

function buildDownloadFileName(text) {
  const chineseChars = Array.from(text.matchAll(/\p{Script=Han}/gu), (match) => match[0]);
  const prefix = chineseChars.slice(0, 5).join("") || "合成音频";
  return `${prefix}.wav`;
}

function updateFileName() {
  const file = voiceFile.files[0];
  fileName.textContent = file ? file.name : t("uploadDefault");
}

async function prepareVoiceFile(file) {
  setStatus(t("convertingAudio"));
  try {
    const wavBlob = await convertAudioToWav(file);
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const wavName = baseName + "-converted.wav";
    return new File([wavBlob], wavName, { type: "audio/wav" });
  } catch (e) {
    setStatus(t("convertFailed"));
    return file;
  }
}

async function convertAudioToWav(file) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !window.OfflineAudioContext) {
    throw new Error(t("browserNoSupport"));
  }

  const audioContext = new AudioContextClass();
  let decodedAudio;
  try {
    decodedAudio = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await audioContext.close();
  }

  const sampleRate = 24000;
  const frameCount = Math.ceil(decodedAudio.duration * sampleRate);
  const offlineContext = new OfflineAudioContext(1, frameCount, sampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = decodedAudio;
  source.connect(offlineContext.destination);
  source.start(0);
  const rendered = await offlineContext.startRendering();
  return encodeWav(rendered.getChannelData(0), sampleRate);
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textPreview(text) {
  const compact = String(text || "").replace(/\s+/g, " ").trim();
  return compact.length > 28 ? `${compact.slice(0, 28)}...` : compact || t("unnamedText");
}

function statusLabel(status) {
  return {
    QUEUED: t("statusQueued"),
    RUNNING: t("statusRunning"),
    SUCCEEDED: t("statusSucceeded"),
    FAILED: t("statusFailed")
  }[status] || status;
}

function statusClass(status) {
  return String(status || "").toLowerCase();
}

function formatDuration(ms) {
  if (!ms || ms <= 0) {
    return "";
  }
  const seconds = Math.max(1, Math.round(ms / 1000));
  return currentLang === "zh" ? `MiMo ${seconds} 秒` : `MiMo ${seconds}s`;
}

function formatAudioDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "";
  }
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const rest = totalSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function extractPeaks(audioBuffer, sampleCount) {
  const channel = audioBuffer.getChannelData(0);
  const samplesPerPeak = Math.floor(channel.length / sampleCount);
  const peaks = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    let sum = 0;
    const start = i * samplesPerPeak;
    for (let j = 0; j < samplesPerPeak; j++) {
      sum += Math.abs(channel[start + j]);
    }
    peaks[i] = sum / samplesPerPeak;
  }
  let maxPeak = 0;
  for (let i = 0; i < peaks.length; i++) {
    if (peaks[i] > maxPeak) maxPeak = peaks[i];
  }
  if (maxPeak > 0) {
    for (let i = 0; i < peaks.length; i++) {
      peaks[i] = peaks[i] / maxPeak;
    }
  }
  return peaks;
}

function renderWaveform(progress) {
  if (!waveCanvas || !waveContainer) return;
  const dpr = window.devicePixelRatio || 1;
  const width = waveContainer.offsetWidth;
  const height = waveContainer.offsetHeight;
  if (width === 0 || height === 0) return;

  waveCanvas.width = width * dpr;
  waveCanvas.height = height * dpr;
  const ctx = waveCanvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const bars = wavePeaks ? getVisibleBars(progress || 0) : DEFAULT_BARS;
  const gap = 4;
  const barWidth = (width - 32 - (BAR_COUNT - 1) * gap) / BAR_COUNT;
  const maxBarH = height * 0.72;
  const startX = 16;

  for (let i = 0; i < BAR_COUNT; i++) {
    const x = startX + i * (barWidth + gap);
    const barH = Math.max(4, bars[i] * maxBarH);
    const y = (height - barH) / 2;
    ctx.fillStyle = wavePeaks ? "rgba(54, 95, 145, 0.7)" : "rgba(54, 95, 145, 0.45)";
    ctx.fillRect(x, y, barWidth, barH);
  }
}

function getVisibleBars(progress) {
  if (!wavePeaks) return DEFAULT_BARS;
  const total = wavePeaks.length;
  const maxOffset = Math.max(0, total - BAR_COUNT);
  const offset = progress * maxOffset;
  const baseIndex = Math.floor(offset);
  const frac = offset - baseIndex;
  const bars = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const idx = baseIndex + i;
    const curr = wavePeaks[Math.min(idx, total - 1)] || 0;
    const next = wavePeaks[Math.min(idx + 1, total - 1)] || 0;
    bars.push(curr + (next - curr) * frac);
  }
  return bars;
}

async function loadAndDrawWaveform(url) {
  try {
    if (peaksCache.has(url)) {
      wavePeaks = peaksCache.get(url);
    } else {
      if (!waveAudioContext) {
        const AC = window.AudioContext || window.webkitAudioContext;
        waveAudioContext = new AC();
      }
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await waveAudioContext.decodeAudioData(arrayBuffer);
      wavePeaks = extractPeaks(audioBuffer, PEAK_SAMPLES);
      peaksCache.set(url, wavePeaks);
    }
    requestAnimationFrame(() => renderWaveform(0));
  } catch (e) {
    wavePeaks = null;
    renderWaveform();
  }
}

function clearWaveform() {
  wavePeaks = null;
  if (waveAnimFrame) {
    cancelAnimationFrame(waveAnimFrame);
    waveAnimFrame = null;
  }
  playerProgressFill.style.width = "0%";
  playerTime.textContent = "0:00";
  playerText.innerHTML = defaultPlayerTextHtml;
  playerPlayIcon.style.display = "";
  playerPauseIcon.style.display = "none";
  renderWaveform();
}

function updatePlayhead() {
  if (!audioPlayer.duration) return;
  const progress = audioPlayer.currentTime / audioPlayer.duration;
  renderWaveform(progress);
  playerProgressFill.style.width = (progress * 100) + "%";
  playerTime.textContent = formatAudioDuration(audioPlayer.currentTime);
  if (!audioPlayer.paused) {
    waveAnimFrame = requestAnimationFrame(updatePlayhead);
  }
}

async function loadSettings() {
  try {
    const response = await fetch("/api/settings");
    const data = await response.json();
    baseUrl.value = data.baseUrl || "https://api.xiaomimimo.com/v1";
    if (data.apiKey) {
      keyState.textContent = t("keyConfigured");
      keyState.classList.remove("missing");
      apiKey.placeholder = `${currentLang === "zh" ? "当前" : "Current"}：${data.apiKey}`;
    } else {
      keyState.textContent = t("keyMissing");
      keyState.classList.add("missing");
      apiKey.placeholder = t("apiKeyPlaceholder");
    }
  } catch (error) {
    keyState.textContent = t("settingsReadFailed");
    keyState.classList.add("missing");
  }
}

async function saveSettings(event) {
  event.preventDefault();
  settingsNote.textContent = t("settingsSaving");
  settingsNote.classList.remove("error");

  try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: apiKey.value.trim(),
        baseUrl: baseUrl.value.trim()
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || t("settingsSaveFailed"));
    }
    settingsNote.textContent = t("settingsSaved");
    apiKey.value = "";
    await loadSettings();
    window.setTimeout(() => settingsModal.close(), 500);
  } catch (error) {
    settingsNote.textContent = error.message;
    settingsNote.classList.add("error");
  }
}

async function submitSynthesis(event) {
  event.preventDefault();
  const file = voiceFile.files[0];
  if (!file) {
    setStatus(t("uploadHint"), "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = t("submitting");
  setStatus(t("preparingSubmit"));
  setSteps("request");

  try {
    const preparedFile = await prepareVoiceFile(file);
    const formData = new FormData();
    formData.append("voiceFile", preparedFile);
    formData.append("stylePrompt", form.elements.stylePrompt.value);
    formData.append("text", form.elements.text.value);

    const response = await fetch("/api/synthesize/jobs", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || t("submitFailed"));
    }

    activeJobId = data.id;
    knownStatuses.set(data.id, data.status);
    setStatus(t("taskSubmitted"));
    setSteps("request");
    await loadJobs();
    startPolling();
  } catch (error) {
    setSteps("upload");
    setStatus(error.message || t("submitFailedHint"), "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = t("submitBtn");
  }
}

function startPolling() {
  if (pollTimer) {
    return;
  }
  pollTimer = window.setInterval(loadJobs, 1500);
}

function stopPollingIfIdle(jobs) {
  const hasActiveJobs = jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING");
  if (!hasActiveJobs && pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function loadJobs() {
  try {
    const response = await fetch("/api/synthesize/jobs");
    const jobs = await response.json();
    if (!response.ok) {
      throw new Error(jobs.error || t("loadHistoryFailed"));
    }
    handleStatusTransitions(jobs);
    lastJobsSnapshot = jobs;
    renderHistory(jobs);
    updateActiveJob(jobs);
    stopPollingIfIdle(jobs);
    historyInitialized = true;
  } catch (error) {
    historyList.innerHTML = `<div class="empty-history">${escapeHtml(error.message)}</div>`;
  }
}

function handleStatusTransitions(jobs) {
  jobs.forEach((job) => {
    const previous = knownStatuses.get(job.id);
    if (historyInitialized && previous && previous !== job.status) {
      if (job.status === "SUCCEEDED") {
        notify(`${t("synthComplete")}: ${textPreview(job.text)}`);
      }
      if (job.status === "FAILED") {
        notify(`${t("synthFailed")}: ${textPreview(job.text)}`);
      }
    }
    knownStatuses.set(job.id, job.status);
  });
}

function updateActiveJob(jobs) {
  if (!activeJobId) {
    return;
  }
  const job = jobs.find((item) => item.id === activeJobId);
  if (!job) {
    return;
  }
  if (job.status === "QUEUED") {
    setSteps("request");
    setStatus(`${t("statusQueued")}: ${textPreview(job.text)}`);
  }
  if (job.status === "RUNNING") {
    setSteps("result");
    setStatus(`${t("statusRunning")}: ${textPreview(job.text)}`);
  }
  if (job.status === "SUCCEEDED") {
    setSteps("done");
    setStatus(`${t("synthComplete")}: ${textPreview(job.text)}。${formatDuration(job.mimoElapsedMillis)}`);
    playJob(job.id, job.text);
    activeJobId = "";
  }
  if (job.status === "FAILED") {
    setSteps("upload");
    setStatus(job.error || t("synthFailed"), "error");
    activeJobId = "";
  }
}

function renderHistory(jobs) {
  pruneSelection(jobs);
  updateBatchBar();
  updateSelectAllCheckbox(jobs);

  if (!jobs.length) {
    historyList.innerHTML = `<div class="empty-history">${t("noHistory")}</div>`;
    return;
  }

  historyList.innerHTML = jobs.map((job) => {
    const canUseAudio = job.status === "SUCCEEDED";
    const checked = selectedJobs.has(job.id);
    const meta = [
      escapeHtml(new Date(job.createdAt).toLocaleString()),
      canUseAudio ? `<span data-duration-job-id="${escapeHtml(job.id)}">${t("readingDuration")}</span>` : "",
      escapeHtml(job.originalFilename)
    ].filter(Boolean).join(" · ");
    return `
      <article class="history-item" data-job-id="${escapeHtml(job.id)}">
        <div class="history-item-main">
          <input type="checkbox" class="history-checkbox" data-job-id="${escapeHtml(job.id)}" ${checked ? "checked" : ""} />
          <div class="history-item-body">
            <div class="history-top">
              <div class="history-title" title="${escapeHtml(job.text)}">${escapeHtml(textPreview(job.text))}</div>
              <span class="status-badge ${statusClass(job.status)}">${statusLabel(job.status)}</span>
            </div>
            <div class="history-meta">${meta}</div>
            ${job.error ? `<div class="history-error">${escapeHtml(job.error)}</div>` : ""}
            <div class="history-actions">
              <button type="button" data-action="play" data-job-id="${escapeHtml(job.id)}" data-job-text="${escapeHtml(job.text)}" class="${canUseAudio ? "" : "disabled"}">${t("play")}</button>
              <button type="button" data-action="download" data-job-id="${escapeHtml(job.id)}" data-job-text="${escapeHtml(job.text)}" class="${canUseAudio ? "" : "disabled"}">${t("download")}</button>
            </div>
            <button type="button" class="history-delete-btn" data-action="delete" data-job-id="${escapeHtml(job.id)}">${t("delete")}</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
  hydrateHistoryDurations(jobs.filter((job) => job.status === "SUCCEEDED"));
}

async function playJob(jobId, text) {
  const url = await getJobAudioUrl(jobId);
  if (!url) {
    return;
  }
  setCurrentAudio(url, text);
}

async function downloadJob(jobId, text) {
  const url = await getJobAudioUrl(jobId);
  if (!url) {
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.download = buildDownloadFileName(text);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function deleteJob(jobId) {
  showConfirm(t("confirmDeleteMsg"), async () => {
    try {
      const response = await fetch(`/api/synthesize/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("deleteFailed"));
      }
      cleanupJobCache(jobId);
      selectedJobs.delete(jobId);
      if (activeJobId === jobId) {
        activeJobId = "";
        resetAudio();
        setSteps("upload");
        setStatus(t("taskDeleted"));
      }
      await loadJobs();
    } catch (error) {
      setStatus(error.message || t("deleteFailed"), "error");
    }
  });
}

async function batchDeleteJobs() {
  const ids = [...selectedJobs];
  if (!ids.length) return;
  showConfirm(t("batchConfirmMsg").replace("{n}", ids.length), async () => {
    try {
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
        cleanupJobCache(id);
        selectedJobs.delete(id);
        if (activeJobId === id) {
          activeJobId = "";
          resetAudio();
          setSteps("upload");
          setStatus(t("taskDeleted"));
        }
      });
      await loadJobs();
    } catch (error) {
      setStatus(error.message || t("batchDeleteFailed"), "error");
    }
  });
}

function cleanupJobCache(jobId) {
  if (audioUrlCache.has(jobId)) {
    URL.revokeObjectURL(audioUrlCache.get(jobId));
    audioUrlCache.delete(jobId);
  }
  peaksCache.delete(jobId);
  durationCache.delete(jobId);
  knownStatuses.delete(jobId);
}

function showConfirm(message, onConfirm) {
  pendingDeleteIds = onConfirm;
  confirmMsg.textContent = message;
  confirmModal.showModal();
}

function pruneSelection(jobs) {
  const jobIds = new Set(jobs.map((j) => j.id));
  for (const id of selectedJobs) {
    if (!jobIds.has(id)) {
      selectedJobs.delete(id);
    }
  }
}

function updateBatchBar() {
  const count = selectedJobs.size;
  if (count > 0) {
    batchBar.classList.add("visible");
    batchCount.textContent = currentLang === "zh" ? `已选 ${count} 项` : `${count} selected`;
  } else {
    batchBar.classList.remove("visible");
  }
}

function updateSelectAllCheckbox(jobs) {
  if (!jobs.length) {
    selectAllJobs.checked = false;
    selectAllJobs.indeterminate = false;
    return;
  }
  const allSelected = jobs.every((j) => selectedJobs.has(j.id));
  const someSelected = jobs.some((j) => selectedJobs.has(j.id));
  selectAllJobs.checked = allSelected;
  selectAllJobs.indeterminate = !allSelected && someSelected;
}

let lastJobsSnapshot = [];

async function getJobAudioUrl(jobId) {
  if (audioUrlCache.has(jobId)) {
    return audioUrlCache.get(jobId);
  }
  const response = await fetch(`/api/synthesize/jobs/${encodeURIComponent(jobId)}/audio`);
  if (!response.ok) {
    return "";
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  audioUrlCache.set(jobId, url);
  return url;
}

async function hydrateHistoryDurations(jobs) {
  await Promise.all(jobs.map(async (job) => {
    const target = historyList.querySelector(`[data-duration-job-id="${CSS.escape(job.id)}"]`);
    if (!target) {
      return;
    }
    if (durationCache.has(job.id)) {
      target.textContent = `${t("audioPrefix")} ${formatAudioDuration(durationCache.get(job.id))}`;
      return;
    }
    const url = await getJobAudioUrl(job.id);
    if (!url) {
      target.textContent = t("durationUnknown");
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
      target.textContent = `${t("audioPrefix")} ${formatAudioDuration(audio.duration)}`;
    } else {
      target.textContent = t("durationUnknown");
    }
  }));
}

function setCurrentAudio(url, text) {
  currentAudioUrl = url;
  audioPlayer.src = url;
  downloadLink.href = url;
  downloadLink.setAttribute("download", buildDownloadFileName(text));
  downloadLink.classList.remove("disabled");
  playerPlayIcon.style.display = "";
  playerPauseIcon.style.display = "none";
  playerProgressFill.style.width = "0%";
  playerTime.textContent = "0:00";
  playerText.textContent = text || "";
  loadAndDrawWaveform(url);
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    settingsNote.textContent = t("notifUnsupported");
    settingsNote.classList.add("error");
    return;
  }
  const permission = await Notification.requestPermission();
  updateNotificationButton();
  if (permission === "granted") {
    settingsNote.textContent = t("notifGranted");
    settingsNote.classList.remove("error");
  } else {
    settingsNote.textContent = t("notifDeniedMsg");
    settingsNote.classList.add("error");
  }
}

function updateNotificationButton() {
  if (!("Notification" in window)) {
    enableNotifications.disabled = true;
    enableNotifications.textContent = t("notifBtnUnsupported");
    return;
  }
  if (Notification.permission === "granted") {
    enableNotifications.disabled = true;
    enableNotifications.textContent = t("notifBtnGranted");
  } else if (Notification.permission === "denied") {
    enableNotifications.disabled = true;
    enableNotifications.textContent = t("notifBtnDenied");
  } else {
    enableNotifications.disabled = false;
    enableNotifications.textContent = t("notifBtn");
  }
}

function notify(message) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  new Notification(t("notifyTitle"), {
    body: message
  });
}

voiceFile.addEventListener("change", updateFileName);
form.addEventListener("submit", submitSynthesis);
settingsForm.addEventListener("submit", saveSettings);
openSettings.addEventListener("click", () => {
  updateNotificationButton();
  settingsModal.showModal();
});
closeSettings.addEventListener("click", () => settingsModal.close());
cancelSettings.addEventListener("click", () => settingsModal.close());
enableNotifications.addEventListener("click", requestNotifications);
clearButton.addEventListener("click", () => {
  resetAudio();
  activeJobId = "";
  setStatus(t("taskCleared"));
  setSteps("upload");
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (button && !button.classList.contains("disabled")) {
    if (button.dataset.action === "play") {
      playJob(button.dataset.jobId, button.dataset.jobText);
    }
    if (button.dataset.action === "download") {
      downloadJob(button.dataset.jobId, button.dataset.jobText);
    }
    if (button.dataset.action === "delete") {
      deleteJob(button.dataset.jobId);
    }
    return;
  }
  const checkbox = event.target.closest(".history-checkbox");
  if (checkbox) {
    if (checkbox.checked) {
      selectedJobs.add(checkbox.dataset.jobId);
    } else {
      selectedJobs.delete(checkbox.dataset.jobId);
    }
    updateBatchBar();
    updateSelectAllCheckbox(lastJobsSnapshot);
  }
});

selectAllJobs.addEventListener("change", () => {
  if (selectAllJobs.checked) {
    lastJobsSnapshot.forEach((j) => selectedJobs.add(j.id));
  } else {
    lastJobsSnapshot.forEach((j) => selectedJobs.delete(j.id));
  }
  document.querySelectorAll(".history-checkbox").forEach((cb) => {
    cb.checked = selectedJobs.has(cb.dataset.jobId);
  });
  updateBatchBar();
});

batchDeleteBtn.addEventListener("click", () => batchDeleteJobs());

confirmOk.addEventListener("click", () => {
  confirmModal.close();
  if (typeof pendingDeleteIds === "function") {
    const fn = pendingDeleteIds;
    pendingDeleteIds = null;
    fn();
  }
});

confirmCancel.addEventListener("click", () => {
  confirmModal.close();
  pendingDeleteIds = null;
});

styleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    stylePrompt.value = button.dataset.stylePrompt || "";
    stylePrompt.focus();
  });
});

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, () => dropZone.classList.add("dragging"));
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove("dragging"));
});

dropZone.addEventListener("drop", (event) => {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) {
    return;
  }
  voiceFile.files = files;
  updateFileName();
});

audioPlayer.addEventListener("play", () => {
  playerPlayIcon.style.display = "none";
  playerPauseIcon.style.display = "";
  if (wavePeaks) {
    waveAnimFrame = requestAnimationFrame(updatePlayhead);
  }
});

audioPlayer.addEventListener("pause", () => {
  playerPlayIcon.style.display = "";
  playerPauseIcon.style.display = "none";
  if (waveAnimFrame) {
    cancelAnimationFrame(waveAnimFrame);
    waveAnimFrame = null;
  }
});

audioPlayer.addEventListener("ended", () => {
  playerPlayIcon.style.display = "";
  playerPauseIcon.style.display = "none";
  if (waveAnimFrame) {
    cancelAnimationFrame(waveAnimFrame);
    waveAnimFrame = null;
  }
  renderWaveform(0);
  playerProgressFill.style.width = "0%";
  playerTime.textContent = formatAudioDuration(audioPlayer.duration) || "0:00";
});

audioPlayer.addEventListener("timeupdate", () => {
  if (wavePeaks && audioPlayer.duration && !waveAnimFrame) {
    const progress = audioPlayer.currentTime / audioPlayer.duration;
    renderWaveform(progress);
    playerProgressFill.style.width = (progress * 100) + "%";
    playerTime.textContent = formatAudioDuration(audioPlayer.currentTime);
  }
});

playerPlayBtn.addEventListener("click", () => {
  if (!audioPlayer.src) return;
  if (audioPlayer.paused) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
});

let progressDragging = false;

function seekToProgress(event) {
  if (!audioPlayer.duration) return;
  const rect = playerProgress.getBoundingClientRect();
  const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  audioPlayer.currentTime = progress * audioPlayer.duration;
  renderWaveform(progress);
  playerProgressFill.style.width = (progress * 100) + "%";
}

playerProgress.addEventListener("mousedown", (event) => {
  progressDragging = true;
  seekToProgress(event);
});

window.addEventListener("mousemove", (event) => {
  if (progressDragging) {
    seekToProgress(event);
  }
});

window.addEventListener("mouseup", () => {
  progressDragging = false;
});

window.addEventListener("resize", () => {
  if (wavePeaks && audioPlayer.duration) {
    renderWaveform(audioPlayer.currentTime / audioPlayer.duration);
  } else {
    renderWaveform();
  }
});

const translations = {
  zh: {
    title: "MiMo 声音复刻合成",
    subtitle: "上传 mp3、wav 或 m4a 声音样本，输入文本，生成复刻音色的 wav 音频。",
    settingsBtn: "设置",
    composerTitle: "合成设置",
    composerDesc: "合成文本会作为 assistant 消息，风格指令会作为 user 消息。",
    keyChecking: "检查配置中",
    keyConfigured: "API Key 已配置",
    keyMissing: "需要配置 API Key",
    uploadDefault: "选择或拖入声音样本",
    uploadHint: "支持 mp3 / wav / m4a，Base64 编码后不超过 10 MB。",
    chooseFile: "选择文件",
    stylePromptLabel: "风格指令",
    stylePromptPlaceholder: "例如：温柔、自然、语速适中，像在给朋友讲解。",
    outputFormatLabel: "输出格式",
    styleHelperTitle: "不会写风格指令？",
    styleHelperHint: "可以从语气、情绪、语速、角色感这几类描述。",
    chipNatural: "自然讲解", chipPro: "专业讲解", chipGentle: "温柔放松",
    chipExcited: "兴奋开心", chipNarration: "专业旁白", chipRadio: "深夜电台",
    styleHelperNote: "也可以在合成文本开头加标签，例如：（开心）今天真的太棒了！ 或 [轻笑] 没想到你还记得。",
    synthTextLabel: "合成文本",
    synthTextPlaceholder: "请输入要合成的文本，可加入风格标签和音频标签。",
    submitBtn: "提交到合成队列",
    submitting: "提交中...",
    taskTitle: "当前任务",
    statusWaiting: "等待上传声音样本。",
    stepUpload: "等待音频样本",
    stepRequest: "发送复刻请求",
    stepResult: "生成可播放音频",
    tagGuide: '<div class="guide-title">标签用法速查</div><div class="guide-section"><div class="guide-heading">风格标签 <span class="guide-desc">放在文本开头，控制整体语气</span></div><div class="guide-row"><span class="guide-label">格式</span>(关键词)文本 支持 () （） [] 可叠加</div><div class="guide-row"><span class="guide-label">情绪</span>开心 悲伤 愤怒 恐惧 惊讶 兴奋 委屈 平静 冷漠 · 怅然 欣慰 无奈 愧疚 释然 嫉妒 厌倦 忐忑 动情</div><div class="guide-row"><span class="guide-label">语调</span>温柔 高冷 活泼 严肃 慵懒 俏皮 深沉 干练 凌厉</div><div class="guide-row"><span class="guide-label">音色</span>磁性 醇厚 清亮 空灵 稚嫩 苍老 甜美 沙哑 醇雅</div><div class="guide-row"><span class="guide-label">腔调</span>夹子音 御姐音 正太音 大叔音 台湾腔</div><div class="guide-row"><span class="guide-label">方言</span>东北话 四川话 河南话 粤语</div><div class="guide-row"><span class="guide-label">特殊</span>唱歌（必须放在最开头）</div></div><div class="guide-section"><div class="guide-heading">音频标签 <span class="guide-desc">插在文本任意位置，控制细节表现</span></div><div class="guide-row"><span class="guide-label">格式</span>[关键词]</div><div class="guide-row"><span class="guide-label">呼吸</span>吸气 深呼吸 叹气 长叹一口气 喘息 屏息</div><div class="guide-row"><span class="guide-label">情绪</span>紧张 害怕 激动 疲惫 委屈 撒娇 心虚 震惊 不耐烦</div><div class="guide-row"><span class="guide-label">声音</span>颤抖 声音颤抖 变调 破音 鼻音 气声 沙哑</div><div class="guide-row"><span class="guide-label">哭笑</span>笑 轻笑 大笑 冷笑 抽泣 呜咽 哽咽 嚎啕大哭</div></div>',
    downloadWav: "下载 wav",
    clearBtn: "清空当前",
    historyTitle: "历史合成结果",
    historyDesc: "后台任务完成后会保存在本机历史中。",
    selectAll: "全选",
    batchDeleteBtn: "删除选中",
    emptyHistory: "暂无历史任务。",
    settingsTitle: "接口设置",
    settingsDesc: "API Key 只提交给本地后端代理，并持久化在本机用户目录。",
    apiKeyLabel: "MiMo API Key",
    apiKeyPlaceholder: "请输入 MiMo API Key",
    baseUrlLabel: "API Base URL",
    notifBtn: "获取通知权限",
    notifBtnGranted: "已获取通知权限",
    notifBtnDenied: "通知权限已被拒绝",
    notifBtnUnsupported: "浏览器不支持通知",
    notifDesc: "点击按钮即可获取浏览器通知权限，在合成任务成功或失败时，可以及时通知你。",
    settingsNote: "保存后会写入本机用户目录，不会在前端接口中返回明文 Key。",
    cancelBtn: "取消",
    saveBtn: "保存设置",
    confirmDelete: "确认删除",
    langToggle: "EN",
    statusQueued: "排队中", statusRunning: "合成中",
    statusSucceeded: "已完成", statusFailed: "失败",
    notifyTitle: "MiMo 声音复刻合成",
    synthComplete: "合成完成", synthFailed: "合成失败",
    play: "播放", download: "下载", delete: "删除",
    noHistory: "暂无历史任务。",
    audioDuration: "音频",
    durationUnknown: "音频时长未知",
    confirmDeleteMsg: "确认删除这条合成记录？删除后无法恢复。",
    batchConfirmMsg: "确认删除选中的 {n} 条合成记录？删除后无法恢复。",
    convertingAudio: "正在将音频转为 24kHz 单声道 WAV…",
    preparingSubmit: "正在准备音频并提交到后台队列。",
    taskSubmitted: "任务已进入后台队列。你可以继续修改合成文本并提交下一条。",
    taskCleared: "当前结果已清空，历史结果仍保留。",
    taskDeleted: "当前任务已删除。",
    settingsSaved: "设置已保存到本机，下次启动会自动读取。",
    settingsSaving: "正在保存设置...",
    notifGranted: "通知权限已获取，任务完成时会提醒你。",
    notifDeniedMsg: "通知权限未获取，你可以在浏览器地址栏左侧重新授权。",
    notifUnsupported: "当前浏览器不支持原生通知。",
    unnamedText: "未命名文本",
    readingDuration: "读取时长中",
    audioPrefix: "音频",
    settingsReadFailed: "设置读取失败",
    submitFailed: "提交失败",
    submitFailedHint: "提交失败，请检查 API Key 和音频文件。",
    loadHistoryFailed: "读取历史失败",
    deleteFailed: "删除失败",
    batchDeleteFailed: "批量删除失败",
    convertFailed: "浏览器端转换失败，将上传原始文件。",
    browserNoSupport: "当前浏览器不支持音频转换，请先手动转成 wav 格式再上传。",
    settingsSaveFailed: "设置保存失败"
  },
  en: {
    title: "MiMo Voice Cloning Synthesis",
    subtitle: "Upload mp3, wav or m4a voice samples, enter text, and generate WAV audio in a cloned voice.",
    settingsBtn: "Settings",
    composerTitle: "Synthesis Settings",
    composerDesc: "Synthesis text is sent as the assistant message; style prompt as the user message.",
    keyChecking: "Checking config",
    keyConfigured: "API Key Configured",
    keyMissing: "API Key Required",
    uploadDefault: "Select or drop a voice sample",
    uploadHint: "Supports mp3 / wav / m4a. Max 10 MB after Base64 encoding.",
    chooseFile: "Choose File",
    stylePromptLabel: "Style Prompt",
    stylePromptPlaceholder: "e.g., gentle, natural, moderate pace, like explaining to a friend.",
    outputFormatLabel: "Output Format",
    styleHelperTitle: "Need help with style prompts?",
    styleHelperHint: "Describe tone, emotion, speed, or character feel.",
    chipNatural: "Natural", chipPro: "Professional", chipGentle: "Gentle",
    chipExcited: "Excited", chipNarration: "Narration", chipRadio: "Late Night",
    styleHelperNote: 'You can also add tags in text, e.g.: (happy) What a great day! or [chuckle] I didn\'t expect that.',
    synthTextLabel: "Synthesis Text",
    synthTextPlaceholder: "Enter text to synthesize. You can add style and audio tags.",
    submitBtn: "Submit to Queue",
    submitting: "Submitting...",
    taskTitle: "Current Task",
    statusWaiting: "Waiting for voice sample upload.",
    stepUpload: "Awaiting audio sample",
    stepRequest: "Sending clone request",
    stepResult: "Generating playable audio",
    tagGuide: '<div class="guide-title">Tag Reference</div><div class="guide-section"><div class="guide-heading">Style Tags <span class="guide-desc">At the start of text — controls overall tone</span></div><div class="guide-row"><span class="guide-label">Format</span>(keyword)text — supports () （） [] — stackable</div><div class="guide-row"><span class="guide-label">Emotion</span>Happy Sad Angry Fearful Surprised Excited Grievance Calm Indifferent · Wistful Relieved Helpless Guilty</div><div class="guide-row"><span class="guide-label">Tone</span>Gentle Cool Lively Serious Lazy Playful Deep Sharp Intense</div><div class="guide-row"><span class="guide-label">Timbre</span>Magnetic Rich Clear Ethereal Youthful Aged Sweet Husky Elegant</div><div class="guide-row"><span class="guide-label">Style</span>Cutesy Mature-boy Young-boy Deep-voice TW-accent</div><div class="guide-row"><span class="guide-label">Dialect</span>Northeastern Sichuan Henan Cantonese</div><div class="guide-row"><span class="guide-label">Special</span>Singing (must be at the very start)</div></div><div class="guide-section"><div class="guide-heading">Audio Tags <span class="guide-desc">Inserted anywhere in text — fine-grained control</span></div><div class="guide-row"><span class="guide-label">Format</span>[keyword]</div><div class="guide-row"><span class="guide-label">Breath</span>Inhale Deep-breath Sigh Long-sigh Pant Hold-breath</div><div class="guide-row"><span class="guide-label">Emotion</span>Nervous Scared Excited Exhausted Upset Cozy Guilty Shocked Impatient</div><div class="guide-row"><span class="guide-label">Voice</span>Tremble Shake Pitch-shift Crack Nasal Breathy Husky</div><div class="guide-row"><span class="guide-label">Laugh/Cry</span>Laugh Chuckle Guffaw Sneer Sob Whimper Choke Wail</div></div>',
    downloadWav: "Download wav",
    clearBtn: "Clear Current",
    historyTitle: "Synthesis History",
    historyDesc: "Completed tasks are saved locally on your machine.",
    selectAll: "Select All",
    batchDeleteBtn: "Delete Selected",
    emptyHistory: "No history yet.",
    settingsTitle: "API Settings",
    settingsDesc: "API Key is only sent to the local backend proxy and persisted on your machine.",
    apiKeyLabel: "MiMo API Key",
    apiKeyPlaceholder: "Enter MiMo API Key",
    baseUrlLabel: "API Base URL",
    notifBtn: "Get Notification Permission",
    notifBtnGranted: "Notifications Enabled",
    notifBtnDenied: "Notifications Blocked",
    notifBtnUnsupported: "Browser Not Supported",
    notifDesc: "Click to enable browser notifications — you'll be alerted when synthesis tasks succeed or fail.",
    settingsNote: "Saved locally. The plain-text key is never returned to the frontend.",
    cancelBtn: "Cancel",
    saveBtn: "Save Settings",
    confirmDelete: "Confirm Delete",
    langToggle: "中",
    statusQueued: "Queued", statusRunning: "Synthesizing",
    statusSucceeded: "Completed", statusFailed: "Failed",
    notifyTitle: "MiMo Voice Cloning",
    synthComplete: "Synthesis complete", synthFailed: "Synthesis failed",
    play: "Play", download: "Download", delete: "Delete",
    noHistory: "No history yet.",
    audioDuration: "Audio",
    durationUnknown: "Duration unknown",
    confirmDeleteMsg: "Delete this synthesis record? This cannot be undone.",
    batchConfirmMsg: "Delete {n} selected records? This cannot be undone.",
    convertingAudio: "Converting audio to 24kHz mono WAV…",
    preparingSubmit: "Preparing audio and submitting to queue.",
    taskSubmitted: "Task queued. You can keep editing text and submit the next one.",
    taskCleared: "Current result cleared. History is preserved.",
    taskDeleted: "Current task deleted.",
    settingsSaved: "Settings saved. They'll be loaded on next startup.",
    settingsSaving: "Saving settings...",
    notifGranted: "Notifications enabled — you'll be alerted on task completion.",
    notifDeniedMsg: "Notifications not granted. You can re-enable from the browser address bar.",
    notifUnsupported: "This browser does not support native notifications.",
    unnamedText: "Untitled",
    readingDuration: "Reading duration",
    audioPrefix: "Audio",
    settingsReadFailed: "Failed to load settings",
    submitFailed: "Submission failed",
    submitFailedHint: "Submission failed. Please check your API Key and audio file.",
    loadHistoryFailed: "Failed to load history",
    deleteFailed: "Delete failed",
    batchDeleteFailed: "Batch delete failed",
    convertFailed: "Browser conversion failed, uploading original file.",
    browserNoSupport: "This browser doesn't support audio conversion. Please convert to WAV manually.",
    settingsSaveFailed: "Failed to save settings"
  }
};

let currentLang = localStorage.getItem("mimo-lang") || "zh";

function t(key) { return translations[currentLang][key] || translations.zh[key] || key; }

function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("mimo-lang", lang);
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (translations[lang][key] !== undefined) el.textContent = translations[lang][key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (translations[lang][key] !== undefined) el.placeholder = translations[lang][key];
  });
  document.querySelectorAll("[data-i18n-html]").forEach(el => {
    const key = el.getAttribute("data-i18n-html");
    if (translations[lang][key] !== undefined) el.innerHTML = translations[lang][key];
  });
  const langBtn = document.querySelector("#langToggle");
  if (langBtn) langBtn.textContent = lang === "zh" ? "EN" : "中";
  updateNotificationButton();
  renderHistory(lastJobsSnapshot);
}

const langToggle = document.querySelector("#langToggle");

loadSettings();
updateNotificationButton();
requestAnimationFrame(() => renderWaveform());
loadJobs().then(() => {
  if (Array.from(knownStatuses.values()).some((status) => status === "QUEUED" || status === "RUNNING")) {
    startPolling();
  }
});

langToggle.addEventListener("click", () => {
  switchLanguage(currentLang === "zh" ? "en" : "zh");
});

// Apply saved language on load
if (currentLang !== "zh") {
  switchLanguage(currentLang);
}
