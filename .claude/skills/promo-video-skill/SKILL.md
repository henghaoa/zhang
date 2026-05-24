---
name: promo-video-workflow
description: |
  生成商业推广视频的完整工作流。当用户想要：
  - 为餐厅/咖啡馆/服装店/商店生成推广视频
  - 把图片转换成营销视频
  - 批量处理多张图片生成多条视频
  - 生成三语（中文/英语/斯洛伐克语）推广文案
  - 为服装模特生成展示视频（走秀/转身/微风飘动等动作）
  - 生成动漫风格/时尚大片/赛博朋克等特殊风格视频
  
  必须使用此skill。即使用户只说"帮我做个推广视频"或"把这张图做成视频"也应激活。
  
  技术栈：即梦AI API（火山引擎）+ Claude API + Node.js本地服务器
---

# 推广视频工作流 Skill

## 概述

这是一套完整的AI推广视频生成系统，核心文件：
- `promo-studio.html` — 前端界面（本地浏览器运行）
- `jimeng-server.js` — 本地后端（处理API签名）
- `tryon.py` — 换装功能（Python，可选）

## 核心能力

### 支持的视频风格
- 精致/Elegant — 高端电影感
- 活力/Vibrant — 活力现代
- 温馨/Cozy — 生活方式
- 简洁/Minimal — 北欧简约
- 时尚大片/Fashion — 杂志editorial风
- 自然真实/Natural — 真实生活感
- 日系动漫/Anime — 吉卜力风
- 3D卡通/Cartoon — 皮克斯风
- 赛博朋克/Cyberpunk — 霓虹未来感
- 水彩插画/Watercolor — 柔和水彩
- 战斗动漫/Battle Anime — 鬼灭/咒术回战风

### 支持的模特动作
转身展示、走秀步伐、微风飘动、展示袖型、旋转裙摆、坐立展示、回眸一顾、走动回转、穿衣动作、开箱展示

### 支持的商家类型
餐厅、咖啡馆、商店、酒吧、面包店

### 三语输出
中文、English、Slovenčina（斯洛伐克语）

## 技术架构

```
用户上传图片
    ↓
选择风格 + 动作 + 语言
    ↓
Claude生成专业视频提示词 + 营销文案 + Hashtags
    ↓
即梦API (jimeng_i2v_first_v30_1080) 生成视频
    ↓
自动添加字幕 + 旁白 + BGM
    ↓
下载视频
```

## 即梦API关键参数

```json
{
  "req_key": "jimeng_i2v_first_v30_1080",
  "prompt": "...",
  "binary_data_base64": ["<base64图片>"],
  "seed": -1,
  "aspect_ratio": "16:9",
  "frames": 121
}
```

Pro版（10秒）：
```json
{
  "req_key": "jimeng_ti2v_v30_pro",
  "frames": 241
}
```

## 提示词生成策略

### 镜头动作库（按商家类型）

**餐厅：**
- Slow macro push-in on hero dish, steam rising, bokeh background
- Low-angle dolly through warm dining room, candles flickering softly
- Overhead crane shot descending to plated dish, golden hour light

**咖啡馆：**
- Close-up pour shot of latte art forming, slow motion steam
- Rack focus from coffee beans to finished cup, warm window light

**服装店（时尚专属）：**
- Elegant vertical pan from shoes upward along full outfit, studio lighting
- Slow 180-degree orbit around mannequin/model, fabric texture detail
- Macro push-in on fabric texture and stitching details, bokeh background

**战斗动漫：**
- Extreme dynamic angle, speed lines radiating from impact point, motion blur
- Low angle upshot of fighter powering up, energy aura expanding
- Rapid zoom into determined eyes, then explosive pull-back revealing full battle stance

### Claude提示词模板

```
You are creating a professional promotional video prompt for a {businessType} business.

CAMERA MOVEMENT: {randomCamera}
MODEL BEHAVIOR: {selectedBehaviors}
Visual style: {styleLabel} — {styleDesc}

Create a Jimeng AI image-to-video prompt in English:
- Start with the exact camera movement
- Add specific lighting details
- Include atmosphere and mood
- End with 2-3 cinematic quality descriptors
- Maximum 80 words

Reply in EXACTLY this format:
VIDEO_PROMPT: [prompt here]
CAPTION: [caption max 12 words in {lang}]
HASHTAGS: [5 hashtags in {lang}]
```

## 服务器签名（Node.js）

即梦API使用火山引擎HMAC-SHA256签名，通过`@volcengine/openapi`的Signer处理：

```javascript
const Signer = require("@volcengine/openapi").Signer;
const signer = new Signer(reqData, "cv");
signer.addAuthorization({ accessKeyId: AK, secretKey: SK });
```

关键参数：
- Region: `cn-north-1`
- Service: `cv`
- Host: `visual.volcengineapi.com`
- Action: `CVSync2AsyncSubmitTask` / `CVSync2AsyncGetResult`

## 批量处理

多张图片批量生成时，用同一个提示词依次提交，进度显示`第X/N条`，完成后2列网格展示所有视频，每条单独下载。

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| SignatureDoesNotMatch | AK/SK错误或格式问题 | 重新创建密钥，注意SK含`=`结尾正常 |
| req_key not supported | 服务未开通或额度用完 | 去火山引擎控制台开通对应服务 |
| Access Denied | Pro版需要购买资源包 | 切换回普通版或购买积分 |
| 字幕不显示 | 浏览器跨域限制 | 字幕显示在视频下方而非叠加 |
| BGM无声音 | 浏览器自动播放限制 | 用户手动点击播放按钮 |

## 文件说明

详细实现参考：
- `references/server-code.md` — 完整服务器代码说明
- `references/prompt-engineering.md` — 提示词优化指南
