from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
version = manifest["config"]["version"]
out = root / "dist" / f"Anon-Community-v{version}-Lite.personal-extension.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in ("manifest.json", "extension.js", "extension.css"):
        archive.write(root / name, name)
with zipfile.ZipFile(out) as archive:
    if archive.testzip() is not None:
        raise RuntimeError("ZIP integrity check failed")
print(out)
print("SHA256:", hashlib.sha256(out.read_bytes()).hexdigest())
