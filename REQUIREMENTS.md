# HRMS Appraisal PDF — Master Requirements (Puppeteer Only)

Status: Approved understanding; do NOT implement until user explicitly says START.

## 1) Executive Summary
- Goal: Generate a pixel-perfect PDF that matches the 11 reference images exactly — layout, spacing, colors, typography, borders, shadows, chips/badges, icons, dividers, avatars, and headings.
- Stack: Puppeteer-only (HTML/CSS → PDF). No PDFKit in the final deliverable.
- Navigation: Clickable tab “pills” anchored to each tab section; PDF bookmarks for each tab.
- Structure: Multi-tab document with hierarchical/nested sections. Max depth 4 for “KRA vs Goals vs Sub Goals” and “Objectives”. “Role Specific Competencies” uses 1–2 levels (dynamic).
- Assets: Show employee avatars/photos everywhere they appear in the references.
- Output: A4 portrait, print backgrounds enabled, precise pagination; tab bar repeats on every page.
- Gate: No implementation until the user says START.

## 2) Source of Truth
- 11 reference images (full visual specification). The PDF must match them “as is”.
- Any design/materials not captured in text must follow the images exactly.

## 3) Constraints & Compatibility
- Puppeteer (Chromium) only.
- Viewers: Adobe Acrobat Reader and Chrome PDF viewer.
- Preserve clickable tab anchors in the exported PDF.
- Provide bookmarks (outline) for each top-level tab.
- Page size: A4 portrait. Print background graphics ON.
- Exact fonts/colors: Prefer brand-provided fonts; otherwise approve closest web fonts (e.g., Inter) before implementation.

## 4) Final Deliverables
- Node.js script to generate the PDF from dynamic JSON via Puppeteer.
- HTML/CSS templates reproducing the references pixel-perfect.
- JSON schema (and sample JSON) covering all tab types and nested levels.
- Output PDF with:
  - Exact visual fidelity
  - Clickable tab anchors and bookmarks
  - Clean pagination and repeated tab header
- README describing run commands and JSON input format.

## 5) Repository Context (Current)
- `generate-hrms-puppeteer.js`: Working baseline Puppeteer generator (will be refined to the final spec).
- `generate-hrms-pdf.js`: Present but will NOT be used further.
- `sample-data.json`: Baseline example; will be extended to support full hierarchy and avatars.
- `README.md`: Baseline usage; will be updated post-implementation.
- `.gitignore`: Should include `node_modules/` and `*.pdf`.

## 6) Global Layout & Visual System
- Header block: Employee name, code, title/designation; appraisal ID/date.
- Tabs row: Pills for each section (e.g., Job Competencies, Role Specific Competencies, KRA vs Goals vs Sub Goals, Objectives, Custom Questions, Potential Rating, etc.). Active tab highlighted; others muted. Clicking jumps to section.
- Colors: Light gray surfaces, subtle borders, primary blue for active states, green accents for progress, orange/yellow for star chips, muted gray text. Exact hex values derived from references.
- Typography: Modern sans (e.g., Inter/SF-like). Exact sizes/weights/line-heights from references; embed fonts if provided.
- Cards: Rounded corners, 1px border, subtle drop shadow, consistent padding/margins.
- Chips/Badges: Rounded pills; color-coded states (e.g., “Low”, “Met expectations”, “Exceeded Expectations”). Star rating chips where applicable.
- Dividers: Thin gray lines; consistent spacing around dividers and headings.

## 7) Tab Content Specifications

### 7.1 Rating Details (Global Panel)
- Title “Rating Details”.
- Description paragraph block.
- Row of chips/badges: Weightage, Rating, Score, Label, Manual Rating, Mapped Score, Mapped Label.
- Star chips and colored badges exactly as shown.

### 7.2 Section Contents (General Pattern used in multiple tabs)
- Section card:
  - Left: Title and context.
  - Right: Rating chip (e.g., 5.0) and label badges (e.g., “Met expectations”).
  - “Description” paragraph.
  - Optional “Behaviors” subsection with pill header and multiple items.
  - Comments list:
    - Each comment shows avatar, name, role, step name (e.g., User Comment, RM Comment), text.
    - Metadata chips (Progress, Updated Value, Status) as in images.
    - Optional star rating aligned right for some comments.
- Section Review panel:
  - Section title (e.g., Role Specific Competencies / Objectives / Custom Questions, etc.).
  - Comment paragraph.
  - Rating/label chip (e.g., 4.5 “Excellent”).
