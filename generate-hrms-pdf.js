/*
  generate-hrms-pdf.js
  Generate a dynamic, interactive tab-based HRMS appraisal PDF using PDFKit.
  - One main page per Tab (sections can overflow to more pages if needed)
  - A persistent tab bar renders at the top of each page
  - Clicking a tab jumps to the first page of that tab (GoTo page link)
  - Content (titles, ratings, comments, weights) is driven by input JSON

  Usage:
    node generate-hrms-pdf.js -i sample-data.json -o appraisal.pdf

  JSON shape (see sample-data.json for a full example):
    {
      "meta": { "employee": { "name": "...", "code": "...", "title": "..." }, "reportTitle": "Assessment Stage" },
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
              "comments": [
                { "author": "James Major", "role": "Developer", "step": "User Comment", "text": "..." },
                { "author": "Millard Atkins", "role": "Reporting Manager", "step": "RM Comment", "text": "..." }
              ]
            }
          ]
        }
      ]
    }
*/

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { input: 'sample-data.json', output: 'appraisal.pdf' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if ((a === '-i' || a === '--input') && args[i + 1]) out.input = args[++i];
    else if ((a === '-o' || a === '--output') && args[i + 1]) out.output = args[++i];
  }
  return out;
}

const palette = {
  bg: '#FFFFFF',
  tabBg: '#F5F7FB',
  tabActiveBg: '#E9EEFF',
  tabInactiveBg: '#F3F4F6',
  primary: '#4C6FFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  accent: '#22C55E',
  warning: '#F59E0B',
  star: '#F59E0B',
  chip: '#EEF2FF',
  chipText: '#3730A3'
};

const A4_WIDTH = 595.28; // PDF points
const A4_HEIGHT = 841.89;

function mm(n) { return (n * 72) / 25.4; }

function drawTabs(doc, tabs, activeIndex, margin, destMap, pageMap) {
  const m = typeof margin === 'number' ? margin : Number(margin);
  const top = m - mm(6); // extend slightly into margin for visual appeal
  const barH = mm(18);
  const gap = mm(3);
  const usableW = A4_WIDTH - m * 2;
  const eachW = Math.max(mm(28), (usableW - gap * (tabs.length - 1)) / tabs.length);

  // Bar background
  doc.save();
  doc.rect(m, top, usableW, barH).fill(palette.tabBg);
  doc.restore();

  tabs.forEach((t, idx) => {
    const x = m + idx * (eachW + gap);
    const y = top + mm(2);
    const h = barH - mm(4);

    const active = idx === activeIndex;
    doc.save();
    doc.roundedRect(x, y, eachW, h, 6)
       .fill(active ? palette.tabActiveBg : palette.tabInactiveBg);

    // Label
    doc.fillColor(active ? palette.primary : palette.muted)
       .font('Helvetica-Bold')
       .fontSize(10);
    const textW = doc.widthOfString(t.label);
    const tx = x + (eachW - textW) / 2;
    const ty = y + (h - 10) / 2 + 1;
    doc.text(t.label, tx, ty, { lineBreak: false });

    // Clickable area linking to tab's first page
    const dest = destMap?.[idx];
    if (typeof dest === 'string') {
      // Preferred: named destination for robust internal navigation
      try { doc.link(x, y, eachW, h, null, { goTo: dest }); } catch (_) { /* ignore */ }
    } else if (typeof pageMap?.[idx] === 'number') {
      // Fallback to page number jump
      try { doc.link(x, y, eachW, h, null, { page: pageMap[idx] }); } catch (_) { /* ignore */ }
    }

    doc.restore();
  });

  // Divider under tabs
  doc.moveTo(margin, top + barH).lineTo(margin + usableW, top + barH)
     .lineWidth(1).strokeColor(palette.border).stroke();
}

function ensureSpace(doc, y, need, margin, activeIndex, tabs, destMap, pageMap) {
  if (y + need <= A4_HEIGHT - margin) return y;
  doc.addPage();
  // draw tabs again on new page
  drawTabs(doc, tabs, activeIndex, margin, destMap, pageMap);
  return margin + mm(30); // reset content Y below the tabs area
}

