"""
Local companion service for Shader Playground.

This keeps heavyweight inference out of the browser while allowing the UI to
request local Depth Pro assets and load them automatically.
"""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import posixpath
import shutil
import subprocess
import sys
import sysconfig
import traceback
import urllib.parse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional


HOST = "127.0.0.1"
PORT = int(os.environ.get("SHADER_PLAYGROUND_COMPANION_PORT", "8765"))
ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "generated-assets"
CHECKPOINT_PATH = ROOT / "checkpoints" / "depth_pro.pt"
SERVICE_VERSION = 1
DEPTH_PRO_MODEL_ID = "apple/ml-depth-pro"
DEPTH_PRO_MODEL_VERSION = "reference-2025"
SHARP_MODEL_ID = "apple/ml-sharp"
SHARP_MODEL_VERSION = "sharp-predict-cli"
DEPTH_PRO_SETTINGS = {
    "visualization": "minmax-per-image",
    "invert": "lighter-is-closer",
    "png": "8-bit-grayscale",
    "raw": "npy-float32-meters",
}
SHARP_SETTINGS = {
    "command": "sharp predict",
    "output": "3dgs-ply",
}
_FILE_HASH_CACHE = {}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_suffix(filename: str, content_type: Optional[str]) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}:
        return suffix
    guessed = mimetypes.guess_extension(content_type or "")
    return guessed if guessed in {".jpg", ".jpeg", ".png", ".webp", ".bmp"} else ".png"


def file_sha256(path: Path) -> Optional[str]:
    if not path.exists():
        return None

    stat = path.stat()
    cache_key = (str(path.resolve()), stat.st_size, stat.st_mtime_ns)
    if cache_key in _FILE_HASH_CACHE:
        return _FILE_HASH_CACHE[cache_key]

    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)

    value = digest.hexdigest()
    _FILE_HASH_CACHE[cache_key] = value
    return value


def current_depth_pro_cache_key() -> dict[str, Any]:
    return {
        "model_id": DEPTH_PRO_MODEL_ID,
        "model_version": DEPTH_PRO_MODEL_VERSION,
        "checkpoint_sha256": file_sha256(CHECKPOINT_PATH),
        "settings": DEPTH_PRO_SETTINGS,
    }


def find_sharp_checkpoint() -> Optional[Path]:
    candidates = []
    env_path = os.environ.get("SHADER_PLAYGROUND_SHARP_CHECKPOINT")
    if env_path:
        candidates.append(Path(env_path))

    candidates.extend(
        [
            ROOT / "checkpoints" / "sharp_2572gikvuh.pt",
            ROOT / "checkpoints" / "sharp_model.pth",
            Path.home() / ".cache" / "torch" / "hub" / "checkpoints" / "sharp_2572gikvuh.pt",
        ]
    )

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _existing_executable(path: str | Path | None) -> Optional[Path]:
    if not path:
        return None

    candidate = Path(str(path).strip('"')).expanduser()
    if candidate.is_file():
        return candidate.resolve()
    return None


def find_sharp_cli() -> Optional[Path]:
    env_cli = os.environ.get("SHADER_PLAYGROUND_SHARP_CLI")
    env_candidate = _existing_executable(env_cli)
    if env_candidate:
        return env_candidate

    if env_cli:
        resolved = shutil.which(env_cli.strip('"'))
        if resolved:
            return Path(resolved).resolve()

    for command_name in ("sharp", "sharp.exe"):
        resolved = shutil.which(command_name)
        if resolved:
            return Path(resolved).resolve()

    script_dirs: list[Path] = []
    virtual_env = os.environ.get("VIRTUAL_ENV")
    if virtual_env:
        script_dirs.append(Path(virtual_env) / ("Scripts" if os.name == "nt" else "bin"))

    try:
        scripts_path = sysconfig.get_path("scripts")
        if scripts_path:
            script_dirs.append(Path(scripts_path))
    except Exception:
        pass

    try:
        python_dir = Path(sys.executable).resolve().parent
        script_dirs.extend([python_dir / "Scripts", python_dir])
    except Exception:
        pass

    script_dirs.extend([ROOT / ".venv" / "Scripts", ROOT / "venv" / "Scripts"])

    if os.name == "nt":
        python_tag = f"Python{sys.version_info.major}{sys.version_info.minor}"
        app_data = os.environ.get("APPDATA")
        if app_data:
            script_dirs.append(Path(app_data) / "Python" / python_tag / "Scripts")

    executable_names = ("sharp.exe", "sharp") if os.name == "nt" else ("sharp",)
    seen_dirs = set()
    for directory in script_dirs:
        directory_key = str(directory).lower()
        if directory_key in seen_dirs:
            continue
        seen_dirs.add(directory_key)

        for executable_name in executable_names:
            executable = _existing_executable(directory / executable_name)
            if executable:
                return executable

    return None


