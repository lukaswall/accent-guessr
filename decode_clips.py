#!/usr/bin/env python3
"""Extract the edited audio clips (CC BY-SA 4.0, see NOTICE) from the shipped
clips-N.js files into ./extracted/*.mp3."""
import json, base64, pathlib, re, sys

out = pathlib.Path(__file__).parent / "extracted"
out.mkdir(exist_ok=True)
root = pathlib.Path(__file__).parent
for chunk in sorted(root.glob("clips-*.js"), key=lambda p: int(re.search(r"\d+", p.name).group())):
    body = chunk.read_text()
    body = body[body.index("=[") + 1:]
    for clip in json.loads(body.rstrip().rstrip(";")):
        data = clip["src"].split(",", 1)[1]
        (out / f"{clip['id']}.mp3").write_bytes(base64.b64decode(data))
        print(clip["id"], clip["answer"], clip["speaker"])
print("done ->", out)
