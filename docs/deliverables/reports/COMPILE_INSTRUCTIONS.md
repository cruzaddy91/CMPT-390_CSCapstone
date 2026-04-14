# How to Compile the LaTeX Report

## Option 1: Overleaf (Recommended - Easiest)

1. Go to https://www.overleaf.com
2. Sign up for a free account (or log in)
3. Click "New Project" → "Blank Project"
4. Name it "Weightlifting Platform Report"
5. Delete the default content
6. Copy and paste the entire contents of `Weightlifting_Platform_Report.tex`
7. Click "Recompile" (top left)
8. Download the PDF when it's ready

**Advantages:**
- No installation needed
- Works in any browser
- Automatic compilation
- Easy to share and collaborate

## Option 2: Install LaTeX Locally (macOS)

### Install BasicTeX (Smaller, ~100MB):
```bash
brew install --cask basictex
```

After installation, add to your PATH:
```bash
export PATH="/usr/local/texlive/2023basic/bin/universal-darwin:$PATH"
```

### Or Install MacTeX (Full, ~4GB):
```bash
brew install --cask mactex
```

### Then Compile:
```bash
cd "/Users/addycruz/Desktop/SeniorProject/latex template"
pdflatex Weightlifting_Platform_Report.tex
pdflatex Weightlifting_Platform_Report.tex  # Run twice for proper references
```

The PDF will be generated as `Weightlifting_Platform_Report.pdf`

## Option 3: Online LaTeX Compilers

- **Overleaf**: https://www.overleaf.com (recommended)
- **LaTeX Base**: https://latexbase.com
- **ShareLaTeX**: https://www.sharelatex.com

## Troubleshooting

If you get errors about missing packages:
- In Overleaf: It will auto-install missing packages
- Locally: Install packages with `tlmgr install <package-name>`

Common packages used:
- geometry
- graphicx
- amssymb
- listings
- xcolor
- hyperref
