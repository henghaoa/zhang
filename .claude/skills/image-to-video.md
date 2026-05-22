# Image to Video (Runway Gen-3)

Generate a video from an image using the Runway Gen-3 Alpha Turbo API.

## Trigger

Use this skill when the user asks to:
- Convert an image to a video / animate a photo
- Generate motion from a still image
- 图生视频 / 图片转视频 / 给图片加动效

## Prerequisites

Set the environment variable before running:

```bash
export RUNWAY_API_KEY="your_key_here"
```

Get your key at: https://app.runwayml.com/account/api-keys

## What to do

1. **Identify the source image** — ask for a local file path or URL if not provided.  
   Accepted formats: JPEG, PNG, WebP. Max size: 16 MB. Recommended resolution: 1280 × 768 or 768 × 1280.
2. **Ask for a motion prompt** — a short English description of the desired motion  
   (e.g. `"camera slowly zooms in"`, `"waves crashing on the beach"`, `"person smiles and nods"`).  
   If the user doesn't provide one, infer a sensible default from the image content.
3. **Ask for duration** — 5 or 10 seconds (default: 5).
4. **Write and run the script below**, substituting the user's inputs.
5. **Confirm the output file** exists and report the path.

---

## Implementation

```python
#!/usr/bin/env python3
"""image_to_video_runway.py — Runway Gen-3 Alpha image-to-video."""

import os, sys, time, base64, pathlib, json, urllib.request, urllib.error

API_KEY  = os.environ["RUNWAY_API_KEY"]
API_BASE = "https://api.dev.runwayml.com/v1"
HEADERS  = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type":  "application/json",
    "X-Runway-Version": "2024-11-06",
}

def encode_image(path: str) -> str:
    """Return base64 data-URI for a local image file."""
    data   = pathlib.Path(path).read_bytes()
    suffix = pathlib.Path(path).suffix.lstrip(".").lower()
    mime   = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
               "png": "image/png",  "webp": "image/webp"}.get(suffix, "image/jpeg")
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"

def submit(image_src: str, prompt: str, duration: int) -> str:
    img = image_src if image_src.startswith("http") else encode_image(image_src)
    body = {
        "model":       "gen3a_turbo",
        "promptImage": img,
        "promptText":  prompt,
        "duration":    duration,   # 5 or 10
        "ratio":       "1280:768", # landscape; use "768:1280" for portrait
    }
    req = urllib.request.Request(
        f"{API_BASE}/image_to_video",
        data=json.dumps(body).encode(),
        headers=HEADERS,
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["id"]

def poll(task_id: str, timeout: int = 360) -> str:
    """Poll until SUCCEEDED, return video URL."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        req = urllib.request.Request(
            f"{API_BASE}/tasks/{task_id}",
            headers=HEADERS,
        )
        try:
            with urllib.request.urlopen(req) as r:
                resp = json.loads(r.read())
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Poll error {e.code}: {e.read().decode()}") from e

        status = resp["status"]
        progress = resp.get("progress", 0)
        print(f"  [{progress*100:.0f}%] {status}", flush=True)

        if status == "SUCCEEDED":
            return resp["output"][0]
        if status in ("FAILED", "CANCELLED"):
            raise RuntimeError(f"Task {status}: {resp.get('failure', 'unknown error')}")
        time.sleep(8)
    raise TimeoutError(f"Task {task_id!r} did not finish within {timeout}s")

def download(url: str, dest: str) -> None:
    urllib.request.urlretrieve(url, dest)
    print(f"Saved: {dest}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python image_to_video_runway.py <image_path_or_url> <prompt> [output.mp4] [duration=5]")
        sys.exit(1)

    image_src = sys.argv[1]
    prompt    = sys.argv[2]
    output    = sys.argv[3] if len(sys.argv) > 3 else "output.mp4"
    duration  = int(sys.argv[4]) if len(sys.argv) > 4 else 5

    if duration not in (5, 10):
        print("Warning: duration must be 5 or 10; defaulting to 5.")
        duration = 5

    print(f"Image : {image_src}")
    print(f"Prompt: {prompt!r}")
    print(f"Output: {output}  ({duration}s)")
    print("Submitting task…")

    task_id = submit(image_src, prompt, duration)
    print(f"Task ID: {task_id}")
    print("Polling for result…")

    video_url = poll(task_id)
    print(f"Video URL: {video_url}")
    download(video_url, output)

if __name__ == "__main__":
    main()
```

**No extra dependencies** — uses Python standard library only (≥ 3.9).

---

## Usage examples

```bash
# Local file
python image_to_video_runway.py photo.jpg "camera slowly zooms in" my_video.mp4

# Remote URL, 10-second clip
python image_to_video_runway.py https://example.com/img.png "waves crashing" out.mp4 10
```

---

## Common errors

| HTTP code | Meaning | Fix |
|-----------|---------|-----|
| `401` | Invalid API key | Check `RUNWAY_API_KEY` |
| `400` | Bad request | Image too large (> 16 MB) or unsupported format |
| `429` | Rate limit | Wait 60 s and retry |
| Task `FAILED` | Generation failed | Try a different prompt or image |

## Pricing (approximate)

- Gen-3 Alpha Turbo: ~0.05 credits/second → 5 s clip ≈ 0.25 credits
- New accounts get free trial credits; check usage at app.runwayml.com
