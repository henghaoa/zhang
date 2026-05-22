# Image to Video Skill

Generate a video from one or more images using AI image-to-video APIs.

## Trigger

Use this skill when the user asks to:
- Convert an image to a video
- Animate a photo or picture
- Create video from image
- Generate motion from a still image
- 图生视频 / 图片转视频 / 给图片加动效

## What to do

1. **Identify the source image** — ask for a local file path or URL if not provided.
2. **Ask for a motion prompt** — a short text description of the desired motion (e.g. "camera slowly zooms in", "character waves hand", "leaves rustling in the wind"). If the user doesn't provide one, generate a sensible default based on the image content.
3. **Detect or ask which API to use** — check for API keys in the environment:
   - `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` → use Kling AI (可灵)
   - `RUNWAY_API_KEY` → use Runway Gen-3 Alpha
   - `STABILITY_API_KEY` → use Stability AI
   - If none found, ask the user which service they prefer and where their key is.
4. **Write and run a Python script** that calls the API and saves the output video.
5. **Report the output path** to the user when done.

---

## API implementations

### Kling AI (快手可灵) — `KLING_ACCESS_KEY` + `KLING_SECRET_KEY`

Kling requires JWT authentication. Use `PyJWT` to sign the token.

```python
#!/usr/bin/env python3
"""image_to_video_kling.py — Generate video via Kling AI image-to-video API."""

import os, time, sys, base64, pathlib, json, urllib.request, urllib.error
import jwt  # pip install PyJWT

ACCESS_KEY = os.environ["KLING_ACCESS_KEY"]
SECRET_KEY = os.environ["KLING_SECRET_KEY"]
API_BASE   = "https://api.klingai.com"

def make_token() -> str:
    now = int(time.time())
    payload = {"iss": ACCESS_KEY, "exp": now + 1800, "nbf": now - 5}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def load_image(src: str) -> tuple[str, str]:
    """Return (image_url_or_base64, mode) where mode is 'url' or 'base64'."""
    if src.startswith("http://") or src.startswith("https://"):
        return src, "url"
    data = pathlib.Path(src).read_bytes()
    b64  = base64.b64encode(data).decode()
    suffix = pathlib.Path(src).suffix.lstrip(".").lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "webp": "image/webp"}.get(suffix, "image/jpeg")
    return f"data:{mime};base64,{b64}", "base64"

def submit_task(image_src: str, prompt: str, duration: int = 5) -> str:
    token  = make_token()
    img_val, mode = load_image(image_src)
    body = {
        "model_name": "kling-v1",
        "prompt": prompt,
        "negative_prompt": "blur, distortion, low quality",
        "cfg_scale": 0.5,
        "mode": "std",
        "duration": str(duration),
    }
    if mode == "url":
        body["image"] = img_val
    else:
        body["image"] = img_val  # base64 data URI

    req = urllib.request.Request(
        f"{API_BASE}/v1/videos/image2video",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {token}"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    if resp.get("code") != 0:
        raise RuntimeError(f"Submit failed: {resp}")
    return resp["data"]["task_id"]

def poll_task(task_id: str, timeout: int = 300) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        token = make_token()
        req = urllib.request.Request(
            f"{API_BASE}/v1/videos/image2video/{task_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(req) as r:
            resp = json.loads(r.read())
        status = resp["data"]["task_status"]
        print(f"  status: {status}", flush=True)
        if status == "succeed":
            return resp["data"]["task_result"]["videos"][0]["url"]
        if status == "failed":
            raise RuntimeError(f"Task failed: {resp}")
        time.sleep(5)
    raise TimeoutError("Task timed out")

def download(url: str, dest: str) -> None:
    urllib.request.urlretrieve(url, dest)

if __name__ == "__main__":
    image_src = sys.argv[1]          # local path or URL
    prompt    = sys.argv[2]          # motion description
    output    = sys.argv[3] if len(sys.argv) > 3 else "output.mp4"
    duration  = int(sys.argv[4]) if len(sys.argv) > 4 else 5  # 5 or 10 seconds

    print(f"Submitting task: image={image_src!r}, prompt={prompt!r}")
    task_id = submit_task(image_src, prompt, duration)
    print(f"Task ID: {task_id}")
    print("Polling for result…")
    video_url = poll_task(task_id)
    print(f"Downloading from {video_url}")
    download(video_url, output)
    print(f"Saved to: {output}")
```

Install dependency: `pip install PyJWT`

Usage:
```bash
python image_to_video_kling.py photo.jpg "camera slowly zooms in" output.mp4
```

---

### Runway Gen-3 Alpha — `RUNWAY_API_KEY`

