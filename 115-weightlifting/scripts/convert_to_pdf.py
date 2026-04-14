#!/usr/bin/env python3
"""
Convert markdown files to PDF with nice formatting
"""
import markdown
from weasyprint import HTML, CSS
from pathlib import Path
import sys

def markdown_to_pdf(md_file, pdf_file):
    """Convert a markdown file to PDF"""
    # Read markdown file
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Convert markdown to HTML
    html_content = markdown.markdown(md_content, extensions=['extra', 'codehilite'])
    
    # Add CSS styling for professional look
    css_style = """
    <style>
        @page {
            size: letter;
            margin: 1in;
        }
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
        }
        h1 {
            font-size: 20pt;
            font-weight: bold;
            margin-top: 24pt;
            margin-bottom: 12pt;
            color: #1a1a1a;
            border-bottom: 2pt solid #333;
            padding-bottom: 6pt;
        }
        h2 {
            font-size: 16pt;
            font-weight: bold;
            margin-top: 18pt;
            margin-bottom: 10pt;
            color: #2a2a2a;
        }
        h3 {
            font-size: 13pt;
            font-weight: bold;
            margin-top: 14pt;
            margin-bottom: 8pt;
            color: #3a3a3a;
        }
        p {
            margin-bottom: 10pt;
            text-align: justify;
        }
        code {
            font-family: 'Courier New', monospace;
            font-size: 10pt;
            background-color: #f5f5f5;
            padding: 2pt 4pt;
            border-radius: 3pt;
        }
        pre {
            background-color: #f5f5f5;
            border: 1pt solid #ddd;
            border-radius: 4pt;
            padding: 10pt;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 9pt;
        }
        pre code {
            background-color: transparent;
            padding: 0;
        }
        strong {
            font-weight: bold;
        }
        em {
            font-style: italic;
        }
        hr {
            border: none;
            border-top: 1pt solid #ccc;
            margin: 20pt 0;
        }
        ul, ol {
            margin-bottom: 10pt;
            padding-left: 24pt;
        }
        li {
            margin-bottom: 6pt;
        }
        blockquote {
            border-left: 4pt solid #ccc;
            padding-left: 12pt;
            margin-left: 0;
            margin-right: 0;
            color: #666;
            font-style: italic;
        }
    </style>
    """
    
    # Wrap in full HTML document
    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        {css_style}
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """
    
    # Convert to PDF
    HTML(string=full_html).write_pdf(pdf_file)
    print(f"✓ Converted {md_file} → {pdf_file}")

if __name__ == "__main__":
    # Convert both transcript files
    files_to_convert = [
        "Transcript_1_Architecture_Planning.md",
        "Transcript_2_Data_Modeling_Implementation.md"
    ]
    
    for md_file in files_to_convert:
        if Path(md_file).exists():
            pdf_file = md_file.replace('.md', '.pdf')
            try:
                markdown_to_pdf(md_file, pdf_file)
            except Exception as e:
                print(f"✗ Error converting {md_file}: {e}")
                sys.exit(1)
        else:
            print(f"✗ File not found: {md_file}")
            sys.exit(1)
    
    print("\n✓ All conversions complete!")
