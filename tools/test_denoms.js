// Denomination scaling: rack grows with the stack; >10000 unlocks the rectangular plaque.
const { JSDOM } = require('jsdom');
const fs = require('fs');
(async () => {
  const html = fs.readFileSync(__dirname + '/../frontend/play.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  await new Promise(r => setTimeout(r, 500));
  const doc = window.document, $ = id => doc.getElementById(id);
  let fails = 0;
  const eq = (name, got, want) => { const ok = got === want; console.log(ok ? 'ok  ' : 'FAIL', name, 'got', got, 'want', want); if (!ok) fails++; };
  const denoms = () => [...doc.querySelectorAll('#chipRow .chip')].map(b => parseInt(b.dataset.amt, 10));
  const L = window.__loan;

  // fresh stack is 1200 (1000 daily bonus on 1000): base set + 1000, no 5000 / plaque yet
  eq('stack 1200 denoms', JSON.stringify(denoms()), JSON.stringify([10, 25, 50, 100, 250, 1000]));

  // borrow up to 21200: 5000 and the 10000 plaque appear
  L.borrow(20000);
  eq('stack 21200 denoms', JSON.stringify(denoms()), JSON.stringify([10, 25, 50, 100, 250, 1000, 5000, 10000]));
  const plaque = doc.querySelector('#chipRow .chip.plaque');
  eq('plaque exists and is the 10000', plaque && plaque.dataset.amt, '10000');

  // start a hand and build a raise with the plaque: 40 + 10000
  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 1800));
  plaque.click();
  eq('raise after plaque click', $('raiseAmtVal').textContent, '10040');
  const pilePlaque = $('betPile').querySelector('.pchip.c10000');
  eq('plaque drops onto the table as a rectangle chip', !!pilePlaque, true);

  console.log(fails === 0 ? 'DENOMS TEST PASS' : ('DENOMS FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
