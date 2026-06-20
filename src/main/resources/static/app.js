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
  fileName.textContent = file ? file.name : "选择或拖入声音样本";
}

async function prepareVoiceFile(file) {
  setStatus("正在将音频转为 24kHz 单声道 WAV…");
  try {
    const wavBlob = await convertAudioToWav(file);
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const wavName = baseName + "-converted.wav";
    return new File([wavBlob], wavName, { type: "audio/wav" });
  } catch (e) {
    setStatus("浏览器端转换失败，将上传原始文件。");
    return file;
  }
}

async function convertAudioToWav(file) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !window.OfflineAudioContext) {
    throw new Error("当前浏览器不支持音频转换，请先手动转成 wav 格式再上传。");
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
  return compact.length > 28 ? `${compact.slice(0, 28)}...` : compact || "未命名文本";
}

function statusLabel(status) {
  return {
    QUEUED: "排队中",
    RUNNING: "合成中",
    SUCCEEDED: "已完成",
    FAILED: "失败"
  }[status] || status;
}

function statusClass(status) {
  return String(status || "").toLowerCase();
}

function formatDuration(ms) {
  if (!ms || ms <= 0) {
    return "";
  }
  return `MiMo ${Math.max(1, Math.round(ms / 1000))} 秒`;
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
      keyState.textContent = "API Key 已配置";
      keyState.classList.remove("missing");
      apiKey.placeholder = `当前：${data.apiKey}`;
    } else {
      keyState.textContent = "需要配置 API Key";
      keyState.classList.add("missing");
      apiKey.placeholder = "请输入 MiMo API Key";
    }
  } catch (error) {
    keyState.textContent = "设置读取失败";
    keyState.classList.add("missing");
  }
}

async function saveSettings(event) {
  event.preventDefault();
  settingsNote.textContent = "正在保存设置...";
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
      throw new Error(data.error || "设置保存失败");
    }
    settingsNote.textContent = "设置已保存到本机，下次启动会自动读取。";
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
    setStatus("请先上传一段 mp3、wav 或 m4a 声音样本。", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "提交中...";
  setStatus("正在准备音频并提交到后台队列。");
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
      throw new Error(data.error || "提交失败");
    }

    activeJobId = data.id;
    knownStatuses.set(data.id, data.status);
    setStatus("任务已进入后台队列。你可以继续修改合成文本并提交下一条。");
    setSteps("request");
    await loadJobs();
    startPolling();
  } catch (error) {
    setSteps("upload");
    setStatus(error.message || "提交失败，请检查 API Key 和音频文件。", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "提交到合成队列";
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
      throw new Error(jobs.error || "读取历史失败");
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
        notify(`合成完成：${textPreview(job.text)}`);
      }
      if (job.status === "FAILED") {
        notify(`合成失败：${textPreview(job.text)}`);
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
    setStatus(`任务排队中：${textPreview(job.text)}`);
  }
  if (job.status === "RUNNING") {
    setSteps("result");
    setStatus(`MiMo 正在合成：${textPreview(job.text)}`);
  }
  if (job.status === "SUCCEEDED") {
    setSteps("done");
    setStatus(`合成完成：${textPreview(job.text)}。${formatDuration(job.mimoElapsedMillis)}`);
    playJob(job.id, job.text);
    activeJobId = "";
  }
  if (job.status === "FAILED") {
    setSteps("upload");
    setStatus(job.error || "合成失败。", "error");
    activeJobId = "";
  }
}

