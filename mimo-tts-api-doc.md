# MiMo-V2.5-TTS 语音合成 API 调用文档

> 语音合成（文本转语音）支持将输入的文本自动转换为自然流畅的语音输出。
> 通过配置发音风格、音色等参数，可生成自然生动的语音内容。
>
> **API Base URL:** `https://api.xiaomimimo.com/v1`
> **认证方式:** Header `api-key: $MIMO_API_KEY`

---

## 目录

- [支持的模型列表](#支持的模型列表)
- [准备工作](#准备工作)
- [通用注意事项](#通用注意事项)
- [风格控制](#风格控制)
  - [自然语言控制](#自然语言控制)
  - [音频标签控制](#音频标签控制)
- [使用预置音色](#使用预置音色进行语音合成)
- [使用文本设计音色](#使用文本设计音色进行语音合成)
- [使用音色复刻](#使用音色复刻进行语音合成)
- [计费说明](#计费说明)

---

## 支持的模型列表

| Model ID | 功能 | 音色 | 注意事项 |
|---|---|---|---|
| `mimo-v2.5-tts` | 使用预置精品音色进行语音合成 | 预置音色列表中的精品音色 | 支持唱歌模式，**不支持**音色设计与音色复刻 |
| `mimo-v2.5-tts-voicedesign` | 通过文本描述定制音色 | 通过文本描述自动生成 | **不支持**唱歌模式、预置音色与音色复刻 |
| `mimo-v2.5-tts-voiceclone` | 基于音频样本复刻任意音色 | 通过音频样本精准复刻 | **不支持**唱歌模式、预置音色与音色设计 |

---

## 准备工作

获取 API Key 等准备工作，请参考官方文档 [首次调用 API](https://mimo.mi.com/#/docs/quick-start/first-api-call)。

---

## 通用注意事项

### 调用规则

1. **目标文本位置** — 语音合成的目标文本需填写在 `role: assistant` 的消息中，**不可**放在 `user` 角色的消息内。
2. **user 消息为可选** — 可传入指令调整语气与风格，也可以是对话历史（消息内容不会出现在合成语音中）。使用 `mimo-v2.5-tts-voicedesign` 模型时，`user` 消息为**必填**。
3. **流式输出格式** — 流式调用时，输出音频格式请指定为 `pcm16`，以便拼接成完整音频。

---

## 风格控制

模型支持通过自然语言指令实现复杂的风格控制：

- **多风格切换** — 同一段语音内完成 播报 → 低语 → 嘶吼 的风格转场
- **多情绪混合** — 支持"压抑的愤怒"、"带着哽咽的笑意"、"温柔但疲惫"等复合情绪
- **多粒度控制** — 段落级 → 句子级 → 词级 → 字粒度的精细控制

提供两种控制方式：

| 方式 | 放置位置 |
|---|---|
| 自然语言控制 | `role: user` 的 `content` 中 |
| 音频标签控制 | `role: assistant` 的 `content` 中 |

---

### 自然语言控制

通过自然语言描述，让模型理解并生成对应风格的语音。

**示例：**

> 用轻快上扬的语调向领导报喜，语速稍快，带着查到成绩后压抑不住的激动与小骄傲，声音明亮有活力。

#### 导演模式（高级模式）

像给演员写剧本一样，从三个维度全方位刻画：

- **【角色】** — 身份、性格底色、外形气质与说话习惯
- **【场景】** — 发生了什么、和谁说话、情绪位置
- **【指导】** — 语速、气息、停顿、重音、共鸣位置、音色质感、情绪起伏

**导演模式示例：**

```
角色：百年门阀岑家的现任大当家。自出生便被过继给祖庙的守门老人抚养，
被塑造成一尊完美无瑕、绝情断欲的家族图腾。常年深居简出，对人有着极强
的阶级疏离感。

场景：在祠堂的阴影里，看着那个不顾一切冲破保安防线来找她、企图带她私
奔的男人。她要用最冷硬的阶级壁垒，绞杀对方，也绞杀自己刚刚萌芽、却足
以燎原的感情。

指导：
冰冷、慵懒却极具威压的低音御姐。发声通道非常松弛，没有任何剑拔弩张，
却有着让人骨里生寒的压迫感。
- 语速与顿挫：极慢，每个字都像是在舌尖滚过才吐出来，带着上位者漫不经
  心的傲慢。句与句之间留下极长的、令人不安的空白。
- 气声与实声：大部分时间声音没有明显的声调起伏，实音重且硬。但一定要
  在某些尾音处（如"真心"），加入极其轻微的气音收束。
- 咬字肌理：文白杂糅的用词带着旧时代的痕迹，唇齿音发得极轻但极清晰。
```

---

### 音频标签控制

在文本中嵌入风格标签与音频标签，进行精细控制。

#### 风格标签 `(风格)`

在目标文本**开头**添加 `(风格)` 标签，指定语音的发音风格。支持同时设置多种风格。

**支持的括号格式：** `()`、`（）`、`[]`

**格式示例：** `(风格1 风格2)待合成内容`

| 风格类型 | 风格示例 |
|---|---|
| 基础情绪 | 开心 / 悲伤 / 愤怒 / 恐惧 / 惊讶 / 兴奋 / 委屈 / 平静 / 冷漠 |
| 复合情绪 | 怅然 / 欣慰 / 无奈 / 愧疚 / 释然 / 嫉妒 / 厌倦 / 忐忑 / 动情 |
| 整体语调 | 温柔 / 高冷 / 活泼 / 严肃 / 慵懒 / 俏皮 / 深沉 / 干练 / 凌厉 |
| 音色定位 | 磁性 / 醇厚 / 清亮 / 空灵 / 稚嫩 / 苍老 / 甜美 / 沙哑 / 醇雅 |
| 人设腔调 | 夹子音 / 御姐音 / 正太音 / 大叔音 / 台湾腔 |
| 方言 | 东北话 / 四川话 / 河南话 / 粤语 |
| 角色扮演 | 孙悟空 / 林黛玉 |
| 唱歌 | 唱歌 / sing / singing |

> **唱歌注意：** 必须在目标文本最开头添加 `(唱歌)` 标签，格式为 `(唱歌)歌词`。歌词建议采用中文。

**样例：**

```
(怅然)这么多年过去了，再走过那条街，心里一下子空了一块。
(慵懒)再让我睡五分钟……就五分钟，真的，最后一次。
(磁性)夜已经深了，城市还在呼吸。我是今晚陪你的人，欢迎收听《午夜电台》。
(东北话)哎呀妈呀，这天儿也忒冷了吧！
(粤语)呢个真係好正啊！食过一次就唔会忘记！
(唱歌)原谅我这一生不羁放纵爱自由，也会怕有一天会跌倒，Oh no。
```

#### 音频标签 `[音频标签]`

在文本中**任意位置**插入 `[音频标签]`，进行细粒度控制。

| 风格类型 | 风格示例 |
|---|---|
| 语速与节奏 | 吸气 / 深呼吸 / 叹气 / 长叹一口气 / 喘息 / 屏息 |
| 情绪状态 | 紧张 / 害怕 / 激动 / 疲惫 / 委屈 / 撒娇 / 心虚 / 震惊 / 不耐烦 |
| 语音特征 | 颤抖 / 声音颤抖 / 变调 / 破音 / 鼻音 / 气声 / 沙哑 |
| 哭笑表达 | 笑 / 轻笑 / 大笑 / 冷笑 / 抽泣 / 呜咽 / 哽咽 / 嚎啕大哭 |

**样例：**

```
（紧张，深呼吸）呼……冷静，冷静。不就是一个面试吗……
（语速加快，碎碎念）自我介绍已经背了五十遍了，应该没问题的。
（小声）哎呀，领带歪没歪？

（极其疲惫，有气无力）师傅……到地方了叫我一声……
（长叹一口气）我先眯一会儿，这班加得我魂儿都要散了。

如果我当时……（沉默片刻）哪怕再坚持一秒钟，结果是不是就不一样了？
（苦笑）呵，没如果了。
```

---

## 使用预置音色进行语音合成

- **模型：** `mimo-v2.5-tts`（仅支持此模型）
- 内置多种精品音色，无需额外配置即可直接使用
- 支持自然语言指令控制风格 + 音频标签控制风格

### 预置音色列表

| 音色名 | Voice ID | 语言 | 性别 |
|---|---|---|---|
| MiMo-默认 | `mimo_default` | 中/英（集群自动选择） | - |
| 冰糖 | `冰糖` | 中文 | 女性 |
| 茉莉 | `茉莉` | 中文 | 女性 |
| 苏打 | `苏打` | 中文 | 男性 |
| 白桦 | `白桦` | 中文 | 男性 |
| Mia | `Mia` | 英文 | 女性 |
| Chloe | `Chloe` | 英文 | 女性 |
| Milo | `Milo` | 英文 | 男性 |
| Dean | `Dean` | 英文 | 男性 |

### 调用示例

#### 非流式调用

**cURL：**

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header 'Content-Type: application/json' \
--data-raw '{
  "model": "mimo-v2.5-tts",
  "messages": [
    {
      "role": "user",
      "content": "Bright, bouncy, slightly sing-song tone — like you are bursting with good news you can barely hold in. Fast pace, rising pitch at the end."
    },
    {
      "role": "assistant",
      "content": "Hey boss — guess what, guess what? I just got the results back and I actually passed! Not just passed, I got a distinction! I know, I know — you told me I was cutting it close, but hey, here we are. Drinks are on me tonight, okay?"
    }
  ],
  "audio": {
    "format": "wav",
    "voice": "Chloe"
  }
}'
```

**Python：**

```python
import os
from openai import OpenAI
import base64

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1"
)

completion = client.chat.completions.create(
    model="mimo-v2.5-tts",
    messages=[
        {
            "role": "user",
            "content": "Bright, bouncy, slightly sing-song tone — like you're bursting with good news you can barely hold in. Fast pace, rising pitch at the end."
        },
        {
            "role": "assistant",
            "content": "Hey boss — guess what, guess what? I just got the results back and I actually passed! Not just passed, I got a distinction! I know, I know — you told me I was cutting it close, but hey, here we are. Drinks are on me tonight, okay?"
        }
    ],
    audio={
        "format": "wav",
        "voice": "Chloe"
    }
)

message = completion.choices[0].message
audio_bytes = base64.b64decode(message.audio.data)
with open("audio_file.wav", "wb") as f:
    f.write(audio_bytes)
```

#### 流式调用

> `mimo-v2.5-tts` 低延迟流式输出已上线，流式接口可实时返回流式响应。

**cURL：**

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header 'Content-Type: application/json' \
--data-raw '{
  "model": "mimo-v2.5-tts",
  "messages": [
    {
      "role": "user",
      "content": "Bright, bouncy, slightly sing-song tone — like you are bursting with good news you can barely hold in. Fast pace, rising pitch at the end."
    },
    {
      "role": "assistant",
      "content": "Hey boss — guess what, guess what? I just got the results back and I actually passed! Not just passed, I got a distinction! I know, I know — you told me I was cutting it close, but hey, here we are. Drinks are on me tonight, okay?"
    }
  ],
  "audio": {
    "format": "pcm16",
    "voice": "Chloe"
  },
  "stream": true
}'
```

**Python：**

```python
import base64
import os
import numpy as np
import soundfile as sf
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1"
)

completion = client.chat.completions.create(
    model="mimo-v2.5-tts",
    messages=[
        {
            "role": "user",
            "content": "Bright, bouncy, slightly sing-song tone — like you're bursting with good news you can barely hold in. Fast pace, rising pitch at the end."
        },
        {
            "role": "assistant",
            "content": "Hey boss — guess what, guess what? I just got the results back and I actually passed! Not just passed, I got a distinction! I know, I know — you told me I was cutting it close, but hey, here we are. Drinks are on me tonight, okay?"
        }
    ],
    audio={
        "format": "pcm16",
        "voice": "Chloe"
    },
    stream=True
)

# 24kHz PCM16LE mono audio
collected_chunks: np.ndarray = np.array([], dtype=np.float32)

for chunk in completion:
    if not chunk.choices:
        continue
    delta = chunk.choices[0].delta
    audio = getattr(delta, "audio", None)

    if audio is not None:
        assert isinstance(audio, dict), f"Expected audio to be a dict, got {type(audio)}"
        pcm_bytes = base64.b64decode(audio["data"])
        np_pcm = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        collected_chunks = np.concatenate((collected_chunks, np_pcm))
        print(f"Received audio chunk of size {len(pcm_bytes)} bytes")

# Save the collected audio to a file
os.makedirs("tmp", exist_ok=True)
sf.write("tmp/output.wav", collected_chunks, samplerate=24000)
print("Audio saved to tmp/output.wav")
```

---

## 使用文本设计音色进行语音合成

- **模型：** `mimo-v2.5-tts-voicedesign`（仅支持此模型）
- 无需音频文件，在 `user` 消息中添加音色描述文本即可生成定制音色

### 如何写好音色描述

一条好的音色描述通常涵盖以下维度（不需要面面俱到）：

| 维度 | 示例 |
|---|---|
| 性别与年龄 | "young woman in her mid-20s"、"五十多岁的中年男性" |
| 音色/质感 | "deep and gravelly"、"丝滑醇厚、带着磁性" |
| 情绪/语气 | "warm and confident"、"温柔但带着一丝疲惫" |
| 语速/节奏 | "slow and deliberate"、"语速极快，像连珠炮" |

可选择性增加的维度：
- **角色/人设：** narrator, podcast host, 评书先生, 深夜电台DJ
- **说话风格：** casual and colloquial, 一本正经地, 压低嗓音像在密谋
- **场景描写：** narrating a nature documentary, 在给投资人路演
- **年代参照：** 1940s film noir, 八十年代译制片配音

#### 写法建议

**简洁描述型** — 关键词或一句话快速勾勒：

```
Heavy Russian accent, gruff middle-aged male, blunt and matter-of-fact.
```

**专业描述型** — 通过场景、人设或多维度细节立体刻画：

```
Young female, extreme close-up with a binaural, ear-to-ear ASMR feel.
Audible breathing, subtle swallowing, and soft natural lip sounds.
She speaks very slowly, creating a deeply relaxing and immersive experience.
```

```
一位年迈的老先生，说带北方口音的普通话，语速缓慢而沉稳，嗓音略带沙哑
和沧桑感，仿佛一位饱经风霜的老爷爷在讲故事，充满岁月的智慧。
```

#### 注意事项

- **长度：** 1-4 句即可，核心特征描述清楚比堆砌维度更重要
- **避免冲突：** 不要同时要求矛盾的特征（如"稚嫩童声 + CEO气场"）
- **避免音质效果词：** 不要写混响、回声、EQ、压缩等后期处理描述
- **避免模糊词：** 不要用"普通的""正常的""外国的"等缺乏具体指向的词
- **中英文均可：** 模型同时支持中英文音色描述
- **合成文本要贴合音色：** `assistant` 消息中的合成文本应与音色描述相匹配

### 调用示例

> 可通过可选参数 `optimize_text_preview: true` 控制是否对目标播报文本进行智能润色；设为 `true` 时可无需传入 `assistant` 消息。

#### 非流式调用

**cURL：**

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header 'Content-Type: application/json' \
--data-raw '{
  "model": "mimo-v2.5-tts-voicedesign",
  "messages": [
    {
      "role": "user",
      "content": "Give me a young male tone."
    },
    {
      "role": "assistant",
      "content": "Yes, I had a sandwich."
    }
  ],
  "audio": {
    "format": "wav",
    "optimize_text_preview": true
  }
}'
```

**Python：**

```python
import os
from openai import OpenAI
import base64

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1"
)

completion = client.chat.completions.create(
    model="mimo-v2.5-tts-voicedesign",
    messages=[
        {
            "role": "user",
            "content": "Give me a young male tone."
        },
        {
            "role": "assistant",
            "content": "Yes, I had a sandwich."
        }
    ],
    audio={
        "format": "wav",
        "optimize_text_preview": True
    }
)

message = completion.choices[0].message
audio_bytes = base64.b64decode(message.audio.data)
with open("audio_file.wav", "wb") as f:
    f.write(audio_bytes)
```

#### 流式调用

> **注意：** `mimo-v2.5-tts-voicedesign` 低延迟流式输出功能暂未上线。当前流式接口降级为兼容模式，仅在所有推理完成后以流式格式返回一次结果。

**cURL：**

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header 'Content-Type: application/json' \
--data-raw '{
  "model": "mimo-v2.5-tts-voicedesign",
  "messages": [
    {
      "role": "user",
      "content": "Give me a young male tone."
    },
    {
      "role": "assistant",
      "content": "You are UN-BE-LIEVABLE! I am sooooo done with your constant lies. GET. OUT!"
    }
  ],
  "audio": {
    "format": "pcm16",
    "optimize_text_preview": true
  },
  "stream": true
}'
```

**Python：**

```python
import base64
import os
import numpy as np
import soundfile as sf
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1"
)

completion = client.chat.completions.create(
    model="mimo-v2.5-tts-voicedesign",
    messages=[
        {
            "role": "user",
            "content": "Give me a young male tone."
        },
        {
            "role": "assistant",
            "content": "You are UN-BE-LIEVABLE! I am sooooo done with your constant lies. GET. OUT!"
        }
    ],
    audio={
        "format": "pcm16",
        "optimize_text_preview": True
    },
    stream=True
)

# 24kHz PCM16LE mono audio
collected_chunks: np.ndarray = np.array([], dtype=np.float32)

for chunk in completion:
    if not chunk.choices:
        continue
    delta = chunk.choices[0].delta
    audio = getattr(delta, "audio", None)

    if audio is not None:
        assert isinstance(audio, dict), f"Expected audio to be a dict, got {type(audio)}"
        pcm_bytes = base64.b64decode(audio["data"])
        np_pcm = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        collected_chunks = np.concatenate((collected_chunks, np_pcm))
        print(f"Received audio chunk of size {len(pcm_bytes)} bytes")

os.makedirs("tmp", exist_ok=True)
sf.write("tmp/output.wav", collected_chunks, samplerate=24000)
print("Audio saved to tmp/output.wav")
```

---

## 使用音色复刻进行语音合成

- **模型：** `mimo-v2.5-tts-voiceclone`（仅支持此模型）
- 传入音频样本即可精准复刻目标音色
- 支持自然语言指令控制风格 + 音频标签控制风格

### 音频样本要求

| 项目 | 说明 |
|---|---|
| 格式 | 将音频文件转为 Base64 编码字符串 |
| 支持格式 | `mp3`、`wav` |
| 大小限制 | Base64 编码后字符串不超过 **10 MB** |
| 前缀格式 | `data:{MIME_TYPE};base64,$BASE64_AUDIO` |

**MIME 类型取值：**
- `audio/mpeg` 或 `audio/mp3`（MP3 格式）
- `audio/wav`（WAV 格式）

**示例：** `data:audio/mpeg;base64,SGVsbG8gV29ybGQ...`

### 调用示例

#### 非流式调用

**cURL：**

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header 'Content-Type: application/json' \
--data-raw '{
  "model": "mimo-v2.5-tts-voiceclone",
  "messages": [
    {
      "role": "user",
      "content": ""
    },
    {
      "role": "assistant",
      "content": "Yes, I had a sandwich."
    }
  ],
  "audio": {
    "format": "wav",
    "voice": "data:{MIME_TYPE};base64,$BASE64_AUDIO"
  }
}'
```

**Python：**

```python
import base64
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1",
)

with open("voice.mp3", "rb") as f:
    voice_bytes = f.read()
voice_base64 = base64.b64encode(voice_bytes).decode("utf-8")

completion = client.chat.completions.create(
    model="mimo-v2.5-tts-voiceclone",
    messages=[
        {
            "role": "user",
            "content": ""
        },
        {
            "role": "assistant",
            "content": "Yes, I had a sandwich."
        }
    ],
    audio={
        "format": "wav",
        "voice": f"data:audio/mpeg;base64,{voice_base64}"
    }
)

message = completion.choices[0].message
audio_bytes = base64.b64decode(message.audio.data)
with open("audio_file.wav", "wb") as f:
    f.write(audio_bytes)
```

#### 流式调用

> **注意：** `mimo-v2.5-tts-voiceclone` 低延迟流式输出功能暂未上线。当前流式接口降级为兼容模式，仅在所有推理完成后以流式格式返回一次结果。

**cURL：**

```bash
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header 'Content-Type: application/json' \
--data-raw '{
  "model": "mimo-v2.5-tts-voiceclone",
  "messages": [
    {
      "role": "user",
      "content": ""
    },
    {
      "role": "assistant",
      "content": "You are UN-BE-LIEVABLE! I am sooooo done with your constant lies. GET. OUT!"
    }
  ],
  "audio": {
    "format": "pcm16",
    "voice": "data:{MIME_TYPE};base64,$BASE64_AUDIO"
  },
  "stream": true
}'
```

**Python：**

```python
import base64
import os
import numpy as np
import soundfile as sf
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MIMO_API_KEY"),
    base_url="https://api.xiaomimimo.com/v1",
)

with open("voice.mp3", "rb") as f:
    voice_bytes = f.read()
voice_base64 = base64.b64encode(voice_bytes).decode("utf-8")

completion = client.chat.completions.create(
    model="mimo-v2.5-tts-voiceclone",
    messages=[
        {
            "role": "user",
            "content": ""
        },
        {
            "role": "assistant",
            "content": "Yes, I had a sandwich."
        }
    ],
    audio={
        "format": "wav",
        "voice": f"data:audio/mpeg;base64,{voice_base64}",
    },
    stream=True
)

# 24kHz PCM16LE mono audio
collected_chunks: np.ndarray = np.array([], dtype=np.float32)

for chunk in completion:
    if not chunk.choices:
        continue
    delta = chunk.choices[0].delta
    audio = getattr(delta, "audio", None)

    if audio is not None:
        assert isinstance(audio, dict), (
            f"Expected audio to be a dict, got {type(audio)}"
        )
        pcm_bytes = base64.b64decode(audio["data"])
        np_pcm = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        collected_chunks = np.concatenate((collected_chunks, np_pcm))
        print(f"Received audio chunk of size {len(pcm_bytes)} bytes")

os.makedirs("tmp", exist_ok=True)
sf.write("tmp/output.wav", collected_chunks, samplerate=24000)
print("Audio saved to tmp/output.wav")
```

---

## 计费说明

- **计费方式：** 限时免费
- **查看用量：** 控制台 [账单明细](https://platform.xiaomimimo.com/#/console/usage)

---

## 快速速查表

| 场景 | 模型 | 音色设置 |
|---|---|---|
| 预置音色播报 | `mimo-v2.5-tts` | `"voice": "冰糖"` 等 |
| 文本描述设计音色 | `mimo-v2.5-tts-voicedesign` | `user.content` 写描述 |
| 音频样本复刻音色 | `mimo-v2.5-tts-voiceclone` | `"voice": "data:audio/mpeg;base64,..."` |

| 参数 | 取值 | 说明 |
|---|---|---|
| `audio.format` | `wav` | 非流式输出，直接解码保存 |
| `audio.format` | `pcm16` | 流式输出，需拼接（24kHz 单声道） |
| `audio.optimize_text_preview` | `true` / `false` | 仅 voicedesign 模型可用 |
| `stream` | `true` | 启用流式输出 |
