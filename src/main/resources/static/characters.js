const characterForm = document.querySelector("#characterForm");
const characterName = document.querySelector("#characterName");
const characterDescription = document.querySelector("#characterDescription");
const characterFile = document.querySelector("#characterFile");
const characterFileName = document.querySelector("#characterFileName");
const characterDropZone = document.querySelector("#characterDropZone");
const characterStatus = document.querySelector("#characterStatus");
const createCharacterBtn = document.querySelector("#createCharacterBtn");
const characterList = document.querySelector("#characterList");
const characterPlayerStatus = document.querySelector("#characterPlayerStatus");
const characterConfirmModal = document.querySelector("#characterConfirmModal");
const characterConfirmMsg = document.querySelector("#characterConfirmMsg");
const characterConfirmOk = document.querySelector("#characterConfirmOk");
const characterConfirmCancel = document.querySelector("#characterConfirmCancel");
const langToggle = document.querySelector("#langToggle");
const characterSelectAll = document.querySelector("#characterSelectAll");
const characterBatchBar = document.querySelector("#characterBatchBar");
const characterBatchCount = document.querySelector("#characterBatchCount");
const characterBatchDeleteBtn = document.querySelector("#characterBatchDeleteBtn");

const translations = {
  zh: {
    title: "角色管理 - MiMo 声音复刻合成",
    charactersPageTitle: "角色管理",
    charactersPageDesc: "创建可复用的声音角色，合成时直接选择角色。",
    backHome: "返回合成页面",
    historyLink: "历史合成结果",
    createTitle: "创建角色",
    createDesc: "上传本地音频，转换通过后会保存为 24kHz 单声道 WAV 样本。",
    nameLabel: "角色名",
    namePlaceholder: "例如：课堂演讲音色",
    descLabel: "备注",
    descPlaceholder: "可写用途、声音特点或来源。",
    fileDefault: "选择或拖入角色音频样本",
    fileHint: "支持 mp3 / wav / m4a。创建前会先转换并校验。",
    chooseFile: "选择文件",
    statusIdle: "等待填写角色信息并选择样本。",
    createBtn: "转换并创建角色",
    listTitle: "角色列表",
    listDesc: "播放样本、查看用途，或删除未被历史记录使用的角色。",
    emptyCharacters: "暂无角色。",
    samplePlayerTitle: "样本播放器",
    samplePlayerIdle: "选择一个角色样本播放。",
    sampleWaveDefault: "角色样本会在这里显示波形。",
    cancelBtn: "取消",
    confirmDelete: "确认删除",
    selectAll: "全选",
    batchCount: "已选 0 项",
    batchDeleteBtn: "删除选中",
    unknownDuration: "未知时长",
    loadFailed: "读取角色失败",
    convertedSample: "转换后样本",
    playSample: "播放样本",
    delete: "删除",
    nameRequired: "请输入角色名。",
    fileRequired: "请选择角色音频样本。",
    converting: "转换中...",
    convertingStatus: "正在转换并校验音频样本。",
    createPassed: "转换通过，正在创建角色。",
    creating: "创建中...",
    createFailed: "创建角色失败",
    createSuccess: "角色“{name}”创建成功。",
    sampleLabel: "角色样本：{name}",
    viewingSample: "正在查看角色样本：{name}",
    deleteConfirm: "确认删除这个角色？",
    batchDeleteConfirm: "确认删除选中的 {n} 个角色？被历史记录使用的角色将无法删除。",
    batchDeleteFailed: "批量删除角色失败",
    batchDeleted: "已删除 {n} 个角色。",
    deleteFailed: "删除角色失败",
    deleted: "角色已删除。",
    langToggle: "EN"
  },
  en: {
    title: "Characters - MiMo Voice Cloning",
    charactersPageTitle: "Character Management",
    charactersPageDesc: "Create reusable voice characters and select them directly during synthesis.",
    backHome: "Synthesis",
    historyLink: "History",
    createTitle: "Create Character",
    createDesc: "Upload local audio. After conversion passes, it is saved as a 24kHz mono WAV sample.",
    nameLabel: "Character Name",
    namePlaceholder: "e.g. Classroom lecture voice",
    descLabel: "Notes",
    descPlaceholder: "Usage, voice qualities, or source.",
    fileDefault: "Select or drop a character sample",
    fileHint: "Supports mp3 / wav / m4a. It will be converted and validated first.",
    chooseFile: "Choose File",
    statusIdle: "Fill in character info and choose a sample.",
    createBtn: "Convert and Create",
    listTitle: "Characters",
    listDesc: "Play samples, review notes, or delete characters not used by history.",
    emptyCharacters: "No characters yet.",
    samplePlayerTitle: "Sample Player",
    samplePlayerIdle: "Select a character sample to play.",
    sampleWaveDefault: "Character sample waveform appears here.",
    cancelBtn: "Cancel",
    confirmDelete: "Confirm Delete",
    selectAll: "Select All",
    batchCount: "0 selected",
    batchDeleteBtn: "Delete Selected",
    unknownDuration: "Unknown duration",
    loadFailed: "Failed to load characters",
    convertedSample: "Converted sample",
    playSample: "Play Sample",
    delete: "Delete",
    nameRequired: "Enter a character name.",
    fileRequired: "Choose a character audio sample.",
    converting: "Converting...",
    convertingStatus: "Converting and validating the audio sample.",
    createPassed: "Conversion passed. Creating character.",
    creating: "Creating...",
    createFailed: "Failed to create character",
    createSuccess: "Character \"{name}\" created.",
    sampleLabel: "Character sample: {name}",
    viewingSample: "Viewing character sample: {name}",
    deleteConfirm: "Delete this character?",
    batchDeleteConfirm: "Delete {n} selected characters? Characters used by history cannot be deleted.",
    batchDeleteFailed: "Failed to delete selected characters",
    batchDeleted: "Deleted {n} characters.",
    deleteFailed: "Failed to delete character",
    deleted: "Character deleted.",
    langToggle: "中"
  }
};

