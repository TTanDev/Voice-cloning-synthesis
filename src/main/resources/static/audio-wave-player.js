(function () {
  const DEFAULT_BARS = [0.3, 0.5, 0.7, 0.4, 0.8, 0.6, 0.9, 0.35, 0.75, 0.55, 0.65, 0.85, 0.45, 0.7, 0.3, 0.6, 0.8, 0.5, 0.9, 0.4, 0.7, 0.55, 0.85, 0.65, 0.35, 0.75, 0.5, 0.8, 0.45, 0.6];
  const BAR_COUNT = 30;
  const PEAK_SAMPLES = 1500;

  function createWavePlayer(root, options = {}) {
    const rootEl = typeof root === "string" ? document.querySelector(root) : root;
    if (!rootEl) {
      throw new Error("Wave player root not found.");
    }
    const defaultText = options.defaultText || "";
    const onBeforePlay = options.onBeforePlay || null;
    const showText = options.showText !== false;
    rootEl.innerHTML = `
      <div class="wave" data-wave>
        <canvas data-wave-canvas></canvas>
      </div>
      <div class="custom-player">
        <button class="player-play-btn" type="button" title="播放/暂停" data-play>
          <svg data-play-icon viewBox="0 0 24 24" width="20" height="20"><polygon points="6,3 20,12 6,21" fill="currentColor"/></svg>
          <svg data-pause-icon viewBox="0 0 24 24" width="20" height="20" style="display:none"><rect x="5" y="3" width="4" height="18" rx="1" fill="currentColor"/><rect x="15" y="3" width="4" height="18" rx="1" fill="currentColor"/></svg>
        </button>
        <div class="player-progress" data-progress>
          <div class="player-progress-fill" data-progress-fill></div>
        </div>
        <span class="player-time" data-time>0:00</span>
      </div>
      ${showText ? `<div class="player-text" data-player-text>${defaultText}</div>` : ""}
      <audio data-audio></audio>
    `;

    const waveContainer = rootEl.querySelector("[data-wave]");
    const waveCanvas = rootEl.querySelector("[data-wave-canvas]");
    const audio = rootEl.querySelector("[data-audio]");
    const playBtn = rootEl.querySelector("[data-play]");
    const playIcon = rootEl.querySelector("[data-play-icon]");
    const pauseIcon = rootEl.querySelector("[data-pause-icon]");
    const progress = rootEl.querySelector("[data-progress]");
    const progressFill = rootEl.querySelector("[data-progress-fill]");
    const time = rootEl.querySelector("[data-time]");
    const playerText = rootEl.querySelector("[data-player-text]");

    let audioContext = null;
    let peaks = null;
    let animFrame = null;
    let currentId = "";
    const peaksCache = new Map();

    function formatAudioDuration(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
      const totalSeconds = Math.round(seconds);
      const minutes = Math.floor(totalSeconds / 60);
      const rest = totalSeconds % 60;
      return `${minutes}:${String(rest).padStart(2, "0")}`;
    }

    function render(progressValue = 0) {
      const dpr = window.devicePixelRatio || 1;
      const width = waveContainer.offsetWidth;
      const height = waveContainer.offsetHeight;
      if (width === 0 || height === 0) return;
      waveCanvas.width = width * dpr;
      waveCanvas.height = height * dpr;
      const ctx = waveCanvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const bars = peaks ? getVisibleBars(progressValue) : DEFAULT_BARS;
      const gap = 4;
      const barWidth = Math.max(3, (width - 32 - (BAR_COUNT - 1) * gap) / BAR_COUNT);
      const maxBarH = height * 0.72;
      const startX = 16;
      for (let i = 0; i < BAR_COUNT; i += 1) {
        const x = startX + i * (barWidth + gap);
        const barH = Math.max(4, bars[i] * maxBarH);
        const y = (height - barH) / 2;
        ctx.fillStyle = peaks ? "rgba(54, 95, 145, 0.7)" : "rgba(54, 95, 145, 0.45)";
        ctx.fillRect(x, y, barWidth, barH);
      }
    }

    function getVisibleBars(progressValue) {
      const total = peaks.length;
      const maxOffset = Math.max(0, total - BAR_COUNT);
      const offset = progressValue * maxOffset;
      const baseIndex = Math.floor(offset);
      const frac = offset - baseIndex;
      const bars = [];
      for (let i = 0; i < BAR_COUNT; i += 1) {
        const idx = baseIndex + i;
        const curr = peaks[Math.min(idx, total - 1)] || 0;
        const next = peaks[Math.min(idx + 1, total - 1)] || 0;
        bars.push(curr + (next - curr) * frac);
      }
      return bars;
    }

    function extractPeaks(audioBuffer, sampleCount) {
      const channel = audioBuffer.getChannelData(0);
      const samplesPerPeak = Math.max(1, Math.floor(channel.length / sampleCount));
      const values = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i += 1) {
        let sum = 0;
        const start = i * samplesPerPeak;
        for (let j = 0; j < samplesPerPeak; j += 1) {
          sum += Math.abs(channel[start + j] || 0);
        }
        values[i] = sum / samplesPerPeak;
      }
      let maxPeak = 0;
      for (let i = 0; i < values.length; i += 1) {
        if (values[i] > maxPeak) maxPeak = values[i];
      }
      if (maxPeak > 0) {
        for (let i = 0; i < values.length; i += 1) values[i] = values[i] / maxPeak;
      }
      return values;
    }

    async function loadAndDraw(url) {
      try {
        if (peaksCache.has(url)) {
          peaks = peaksCache.get(url);
        } else {
          if (!audioContext) {
            const AC = window.AudioContext || window.webkitAudioContext;
            audioContext = new AC();
          }
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          peaks = extractPeaks(audioBuffer, PEAK_SAMPLES);
          peaksCache.set(url, peaks);
        }
        requestAnimationFrame(() => render(0));
      } catch (error) {
        peaks = null;
        render();
      }
    }

    function updatePlayhead() {
      if (!audio.duration) return;
      const progressValue = audio.currentTime / audio.duration;
      render(progressValue);
      progressFill.style.width = `${progressValue * 100}%`;
      time.textContent = formatAudioDuration(audio.currentTime);
      if (!audio.paused) {
        animFrame = requestAnimationFrame(updatePlayhead);
      }
    }

    function setSource(url, text = "", id = "") {
      currentId = id;
      audio.src = url;
      audio.load();
      if (playerText) playerText.textContent = text || "";
      playIcon.style.display = "";
      pauseIcon.style.display = "none";
      progressFill.style.width = "0%";
      time.textContent = "0:00";
      loadAndDraw(url);
    }

    function clear() {
      currentId = "";
      peaks = null;
      if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
      }
      audio.removeAttribute("src");
      audio.load();
      if (playerText) playerText.innerHTML = defaultText;
      progressFill.style.width = "0%";
      time.textContent = "0:00";
      playIcon.style.display = "";
      pauseIcon.style.display = "none";
      render();
    }

    playBtn.addEventListener("click", async () => {
      if (!audio.src) return;
      if (audio.paused) {
        if (onBeforePlay) await onBeforePlay(currentId);
        audio.play();
      } else {
        audio.pause();
      }
    });

    audio.addEventListener("play", () => {
      playIcon.style.display = "none";
      pauseIcon.style.display = "";
      if (peaks) animFrame = requestAnimationFrame(updatePlayhead);
    });

    audio.addEventListener("pause", () => {
      playIcon.style.display = "";
      pauseIcon.style.display = "none";
      if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
      }
    });

    audio.addEventListener("ended", () => {
      playIcon.style.display = "";
      pauseIcon.style.display = "none";
      render(0);
      progressFill.style.width = "0%";
      time.textContent = formatAudioDuration(audio.duration);
    });

    audio.addEventListener("timeupdate", () => {
      if (peaks && audio.duration && !animFrame) {
        const progressValue = audio.currentTime / audio.duration;
        render(progressValue);
        progressFill.style.width = `${progressValue * 100}%`;
        time.textContent = formatAudioDuration(audio.currentTime);
      }
    });

    let dragging = false;
    function seek(event) {
      if (!audio.duration) return;
      const rect = progress.getBoundingClientRect();
      const progressValue = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      audio.currentTime = progressValue * audio.duration;
      render(progressValue);
      progressFill.style.width = `${progressValue * 100}%`;
    }
    progress.addEventListener("mousedown", (event) => {
      dragging = true;
      seek(event);
    });
    window.addEventListener("mousemove", (event) => {
      if (dragging) seek(event);
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
    });
    window.addEventListener("resize", () => {
      if (peaks && audio.duration) render(audio.currentTime / audio.duration);
      else render();
    });

    requestAnimationFrame(() => render());
    return { setSource, clear, audio };
  }

  window.createWavePlayer = createWavePlayer;
})();
