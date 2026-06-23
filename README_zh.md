# MiMo 声音克隆合成工具

> 创建可复用的声音角色，输入文字，即可在浏览器里生成克隆音色语音。

[English](README.md)

![截图](docs/screenshot-CN.png)

---

基于[小米 MiMo](https://platform.xiaomimimo.com/) `mimo-v2.5-tts-voiceclone` 模型的本地语音合成 Web 应用。免 GPU、免 Python 依赖、免 Docker。先用本地样本创建声音角色，再在合成页面复用角色批量生成语音。

---

## 快速开始

```bash
git clone https://github.com/TTanDev/Voice-cloning-synthesis.git
cd Voice-cloning-synthesis
mvn spring-boot:run
```

打开 [http://localhost:8080](http://localhost:8080)

**前置要求：** Java 17+ · Maven 3.6+ · [MiMo API Key](https://platform.xiaomimimo.com/)

---

## 产品特色

### 可复用声音角色

创建角色时填写角色信息，选择本地 mp3/wav/m4a 样本，浏览器会先转换并校验为 24kHz 单声道 WAV。之后每次合成只需要选择角色，不必重复上传同一份样本。

### 丰富的表现力控制

告别平淡的机器音：

| 控制方式 | 示例 | 效果 |
|---------|------|------|
| 风格描述 | `温柔、自然、中等语速` | 为整段输出设定整体基调 |
| 风格标签 | `(happy)今天真开心！` | 对后续文字施加情绪影响 |
| 音效标签 | `我很好 [sigh]` | 插入非语言声音（笑声、叹气、呼吸...） |

支持的风格：happy、sad、angry、gentle、magnetic、Cantonese 等  
支持的音效：`[sigh]` · `[chuckle]` · `[trembling]` · `[deep breath]`

完整标签参考：[mimo-tts-api-doc.md](mimo-tts-api-doc.md)

### 队列合成，切走不管

支持同时提交多个合成任务，后台依次执行，不阻塞界面。每个任务完成时可以弹出浏览器通知。

### 波形播放器

内置音频播放器，带实时 Canvas 波形可视化。主页和历史页可播放合成结果，角色管理页可播放角色样本。

### 独立历史与批量操作

已完成结果可以收进专属历史页，支持分组、实时搜索、播放、下载、批量下载、移回、删除。主页只保留当前队列和未收进历史的合成结果。

### 角色管理

专属角色管理页支持创建、播放样本、删除角色。被历史记录引用的角色会被后端保护，避免误删导致历史记录失去角色信息。

### 本地优先

所有数据都留在你的项目目录（`.mimo-voiceclone/`），除了调用 MiMo API 的必要请求外，没有任何数据外传。

---

## 使用说明

1. **配置**：点击右上角 Settings，粘贴 MiMo API Key。
2. **创建角色**：进入角色管理页，填写信息，选择样本，转换并保存。
3. **选择角色**：回到合成页，选择已创建的声音角色。
4. **风格**（可选）：输入风格描述或选择预设。
5. **合成**：输入文字（可嵌入标签），点击提交。
6. **管理**：播放、下载、批量下载、收进历史、分组、搜索、移回或删除结果。

---

## 项目结构

```text
├── pom.xml                               # Maven 配置
├── src/main/java/com/voiceclone/
│   ├── MimoVoiceCloneApplication.java    # Spring Boot 入口
│   ├── api/
│   │   ├── CharacterController.java      # 角色 REST 接口
│   │   ├── PageController.java           # 页面路由
│   │   ├── SynthesisController.java      # 合成 REST 接口
│   │   ├── SettingsController.java       # 设置 REST 接口
│   │   ├── ApiException.java             # 自定义异常
│   │   └── ApiExceptionHandler.java      # 全局异常处理
│   ├── config/
│   │   ├── MimoSettings.java             # 设置数据模型
│   │   └── SettingsService.java          # 设置持久化
│   └── service/
│       ├── CharacterService.java         # 角色样本持久化
│       ├── MimoVoiceCloneService.java    # MiMo API 客户端
│       └── SynthesisJobService.java      # 异步任务队列 & 持久化
└── src/main/resources/
    ├── application.properties            # 应用配置
    └── static/
        ├── index.html                    # 合成页面
        ├── history.html                  # 历史合成结果页面
        ├── characters.html               # 角色管理页面
        ├── app.js                        # 主页逻辑
        ├── history.js                    # 历史页逻辑
        ├── characters.js                 # 角色页逻辑
        ├── audio-wave-player.js          # 共享波形播放器
        ├── audio-convert.js              # 浏览器端 WAV 转换
        └── styles.css                    # 样式表
```

---

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Spring Boot 3.3.7, Java 17 |
| 前端 | 原生 HTML/CSS/JS（无框架） |
| 构建 | Maven |
| 存储 | 本地文件系统（JSON + WAV） |
| 外部 API | 小米 MiMo TTS（`mimo-v2.5-tts-voiceclone`） |

---

## API 文档说明

`mimo-tts-api-doc.md` 是小米 MiMo TTS API 官方文档的 Markdown 版本。官方未提供 Markdown 格式，此文件于 **2026 年 6 月 20 日（约 20:00 CST）** 根据[官方文档](https://mimo.mi.com/#/docs)手动整理。可能未同步最新变更，请以[官方 MiMo 文档](https://mimo.mi.com/)为准。

---

## 数据存储

所有数据存储在本地 `.mimo-voiceclone/` 目录：

| 文件/目录 | 内容 |
|----------|------|
| `settings.json` | API Key 和 Base URL |
| `history/` | 合成结果（JSON 元数据 + WAV 音频） |
| `characters/` | 角色元数据 + 转换后的 WAV 样本 |
| `voice-queue/` | 待处理任务的临时样本（自动清理） |

该目录已加入 `.gitignore`，**永远不会**被提交到仓库。

---

## 许可证

[MIT License](LICENSE)

---

## 致谢

语音合成由[小米 MiMo](https://platform.xiaomimimo.com/) 提供。感谢 MiMo 团队的 TTS API。
