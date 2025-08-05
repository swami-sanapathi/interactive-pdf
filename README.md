# HRMS Tabbed PDF Generator (Node.js)

Generate a dynamic, interactive PDF that simulates a tab-based UI for HRMS appraisal reports.

Two generators are included:
- PDFKit-based (`generate-hrms-pdf.js`) – draws vector UI and adds internal links per tab.
- Puppeteer-based (`generate-hrms-puppeteer.js`) – renders styled HTML and exports to PDF with clickable in-document anchors.

Both outputs work in Adobe Acrobat Reader and Chrome PDF viewer. Tab clicks jump to the corresponding section/page.

## Quick Start

1) Install dependencies:
```bash
npm install
```

2) Run either generator (uses `sample-data.json` by default):

- PDFKit:
```bash
npm run pdfkit
```

- Puppeteer (Chromium HTML→PDF):
```bash
npm run puppeteer
```

This builds `appraisal.pdf` in the project root.

## Input JSON Shape
See `sample-data.json` for a full example. Shape:
```json
{
  "meta": {
    "reportTitle": "Assessment Stage",
    "employee": { "name": "...", "code": "...", "title": "..." }
  },
  "tabs": [
    {
      "id": "job",
      "label": "Job Competencies",
      "sections": [
        {
          "title": "Manage Relationships",
          "weightage": 80,
          "expectedRating": 4.5,
          "rating": 5.0,
          "description": "...",
          "behaviors": ["..."],
          "comments": [
            { "author": "...", "role": "...", "step": "...", "text": "..." }
          ]
        }
      ]
    }
  ]
}
```

## Notes on Interactivity
- Tabs are rendered on every page. Clicking a tab:
  - PDFKit build: jumps to the first page of that tab (internal page link). Bookmarks are added as well.
  - Puppeteer build: uses HTML anchors (`#tab-i`) that remain clickable after PDF export.
- Complete content hiding inside a single PDF page is not feasible with standard PDF viewers; we simulate tabs via in-document navigation.

## Customization
- Colors/spacing: edit palette and constants in `generate-hrms-pdf.js` or CSS in `generate-hrms-puppeteer.js`.
- Data: replace `sample-data.json` or pass `-i your.json -o out.pdf`.

## Commands
```bash
node generate-hrms-pdf.js -i sample-data.json -o appraisal.pdf
node generate-hrms-puppeteer.js -i sample-data.json -o appraisal.pdf
```

## Compatibility
Tested with:
- pdfkit ^0.14
- puppeteer ^22
Opens with clickable internal links in Adobe Reader and Chrome PDF viewer.
