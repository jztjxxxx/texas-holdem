// Upgrade round tests: dealer rotation badges, equity hint, report modal,
// touch prop preview (tap once = preview, tap again = play), match-end modal.
const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../frontend/play.html', 'utf8');
let fails = 0;
function eq(name, got, want) { const ok = got === want; if (!ok) { fails++; console.log('FAIL', name, 'got', got, 'want', want); } else console.log('ok  ', name); }
function ok(name, cond) { eq(name, !!cond, true); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window, doc = w.document;
  await sleep(300);
  const $ = id => doc.getElementById(id);

  // start first hand: player is dealer (games=0)
  $('nextBtn').click();
  // the new-hand log line is written synchronously, before dealing replaces it
  ok('log shows blinds 10/20', $('log').textContent.includes('盲注 10/20'));
  ok('log says player deals first hand', $('log').textContent.includes('你坐庄'));
  await sleep(1600); // dealing 4 x 300ms + buffer
  ok('player role badge shows dealer/SB', $('playerRole').textContent.includes('庄家·小盲 10'));
  ok('bot role badge shows BB', $('botRole').textContent.includes('大盲 20'));
  ok('equity line in hint panel', $('hintBody').textContent.includes('粗略胜率约'));

  // touch preview: first tap only previews, second tap plays
  const card = doc.querySelector('#propHand .propCard[data-pid="peek"]');
  ok('peek card present', !!card);
  function touchTap(el, jitter) {
    const pd = new w.MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }); pd.pointerType = 'touch';
    el.dispatchEvent(pd);
    if (jitter) { const pm = new w.MouseEvent('pointermove', { bubbles: true, clientX: 100 + jitter, clientY: 100 }); pm.pointerType = 'touch'; w.dispatchEvent(pm); }
    const pu = new w.MouseEvent('pointerup', { bubbles: true, clientX: 100 + (jitter || 0), clientY: 100 }); pu.pointerType = 'touch';
    w.dispatchEvent(pu);
    el.click(); // browsers fire a trailing click after touch; it must be swallowed
  }
  touchTap(card, 8); // finger jitter of 8px must still count as a tap, not a drag
  await sleep(60);
  ok('first touch tap previews (class)', card.classList.contains('preview'));
  eq('preview does not consume the card', w.__loan.get().meta.propInv.peek, 1);
  touchTap(card, 0);
  await sleep(1500); // fly animation ~1.06s then effect lands
  eq('second tap plays the card (consumed)', w.__loan.get().meta.propInv.peek, 0);

  // report modal
  w.__report.openReport();
  ok('report modal opens', $('reportModal').classList.contains('show'));
  ok('report shows total hands', $('reportBody').textContent.includes('总手数'));
  ok('report shows match record', $('reportBody').textContent.includes('整场战绩'));
  ok('report shows achievement wall', $('reportBadges').textContent.length > 10);
  $('reportCloseBtn').click();
  ok('report modal closes', !$('reportModal').classList.contains('show'));

  // match end modal + reset
  w.__report.openMatchEnd();
  ok('match modal opens', $('matchModal').classList.contains('show'));
  eq('match counted', w.__report.stats().matches, 1);
  eq('match win counted', w.__report.stats().matchWins, 1);
  w.__report.openMatchEnd();
  eq('match not double counted', w.__report.stats().matches, 1);
  $('matchResetBtn').click();
  ok('match modal closes after reset', !$('matchModal').classList.contains('show'));
  eq('stacks reset to 1000', w.__loan.get().playerStack, 1000);
  eq('props refilled after reset', w.__loan.get().meta.propInv.peek, 1);

  // blinds are per-match now: the reset above zeroed the match hand counter
  eq('matchHands reset to 0', w.__loan.get().meta.matchHands, 0);

  // settlement display must match the real (global) stacks, interest included
  doc.querySelector('.loanB[data-amt="500"]').click();
  eq('borrowed 500 for the display test', w.__loan.get().loan.p, 500);
  $('nextBtn').click();
  await sleep(1600);
  for (let i = 0; i < 30; i++) {
    if ($('nextBtn').style.display !== 'none') break;
    $('callBtn').click();
    await sleep(750);
  }
  ok('hand finished for display test', $('nextBtn').style.display !== 'none');
  eq('displayed player stack == real stack after interest', $('playerStack').textContent, String(w.__loan.get().playerStack));
  eq('displayed bot stack == real stack', $('botStack').textContent, String(w.__loan.get().botStack));
  eq('matchHands counted the hand', w.__loan.get().meta.matchHands, 1);

  // save export / import
  ok('save IO hook exists', !!w.__saveIO);
  const exported = w.__saveIO.exportSaveData();
  ok('export returns saved JSON with stats', exported.includes('stats'));
  eq('import rejects garbage', w.__saveIO.importSaveData('not json'), false);
  eq('import rejects wrong shape', w.__saveIO.importSaveData('{"a":1}'), false);
  eq('import accepts a valid save', w.__saveIO.importSaveData(exported), true);
  eq('import sanitizes a malformed-but-shaped save', w.__saveIO.importSaveData('{"stats":{"games":"x","wins":3},"meta":{}}'), true);
  const stored = JSON.parse(w.localStorage.getItem('monadpoker_save'));
  eq('sanitized games is a number', typeof stored.stats.games, 'number');
  ok('sanitized meta.quests is an array', Array.isArray(stored.meta.quests));
  ok('sanitized meta.propInv complete', !!stored.meta.propInv && typeof stored.meta.propInv.peek === 'number');
  w.__saveIO.importSaveData(exported); // restore the real save

  console.log(fails === 0 ? 'UPGRADE TEST PASS' : ('FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
