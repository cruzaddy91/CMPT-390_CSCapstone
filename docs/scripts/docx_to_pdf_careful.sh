#!/usr/bin/env bash
# Convert a .docx to PDF with careful pagination: avoid breaking paragraphs,
# headings, and lists in the middle. Injects print CSS then uses Chrome headless.
# Usage: docx_to_pdf_careful.sh <input.docx> <output.pdf>
# Requires: pandoc, Google Chrome.

set -e
INPUT_DOCX="$1"
OUTPUT_PDF="$2"
[[ -z "$INPUT_DOCX" || -z "$OUTPUT_PDF" ]] && { echo "Usage: $0 <input.docx> <output.pdf>" >&2; exit 1; }
[[ ! -f "$INPUT_DOCX" ]] && { echo "Not found: $INPUT_DOCX" >&2; exit 1; }

CHROME_MAC="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[[ -x "$CHROME_MAC" ]] || { echo "Chrome not found at $CHROME_MAC" >&2; exit 1; }

TEMP_HTML="$(mktemp -t docx_pdf_XXXXXX.html)"
trap 'rm -f "$TEMP_HTML"' EXIT

# Pandoc: docx -> standalone HTML
pandoc -s -t html -o "$TEMP_HTML" "$INPUT_DOCX"

# Inject print CSS to avoid bad page breaks (before </head>)
# p, ul, ol, table: don't break inside; h1-h6: don't leave heading alone at bottom of page
PRINT_CSS='<style type="text/css">@media print{p{page-break-inside:avoid;}h1,h2,h3,h4,h5,h6{page-break-after:avoid;}ul,ol,table{page-break-inside:avoid;}}</style>'

# Insert before </head> (macOS sed: -i ''; GNU sed: -i)
if sed --version 2>/dev/null | head -1 | grep -q GNU; then
  sed -i "s|</head>|${PRINT_CSS}</head>|" "$TEMP_HTML"
else
  sed -i '' "s|</head>|${PRINT_CSS}</head>|" "$TEMP_HTML"
fi

# Chrome headless -> PDF
mkdir -p "$(dirname "$OUTPUT_PDF")"
"$CHROME_MAC" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="$OUTPUT_PDF" "file://${TEMP_HTML}"

echo "Written: $OUTPUT_PDF"
