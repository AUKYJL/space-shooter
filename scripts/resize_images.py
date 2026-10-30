#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from pathlib import Path

from PIL import Image, ImageOps


DEFAULT_INPUT_DIR = Path(
    "/Users/aukyjl/Projects/Web/test/spaceShooter/docs/design/assets/asteroids"
)


SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Resize images in a folder.\n"
            "- target=square: produce square thumbnails (e.g. 128x128 or 256x256)\n"
            "- target=width: resize proportionally to the given width (height auto)\n"
        )
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help=f"Folder with source images (default: {DEFAULT_INPUT_DIR})",
    )
    parser.add_argument(
        "--size",
        type=int,
        choices=[128, 256],
        required=True,
        help="Target size in px (square side for target=square, width for target=width).",
    )
    parser.add_argument(
        "--target",
        choices=["square", "width"],
        default="square",
        help="square = output is size×size, width = output width is size and height is proportional.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output folder (default: <input-dir>/resized_<size>).",
    )
    parser.add_argument(
        "--mode",
        choices=["contain", "cover"],
        default="contain",
        help="For target=square: contain = fit inside square with padding, cover = fill square with center crop.",
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
        "--quality",
        type=int,
        default=90,
        help="JPEG/WebP quality (1-100). Default: 90.",
    )
    return parser.parse_args()


def iter_images(input_dir: Path, recursive: bool) -> list[Path]:
    if recursive:
        candidates = input_dir.rglob("*")
    else:
        candidates = input_dir.glob("*")
    images: list[Path] = []
    for p in candidates:
        if not p.is_file():
            continue
        if p.suffix.lower() in SUPPORTED_EXTS:
            images.append(p)
    return images


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def background_for_format(fmt: str) -> tuple[int, int, int, int] | tuple[int, int, int]:
    # For formats without alpha (e.g. JPEG) we use black background.
    if fmt.upper() == "JPEG":
        return (0, 0, 0)
    return (0, 0, 0, 0)


def resize_image(
    src_path: Path, dest_path: Path, size: int, target: str, mode: str, quality: int
) -> None:
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)

        fmt = (im.format or "").upper()
        if not fmt:
            fmt = dest_path.suffix.lstrip(".").upper()

        # Preserve transparency for palette images (mode "P") and similar.
        # PIL can otherwise drop the alpha when resizing/pasting.
        if fmt not in {"JPEG", "JPG"} and im.mode in {"P", "LA"}:
            im = im.convert("RGBA")

        if target == "width":
            if im.width <= 0:
                raise ValueError(f"Invalid image width: {im.width}")
            new_w = size
            new_h = max(1, round((size / im.width) * im.height))
            resized = im.resize((new_w, new_h), resample=Image.Resampling.LANCZOS)
        else:
            target_size = (size, size)

            if mode == "cover":
                resized = ImageOps.fit(
                    im,
                    target_size,
                    method=Image.Resampling.LANCZOS,
                    centering=(0.5, 0.5),
                )
            else:
                bg = background_for_format(fmt)
                resized = ImageOps.contain(im, target_size, method=Image.Resampling.LANCZOS)

                # If we're outputting a format that supports alpha, keep it.
                if len(bg) == 4 and resized.mode != "RGBA":
                    resized = resized.convert("RGBA")

                canvas = Image.new(
                    "RGBA" if len(bg) == 4 else "RGB",
                    target_size,
                    bg,
                )
                paste_x = (size - resized.width) // 2
                paste_y = (size - resized.height) // 2
                mask = None
                if resized.mode in ("RGBA", "LA"):
                    mask = resized.split()[-1]
                canvas.paste(resized, (paste_x, paste_y), mask)
                resized = canvas

        save_kwargs: dict[str, object] = {}
        if fmt in {"JPEG", "JPG"}:
            if resized.mode in ("RGBA", "LA"):
                resized = resized.convert("RGB")
            save_kwargs.update({"quality": quality, "optimize": True})
        elif fmt == "WEBP":
            save_kwargs.update({"quality": quality, "method": 6})
        elif fmt == "PNG":
            save_kwargs.update({"optimize": True})

        ensure_parent(dest_path)
        resized.save(dest_path, format=fmt if fmt else None, **save_kwargs)


def main() -> int:
    args = parse_args()

    input_dir: Path = args.input_dir
    if not input_dir.exists() or not input_dir.is_dir():
        raise SystemExit(f"Input directory not found: {input_dir}")

    output_dir: Path = args.output_dir or (input_dir / f"resized_{args.size}")
    output_dir.mkdir(parents=True, exist_ok=True)

    images = iter_images(input_dir, recursive=args.recursive)
    if not images:
        print(f"No images found in {input_dir} (supported: {', '.join(sorted(SUPPORTED_EXTS))})")
        return 0

    processed = 0
    skipped = 0
    for src in images:
        rel = src.relative_to(input_dir)
        dest = output_dir / rel

        if dest.exists() and not args.overwrite:
            skipped += 1
            continue

        try:
            resize_image(
                src,
                dest,
                size=args.size,
                target=args.target,
                mode=args.mode,
                quality=args.quality,
            )
            processed += 1
        except Exception as e:
            print(f"[ERROR] {src}: {e}")

    print(
        f"Done. processed={processed} skipped={skipped} input={input_dir} output={output_dir} size={args.size} target={args.target} mode={args.mode}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
