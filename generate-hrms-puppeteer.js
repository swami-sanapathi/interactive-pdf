/*
  generate-hrms-puppeteer.js
  Generate a dynamic, interactive tab-based HRMS appraisal PDF using Puppeteer (Chromium HTML-to-PDF).
  - Renders HTML that visually matches the provided screenshots (tabs, chips, ratings, comments)
  - A tab bar is rendered at the top of each tab page
  - Clicking a tab jumps to the corresponding tab page via internal anchors (works in Adobe/Chrome viewers)

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

  const css = `
  * { box-sizing: border-box; }
  body { font-family: Inter, Arial, Helvetica, sans-serif; color: #111827; background: #fff; margin: 0; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm; margin: 0 auto; position: relative; }
  .page + .page { page-break-before: always; }

  h1 { font-size: 18px; margin: 0 0 8px; }
  .muted { color: #6B7280; }
  .divider { height: 1px; background: #E5E7EB; margin: 6px 0 10px; }

  /* Tabs bar */
  .tabs { display: flex; gap: 6px; background: #F5F7FB; border-radius: 8px; padding: 6px; margin-top: 6px; }
  .tab { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; font-weight: 600; font-size: 11px; border-radius: 8px; color: #6B7280; text-decoration: none; background: #F3F4F6; border: 1px solid #E5E7EB; }
  .tab.active { color: #4C6FFF; background: #E9EEFF; border-color: #D1D5DB; }

  /* Section card */
  .card { border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px; margin-bottom: 14px; }
  .card h3 { margin: 0 0 6px; font-size: 14px; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }

  .chip { display: inline-flex; align-items: center; gap: 6px; height: 20px; padding: 0 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
  .chip.info { background: #EFF6FF; color: #1D4ED8; }
  .chip.ok { background: #ECFDF5; color: #065F46; }
  .chip.rate { background: #FEF3C7; color: #92400E; }
  .star { color: #F59E0B; font-size: 12px; }

  .para { color: #6B7280; font-size: 11px; line-height: 1.5; margin: 0 0 8px; text-align: justify; }

  .comment { background: #F9FAFB; border-radius: 8px; padding: 10px; margin-top: 8px; }
  .comment .hdr { font-weight: 700; font-size: 11px; color: #111827; margin-bottom: 4px; }
  .comment .txt { color: #6B7280; font-size: 11px; }

  .header { margin-bottom: 8px; }
  .footer { position: absolute; bottom: 12mm; right: 18mm; color: #6B7280; font-size: 10px; }
  `;

  const tabBar = (activeIdx) => `
    <nav class="tabs">
      ${tabs.map((t, i) => {
        const active = i === activeIdx ? 'active' : '';
        return `<a class="tab ${active}" href="#tab-${i}">${esc(t.label)}</a>`;
      }).join('')}
    </nav>
  `;

  const sectionHTML = (s) => `
    <section class="card">
      <h3>${esc(s.title)}</h3>
      <div class="row">
        ${typeof s.weightage !== 'undefined' ? `<span class="chip info">Weightage: ${esc(s.weightage)}</span>` : ''}
        ${typeof s.expectedRating !== 'undefined' ? `<span class="chip ok">Expected: ${esc(s.expectedRating)}</span>` : ''}
        ${typeof s.rating !== 'undefined' ? `<span class="chip rate"><span class="star">★</span> ${esc(Number(s.rating).toFixed(1))}</span>` : ''}
      </div>
      ${s.description ? `<p class="para">${esc(s.description)}</p>` : ''}
      ${Array.isArray(s.behaviors) && s.behaviors.length ? `<div class="para" style="color:#111827"><strong>Behaviors</strong></div>
        ${s.behaviors.map(b => `<p class="para">• ${esc(b)}</p>`).join('')}` : ''}
      ${Array.isArray(s.comments) ? s.comments.map(c => `
        <div class="comment">
          <div class="hdr">${esc(c.author || 'User')} • ${esc(c.role || '')} • ${esc(c.step || '')}</div>
          <div class="txt">${esc(c.text || '')}</div>
        </div>
      `).join('') : ''}
    </section>
  `;

  const pages = tabs.map((tab, idx) => `
    <div class="page" id="tab-${idx}">
      <div class="header">
        <h1>${reportTitle}</h1>
        <div class="muted">${empInfo}</div>
        <div class="divider"></div>
        ${tabBar(idx)}
      </div>
      <div class="content">
        ${(tab.sections || []).map(sectionHTML).join('') || '<div class="muted">No content available for this tab.</div>'}
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
  await page.setContent(html, { waitUntil: ['domcontentloaded'] });

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
