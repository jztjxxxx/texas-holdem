// Inventory tests: full set of 4 at match start, each usable once (all in one hand allowed),
// no per-hand refill, restart refills the set.
const { JSDOM } = require('jsdom');
const fs = require('fs');
(async () => {
  const html = fs.readFileSync(__dirname + '/../frontend/play.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  await new Promise(r => setTimeout(r, 500));
  const doc = window.document, $ = id => doc.getElementById(id);
  let fails = 0;
  const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(ok ? 'ok  ' : 'FAIL', name, 'got', JSON.stringify(got), 'want', JSON.stringify(want)); if (!ok) fails++; };
  const L = window.__loan;
  const inv = () => L.get().meta.propInv;
  const byPid = pid => doc.querySelector('[data-pid="' + pid + '"]');

  eq('starts with the full set', inv(), { peek: 1, swap: 1, double: 1, shield: 1 });

  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 1800));

  // burn all four in a single hand
  for (const pid of ['peek', 'swap', 'double', 'shield']) {
    byPid(pid).click();
    await new Promise(r => setTimeout(r, 1400));
    eq(pid + ' consumed after play', inv()[pid], 0);
    eq(pid + ' card gone from the table', byPid(pid).className.includes('gone'), true);
  }
  if (!$('potToken').textContent.includes('双倍生效中') || !$('potToken').textContent.includes('护盾生效中')) { console.log('FAIL pot tokens', $('potToken').textContent); fails++; }

  // finish the hand, start the next: still empty (no per-hand refill)
  let steps = 0, ended = false;
  while (steps++ < 160) {
    if ($('nextBtn').style.display !== 'none' && steps > 1) { ended = true; break; }
    if ($('callBtn').style.display !== 'none' && !$('callBtn').disabled) $('callBtn').click();
    await new Promise(r => setTimeout(r, 90));
  }
  eq('hand finished', ended, true);
  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 1800));
  eq('next hand: inventory still empty', inv(), { peek: 0, swap: 0, double: 0, shield: 0 });
  eq('next hand: no cards on the table', doc.querySelectorAll('#propHand .propCard:not(.gone)').length, 0);

  // restart the match: full set restored
  $('resetBtn').click();
  await new Promise(r => setTimeout(r, 200));
  eq('restart refills the set', inv(), { peek: 1, swap: 1, double: 1, shield: 1 });
  eq('cards back on the table', doc.querySelectorAll('#propHand .propCard:not(.gone)').length, 4);

  console.log(fails === 0 ? 'PROPS TEST PASS' : ('PROPS FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