function drawHeader(doc, meta, margin) {
  const y = margin - mm(14);
  const w = A4_WIDTH - margin * 2;

  // Title and employee info row
  const title = meta.reportTitle || 'Assessment Stage';
  doc.fillColor(palette.text).font('Helvetica-Bold').fontSize(16).text(title, margin, y);

  const emp = meta.employee || {};
  const info = [emp.name, emp.code, emp.title].filter(Boolean).join(' • ');
  doc.fillColor(palette.muted).font('Helvetica').fontSize(10).text(info, margin, y + mm(7));

  // Divider
  doc.moveTo(margin, y + mm(14)).lineTo(margin + w, y + mm(14))
     .lineWidth(1).strokeColor(palette.border).stroke();
}

function chip(doc, x, y, text, bg = palette.chip, fg = palette.chipText, icon) {
  doc.save();
  doc.font('Helvetica').fontSize(9);
  const padX = 6, padY = 3;
  const iconW = icon ? doc.widthOfString(icon) + 4 : 0;
  const textW = doc.widthOfString(text);
  const w = padX * 2 + textW + iconW;
  const h = 16;
  doc.roundedRect(x, y, w, h, 8).fill(bg);
  doc.fillColor(fg);
  let cx = x + padX;
  const cy = y + 3;
  if (icon) { doc.text(icon, cx, cy, { lineBreak: false }); cx += iconW; }
  doc.text(text, cx, cy, { lineBreak: false });
  doc.restore();
  return { width: w, height: h };
}

function ratingBadge(doc, x, y, rating) {
  return chip(doc, x, y, String(rating.toFixed ? rating.toFixed(1) : rating), '#FEF3C7', '#92400E', '★');
}

function sectionHeader(doc, x, y, section) {
  doc.save();
  doc.fillColor(palette.text).font('Helvetica-Bold').fontSize(13);
  doc.text(section.title, x, y);
  doc.restore();
}

function paragraph(doc, text, x, y, width, fontSize = 10, color = palette.muted) {
  doc.save();
  doc.fillColor(color).font('Helvetica').fontSize(fontSize);
  const h = doc.heightOfString(text, { width, align: 'justify' });
  doc.text(text, x, y, { width, lineGap: 2, align: 'justify' });
  doc.restore();
  return h;
}

function commentCard(doc, x, y, width, comment) {
  const pad = 10;
  const headerH = 16;
  const bodyH = doc.heightOfString(comment.text, { width: width - pad * 2, align: 'left' });
  const h = pad + headerH + 6 + bodyH + pad;

  doc.save();
  doc.roundedRect(x, y, width, h, 8).fill('#F9FAFB');

  // Header line: author • role • step
  const header = [comment.author, comment.role, comment.step].filter(Boolean).join('  •  ');
  doc.fillColor(palette.text).font('Helvetica-Bold').fontSize(10).text(header, x + pad, y + pad);

  // Body
  doc.fillColor(palette.muted).font('Helvetica').fontSize(10)
    .text(comment.text, x + pad, y + pad + headerH, { width: width - pad * 2 });

  doc.restore();
  return h + 2;
}

