# MiMo Voice Cloning Synthesis Tool

> 🎤 Upload a voice sample, type some text — get back speech in that cloned voice.

[中文文档](README_zh.md)

![Screenshot](docs/screenshot-EN.png)

---

A local web application for voice cloning and speech synthesis, powered by the [Xiaomi MiMo](https://platform.xiaomimimo.com/) `mimo-v2.5-tts-voiceclone` model. No GPU, no Python dependencies, no Docker — just clone a voice and start generating speech from your browser.

---

## ⚡ Quick Start

```bash
git clone https://github.com/TTanDev/Voice-cloning-synthesis.git
cd Voice-cloning-synthesis
mvn spring-boot:run
```

→ Open [http://localhost:8080](http://localhost:8080)

**Requirements:** Java 17+ · Maven 3.6+ · [MiMo API Key](https://platform.xiaomimimo.com/)

---

## ✨ What Can It Do?

### 🎤 Clone Any Voice
Upload an mp3/wav/m4a sample (~10 MB max). The model learns the voice characteristics instantly — no training, no fine-tuning. One upload, ready to go.

### 🎭 Rich Emotional Control
Go far beyond flat robotic TTS. Direct how the voice sounds with:

| Control | Example | Effect |
|---------|---------|--------|
| Style prompt | `gentle, natural, moderate pace` | Sets overall tone for the entire output |
| Style tag | `(happy)Today is amazing!` | Applies emotion to the following text |
| Audio tag | `I'm fine [sigh]` | Inserts non-verbal sounds (laugh, sigh, breath...) |

Supported styles include: happy, sad, angry, gentle, magnetic, Cantonese, and more.  
Supported audio tags: `[sigh]` · `[chuckle]` · `[trembling]` · `[deep breath]`

→ Full tag reference: [mimo-tts-api-doc.md](mimo-tts-api-doc.md)

### ⏱️ Queue & Walk Away
Submit multiple synthesis jobs at once. They process sequentially in the background — no blocking, no waiting. You'll get a browser notification when each job finishes.

### 🎧 Waveform Player
Built-in audio player with real-time Canvas waveform visualization. Scrub through your synthesis, preview any segment, download as WAV.

### 📜 Persistent History
Every result is saved locally with full metadata. Replay, download, or batch-delete past jobs — nothing gets lost between sessions.

### 🏠 Local-First
All data stays in your project directory (`.mimo-voiceclone/`). Nothing leaves your machine except the API calls to MiMo.

---

## 📖 Usage

1. **Configure** → Click Settings (top-right) → paste your MiMo API Key
2. **Upload** → Drop a voice sample (mp3, wav, m4a)
3. **Style** (optional) → Type a style prompt or pick a preset
4. **Synthesize** → Enter text with optional tags, click Submit
5. **Manage** → Play, download, or organize results in History

---

## 🏗️ Project Structure

```
├── pom.xml                               # Maven configuration
├── src/main/java/com/voiceclone/
│   ├── MimoVoiceCloneApplication.java    # Spring Boot entry point
│   ├── api/
│   │   ├── SynthesisController.java      # Synthesis REST endpoints
│   │   ├── SettingsController.java       # Settings REST endpoints
│   │   ├── ApiException.java             # Custom exception
│   │   └── ApiExceptionHandler.java      # Global exception handler
│   ├── config/
│   │   ├── MimoSettings.java             # Settings model
│   │   └── SettingsService.java          # Settings persistence
│   └── service/
│       ├── MimoVoiceCloneService.java    # MiMo API client
│       └── SynthesisJobService.java      # Async job queue & persistence
└── src/main/resources/
    ├── application.properties            # App configuration
    └── static/
        ├── index.html                    # Frontend page
        ├── app.js                        # Frontend logic
        └── styles.css                    # Styles
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 3.3.7, Java 17 |
| Frontend | Vanilla HTML/CSS/JS (no framework) |
| Build | Maven |
| Storage | File system (JSON + WAV) |
| External API | Xiaomi MiMo TTS (`mimo-v2.5-tts-voiceclone`) |

---

## 📋 API Documentation Note

The file `mimo-tts-api-doc.md` is a Markdown adaptation of the official Xiaomi MiMo TTS API reference. The official docs don't provide a Markdown version, so this file was manually compiled from the [official reference](https://mimo.mi.com/#/docs) on **June 20, 2026 (~20:00 CST)**. It may not reflect the latest API changes. For the most up-to-date information, please refer to the [official MiMo documentation](https://mimo.mi.com/).

---

## 🔒 Data Storage

All data is stored locally in the `.mimo-voiceclone/` directory:

| File/Dir | Contents |
|----------|----------|
| `settings.json` | API Key and Base URL |
| `history/` | Synthesis results (JSON metadata + WAV audio) |
| `voice-queue/` | Temporary voice samples for pending jobs (auto-cleaned) |

This directory is in `.gitignore` and will **never** be committed.

---

## 📄 License

[MIT License](LICENSE)

---

## 🙏 Acknowledgements

Voice synthesis powered by [Xiaomi MiMo](https://platform.xiaomimimo.com/) — thank you for providing the TTS API.
