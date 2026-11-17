// Loan + growth + bot-brain tests on the standalone file.
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
  const L = window.__loan;

  // rate tiers
  eq('rate 0', L.rateFor(0), 0); eq('rate 500', L.rateFor(500), 0.02); eq('rate 1000', L.rateFor(1000), 0.02);
  eq('rate 2000', L.rateFor(2000), 0.04); eq('rate 5000', L.rateFor(5000), 0.06); eq('rate 15000', L.rateFor(15000), 0.09);

  // daily bonus + quests initialized
  eq('daily bonus stack 1200', L.get().playerStack, 1200);
  eq('3 quests active', L.get().meta.quests.length, 3);
  if (!$('questList').textContent.includes('🎯')) { console.log('FAIL quest list rendered'); fails++; }

  // borrow / cap / repay
  L.borrow(500); eq('borrow 500 debt', L.get().loan.p, 500); eq('borrow 500 stack', L.get().playerStack, 1700);
  L.borrow(999999); eq('borrow clamps at cap 20000', L.get().loan.p, 20000);
  L.repay(999999); eq('repay all debt', L.get().loan.p, 0); eq('stack after repay all', L.get().playerStack, 1200);

  // interest: debt 1000 at 2% -> 20 off a 1000 stack
  L.borrow(1000);
  const notes = []; const [p2] = L.applyInterest(1000, 1000, notes);
  eq('interest deducted', p2, 980);
  if (!notes.join('').includes('利息 20')) { console.log('FAIL interest note', notes); fails++; }
  L.repay(1000);

  // bot brain: broke + on tilt (3 straight losses) -> borrows big 4000, aggro high
  const st = L.get(); st.loan.b = 0; st.loan.bStreak = 3; st.loan.trait = 'steady';
  window.eval('botStack = 10');
  const brain = L.botBrain();
  eq('tilted bot borrows 4000', L.get().loan.b, 4000);
  eq('bot stack after borrow', L.get().botStack, 4010);
  if (!(brain.aggro >= 0.75)) { console.log('FAIL tilt aggro', brain.aggro); fails++; }
  // bot brain: flush -> repays down to 1200 reserve
  window.eval('botStack = 5000');
  L.botBrain();
  eq('bot repays when flush', L.get().loan.b, 200);
  eq('bot stack after repay', L.get().botStack, 1200);

  // play one hand: xp and quest machinery move
  const xpBefore = L.get().meta.xp;
  $('nextBtn').click();
  let steps = 0, ended = false;
  while (steps++ < 200) {
    if ($('nextBtn').style.display !== 'none' && steps > 3) { ended = true; break; }
    if ($('callBtn').style.display !== 'none' && !$('callBtn').disabled) $('callBtn').click();
    await new Promise(r => setTimeout(r, 80));
  }
  eq('hand ended', ended, true);
  if (!(L.get().meta.xp >= xpBefore + 10)) { console.log('FAIL xp gain', L.get().meta.xp, xpBefore); fails++; }
  eq('games counted', parseInt($('statGames').textContent, 10), 1);

  console.log(fails === 0 ? 'GROWTH TEST PASS' : ('GROWTH FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
