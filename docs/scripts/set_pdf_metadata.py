#!/usr/bin/env python3
"""
Rewrite PDF metadata to match normal Google Docs or Word export conventions.

Conventions (from real exports):
- Google Docs: Producer = "Skia/PDF mNN" (Skia backend), Creator = not set (blank).
- Microsoft Word: Creator = "Microsoft Word" (or versioned), Producer = same or "Microsoft: Print To PDF".

Usage:
  python3 set_pdf_metadata.py <file.pdf> [--convention google-docs|word]
  python3 set_pdf_metadata.py <directory/> [--convention google-docs|word]
  python3 set_pdf_metadata.py <path> --creator "X" --producer "Y"   # custom

Requires: pypdf (pip install pypdf)
"""

import argparse
import sys
from pathlib import Path

try:
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject, TextStringObject
except ImportError:
    print("pypdf is required. Install with: pip install pypdf", file=sys.stderr)
    sys.exit(1)

# Match real Google Docs: only Producer set (Skia/PDF), Creator blank.
GOOGLE_DOCS_PRODUCER = "Skia/PDF m129"
GOOGLE_DOCS_CREATOR = ""  # Google Docs does not set Creator

# Match Word export: Creator and Producer identify Word.
WORD_CREATOR = "Microsoft Word"
WORD_PRODUCER = "Microsoft Word"


def rewrite_metadata(pdf_path: Path, creator: str, producer: str) -> None:
    pdf_path = pdf_path.resolve()
    if pdf_path.suffix.lower() != ".pdf" or not pdf_path.is_file():
        return
    out_path = pdf_path.parent / (pdf_path.stem + "_meta.pdf")
    reader = PdfReader(str(pdf_path))
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    meta = dict(reader.metadata or {})
    meta[NameObject("/Producer")] = TextStringObject(producer)
    meta[NameObject("/Creator")] = TextStringObject(creator)  # empty for Google Docs
    writer.add_metadata(meta)
    with open(out_path, "wb") as f:
        writer.write(f)
    out_path.replace(pdf_path)
    print(f"Updated metadata: {pdf_path}")


def main():
    ap = argparse.ArgumentParser(
        description="Set PDF metadata to match Google Docs or Word export."
    )
    ap.add_argument("path", type=Path, help="PDF file or directory")
    ap.add_argument(
        "--convention",
        choices=("google-docs", "word"),
        default="google-docs",
        help="Use real Google Docs or Word metadata (default: google-docs)",
    )
    ap.add_argument("--creator", default=None, help="Override Creator (with custom)")
    ap.add_argument("--producer", default=None, help="Override Producer (with custom)")
    args = ap.parse_args()
    path = args.path.resolve()

    if args.creator is not None or args.producer is not None:
        creator = args.creator or ""
        producer = args.producer or ""
    elif args.convention == "google-docs":
        creator = GOOGLE_DOCS_CREATOR
        producer = GOOGLE_DOCS_PRODUCER
    else:
        creator = WORD_CREATOR
        producer = WORD_PRODUCER

    if path.is_file():
        rewrite_metadata(path, creator, producer)
    elif path.is_dir():
        for f in sorted(path.rglob("*.pdf")):
            rewrite_metadata(f, creator, producer)
    else:
        print(f"Not found: {path}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
