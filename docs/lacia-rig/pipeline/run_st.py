"""Run the archived See-through workflow on one image.

    python docs/lacia-rig/pipeline/run_st.py <local png> <comfy input name> <prefix>

Writes <prefix>_<timestamp>_<hash>_*.png plus <...>_layers.json into the ComfyUI
output folder, which is what `export_assets.py --src/--meta` consumes.
"""

import io
import json
import os
import sys
import time
import urllib.request
import uuid

HOST = "http://127.0.0.1:8188"
# This file lives at docs/lacia-rig/pipeline/, so the repo root is four levels up
# (it used to sit in the gitignored .ref/ draft folder, where it was two).
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
WF = os.path.join(ROOT, "docs", "seethrough-dress", "workflow.json")
os.environ.pop("HTTP_PROXY", None)
os.environ.pop("HTTPS_PROXY", None)
os.environ.pop("http_proxy", None)
os.environ.pop("https_proxy", None)


def post(path, payload):
    req = urllib.request.Request(
        HOST + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
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
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read())["name"]


local, name, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
upload(name, open(local, "rb").read())
print("uploaded", name, flush=True)

wf = json.load(open(WF, encoding="utf-8"))
for node in wf.values():
    if node["class_type"] == "LoadImage":
        node["inputs"]["image"] = name
    if node["class_type"] == "SeeThrough_SavePSD":
        node["inputs"]["filename_prefix"] = prefix

pid = post("/prompt", {"prompt": wf, "client_id": uuid.uuid4().hex})["prompt_id"]
print("queued", pid, flush=True)

t0 = time.time()
while True:
    time.sleep(5)
    hist = get(f"/history/{pid}")
    if pid in hist:
        st = hist[pid].get("status", {})
        for m in st.get("messages", []):
            if m[0] in ("execution_error", "execution_interrupted"):
                print("ERROR", json.dumps(m[1], ensure_ascii=False)[:900], flush=True)
        print(f"{time.time() - t0:.0f}s", flush=True)
        break
    q = get("/queue")
    if time.time() - t0 > 1800:
        print("timeout", flush=True)
        break
    if int(time.time() - t0) % 60 < 5:
        print(f"  ...{time.time() - t0:.0f}s pending={len(q.get('queue_pending', []))}", flush=True)
