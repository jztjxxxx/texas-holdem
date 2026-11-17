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
  const pd = new w.MouseEvent('pointerdown', { bubbles: true }); pd.pointerType = 'touch';
  card.dispatchEvent(pd);
  card.click();
  await sleep(60);
  ok('first touch tap previews (class)', card.classList.contains('preview'));
  eq('preview does not consume the card', w.__loan.get().meta.propInv.peek, 1);
  card.click();
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

  console.log(fails === 0 ? 'UPGRADE TEST PASS' : ('FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
