// Standalone play.html with animations: no external resources at all.
// Verifies: dealing is staged (cards NOT all visible instantly), then a full hand completes.
const { JSDOM } = require('jsdom');
const fs = require('fs');
(async () => {
  const html = fs.readFileSync(__dirname + '/../frontend/play.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
  const { window } = dom;
  await new Promise(r => setTimeout(r, 500));
  const doc = window.document, $ = id => doc.getElementById(id);
  console.log('engine inline:', typeof window.PokerEngine === 'object');
  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 350)); // mid-deal: only ~1 card should be out
  const midCards = $('playerCards').querySelectorAll('.card:not(.empty)').length;
  const midBot = $('botCards').querySelectorAll('.card:not(.empty)').length;
  console.log('mid-deal visible: player', midCards, 'bot', midBot, '(staged if total < 4)');
  const staged = (midCards + midBot) >= 1 && (midCards + midBot) < 4;
  console.log('dealing staged:', staged);
  console.log('call disabled during deal:', $('callBtn').disabled);
  await new Promise(r => setTimeout(r, 1200)); // deal should be finished (~4 x 300ms)
  const fullCards = $('playerCards').querySelectorAll('.card:not(.empty)').length;
  console.log('after deal, player cards:', fullCards, '| call enabled:', !$('callBtn').disabled);
  let steps = 0, ended = false;
  while (steps++ < 160) {
    if ($('nextBtn').style.display !== 'none' && steps > 1) { ended = true; break; }
    if ($('callBtn').style.display !== 'none' && !$('callBtn').disabled) $('callBtn').click();
    await new Promise(r => setTimeout(r, 90));
  }
  console.log('hand ended:', ended, '| log:', $('log').textContent.split('\n')[0]);
  console.log('stats games:', $('statGames').textContent);
  const ok = staged && fullCards === 2 && ended && $('statGames').textContent === '1';
  console.log(ok ? 'STANDALONE ANIM TEST PASS' : 'STANDALONE ANIM TEST FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
