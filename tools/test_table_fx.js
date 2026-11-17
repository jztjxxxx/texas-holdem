// Table FX tests: chip pile drops + hint broadcast panel (fixed-card unit checks + live play).
const { JSDOM } = require('jsdom');
const fs = require('fs');
(async () => {
  const html = fs.readFileSync(__dirname + '/../frontend/play.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  await new Promise(r => setTimeout(r, 500));
  const doc = window.document, $ = id => doc.getElementById(id);
  let fails = 0;
  const has = (name, text, sub) => { const ok = text.includes(sub); console.log(ok ? 'ok  ' : 'FAIL', name); if (!ok) fails++; };

  // --- hintFor with fixed cards ---
  const C = (r, s) => ({ r, s });
  let lines = window.__hintFor([C(14, 0), C(13, 0)], [C(12, 0), C(11, 0), C(2, 2)]).join('\n');
  has('AKs + QJs board: flush draw hint', lines, '同花听牌');
  has('AKs + QJs board: straight draw hint', lines, '顺子听牌');
  lines = window.__hintFor([C(14, 0), C(14, 1)], [C(14, 2), C(8, 3), C(8, 0)]).join('\n');
  has('aces full: made hand line', lines, '当前牌型：葫芦');
  lines = window.__hintFor([C(9, 0), C(9, 1)], []).join('\n');
  has('pocket pair preflop hint', lines, '对 9');
  lines = window.__hintFor([C(14, 0), C(13, 0)], []).join('\n');
  has('AK suited preflop hint', lines, '同花');

  // --- chip pile in live play ---
  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 1600));
  doc.querySelector('.chip.c100').click();
  console.log('pile after 1 chip:', $('betPile').children.length, $('betPile').children[0] && $('betPile').children[0].textContent);
  if ($('betPile').children.length !== 1 || $('betPile').children[0].textContent !== '100') fails++;
  doc.querySelector('.chip.c25').click();
  console.log('pile after 2 chips:', $('betPile').children.length);
  if ($('betPile').children.length !== 2) fails++;
  has('hint panel shows hole cards live', $('hintBody').textContent, '你的底牌');
  $('raiseBtn').click();
  await new Promise(r => setTimeout(r, 600));
  console.log('pile after raise (collected):', $('betPile').children.length);
  if ($('betPile').children.length !== 0) fails++;

  console.log(fails === 0 ? 'TABLE FX TEST PASS' : ('TABLE FX FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
