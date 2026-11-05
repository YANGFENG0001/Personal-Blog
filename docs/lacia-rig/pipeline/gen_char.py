"""Generate one character illustration by img2img from lacia_idle.png.

Why img2img and not txt2img: the rig needs a standing A-pose. Free txt2img gives
whatever pose the prompt feels like, and `export_assets.py` measures knees and
elbows inside fixed bands -- an arm crossed over the hip lands outside the band
and the elbow pivot goes with it. Keeping Lacia's silhouette as the structure
input is the cheapest way to hold the pose.

Usage:
    python docs/lacia-rig/pipeline/gen_char.py <name> <denoise> "<prompt>" [seed] [mode]

mode: ckpt (qwenRapidAIO, everything in one file) | qwen (explicit Qwen-Image trio)
"""

import io
import json
import os
import sys
import time
import urllib.request
import uuid

from PIL import Image

HOST = "http://127.0.0.1:8188"
os.environ.pop("HTTP_PROXY", None)
os.environ.pop("HTTPS_PROXY", None)
os.environ.pop("http_proxy", None)
os.environ.pop("https_proxy", None)

SRC = r"D:/Comfy-Desktop/ComfyUI-Installs/ComfyUI/ComfyUI/input/lacia_idle.png"


def post(path, payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(HOST + path, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def get(path):
    with urllib.request.urlopen(HOST + path, timeout=60) as r:
        return json.loads(r.read())


def upload(name, blob):
    boundary = "----" + uuid.uuid4().hex
    body = io.BytesIO()
    body.write(f"--{boundary}\r\n".encode())
    body.write(f'Content-Disposition: form-data; name="image"; filename="{name}"\r\n'.encode())
    body.write(b"Content-Type: image/png\r\n\r\n")
    body.write(blob)
    body.write(f"\r\n--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n')
    body.write(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(
        HOST + "/upload/image",
        data=body.getvalue(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())["name"]


def main():
    name = sys.argv[1]
    denoise = float(sys.argv[2])
    prompt = sys.argv[3]
    seed = int(sys.argv[4]) if len(sys.argv) > 4 else 12345
    mode = sys.argv[5] if len(sys.argv) > 5 else "ckpt"

    src = Image.open(SRC).convert("RGBA")
    if src.size != (584, 1504):
        src = src.resize((584, 1504), Image.LANCZOS)
    buf = io.BytesIO()
    src.save(buf, "PNG")
    src_name = upload(f"rig-{name}-in.png", buf.getvalue())
    print("uploaded", src_name, flush=True)

    g = {
        "2": {"class_type": "LoadImage", "inputs": {"image": src_name, "upload": "image"}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt}},
        "5": {"class_type": "ConditioningZeroOut", "inputs": {"conditioning": ["4", 0]}},
    }

    if mode == "qwen":
        g["1"] = {"class_type": "UNETLoader", "inputs": {"unet_name": "qwenImage_qwenImageFp8E4m3fn.safetensors", "weight_dtype": "default"}}
        g["10"] = {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors", "type": "qwen_image"}}
        g["11"] = {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}}
        model, clip, vae = ["1", 0], ["10", 0], ["11", 0]
    else:
        g["1"] = {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "qwenRapidAIO_v30.safetensors"}}
        model, clip, vae = ["1", 0], ["1", 1], ["1", 2]

    g["4"]["inputs"]["clip"] = clip
    g["3"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["2", 0], "vae": vae}}
    g["6"] = {
        "class_type": "KSampler",
        "inputs": {
            "model": model,
            "positive": ["4", 0],
            "negative": ["5", 0],
            "latent_image": ["3", 0],
            "seed": seed,
            "steps": 10,
            "cfg": 1.0,
            "sampler_name": "euler",
            "scheduler": "simple",
            "denoise": denoise,
        },
    }
    g["7"] = {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": vae}}
    g["8"] = {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": f"rig-{name}"}}

    pid = post("/prompt", {"prompt": g, "client_id": uuid.uuid4().hex})["prompt_id"]
    print("queued", pid, flush=True)
    t0 = time.time()
    while True:
        time.sleep(3)
        hist = get(f"/history/{pid}")
        if pid in hist:
            st = hist[pid].get("status", {})
            for m in st.get("messages", []):
                if m[0] in ("execution_error", "execution_interrupted"):
                    print("ERROR", json.dumps(m[1], ensure_ascii=False)[:900])
            out = hist[pid].get("outputs", {})
            print(f"{time.time() - t0:.0f}s", flush=True)
            for node in out.values():
                for im in node.get("images", []):
                    print("FILE", im["filename"], flush=True)
            break
        if time.time() - t0 > 1200:
            print("timeout")
            break


main()