```python
#!/usr/bin/env python3
"""image_to_video_runway.py — Generate video via Runway Gen-3 Alpha."""

import os, sys, time, base64, pathlib, json, urllib.request

API_KEY  = os.environ["RUNWAY_API_KEY"]
API_BASE = "https://api.dev.runwayml.com/v1"

def load_image_base64(path: str) -> str:
    data = pathlib.Path(path).read_bytes()
    b64  = base64.b64encode(data).decode()
    suffix = pathlib.Path(path).suffix.lstrip(".").lower()
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "webp": "image/webp"}.get(suffix, "image/jpeg")
    return f"data:{mime};base64,{b64}"

def submit(image_src: str, prompt: str, duration: int = 5) -> str:
    if image_src.startswith("http"):
        img_field = image_src
    else:
        img_field = load_image_base64(image_src)

    body = {
        "model": "gen3a_turbo",
        "promptImage": img_field,
        "promptText": prompt,
        "duration": duration,
        "ratio": "1280:720",
    }
    req = urllib.request.Request(
        f"{API_BASE}/image_to_video",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {API_KEY}",
                 "X-Runway-Version": "2024-11-06"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    return resp["id"]

def poll(task_id: str, timeout: int = 300) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        req = urllib.request.Request(
            f"{API_BASE}/tasks/{task_id}",
            headers={"Authorization": f"Bearer {API_KEY}",
                     "X-Runway-Version": "2024-11-06"},
        )
        with urllib.request.urlopen(req) as r:
            resp = json.loads(r.read())
        status = resp["status"]
        print(f"  status: {status}", flush=True)
        if status == "SUCCEEDED":
            return resp["output"][0]
        if status in ("FAILED", "CANCELLED"):
            raise RuntimeError(f"Task {status}: {resp.get('failure', '')}")
        time.sleep(5)
    raise TimeoutError("Task timed out")

def download(url: str, dest: str) -> None:
    urllib.request.urlretrieve(url, dest)

if __name__ == "__main__":
    image_src = sys.argv[1]
    prompt    = sys.argv[2]
    output    = sys.argv[3] if len(sys.argv) > 3 else "output.mp4"
    duration  = int(sys.argv[4]) if len(sys.argv) > 4 else 5

    print(f"Submitting: image={image_src!r}, prompt={prompt!r}")
    task_id = submit(image_src, prompt, duration)
    print(f"Task ID: {task_id}")
    video_url = poll(task_id)
    download(video_url, output)
    print(f"Saved to: {output}")
```

Usage:
```bash
python image_to_video_runway.py photo.jpg "gentle breeze, leaves moving" output.mp4
```

---

### Stability AI — `STABILITY_API_KEY`

```python
#!/usr/bin/env python3
"""image_to_video_stability.py — Generate video via Stability AI SVD."""

import os, sys, time, json, pathlib, urllib.request, urllib.parse

API_KEY  = os.environ["STABILITY_API_KEY"]
API_BASE = "https://api.stability.ai/v2beta"

def submit(image_path: str, cfg_scale: float = 1.8, motion_bucket: int = 127) -> str:
    img_bytes = pathlib.Path(image_path).read_bytes()
    suffix    = pathlib.Path(image_path).suffix.lstrip(".").lower()
    mime      = "image/jpeg" if suffix in ("jpg", "jpeg") else "image/png"

    boundary = "----FormBoundary7MA4YWxkTrZu0gW"
    body  = f"--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="image"; filename="image.{suffix}"\r\n'.encode()
    body += f"Content-Type: {mime}\r\n\r\n".encode()
    body += img_bytes
    body += f"\r\n--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="cfg_scale"\r\n\r\n'
    body += str(cfg_scale).encode()
    body += f"\r\n--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="motion_bucket_id"\r\n\r\n'
    body += str(motion_bucket).encode()
    body += f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{API_BASE}/image-to-video",
        data=body,
        headers={"Authorization": f"Bearer {API_KEY}",
                 "Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read())
    return resp["id"]

def poll(gen_id: str, timeout: int = 300) -> bytes:
    deadline = time.time() + timeout
    while time.time() < deadline:
        req = urllib.request.Request(
            f"{API_BASE}/image-to-video/result/{gen_id}",
            headers={"Authorization": f"Bearer {API_KEY}",
                     "Accept": "video/*"},
        )
        try:
            with urllib.request.urlopen(req) as r:
                if r.status == 200:
                    return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 202:
                print("  still processing…", flush=True)
                time.sleep(10)
                continue
            raise
    raise TimeoutError("Task timed out")

if __name__ == "__main__":
    image_path = sys.argv[1]
    output     = sys.argv[2] if len(sys.argv) > 2 else "output.mp4"

    print(f"Submitting: image={image_path!r}")
    gen_id = submit(image_path)
    print(f"Generation ID: {gen_id}")
    print("Polling…")
    video_bytes = poll(gen_id)
    pathlib.Path(output).write_bytes(video_bytes)
    print(f"Saved to: {output}")
```

Usage:
```bash
python image_to_video_stability.py photo.png output.mp4
```

---

## Error handling hints

| Error | Likely cause | Fix |
|-------|-------------|-----|
| `401 Unauthorized` | Wrong or expired API key | Re-check env var |
| `429 Too Many Requests` | Rate limit | Wait 60 s and retry |
| `413 Request Entity Too Large` | Image too big | Resize to ≤ 1280 px, < 10 MB |
| Task stays `processing` > 5 min | Server queue | Increase timeout or retry |

## Notes

- Kling AI free tier allows ~166 credits/month (each 5 s clip costs ~10 credits).
- Runway Gen-3 Turbo is faster and cheaper than standard Gen-3.
- Stability SVD works best with images resized to **1024 × 576** or **576 × 1024**.
- Always confirm the output file exists before reporting success.
