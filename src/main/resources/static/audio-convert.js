(function () {
  async function convertAudioToWav(file) {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !window.OfflineAudioContext) {
      throw new Error("当前浏览器不支持音频转换，请先手动转成 wav 格式。");
    }

    const audioContext = new AudioContextClass();
    let decodedAudio;
    try {
      decodedAudio = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    } finally {
      await audioContext.close();
    }

    if (!Number.isFinite(decodedAudio.duration) || decodedAudio.duration <= 0) {
      throw new Error("音频无法识别，请更换样本。");
    }

    const sampleRate = 24000;
    const frameCount = Math.ceil(decodedAudio.duration * sampleRate);
    const offlineContext = new OfflineAudioContext(1, frameCount, sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = decodedAudio;
    source.connect(offlineContext.destination);
    source.start(0);
    const rendered = await offlineContext.startRendering();
    const wavBlob = encodeWav(rendered.getChannelData(0), sampleRate);
    validateWavBlob(wavBlob);
    return { blob: wavBlob, durationSeconds: rendered.duration, sampleRate };
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

  function validateWavBlob(blob) {
    if (!blob || blob.size <= 44) {
      throw new Error("转换后的 WAV 样本无效。");
    }
  }

  function convertedFileName(file) {
    const baseName = file.name.replace(/\.[^.]+$/, "") || "voice-sample";
    return `${baseName}-converted.wav`;
  }

  window.MimoAudioTools = {
    convertAudioToWav,
    convertedFileName
  };
})();