function drawSection(doc, tabs, activeIndex, margin, section, destMap, pageMap) {
  const x = margin;
  let y = ensureSpace(doc, margin + mm(30), mm(40), margin, activeIndex, tabs, destMap, pageMap);
  const width = A4_WIDTH - margin * 2;

  // Card container
  const cardPad = 14;
  const cardYStart = y;
  let cardH = 0;

  // Reserve minimal height; compute as we draw
  // Header
  sectionHeader(doc, x + cardPad, y + cardPad, section);

  // Badges row (weight, expected, rating)
  let bx = x + cardPad;
  const by = y + cardPad + mm(8);
  if (typeof section.weightage !== 'undefined') {
    const r = chip(doc, bx, by, `Weightage: ${section.weightage}`, '#EFF6FF', '#1D4ED8');
    bx += r.width + 6;
  }
  if (typeof section.expectedRating !== 'undefined') {
    const r = chip(doc, bx, by, `Expected: ${section.expectedRating}`, '#ECFDF5', '#065F46');
    bx += r.width + 6;
  }
  if (typeof section.rating !== 'undefined') {
    ratingBadge(doc, bx, by, section.rating);
  }

  let contentY = by + mm(10);

  if (section.description) {
    const ph = paragraph(doc, section.description, x + cardPad, contentY, width - cardPad * 2, 10);
    contentY += ph + 8;
  }

  if (Array.isArray(section.behaviors) && section.behaviors.length) {
    doc.fillColor(palette.text).font('Helvetica-Bold').fontSize(11).text('Behaviors', x + cardPad, contentY);
    contentY += 16;
    section.behaviors.forEach((b) => {
      const bh = paragraph(doc, `• ${b}`, x + cardPad, contentY, width - cardPad * 2, 10, palette.text);
      contentY += bh + 4;
    });
    contentY += 6;
  }

  if (Array.isArray(section.comments)) {
    section.comments.forEach((c, idx) => {
      const need = 110; // approx min height per card
      contentY = ensureSpace(doc, contentY, need, margin, activeIndex, tabs, destMap, pageMap);
      const ch = commentCard(doc, x + cardPad, contentY, width - cardPad * 2, c);
      contentY += ch + 8;
    });
  }

  cardH = contentY - y + cardPad;
  // Card border
  doc.save();
  doc.roundedRect(x, y, width, cardH, 12)
    .lineWidth(1)
    .strokeColor(palette.border)
    .stroke();
  doc.restore();

  return y + cardH + 14;
}

function footer(doc, margin) {
  const w = A4_WIDTH - margin * 2;
  const y = A4_HEIGHT - margin + mm(4);
  doc.save();
  doc.font('Helvetica').fontSize(9).fillColor(palette.muted);
  const pageText = `Page ${doc.page.number}`;
  const tw = doc.widthOfString(pageText);
  doc.text(pageText, margin + w - tw, y);
  doc.restore();
}

function drawPageScaffold(doc, meta, tabs, activeIndex, margin, destMap, pageMap) {
  drawHeader(doc, meta, margin);
  drawTabs(doc, tabs, activeIndex, margin, destMap, pageMap);
}

function addOutlines(doc, tabs, pageMap) {
  if (!doc.outline) return; // outline not available in some pdfkit builds
  const root = doc.outline;
  tabs.forEach((t, idx) => {
    const page = pageMap[idx];
    try { root.addItem(t.label, { page }); } catch (_) { /* ignore */ }
  });
}

function generate(doc, data) {
  const margin = mm(18);
  const { meta = {}, tabs = [] } = data;

  // Named destinations per tab for robust internal navigation
  const destMap = {};
  // Fallback page numbers per tab (first page for that tab)
  const pageMap = {};

  // First page is for tab index 0; we will create one page per tab minimally
  tabs.forEach((tab, idx) => {
    if (idx === 0) {
      // Use the automatically created first page
    } else {
      doc.addPage();
    }

    // Record first page and create a named destination for this tab
    pageMap[idx] = doc.page.number;
    const destName = `tab-${idx}-${(tabs[idx].id || tabs[idx].label || 'sec').toString().toLowerCase().replace(/\s+/g,'-')}`;
    try {
      doc.addNamedDestination(destName);
      destMap[idx] = destName;
    } catch (_) { /* ignore; will fall back to pageMap */ }

    // Draw scaffold
    drawPageScaffold(doc, meta, tabs, idx, margin, destMap, pageMap);

    // Content: iterate sections
    let y = margin + mm(30);
    if (Array.isArray(tab.sections)) {
      tab.sections.forEach((section) => {
        y = drawSection(doc, tabs, idx, margin, section, destMap, pageMap);
      });
    }

    footer(doc, margin);
  });

  // Add PDF bookmarks
  addOutlines(doc, tabs, pageMap);
}

function main() {
  const { input, output } = parseArgs();
  const inputPath = path.resolve(input);
  const outPath = path.resolve(output);

  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  const doc = new PDFDocument({ size: 'A4', margin: mm(18) });
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  generate(doc, data);

  doc.end();
  stream.on('finish', () => {
    console.log(`PDF generated: ${outPath}`);
  });
}

if (require.main === module) {
  main();
}