let currentLang = localStorage.getItem("mimo-lang") || "zh";
let pendingConfirm = null;
let latestCharacters = [];
const selectedCharacters = new Set();
let isDefaultFileLabel = true;
let playerHasSource = false;
let currentPlayingCharacter = null;

function t(key) {
  return translations[currentLang][key] || translations.zh[key] || key;
}

const characterPlayer = window.createWavePlayer("#characterWavePlayer", {
  defaultText: t("sampleWaveDefault"),
  showText: false
});

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
  langToggle.textContent = t("langToggle");
  if (isDefaultFileLabel) {
    characterFileName.textContent = t("fileDefault");
  }
  if (!playerHasSource) {
    characterPlayer.clear();
  } else if (currentPlayingCharacter) {
    characterPlayerStatus.textContent = t("viewingSample").replace("{name}", currentPlayingCharacter.name);
  }
  renderCharacters(latestCharacters);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return t("unknownDuration");
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function setStatus(message, type = "normal") {
  characterStatus.textContent = message;
  characterStatus.classList.toggle("error", type === "error");
}

async function loadCharacters() {
  try {
    const response = await fetch("/api/characters");
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || t("loadFailed"));
    }
    latestCharacters = data;
    renderCharacters(data);
  } catch (error) {
    characterList.innerHTML = `<div class="empty-history">${escapeHtml(error.message)}</div>`;
  }
}

function renderCharacters(characters) {
  pruneCharacterSelection();
  updateCharacterBatchBar();
  updateCharacterSelectAll();
  if (!characters.length) {
    characterList.innerHTML = `<div class="empty-history">${t("emptyCharacters")}</div>`;
    return;
  }
  characterList.innerHTML = characters.map((character) => `
    <article class="character-item" data-character-id="${escapeHtml(character.id)}">
      <div class="character-item-main">
        <input type="checkbox" class="history-checkbox character-checkbox" data-character-id="${escapeHtml(character.id)}" ${selectedCharacters.has(character.id) ? "checked" : ""} />
        <div class="character-main">
        <div>
          <div class="character-name">${escapeHtml(character.name)}</div>
          <div class="history-meta">
            ${escapeHtml(character.originalFilename || t("convertedSample"))} · ${formatTime(character.sampleDurationSeconds)} · ${Math.ceil((character.sampleSizeBytes || 0) / 1024)} KB
          </div>
          ${character.description ? `<div class="character-desc">${escapeHtml(character.description)}</div>` : ""}
        </div>
        <div class="character-actions">
          <button type="button" data-action="play" data-id="${escapeHtml(character.id)}" data-name="${escapeHtml(character.name)}">${t("playSample")}</button>
          <button type="button" data-action="delete" data-id="${escapeHtml(character.id)}" class="danger-action">${t("delete")}</button>
        </div>
      </div>
      </div>
    </article>
  `).join("");
}

async function createCharacter(event) {
  event.preventDefault();
  const file = characterFile.files[0];
  if (!characterName.value.trim()) {
    setStatus(t("nameRequired"), "error");
    return;
  }
  if (!file) {
    setStatus(t("fileRequired"), "error");
    return;
  }

  createCharacterBtn.disabled = true;
  createCharacterBtn.textContent = t("converting");
  setStatus(t("convertingStatus"));
  try {
    const converted = await window.MimoAudioTools.convertAudioToWav(file);
    const wavFile = new File(
      [converted.blob],
      window.MimoAudioTools.convertedFileName(file),
      { type: "audio/wav" });

    setStatus(t("createPassed"));
    createCharacterBtn.textContent = t("creating");
    const formData = new FormData();
    formData.append("name", characterName.value.trim());
    formData.append("description", characterDescription.value.trim());
    formData.append("durationSeconds", String(converted.durationSeconds || 0));
    formData.append("sampleFile", wavFile);

    const response = await fetch("/api/characters", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || t("createFailed"));
    }
    setStatus(t("createSuccess").replace("{name}", data.name));
    characterForm.reset();
    isDefaultFileLabel = true;
    characterFileName.textContent = t("fileDefault");
    await loadCharacters();
  } catch (error) {
    setStatus(error.message || t("createFailed"), "error");
  } finally {
    createCharacterBtn.disabled = false;
    createCharacterBtn.textContent = t("createBtn");
  }
}

