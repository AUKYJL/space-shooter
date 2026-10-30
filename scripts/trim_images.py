#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


SUPPORTED_EXTS = {".png", ".webp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Trim empty transparent padding around images (all 4 sides).\n"
            "Works best for PNG/WebP assets where the object is centered and the outside area is transparent."
        )
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        "--input-dir",
        type=Path,
        help="Folder with source images.",
    )
    input_group.add_argument(
        "--input",
        type=Path,
        help="Single image file to process.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output folder (default: <input-dir>/trimmed or <input-parent>/trimmed).",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing files in output folder.",
    )
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Process images in subfolders too.",
    )
    parser.add_argument(
        "--alpha-threshold",
        type=int,
        default=2,
        help="Pixels with alpha < threshold are treated as empty. Range: 0-255. Default: 2.",
    )
    parser.add_argument(
        "--keep-if-empty",
        action="store_true",
        help="If the image is fully empty/transparent, copy it as-is (default: skip).",
    )
    return parser.parse_args()


def iter_images(input_dir: Path, recursive: bool) -> list[Path]:
    candidates = input_dir.rglob("*") if recursive else input_dir.glob("*")
    images: list[Path] = []
    for p in candidates:
        if not p.is_file():
            continue
        if p.suffix.lower() in SUPPORTED_EXTS:
            images.append(p)
    return images


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def bbox_from_alpha(im: Image.Image, alpha_threshold: int) -> tuple[int, int, int, int] | None:
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    alpha = im.split()[-1]
    if alpha_threshold <= 0:
        return alpha.getbbox()
    if alpha_threshold >= 255:
        # Only fully-opaque pixels survive.
        mask = alpha.point(lambda a: 255 if a >= 255 else 0)
        return mask.getbbox()
    mask = alpha.point(lambda a: 255 if a >= alpha_threshold else 0)
    return mask.getbbox()


def trim_image(src_path: Path, dest_path: Path, alpha_threshold: int) -> bool:
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)
        fmt = (im.format or "").upper() or dest_path.suffix.lstrip(".").upper()

        if im.mode not in {"RGBA", "LA", "P"} and "A" not in im.getbands():
            # No alpha channel; nothing to trim safely.
            return False

        bbox = bbox_from_alpha(im, alpha_threshold=alpha_threshold)
        if bbox is None:
            return False

        trimmed = im.crop(bbox)

        save_kwargs: dict[str, object] = {}
        if fmt == "PNG":
            save_kwargs.update({"optimize": True})
        elif fmt == "WEBP":
            # Keep lossless alpha by default for sprites/assets.
            save_kwargs.update({"lossless": True, "method": 6})

        ensure_parent(dest_path)
        trimmed.save(dest_path, format=fmt if fmt else None, **save_kwargs)
        return True


def main() -> int:
    args = parse_args()

    if not (0 <= args.alpha_threshold <= 255):
        raise SystemExit("--alpha-threshold must be in range 0..255")

    if args.input is not None:
        input_path: Path = args.input
        if not input_path.exists() or not input_path.is_file():
            raise SystemExit(f"Input file not found: {input_path}")
        images = [input_path]
        base_dir = input_path.parent
    else:
        input_dir: Path = args.input_dir
        if input_dir is None or not input_dir.exists() or not input_dir.is_dir():
            raise SystemExit(f"Input directory not found: {input_dir}")
        images = iter_images(input_dir, recursive=args.recursive)
        base_dir = input_dir

    output_dir: Path = args.output_dir or (base_dir / "trimmed")
    output_dir.mkdir(parents=True, exist_ok=True)

    if not images:
        source = args.input_dir or base_dir
        print(f"No images found in {source} (supported: {', '.join(sorted(SUPPORTED_EXTS))})")
        return 0

    processed = 0
    skipped = 0
    unchanged = 0
    for src in images:
        dest = output_dir / src.name if args.input is not None else (output_dir / src.relative_to(base_dir))

        if dest.exists() and not args.overwrite:
            skipped += 1
            continue

        try:
            did_trim = trim_image(src, dest, alpha_threshold=args.alpha_threshold)
            if did_trim:
                processed += 1
            else:
                if args.keep_if_empty:
                    ensure_parent(dest)
                    dest.write_bytes(src.read_bytes())
                    unchanged += 1
                else:
                    unchanged += 1
        except Exception as e:
            print(f"[ERROR] {src}: {e}")

    print(
        f"Done. trimmed={processed} unchanged={unchanged} skipped={skipped} input={args.input or args.input_dir} output={output_dir} threshold={args.alpha_threshold}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
