#!/usr/bin/env bash
# Generate PDFs of all deliverables and supporting docs under CMPT-390_CSCapstone/docs.
# Uses Chrome headless for HTML and for anything converted to HTML (md, docx, txt, tex).
# Does not move originals; writes PDFs into docs/final_deliverables/ preserving folder structure.
# Requires: Google Chrome, pandoc.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${DOCS_ROOT}/final_deliverables"
TEMP_HTML="$(mktemp -t capstone_pdf_XXXXXX.html)"

CHROME_MAC="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ -x "$CHROME_MAC" ]]; then
    CHROME="$CHROME_MAC"
else
    echo "Google Chrome not found at $CHROME_MAC. Install Chrome or set CHROME to your binary." >&2
    exit 1
fi

mkdir -p "$OUT_DIR"
cleanup() { rm -f "$TEMP_HTML"; }
trap cleanup EXIT

to_pdf_via_chrome() {
    local src="$1"
    local out_pdf="$2"
    "$CHROME" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$out_pdf" "file://${1}"
}

to_pdf_via_pandoc_then_chrome() {
    local src="$1"
    local out_pdf="$2"
    local fmt=""
    case "${src}" in
        *.md)   fmt="-f markdown" ;;
        *.docx) fmt="" ;;
        *.tex)  fmt="-f latex" ;;
        *)      fmt="" ;;
    esac
    if ! pandoc -s $fmt -t html -o "$TEMP_HTML" "$src"; then
        echo "pandoc failed: $src" >&2
        return 1
    fi
    to_pdf_via_chrome "$TEMP_HTML" "$out_pdf"
}

process_file() {
    local f="$1"
    [[ "$f" == *'~$'* ]] && return 0
    [[ "$f" == *".DS_Store"* ]] && return 0
    [[ "$f" == *"/final_deliverables/"* ]] && return 0

    local rel="${f#$DOCS_ROOT/}"
    local dir_out="$OUT_DIR/$(dirname "$rel")"
    local ext="${f##*.}"
    local base="$(basename "$f" ."$ext")"

    case "$ext" in
        pdf)
            mkdir -p "$dir_out"
            cp "$f" "${dir_out}/$(basename "$f")"
            echo "Copied PDF: $rel"
            ;;
        html)
            mkdir -p "$dir_out"
            to_pdf_via_chrome "$f" "${dir_out}/${base}.pdf"
            echo "HTML -> PDF: $rel"
            ;;
        md|docx|tex)
            mkdir -p "$dir_out"
            to_pdf_via_pandoc_then_chrome "$f" "${dir_out}/${base}.pdf"
            echo "Converted: $rel"
            ;;
        *)
            ;;
    esac
}

export DOCS_ROOT OUT_DIR TEMP_HTML CHROME
export -f to_pdf_via_chrome to_pdf_via_pandoc_then_chrome process_file cleanup

find "$DOCS_ROOT" -type f \( -name '*.pdf' -o -name '*.html' -o -name '*.md' -o -name '*.docx' -o -name '*.tex' \) ! -path '*/final_deliverables/*' -print0 2>/dev/null | while IFS= read -r -d '' f; do
    process_file "$f"
done

echo "Done. PDFs are in: $OUT_DIR"