async function playCharacter(id, name) {
  const url = `/api/characters/${encodeURIComponent(id)}/audio`;
  playerHasSource = true;
  currentPlayingCharacter = { id, name };
  characterPlayer.setSource(url, t("sampleLabel").replace("{name}", name), id);
  characterPlayerStatus.textContent = t("viewingSample").replace("{name}", name);
}

async function deleteCharacter(id) {
  showConfirm(t("deleteConfirm"), async () => {
    const response = await fetch(`/api/characters/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      const data = await response.json();
      setStatus(data.error || t("deleteFailed"), "error");
      return;
    }
    setStatus(t("deleted"));
    await loadCharacters();
  });
}

async function batchDeleteCharacters() {
  const ids = [...selectedCharacters];
  if (!ids.length) return;
  showConfirm(t("batchDeleteConfirm").replace("{n}", ids.length), async () => {
    let deleted = 0;
    for (const id of ids) {
      const response = await fetch(`/api/characters/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t("batchDeleteFailed"));
      }
      selectedCharacters.delete(id);
      deleted += 1;
    }
    setStatus(t("batchDeleted").replace("{n}", deleted));
    await loadCharacters();
  });
}

function pruneCharacterSelection() {
  const ids = new Set(latestCharacters.map((character) => character.id));
  for (const id of selectedCharacters) {
    if (!ids.has(id)) {
      selectedCharacters.delete(id);
    }
  }
}

function updateCharacterBatchBar() {
  const count = selectedCharacters.size;
  if (count > 0) {
    characterBatchBar.classList.add("visible");
    characterBatchCount.textContent = currentLang === "zh" ? `已选 ${count} 项` : `${count} selected`;
  } else {
    characterBatchBar.classList.remove("visible");
  }
}

function updateCharacterSelectAll() {
  if (!latestCharacters.length) {
    characterSelectAll.checked = false;
    characterSelectAll.indeterminate = false;
    return;
  }
  const allSelected = latestCharacters.every((character) => selectedCharacters.has(character.id));
  const someSelected = latestCharacters.some((character) => selectedCharacters.has(character.id));
  characterSelectAll.checked = allSelected;
  characterSelectAll.indeterminate = !allSelected && someSelected;
}

function showConfirm(message, onConfirm) {
  pendingConfirm = onConfirm;
  characterConfirmMsg.textContent = message;
  characterConfirmModal.showModal();
}

characterForm.addEventListener("submit", createCharacter);
characterFile.addEventListener("change", () => {
  const file = characterFile.files[0];
  isDefaultFileLabel = !file;
  characterFileName.textContent = file ? file.name : t("fileDefault");
});

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  window.addEventListener(eventName, (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
});

["dragenter", "dragover"].forEach((eventName) => {
  characterDropZone.addEventListener(eventName, () => characterDropZone.classList.add("dragging"));
});

["dragleave", "drop"].forEach((eventName) => {
  characterDropZone.addEventListener(eventName, () => characterDropZone.classList.remove("dragging"));
});

characterDropZone.addEventListener("drop", (event) => {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  characterFile.files = files;
  isDefaultFileLabel = false;
  characterFileName.textContent = files[0].name;
});

characterList.addEventListener("click", (event) => {
  const checkbox = event.target.closest(".character-checkbox");
  if (checkbox) {
    if (checkbox.checked) {
      selectedCharacters.add(checkbox.dataset.characterId);
    } else {
      selectedCharacters.delete(checkbox.dataset.characterId);
    }
    updateCharacterBatchBar();
    updateCharacterSelectAll();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  if (button.dataset.action === "play") {
    playCharacter(button.dataset.id, button.dataset.name);
  }
  if (button.dataset.action === "delete") {
    deleteCharacter(button.dataset.id);
  }
});

characterSelectAll.addEventListener("change", () => {
  if (characterSelectAll.checked) {
    latestCharacters.forEach((character) => selectedCharacters.add(character.id));
  } else {
    latestCharacters.forEach((character) => selectedCharacters.delete(character.id));
  }
  characterList.querySelectorAll(".character-checkbox").forEach((checkbox) => {
    checkbox.checked = selectedCharacters.has(checkbox.dataset.characterId);
  });
  updateCharacterBatchBar();
  updateCharacterSelectAll();
});

characterBatchDeleteBtn.addEventListener("click", () => batchDeleteCharacters());

characterConfirmOk.addEventListener("click", async () => {
  characterConfirmModal.close();
  if (typeof pendingConfirm === "function") {
    const fn = pendingConfirm;
    pendingConfirm = null;
    try {
      await fn();
    } catch (error) {
      setStatus(error.message || t("batchDeleteFailed"), "error");
      await loadCharacters();
    }
  }
});

characterConfirmCancel.addEventListener("click", () => {
  characterConfirmModal.close();
  pendingConfirm = null;
});

langToggle.addEventListener("click", () => {
  currentLang = currentLang === "zh" ? "en" : "zh";
  localStorage.setItem("mimo-lang", currentLang);
  applyLanguage();
});

applyLanguage();
loadCharacters();
