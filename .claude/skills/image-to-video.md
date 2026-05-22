# 图生视频 —— 即梦 AI (火山方舟 ARK)

使用字节跳动**火山方舟**平台的即梦图生视频接口，将一张图片生成视频。

## 触发时机

用户说以下任何内容时使用本 skill：
- 图生视频 / 图片转视频 / 给图片加动效
- convert image to video / animate a photo
- 用即梦 / 用方舟生成视频

## 前置条件

设置 API Key 环境变量（格式：`apikey-YYYYMMDDHHMMSS-xxxxx`）：

```bash
export ARK_API_KEY="apikey-xxxxxxxxxxxxxxxx-xxxxx"
```

**模型接入点**（即梦视频，已固定在代码中，无需修改）：

```
ark-7a3fbb58-5a00-4713-b12c-1beab82c5339-ef75d
```

**安装依赖**（仅需一次）：

```bash
pip install volcenginesdkarkruntime
```

## 操作流程

1. **确认输入图片** — 本地路径或公网 URL；若未提供则询问用户。  
   支持格式：JPEG / PNG / WebP；建议短边 ≥ 300px，长边 ≤ 4096px，< 10 MB。
2. **确认运动提示词** — 描述期望的画面运动（中英文均可）。  
   若用户未提供，则根据图片内容自动生成一个合理的提示词。
3. **生成并运行下方脚本**，用实际参数替换占位符。
4. **确认输出文件存在**，告知用户保存路径。

---

## 完整实现

```python
#!/usr/bin/env python3
"""
image_to_video_ark.py
使用火山方舟 (ARK) 即梦图生视频接口。

安装: pip install volcenginesdkarkruntime
"""

import os, sys, time, base64, pathlib, urllib.request

from volcenginesdkarkruntime import Ark

ARK_API_KEY = os.environ["ARK_API_KEY"]
MODEL_EP    = "ark-7a3fbb58-5a00-4713-b12c-1beab82c5339-ef75d"

client = Ark(api_key=ARK_API_KEY)


def to_data_uri(path: str) -> str:
    """将本地图片转为 base64 data-URI。"""
    data   = pathlib.Path(path).read_bytes()
    suffix = pathlib.Path(path).suffix.lstrip(".").lower()
    mime   = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
               "png": "image/png",  "webp": "image/webp"}.get(suffix, "image/jpeg")
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def submit(image_src: str, prompt: str) -> str:
    """提交图生视频任务，返回 task_id。"""
    img = image_src if image_src.startswith("http") else to_data_uri(image_src)

    task = client.content_generation.tasks.create(
        model=MODEL_EP,
        content=[
            {"type": "image_url", "image_url": {"url": img}},
            {"type": "text",      "text": prompt},
        ],
    )
    task_id = task.id
    print(f"任务已提交，task_id: {task_id}")
    return task_id


def poll(task_id: str, timeout: int = 300) -> str:
    """轮询任务状态，返回视频 URL。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        task = client.content_generation.tasks.get(task_id=task_id)
        status = task.status
        print(f"  状态: {status}", flush=True)

        if status == "succeeded":
            # 取第一个视频输出
            for item in task.content:
                if item.type == "video_url":
                    return item.video_url.url
            raise RuntimeError("任务成功但未找到视频 URL")

        if status in ("failed", "cancelled"):
            raise RuntimeError(f"任务{status}: {getattr(task, 'error', '未知错误')}")

        time.sleep(5)

    raise TimeoutError(f"任务 {task_id!r} 超时（{timeout}s）")


def download(url: str, dest: str) -> None:
    urllib.request.urlretrieve(url, dest)
    print(f"视频已保存至: {dest}")


def main():
    if len(sys.argv) < 3:
        print("用法: python image_to_video_ark.py <图片路径或URL> <运动提示词> [输出文件.mp4]")
        sys.exit(1)

    image_src = sys.argv[1]
    prompt    = sys.argv[2]
    output    = sys.argv[3] if len(sys.argv) > 3 else "output.mp4"

    print(f"图片  : {image_src}")
    print(f"提示词: {prompt!r}")
    print(f"输出  : {output}")
    print("正在提交任务…")

    task_id   = submit(image_src, prompt)
    print("等待生成结果…")
    video_url = poll(task_id)
    print(f"视频地址: {video_url}")
    download(video_url, output)


if __name__ == "__main__":
    main()
```

---

## 使用示例

```bash
# 本地图片
python image_to_video_ark.py photo.jpg "镜头缓缓推进，海浪轻柔涌动" my_video.mp4

# 在线图片 URL
python image_to_video_ark.py https://example.com/img.png "人物微笑点头" output.mp4
```

---

## 常见错误排查

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| `AuthenticationError` | API Key 错误 | 检查 `ARK_API_KEY` 环境变量 |
| `NotFoundError` | 接入点 ID 错误或未开通 | 在方舟控制台确认接入点已部署 |
| `RateLimitError` | 并发超限 | 等待片刻后重试 |
| 任务状态一直 `running` | 队列繁忙 | 增大 `timeout` 参数（默认 300 s） |
| `ModuleNotFoundError` | 未安装 SDK | 执行 `pip install volcenginesdkarkruntime` |
