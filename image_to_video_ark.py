#!/usr/bin/env python3
"""
image_to_video_ark.py
使用火山方舟 (ARK) 即梦图生视频接口。

安装: pip install volcenginesdkarkruntime
"""

import os, sys, time, base64, pathlib, urllib.request

from volcenginesdkarkruntime import Ark

ARK_API_KEY = os.environ["ARK_API_KEY"]
MODEL_EP    = "apikey-20260522211746-4n8gb"

client = Ark(api_key=ARK_API_KEY)


def to_data_uri(path: str) -> str:
    data   = pathlib.Path(path).read_bytes()
    suffix = pathlib.Path(path).suffix.lstrip(".").lower()
    mime   = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
               "png": "image/png",  "webp": "image/webp"}.get(suffix, "image/jpeg")
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


def submit(image_src: str, prompt: str) -> str:
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
    deadline = time.time() + timeout
    while time.time() < deadline:
        task = client.content_generation.tasks.get(task_id=task_id)
        status = task.status
        print(f"  状态: {status}", flush=True)

        if status == "succeeded":
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