- Section end markers centered, e.g.: “• ROLE COMPETENCIES END •”, “• OBJECTIVES END •”, “• CUSTOM QUESTIONS END •”.

### 7.3 Hierarchical Tabs (Nested Levels)
- “KRA vs Goals vs Sub Goals” and “Objectives”: Up to 4 levels.
- Node layout:
  - Header row with identifiers: title, date, KPI/IDs, category names/types.
  - Priority pill (e.g., High/Low) and Present Status pill.
  - Right side: Circular progress (e.g., 70%) and a rating chip (e.g., 5.0).
  - Description paragraph.
  - Comments thread identical structure to general comments.
  - Children render below with clear indentation and vertical connector lines.
  - Green numbered dot for each node level index as in references.
- “Role Specific Competencies”: 1–2 levels depending on data.

### 7.4 Custom Questions
- Blocks grouped per person: avatar, name, role.
- Items numbered (01–04) with questions and answers; small star ratings inline where shown.
- “Low” badge aligned to the right for some persons.
- Section Review at the end with rating/label.

### 7.5 Acknowledgment Stage
- Header and final panels/notes matching references.

## 8) Interactivity & Anchors
- Tab pills are anchor links (#tab-n) preserved in the PDF.
- Bookmarks/outline entries for each tab.

## 9) Pagination Rules
- Format: A4 portrait; printBackground: true; preferCSSPageSize: true.
- Prevent awkward splits: cards and composite blocks should avoid page-break-inside where possible.
- If a block won’t fit, shift the whole block to the next page.
- Repeat the tab bar (and top header if required) on every page.
- Maintain exact top/bottom margins based on references.

## 10) Data Model (JSON) — High Level
```json
{
  "meta": {
    "employee": { "name": "", "code": "", "title": "", "avatar": "" },
    "appraisal": { "id": "", "date": "" },
    "reportTitle": ""
  },
  "tabs": [
    {
      "id": "",
      "label": "",
      "sections": [
        {
          "title": "",
          "weightage": 0,
          "expectedRating": 0,
          "rating": 0,
          "labels": [""],
          "description": "",
          "behaviors": [""],
          "comments": [
            {
              "author": "",
              "role": "",
              "avatar": "",
              "stepName": "",
              "text": "",
              "rating": 0,
              "chips": { "progress": 0, "updatedValue": 0, "status": "" }
            }
          ]
        }
      ],
      "hierarchy": {
        "nodes": [
          {
            "id": "",
            "title": "",
            "date": "",
            "kpi": "",
            "categoryName": "",
            "categoryType": "",
            "weightage": 0,
            "progressPercent": 0,
            "rating": 0,
            "priority": "",
            "presentStatus": "",
            "description": "",
            "comments": [ /* same as above */ ],
            "children": [ /* recursive, up to depth 4 */ ]
          }
        ]
      }
    }
  ]
}
```
- Avatars/icons may be URLs or base64; final approach will ensure crisp render in PDF.

## 11) Rendering Settings
- Puppeteer: `page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })`.
- CSS:
  - CSS variables for palette.
  - page-break-* rules for pagination control.
  - Anchor tags for tabs; IDs at tab section containers.
- Fonts: embed exact font files if provided; otherwise use and approve a close Google Fonts alternative.

## 12) Testing & Acceptance Criteria
- Viewers: Adobe Acrobat Reader and Chrome PDF viewer.
- Checks:
  - All tabs present, clickable anchors navigate correctly.
  - Bookmarks for each tab.
  - Pixel parity with references: spacing, borders, shadows, colors, typography, chips/badges, icons, dividers, avatars, headings.
  - Hierarchy renders correctly up to 4 levels with connectors and numbered dots.
  - Clean pagination; no broken cards or awkward splits.
- Performance: Reasonable memory/time for large JSON inputs.

## 13) Risks & Mitigations
- Font metric mismatch → Embed provided fonts or agree on closest alternative before implementation.
- Icon crispness → Prefer SVG; fallback to high-DPI PNG if necessary.
- Large content pagination → Strict CSS rules to avoid page-break-inside and test with maximal depth.

## 14) Open Items (to confirm at START)
- Provide exact font files or approve fallback.
- Confirm brand hex palette if different from what we extract from images.
- Provide/approve icon assets (stars, progress donut, priority/status pills) if brand-specific.
- Supply a comprehensive sample JSON covering a 4-level nested case, all chip types, statuses, avatars, and ratings across tabs.

## 15) Start Gate
- No work will begin until the user explicitly says **START**.
- Upon START: finalize schema, build HTML/CSS templates, wire anchors/bookmarks, tune pagination, deliver script and README.
