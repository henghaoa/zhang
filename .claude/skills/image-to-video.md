# 图生视频 —— 即梦 AI (Jimeng / 火山引擎)

使用字节跳动即梦 AI 的图生视频接口，将一张图片生成 4 秒短视频。

## 触发时机

用户说以下任何内容时使用本 skill：
- 图生视频 / 图片转视频 / 给图片加动效
- convert image to video / animate a photo
- 用即梦生成视频

## 前置条件

在火山引擎控制台（console.volcengine.com）开通 **即梦 AI** 服务，并创建 Access Key：

```bash
export JIMENG_ACCESS_KEY="your_access_key_id"
export JIMENG_SECRET_KEY="your_secret_access_key"
```

## 操作流程

1. **确认输入图片** — 本地路径或 URL；若未提供则询问用户。  
   支持格式：JPEG / PNG / WebP；建议尺寸 ≥ 512px，≤ 4096px，< 10 MB。
2. **确认运动提示词** — 描述期望的画面运动（中英文均可）。  
   若用户未提供，则根据图片内容自动生成一个合理的提示词。
3. **生成并运行下方脚本**，用实际参数替换占位符。
4. **确认输出文件存在**，告知用户保存路径。

---

## 完整实现

```python
#!/usr/bin/env python3
"""
image_to_video_jimeng.py
使用即梦 AI (火山引擎) 图生视频接口。
依赖：volcengine-python-sdk  →  pip install volcengine
"""

import os, sys, time, json, base64, pathlib

# ── 鉴权：从环境变量读取 ──────────────────────────────────────────────────────
ACCESS_KEY = os.environ["JIMENG_ACCESS_KEY"]
SECRET_KEY = os.environ["JIMENG_SECRET_KEY"]


def encode_image(path: str) -> str:
    """将本地图片编码为 base64 字符串（不含 data-URI 前缀）。"""
    return base64.b64encode(pathlib.Path(path).read_bytes()).decode()


def submit_task(image_src: str, prompt: str) -> str:
    """提交图生视频任务，返回 task_id。"""
    from volcengine.visual.VisualService import VisualService

    svc = VisualService()
    svc.set_ak(ACCESS_KEY)
    svc.set_sk(SECRET_KEY)

    if image_src.startswith("http://") or image_src.startswith("https://"):
        req_body = {
            "req_key":    "jimeng_video_generation",
            "prompt":     prompt,
            "image_urls": [image_src],
        }
    else:
        req_body = {
            "req_key":    "jimeng_video_generation",
            "prompt":     prompt,
            "binary_data_base64": [encode_image(image_src)],
        }

    resp = svc.cv_process(req_body)
    if resp.get("code") != 10000:
        raise RuntimeError(f"提交失败: {resp}")

    task_id = resp["data"]["task_id"]
    print(f"任务已提交，task_id: {task_id}")
    return task_id


def poll_task(task_id: str, timeout: int = 300) -> str:
    """轮询任务状态，返回视频 URL。"""
    from volcengine.visual.VisualService import VisualService

    svc = VisualService()
    svc.set_ak(ACCESS_KEY)
    svc.set_sk(SECRET_KEY)

    deadline = time.time() + timeout
    while time.time() < deadline:
        resp = svc.cv_process({
            "req_key": "jimeng_video_query",
            "task_id": task_id,
        })
        if resp.get("code") != 10000:
            raise RuntimeError(f"查询失败: {resp}")

        status = resp["data"]["status"]
        print(f"  状态: {status}", flush=True)

        if status == "done":
            return resp["data"]["video_url"]
        if status in ("failed", "error"):
            raise RuntimeError(f"任务失败: {resp['data'].get('message', '未知错误')}")

        time.sleep(5)

    raise TimeoutError(f"任务 {task_id!r} 超时（{timeout}s）")


def download(url: str, dest: str) -> None:
    import urllib.request
    urllib.request.urlretrieve(url, dest)
    print(f"视频已保存至: {dest}")


def main():
    if len(sys.argv) < 3:
        print("用法: python image_to_video_jimeng.py <图片路径或URL> <运动提示词> [输出文件.mp4]")
        sys.exit(1)

    image_src = sys.argv[1]
    prompt    = sys.argv[2]
    output    = sys.argv[3] if len(sys.argv) > 3 else "output.mp4"

    print(f"图片  : {image_src}")
    print(f"提示词: {prompt!r}")
    print(f"输出  : {output}")
    print("正在提交任务…")

    task_id   = submit_task(image_src, prompt)
    print("等待生成结果…")
    video_url = poll_task(task_id)
    print(f"视频地址: {video_url}")
    download(video_url, output)


if __name__ == "__main__":
    main()
```

**安装依赖**（仅需一次）：

```bash
pip install volcengine
```

---

## 使用示例

```bash
# 本地图片
python image_to_video_jimeng.py photo.jpg "镜头缓缓推进，海浪轻柔涌动" my_video.mp4

# 在线图片 URL
python image_to_video_jimeng.py https://example.com/img.png "人物微笑点头" output.mp4
```

---

## 常见错误排查

| 错误信息 | 原因 | 解决方法 |
|---------|------|---------|
| `code != 10000` | AK/SK 错误或服务未开通 | 检查环境变量；在火山引擎控制台确认即梦服务已激活 |
| `image too large` | 图片超过 10 MB | 压缩或缩放图片后重试 |
| 任务状态一直 `processing` | 服务器队列繁忙 | 增大 `timeout` 参数（默认 300 s） |
| `ModuleNotFoundError: volcengine` | 未安装 SDK | 执行 `pip install volcengine` |

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|-------|
| `req_key` | 即梦图生视频服务标识 | `jimeng_video_generation` |
| `prompt` | 运动描述，中英文均可，建议 10–80 字 | — |
| `binary_data_base64` | 本地图片 base64（与 `image_urls` 二选一） | — |
| `image_urls` | 图片在线 URL（与 `binary_data_base64` 二选一） | — |

> **提示**：`req_key` 的准确值以火山引擎即梦产品文档为准，若接口有更新请以官方文档中的 `req_key` 为准。
