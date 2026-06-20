# MiMo 声音复刻合成工具

[English](README.md)

一个基于 [小米 MiMo](https://platform.xiaomimimo.com/) `mimo-v2.5-tts-voiceclone` 模型的本地 Web 声音克隆合成工具。上传一段声音样本，输入文本，即可在浏览器中生成复刻音色的自然语音。

![截图](docs/screenshot.png)

## 功能特性

- **声音克隆** — 上传 mp3/wav/m4a 声音样本，生成与原声高度相似的语音
- **风格控制** — 通过自然语言风格指令和内嵌音频标签（情绪、语调、语速、方言等）精细调控输出
- **后台任务队列** — 支持连续提交多条合成任务，后台单线程依次处理，不阻塞操作
- **波形播放器** — 自定义音频播放器，带 Canvas 实时波形可视化和进度条拖拽
- **历史持久化** — 所有合成结果以 WAV + JSON 元数据形式保存在本地，支持播放、下载和删除
- **浏览器通知** — 合成完成或失败时自动弹出桌面通知提醒
- **批量管理** — 支持全选和批量删除历史记录
- **API Key 安全** — API Key 仅存储在服务端，前端接口只返回脱敏后的 Key

## 环境要求

- **Java 17+**
- **Maven 3.6+**
- 小米 MiMo API Key — 前往 [platform.xiaomimimo.com](https://platform.xiaomimimo.com/) 获取

## 快速开始

```bash
git clone https://github.com/TTanDev/Voice-cloning-synthesis.git
cd Voice-cloning-synthesis
mvn spring-boot:run
```

在浏览器中打开 [http://localhost:8080/](http://localhost:8080/)。

## 使用方法

1. 点击右上角**设置**，填入你的 MiMo API Key。API Base URL 默认为 `https://api.xiaomimimo.com/v1`。
2. 上传声音样本（支持 mp3、wav、m4a，Base64 编码后不超过约 10 MB）。
3. （可选）输入**风格指令**，如"温柔、自然、语速适中"，或直接选择预设风格。
4. 输入**合成文本**。可在文本中嵌入风格标签如 `(开心)今天真的太棒了！` 和音频标签如 `[叹气]` 进行精细控制。
5. 点击**提交到合成队列**。任务在后台运行，你可以继续提交下一条。
6. 完成后在**历史合成结果**面板中播放、下载或管理。

### 风格标签与音频标签

MiMo 模型支持丰富的文本内控制：

- **风格标签**（放在文本开头）：`(开心)文本`、`(温柔 磁性)文本`、`(粤语)文本`
- **音频标签**（插在文本任意位置）：`[叹气]`、`[轻笑]`、`[声音颤抖]`、`[深呼吸]`

完整标签列表请参考应用内的标签速查指南或 [mimo-tts-api-doc.md](mimo-tts-api-doc.md)。

## 项目结构

```
├── pom.xml                               # Maven 配置
├── src/main/java/com/voiceclone/
│   ├── MimoVoiceCloneApplication.java    # Spring Boot 启动入口
│   ├── api/
│   │   ├── SynthesisController.java      # 合成任务 REST 接口
│   │   ├── SettingsController.java       # 设置管理接口
│   │   ├── ApiException.java             # 自定义异常
│   │   └── ApiExceptionHandler.java      # 全局异常处理器
│   ├── config/
│   │   ├── MimoSettings.java             # 设置数据模型
│   │   └── SettingsService.java          # 设置读写与持久化
│   └── service/
│       ├── MimoVoiceCloneService.java    # MiMo API 调用核心
│       └── SynthesisJobService.java      # 异步任务队列与持久化
└── src/main/resources/
    ├── application.properties            # 应用配置
    └── static/
        ├── index.html                    # 前端页面
        ├── app.js                        # 前端逻辑
        └── styles.css                    # 前端样式
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Spring Boot 3.3.7, Java 17 |
| 前端 | 原生 HTML/CSS/JS（无框架依赖） |
| 构建 | Maven |
| 存储 | 文件系统（JSON + WAV） |
| 外部 API | 小米 MiMo TTS (`mimo-v2.5-tts-voiceclone`) |

## 关于 API 文档

仓库中的 `mimo-tts-api-doc.md` 是从小米 MiMo TTS 官方参考文档整理而来的 Markdown 版本。官方并未提供 Markdown 格式的文档，因此该文件是根据 [官方参考文档](https://mimo.mi.com/#/docs) 在 **2026 年 6 月 20 日（约晚 8 点）手动整理的，不具时效性**，可能无法反映后续 API 的变更。如需获取最新信息，请参阅 [MiMo 官方文档](https://mimo.mi.com/)。

## 数据隐私

所有数据保存在项目目录下的 `.mimo-voiceclone/` 文件夹中：

- `settings.json` — API Key 和 Base URL
- `history/` — 合成结果（JSON 元数据 + WAV 音频）
- `voice-queue/` — 排队任务的临时声音样本（完成后自动清理）

`.mimo-voiceclone/` 目录已加入 `.gitignore`，**不会**被提交到仓库。

## 许可证

[MIT License](LICENSE)

## 致谢

- 语音合成由 [小米 MiMo](https://platform.xiaomimimo.com/) 提供 TTS API 支持。
