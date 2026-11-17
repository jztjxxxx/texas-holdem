// Chip rack UI test on the standalone file: click chips to build a raise, then raise.
const { JSDOM } = require('jsdom');
const fs = require('fs');
(async () => {
  const html = fs.readFileSync(__dirname + '/../frontend/play.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  await new Promise(r => setTimeout(r, 500));
  const doc = window.document, $ = id => doc.getElementById(id);
  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 1600)); // dealing done
  console.log('rack visible:', $('chipRack').style.display !== 'none');
  if ($('chipRack').style.display === 'none') { console.log('CHIP TEST FAIL: rack hidden'); process.exit(1); }
  console.log('default raiseAmt:', $('raiseAmtVal').textContent);
  doc.querySelector('.chip.c100').click();
  doc.querySelector('.chip.c50').click();
  console.log('after +100 +50 chips:', $('raiseAmtVal').textContent, '| raiseBtn:', $('raiseBtn').textContent);
  window.__amtAfterChips = $('raiseAmtVal').textContent;
  const potBefore = parseInt($('pot').textContent, 10);
  $('raiseBtn').click();
  await new Promise(r => setTimeout(r, 200));
  const contribAfter = parseInt($('playerContrib').textContent, 10);
  console.log('pot before raise:', potBefore, '| player contrib after raise (want 210 = 10 SB + 10 call + 190):', contribAfter);
  $('chipClear') && null;
  let steps = 0, ended = false;
  while (steps++ < 160) {
    if ($('nextBtn').style.display !== 'none' && steps > 1) { ended = true; break; }
    if ($('callBtn').style.display !== 'none' && !$('callBtn').disabled) $('callBtn').click();
    await new Promise(r => setTimeout(r, 90));
  }
  console.log('hand ended:', ended, '| games:', $('statGames').textContent);
  const amtOk = window.__amtAfterChips === '190';
  const ok = amtOk && contribAfter === 210 && ended && $('statGames').textContent === '1';
  console.log(ok ? 'CHIP TEST PASS' : 'CHIP TEST FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