def current_sharp_cache_key() -> dict[str, Any]:
    checkpoint = find_sharp_checkpoint()
    return {
        "model_id": SHARP_MODEL_ID,
        "model_version": SHARP_MODEL_VERSION,
        "checkpoint_path": str(checkpoint) if checkpoint else "auto",
        "checkpoint_sha256": file_sha256(checkpoint) if checkpoint else "auto",
        "settings": SHARP_SETTINGS,
    }


def cache_entry_is_valid(entry: dict[str, Any], cache_key: dict[str, Any], required_files: list[Path]) -> bool:
    if entry.get("status") != "ready":
        return False
    if entry.get("cache_key") != cache_key:
        return False
    return all(path.exists() for path in required_files)


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    tmp.replace(path)


def load_manifest(package_dir: Path) -> Optional[dict[str, Any]]:
    manifest_path = package_dir / "manifest.json"
    if not manifest_path.exists():
        return None
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


class DepthProEngine:
    def __init__(self) -> None:
        self.model = None
        self.transform = None
        self.device = None
        self.depth_pro = None
        self.torch = None
        self.np = None
        self.image_cls = None

    def load(self) -> None:
        if self.model is not None:
            return

        if not CHECKPOINT_PATH.exists():
            raise RuntimeError(
                "Depth Pro checkpoint not found. Run setup_depth_pro.bat first "
                f"so {CHECKPOINT_PATH} exists."
            )

        try:
            import depth_pro
            import numpy as np
            import torch
            from PIL import Image
        except ImportError as exc:
            raise RuntimeError(
                "Depth Pro dependencies are missing. Run setup_depth_pro.bat, "
                "then restart start_companion.bat."
            ) from exc

        self.depth_pro = depth_pro
        self.torch = torch
        self.np = np
        self.image_cls = Image
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        try:
            model, transform = depth_pro.create_model_and_transforms(
                device=self.device,
                precision=torch.float32,
            )
        except TypeError:
            model, transform = depth_pro.create_model_and_transforms()
            model = model.to(self.device)

        state_dict = torch.load(str(CHECKPOINT_PATH), map_location="cpu")
        try:
            model.load_state_dict(state_dict)
        except RuntimeError:
            if isinstance(state_dict, dict) and "model" in state_dict:
                model.load_state_dict(state_dict["model"])
            else:
                raise

        model.eval()
        self.model = model
        self.transform = transform

    def generate(self, source_path: Path, output_png: Path, output_raw: Path) -> dict[str, Any]:
        self.load()

        assert self.depth_pro is not None
        assert self.image_cls is not None
        assert self.model is not None
        assert self.np is not None
        assert self.torch is not None
        assert self.transform is not None
        assert self.device is not None

        torch = self.torch
        np = self.np
        depth_pro = self.depth_pro

        with torch.no_grad():
            try:
                image, _, f_px = depth_pro.load_rgb(str(source_path))
                input_image = self.transform(image).to(self.device)
                prediction = self.model.infer(input_image, f_px=f_px)
            except AttributeError:
                image = self.image_cls.open(source_path).convert("RGB")
                input_image = self.transform(image).to(self.device)
                prediction = self.model.infer(input_image)

        depth = prediction["depth"].detach().cpu().numpy().squeeze().astype("float32")
        min_depth = float(depth.min())
        max_depth = float(depth.max())
        denom = max(max_depth - min_depth, 1e-6)
        depth_normalized = (depth - min_depth) / denom
        depth_normalized = (255.0 - depth_normalized * 255.0).clip(0, 255).astype("uint8")

        self.image_cls.fromarray(depth_normalized).save(output_png)
        np.save(output_raw, depth)

        return {
            "min_depth_m": min_depth,
            "max_depth_m": max_depth,
            "device": str(self.device),
            "format": "8-bit grayscale PNG, inverted so lighter is closer",
        }


DEPTH_PRO = DepthProEngine()