function renderHistory(jobs) {
  pruneSelection(jobs);
  updateBatchBar();
  updateSelectAllCheckbox(jobs);

  if (!jobs.length) {
    historyList.innerHTML = `<div class="empty-history">暂无历史任务。</div>`;
    return;
  }

  historyList.innerHTML = jobs.map((job) => {
    const canUseAudio = job.status === "SUCCEEDED";
    const checked = selectedJobs.has(job.id);
    const meta = [
      escapeHtml(new Date(job.createdAt).toLocaleString()),
      canUseAudio ? `<span data-duration-job-id="${escapeHtml(job.id)}">读取时长中</span>` : "",
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
              <button type="button" data-action="play" data-job-id="${escapeHtml(job.id)}" data-job-text="${escapeHtml(job.text)}" class="${canUseAudio ? "" : "disabled"}">播放</button>
              <button type="button" data-action="download" data-job-id="${escapeHtml(job.id)}" data-job-text="${escapeHtml(job.text)}" class="${canUseAudio ? "" : "disabled"}">下载</button>
            </div>
            <button type="button" class="history-delete-btn" data-action="delete" data-job-id="${escapeHtml(job.id)}">删除</button>
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
  showConfirm("确认删除这条合成记录？删除后无法恢复。", async () => {
    try {
      const response = await fetch(`/api/synthesize/jobs/${encodeURIComponent(jobId)}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "删除失败");
      }
      cleanupJobCache(jobId);
      selectedJobs.delete(jobId);
      if (activeJobId === jobId) {
        activeJobId = "";
        resetAudio();
        setSteps("upload");
        setStatus("当前任务已删除。");
      }
      await loadJobs();
    } catch (error) {
      setStatus(error.message || "删除失败", "error");
    }
  });
}

async function batchDeleteJobs() {
  const ids = [...selectedJobs];
  if (!ids.length) return;
  showConfirm(`确认删除选中的 ${ids.length} 条合成记录？删除后无法恢复。`, async () => {
    try {
      const response = await fetch("/api/synthesize/jobs/batch", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "批量删除失败");
      }
      ids.forEach((id) => {
        cleanupJobCache(id);
        selectedJobs.delete(id);
        if (activeJobId === id) {
          activeJobId = "";
          resetAudio();
          setSteps("upload");
          setStatus("当前任务已删除。");
        }
      });
      await loadJobs();
    } catch (error) {
      setStatus(error.message || "批量删除失败", "error");
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
    batchCount.textContent = `已选 ${count} 项`;
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
      target.textContent = `音频 ${formatAudioDuration(durationCache.get(job.id))}`;
      return;
    }
    const url = await getJobAudioUrl(job.id);
    if (!url) {
      target.textContent = "音频时长未知";
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
      target.textContent = `音频 ${formatAudioDuration(audio.duration)}`;
    } else {
      target.textContent = "音频时长未知";
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
    settingsNote.textContent = "当前浏览器不支持原生通知。";
    settingsNote.classList.add("error");
    return;
  }
  const permission = await Notification.requestPermission();
  updateNotificationButton();
  if (permission === "granted") {
    settingsNote.textContent = "通知权限已获取，任务完成时会提醒你。";
    settingsNote.classList.remove("error");
  } else {
    settingsNote.textContent = "通知权限未获取，你可以在浏览器地址栏左侧重新授权。";
    settingsNote.classList.add("error");
  }
}

function updateNotificationButton() {
  if (!("Notification" in window)) {
    enableNotifications.disabled = true;
    enableNotifications.textContent = "浏览器不支持通知";
    return;
  }
  if (Notification.permission === "granted") {
    enableNotifications.disabled = true;
    enableNotifications.textContent = "已获取通知权限";
  } else if (Notification.permission === "denied") {
    enableNotifications.disabled = true;
    enableNotifications.textContent = "通知权限已被拒绝";
  } else {
    enableNotifications.disabled = false;
    enableNotifications.textContent = "获取通知权限";
  }
}

function notify(message) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  new Notification("MiMo 声音复刻合成", {
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
  setStatus("当前结果已清空，历史结果仍保留。");
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

loadSettings();
updateNotificationButton();
requestAnimationFrame(() => renderWaveform());
loadJobs().then(() => {
  if (Array.from(knownStatuses.values()).some((status) => status === "QUEUED" || status === "RUNNING")) {
    startPolling();
  }
});
