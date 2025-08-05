/*
  generate-hrms-puppeteer.js
  Generate a dynamic, interactive tab-based HRMS appraisal PDF using Puppeteer (Chromium HTML-to-PDF).
  - Pixel-fidelity HTML/CSS scaffold matching reference images: tabs, chips, ratings, comments, hierarchy, review panels
  - A tab bar is rendered at the start of each tab section (anchor target)
  - Clicking a tab jumps to the corresponding tab section via internal anchors (works in Adobe/Chrome viewers)

  Usage:
    node generate-hrms-puppeteer.js -i sample-data.json -o appraisal.pdf
*/

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

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

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHTML(data) {
  const { meta = {}, tabs = [] } = data;
  const reportTitle = esc(meta.reportTitle || 'Assessment Stage');
  const emp = meta.employee || {};
  const empInfo = [emp.name, emp.code, emp.title].filter(Boolean).map(esc).join(' • ');
  const ratingDetails = meta.ratingDetails || null;

  const css = `
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { font-family: 'Inter', Arial, Helvetica, sans-serif; color: #111827; background: #fff; margin: 0; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm; margin: 0 auto; position: relative; }
  .page + .page { page-break-before: always; }

  h1 { font-size: 18px; margin: 0 0 8px; font-weight: 700; }
  .muted { color: #6B7280; }
  .divider { height: 1px; background: #E5E7EB; margin: 6px 0 10px; }

  /* Tabs bar */
  .tabs { display: flex; gap: 6px; background: #F5F7FB; border-radius: 8px; padding: 6px; margin: 10px 0 14px; border: 1px solid #E5E7EB; }
  .tab { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; font-weight: 600; font-size: 11px; border-radius: 8px; color: #6B7280; text-decoration: none; background: #F3F4F6; border: 1px solid #E5E7EB; }
  .tab.active { color: #4C6FFF; background: #E9EEFF; border-color: #D1D5DB; }

  /* Section card */
  .card { border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); background: #fff; }
  .card h3 { margin: 0 0 6px; font-size: 14px; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }

  .chip { display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
  .chip.info { background: #EFF6FF; color: #1D4ED8; }
  .chip.ok { background: #ECFDF5; color: #065F46; }
  .chip.rate { background: #FEF3C7; color: #92400E; }
  .star { color: #F59E0B; font-size: 12px; }
  .pill { display:inline-flex; align-items:center; gap:6px; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:600; border:1px solid #E5E7EB; background:#F9FAFB; color:#374151; }
  .pill.low { background:#FEF2F2; color:#B91C1C; border-color:#FECACA; }
  .pill.high { background:#FEF3C7; color:#B45309; border-color:#FDE68A; }
  .pill.status { background:#ECFDF5; color:#065F46; border-color:#A7F3D0; }

  .para { color: #6B7280; font-size: 11px; line-height: 1.55; margin: 0 0 8px; text-align: justify; }

  .comment { background: #F9FAFB; border-radius: 8px; padding: 10px; margin-top: 8px; border:1px solid #E5E7EB; }
  .comment .hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom: 4px; }
  .comment .left { display:flex; align-items:center; gap:8px; font-weight: 700; font-size: 11px; color: #111827; }
  .comment .meta { display:flex; gap:6px; align-items:center; }
  .comment .txt { color: #6B7280; font-size: 11px; }
  .avatar { width:20px; height:20px; border-radius:999px; object-fit:cover; border:1px solid #E5E7EB; }

  .header { margin-bottom: 8px; }
  .footer { color: #6B7280; font-size: 10px; text-align:right; margin-top: 10px; }

  /* Rating details panel */
  .panel { border:1px solid #E5E7EB; background:#fff; border-radius:12px; padding:12px; box-shadow:0 1px 2px rgba(0,0,0,0.04); margin: 10px 0 12px; }
  .panel .title { font-weight:700; font-size:13px; margin-bottom:6px; color:#111827; }

  /* Section review & end markers */
  .review { border:1px dashed #E5E7EB; border-radius:12px; padding:12px; background:#F9FAFB; margin-top: 10px; }
  .section-end { text-align:center; color:#9CA3AF; font-size:11px; margin: 10px 0; }

  /* Hierarchy */
  .node { border:1px solid #E5E7EB; border-radius:12px; padding:12px; margin:10px 0; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.04); }
  .node-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
  .node-left { min-width:0; }
  .node-title { margin:0 0 6px; font-size:13px; font-weight:700; color:#111827; }
  .node-sub { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px; }
  .node-right { display:flex; align-items:center; gap:8px; }
  .donut { width:34px; height:34px; border-radius:999px; position:relative; display:grid; place-items:center; font-size:10px; color:#111827; background: conic-gradient(#16A34A var(--deg), #E5E7EB 0); }
  .donut::after { content:""; position:absolute; inset:4px; background:#fff; border-radius:999px; }
  .donut span { position:relative; z-index:1; font-weight:700; font-size:9px; }
  .node-children { border-left:2px solid #D1FAE5; margin-left:14px; padding-left:14px; }
  .node-index { width:22px; height:22px; border-radius:999px; background:#10B981; color:#fff; font-weight:700; font-size:11px; display:inline-flex; align-items:center; justify-content:center; margin-right:6px; }

  /* Pagination control */
  .card, .comment, .node, .panel, .review { break-inside: avoid; page-break-inside: avoid; }
  `;

  const tabBar = (activeIdx) => `
    <nav class="tabs">
      ${tabs.map((t, i) => {
        const active = i === activeIdx ? 'active' : '';
        return `<a class="tab ${active}" href="#tab-${i}">${esc(t.label)}</a>`;
      }).join('')}
    </nav>
  `;

  const commentHTML = (c) => `
    <div class="comment">
      <div class="hdr">
        <div class="left">
          ${c.avatar ? `<img class="avatar" src="${esc(c.avatar)}" />` : ''}
          <div>${esc(c.author || 'User')} • ${esc(c.role || '')} • ${esc(c.stepName || c.step || '')}</div>
        </div>
        <div class="meta">
          ${typeof c.chips?.progress !== 'undefined' ? `<span class="pill">Progress: ${esc(c.chips.progress)}</span>` : ''}
          ${typeof c.chips?.updatedValue !== 'undefined' ? `<span class="pill">Updated Value: ${esc(c.chips.updatedValue)}</span>` : ''}
          ${c.chips?.status ? `<span class="pill">Status: ${esc(c.chips.status)}</span>` : ''}
          ${typeof c.rating !== 'undefined' ? `<span class="chip rate"><span class="star">★</span> ${esc(Number(c.rating).toFixed(1))}</span>` : ''}
        </div>
      </div>
      <div class="txt">${esc(c.text || '')}</div>
    </div>
  `;

  const sectionHTML = (s) => `
    <section class="card">
      <h3>${esc(s.title)}</h3>
      <div class="row">
        ${typeof s.weightage !== 'undefined' ? `<span class="chip info">Weightage: ${esc(s.weightage)}</span>` : ''}
        ${typeof s.expectedRating !== 'undefined' ? `<span class="chip ok">Expected: ${esc(s.expectedRating)}</span>` : ''}
        ${typeof s.rating !== 'undefined' ? `<span class="chip rate"><span class="star">★</span> ${esc(Number(s.rating).toFixed(1))}</span>` : ''}
        ${(s.labels || []).map(l => `<span class="pill status">${esc(l)}</span>`).join('')}
      </div>
      ${s.description ? `<p class="para">${esc(s.description)}</p>` : ''}
      ${Array.isArray(s.behaviors) && s.behaviors.length ? `<div class="para" style="color:#111827"><strong>Behaviors</strong></div>
        ${s.behaviors.map(b => `<p class="para">• ${esc(b)}</p>`).join('')}` : ''}
      ${(Array.isArray(s.comments) ? s.comments.map(commentHTML).join('') : '')}
    </section>
  `;

  const reviewHTML = (title, text, rating, label) => `
    <section class="review">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <div style="font-weight:700; color:#111827;">${esc(title || 'Section Review')}</div>
        <div>
          ${typeof rating !== 'undefined' ? `<span class=\"chip rate\"><span class=\"star\">★</span> ${esc(Number(rating).toFixed(1))}</span>` : ''}
          ${label ? `<span class=\"pill status\">${esc(label)}</span>` : ''}
        </div>
      </div>
      ${text ? `<p class="para">${esc(text)}</p>` : ''}
    </section>
  `;

  const endMarker = (text) => `<div class="section-end">• ${esc(text)} •</div>`;

  const nodeHTML = (node, level = 1, indexPath = []) => {
    const deg = Math.max(0, Math.min(100, Number(node.progressPercent || 0))) * 3.6;
    const idxLabel = indexPath.length ? indexPath[indexPath.length - 1] : 1;
    return `
      <div class="node">
        <div class="node-head">
          <div class="node-left">
            <div class="node-title"><span class="node-index">${esc(idxLabel)}</span>${esc(node.title || '')}</div>
            <div class="node-sub">
              ${node.date ? `<span class=\"pill\">${esc(node.date)}</span>` : ''}
              ${node.kpi ? `<span class=\"pill\">KPI: ${esc(node.kpi)}</span>` : ''}
              ${node.categoryName ? `<span class=\"pill\">${esc(node.categoryName)}</span>` : ''}
              ${node.categoryType ? `<span class=\"pill\">${esc(node.categoryType)}</span>` : ''}
              ${typeof node.weightage !== 'undefined' ? `<span class=\"pill\">Weightage: ${esc(node.weightage)}</span>` : ''}
              ${node.priority ? `<span class=\"pill ${node.priority.toLowerCase()}\">${esc(node.priority)}</span>` : ''}
              ${node.presentStatus ? `<span class=\"pill status\">${esc(node.presentStatus)}</span>` : ''}
            </div>
          </div>
          <div class="node-right">
            ${typeof node.rating !== 'undefined' ? `<span class=\"chip rate\"><span class=\"star\">★</span> ${esc(Number(node.rating).toFixed(1))}</span>` : ''}
            <div class="donut" style="--deg:${deg}deg"><span>${esc(String(Math.round(node.progressPercent || 0)))}%</span></div>
          </div>
        </div>
        ${node.description ? `<p class="para">${esc(node.description)}</p>` : ''}
        ${(Array.isArray(node.comments) ? node.comments.map(commentHTML).join('') : '')}
        ${Array.isArray(node.children) && node.children.length ? `<div class="node-children">
          ${node.children.map((child, i) => nodeHTML(child, level + 1, [...indexPath, i + 1])).join('')}
        </div>` : ''}
      </div>
    `;
  };

  const hierarchyHTML = (hier) => {
    if (!hier || !Array.isArray(hier.nodes)) return '';
    return hier.nodes.map((node, i) => nodeHTML(node, 1, [i + 1])).join('');
  };

  const ratingPanel = ratingDetails ? `
    <section class="panel">
      <div class="title">Rating Details</div>
      ${ratingDetails.description ? `<p class="para" style="margin-bottom:6px;">${esc(ratingDetails.description)}</p>` : ''}
      <div class="row">
        ${typeof ratingDetails.weightage !== 'undefined' ? `<span class=\"chip info\">Weightage: ${esc(ratingDetails.weightage)}</span>` : ''}
        ${typeof ratingDetails.score !== 'undefined' ? `<span class=\"pill\">Score: ${esc(ratingDetails.score)}</span>` : ''}
        ${ratingDetails.label ? `<span class=\"pill status\">Label: ${esc(ratingDetails.label)}</span>` : ''}
        ${typeof ratingDetails.manualRating !== 'undefined' ? `<span class=\"pill\">Manual Rating: ${esc(ratingDetails.manualRating)}</span>` : ''}
        ${typeof ratingDetails.mappedScore !== 'undefined' ? `<span class=\"pill\">Mapped Score: ${esc(ratingDetails.mappedScore)}</span>` : ''}
        ${ratingDetails.mappedLabel ? `<span class=\"pill status\">Mapped Label: ${esc(ratingDetails.mappedLabel)}</span>` : ''}
        ${typeof ratingDetails.rating !== 'undefined' ? `<span class=\"chip rate\"><span class=\"star\">★</span> ${esc(Number(ratingDetails.rating).toFixed(1))}</span>` : ''}
      </div>
    </section>
  ` : '';

  const pages = tabs.map((tab, idx) => `
    <div class="page" id="tab-${idx}">
      <div class="header">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div>
            <h1>${reportTitle}</h1>
            <div class="muted">${empInfo}</div>
          </div>
          ${emp.avatar ? `<img class="avatar" src="${esc(emp.avatar)}" style="width:28px;height:28px;"/>` : ''}
        </div>
        <div class="divider"></div>
        ${tabBar(idx)}
      </div>
      ${idx === 0 ? `${ratingPanel}` : ''}
      <div class="content">
        ${(tab.sections || []).map(sectionHTML).join('')}
        ${tab.review ? reviewHTML(tab.review.title, tab.review.text, tab.review.rating, tab.review.label) : ''}
        ${tab.reviewEndMarker ? endMarker(tab.reviewEndMarker) : ''}
        ${tab.hierarchy ? hierarchyHTML(tab.hierarchy) : ''}
        ${tab.hierarchyEndMarker ? endMarker(tab.hierarchyEndMarker) : ''}
        ${(!tab.sections || !tab.sections.length) && !tab.hierarchy ? '<div class="muted">No content available for this tab.</div>' : ''}
      </div>
      <div class="footer">Tab ${idx + 1} / ${tabs.length}</div>
    </div>
  `).join('');

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${reportTitle}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>${css}</style>
    </head>
    <body>
      ${pages}
    </body>
  </html>`;
}

async function main() {
  const { input, output } = parseArgs();
  const inputPath = path.resolve(input);
  const outPath = path.resolve(output);
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  const html = buildHTML(data);

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: ['domcontentloaded', 'networkidle0'] });

  await page.pdf({
    path: outPath,
    printBackground: true,
    format: 'A4',
    margin: { top: '10mm', right: '10mm', bottom: '12mm', left: '10mm' }
  });

  await browser.close();
  console.log(`PDF generated: ${outPath}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