class CompanionHandler(BaseHTTPRequestHandler):
    server_version = f"ShaderPlaygroundCompanion/{SERVICE_VERSION}"

    def log_message(self, fmt: str, *args: Any) -> None:
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.end_headers()

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/health":
            sharp_cli = find_sharp_cli()
            sharp_checkpoint = find_sharp_checkpoint()
            self.send_json(
                200,
                {
                    "ok": True,
                    "service": "Shader Playground Companion",
                    "version": SERVICE_VERSION,
                    "depth_pro_checkpoint": CHECKPOINT_PATH.exists(),
                    "sharp_cli": bool(sharp_cli),
                    "sharp_cli_path": str(sharp_cli) if sharp_cli else None,
                    "sharp_checkpoint": str(sharp_checkpoint) if sharp_checkpoint else None,
                    "asset_root": str(ASSET_ROOT),
                },
            )
            return

        if parsed.path.startswith("/assets/"):
            self.serve_asset(parsed.path)
            return

        self.send_json(404, {"ok": False, "error": "Unknown endpoint."})

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        try:
            if parsed.path == "/depth-pro":
                self.handle_depth_pro(parsed)
                return
            if parsed.path == "/sharp":
                self.handle_sharp(parsed)
                return
            self.send_json(404, {"ok": False, "error": "Unknown endpoint."})
        except Exception as exc:
            traceback.print_exc()
            self.send_json(500, {"ok": False, "error": str(exc)})

    def handle_depth_pro(self, parsed: urllib.parse.ParseResult) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            self.send_json(400, {"ok": False, "error": "No image bytes received."})
            return

        query = urllib.parse.parse_qs(parsed.query)
        filename = query.get("filename", ["source.png"])[0]
        content_type = self.headers.get("Content-Type") or "application/octet-stream"
        image_bytes = self.rfile.read(length)
        image_hash = hashlib.sha256(image_bytes).hexdigest()
        asset_id = image_hash[:16]
        package_dir = ASSET_ROOT / asset_id
        package_dir.mkdir(parents=True, exist_ok=True)

        suffix = safe_suffix(filename, content_type)
        source_path = package_dir / f"source{suffix}"
        depth_path = package_dir / "depth_pro.png"
        raw_path = package_dir / "depth_pro_raw.npy"
        manifest_path = package_dir / "manifest.json"

        if not source_path.exists():
            source_path.write_bytes(image_bytes)

        manifest = load_manifest(package_dir) or {
            "version": 1,
            "asset_id": asset_id,
            "created_at": utc_now(),
            "source": {
                "original_filename": filename,
                "mime_type": content_type,
                "sha256": image_hash,
                "bytes": len(image_bytes),
                "path": source_path.name,
            },
            "depth_pro": {"status": "not_generated"},
            "sharp": {"status": "not_generated"},
        }

        cache_key = current_depth_pro_cache_key()
        cached = cache_entry_is_valid(manifest.get("depth_pro", {}), cache_key, [depth_path, raw_path])
        if not cached:
            metadata = DEPTH_PRO.generate(source_path, depth_path, raw_path)
            manifest["updated_at"] = utc_now()
            manifest["depth_pro"] = {
                "status": "ready",
                "generated_at": utc_now(),
                "path": depth_path.name,
                "raw_path": raw_path.name,
                "model": DEPTH_PRO_MODEL_ID,
                "model_version": DEPTH_PRO_MODEL_VERSION,
                "checkpoint_sha256": cache_key["checkpoint_sha256"],
                "generation_settings": DEPTH_PRO_SETTINGS,
                "cache_key": cache_key,
                **metadata,
            }
            atomic_write_json(manifest_path, manifest)

        self.send_json(
            200,
            {
                "ok": True,
                "cached": cached,
                "asset_id": asset_id,
                "package_dir": str(package_dir),
                "manifest": manifest,
                "depth_url": f"http://{HOST}:{PORT}/assets/{asset_id}/depth_pro.png",
            },
        )

    def handle_sharp(self, parsed: urllib.parse.ParseResult) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            self.send_json(400, {"ok": False, "error": "No image bytes received."})
            return

        sharp_cli = find_sharp_cli()
        if not sharp_cli:
            self.send_json(
                503,
                {
                    "ok": False,
                    "error": "SHARP CLI was not found. Run setup_sharp.bat and restart the companion.",
                },
            )
            return

        query = urllib.parse.parse_qs(parsed.query)
        filename = query.get("filename", ["source.png"])[0]
        content_type = self.headers.get("Content-Type") or "application/octet-stream"
        image_bytes = self.rfile.read(length)
        image_hash = hashlib.sha256(image_bytes).hexdigest()
        asset_id = image_hash[:16]
        package_dir = ASSET_ROOT / asset_id
        package_dir.mkdir(parents=True, exist_ok=True)

        suffix = safe_suffix(filename, content_type)
        source_path = package_dir / f"source{suffix}"
        manifest_path = package_dir / "manifest.json"
        sharp_dir = package_dir / "sharp"
        sharp_input_dir = package_dir / "sharp-input"
        sharp_output_dir = sharp_dir / "gaussians"
        ply_path = sharp_output_dir / f"{source_path.stem}.ply"

        if not source_path.exists():
            source_path.write_bytes(image_bytes)

        manifest = load_manifest(package_dir) or {
            "version": 1,
            "asset_id": asset_id,
            "created_at": utc_now(),
            "source": {
                "original_filename": filename,
                "mime_type": content_type,
                "sha256": image_hash,
                "bytes": len(image_bytes),
                "path": source_path.name,
            },
            "depth_pro": {"status": "not_generated"},
            "sharp": {"status": "not_generated"},
        }

        cache_key = current_sharp_cache_key()
        sharp_entry = manifest.get("sharp", {})
        existing_ply = package_dir / (sharp_entry.get("ply_path") or "__missing__.ply")
        cached = cache_entry_is_valid(sharp_entry, cache_key, [existing_ply])

        if not cached:
            if sharp_input_dir.exists():
                shutil.rmtree(sharp_input_dir)
            sharp_input_dir.mkdir(parents=True, exist_ok=True)
            staged_source = sharp_input_dir / source_path.name
            shutil.copy2(source_path, staged_source)

            if sharp_output_dir.exists():
                shutil.rmtree(sharp_output_dir)
            sharp_output_dir.mkdir(parents=True, exist_ok=True)

            command = [str(sharp_cli), "predict", "-i", str(sharp_input_dir), "-o", str(sharp_output_dir)]
            checkpoint = find_sharp_checkpoint()
            if checkpoint:
                command.extend(["-c", str(checkpoint)])

            completed = subprocess.run(
                command,
                cwd=str(ROOT),
                text=True,
                capture_output=True,
                check=False,
            )
            if completed.returncode != 0:
                raise RuntimeError(
                    "SHARP generation failed.\n"
                    f"Command: {' '.join(command)}\n"
                    f"stdout: {completed.stdout[-2000:]}\n"
                    f"stderr: {completed.stderr[-2000:]}"
                )

            ply_files = sorted(sharp_output_dir.rglob("*.ply"))
            if not ply_files:
                raise RuntimeError(
                    "SHARP completed but no .ply file was found in "
                    f"{sharp_output_dir}."
                )

            ply_path = ply_files[0]
            manifest["updated_at"] = utc_now()
            manifest["sharp"] = {
                "status": "ready",
                "generated_at": utc_now(),
                "model": SHARP_MODEL_ID,
                "model_version": SHARP_MODEL_VERSION,
                "ply_path": str(ply_path.relative_to(package_dir)),
                "cache_key": cache_key,
                "generation_settings": SHARP_SETTINGS,
                "stdout_tail": completed.stdout[-2000:],
                "stderr_tail": completed.stderr[-2000:],
            }
            atomic_write_json(manifest_path, manifest)
        else:
            ply_path = existing_ply

        relative_ply = str(ply_path.relative_to(package_dir)).replace("\\", "/")
        self.send_json(
            200,
            {
                "ok": True,
                "cached": cached,
                "asset_id": asset_id,
                "package_dir": str(package_dir),
                "manifest": manifest,
                "ply_path": str(ply_path),
                "ply_url": f"http://{HOST}:{PORT}/assets/{asset_id}/{relative_ply}",
            },
        )

    def serve_asset(self, request_path: str) -> None:
        rel = posixpath.normpath(urllib.parse.unquote(request_path[len("/assets/") :]))
        if rel.startswith("../") or rel == "..":
            self.send_json(400, {"ok": False, "error": "Invalid asset path."})
            return

        file_path = (ASSET_ROOT / rel).resolve()
        try:
            file_path.relative_to(ASSET_ROOT.resolve())
        except ValueError:
            self.send_json(400, {"ok": False, "error": "Invalid asset path."})
            return

        if not file_path.is_file():
            self.send_json(404, {"ok": False, "error": "Asset not found."})
            return

        body = file_path.read_bytes()
        mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    print("Shader Playground companion service")
    print(f"Listening on http://{HOST}:{PORT}")
    print(f"Generated assets: {ASSET_ROOT}")
    print("Press Ctrl+C to stop.")

    server = ThreadingHTTPServer((HOST, PORT), CompanionHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping companion service...")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
