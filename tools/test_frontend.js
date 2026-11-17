// Frontend smoke test in jsdom: start a hand, keep calling until showdown/end, verify result + stats.
const { JSDOM } = require('jsdom');
(async () => {
  const dom = await JSDOM.fromFile(__dirname + '/../frontend/index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true
  });
  const { window } = dom;
  await new Promise(r => setTimeout(r, 2500));
  const doc = window.document;
  const $ = id => doc.getElementById(id);
  console.log('engine loaded:', typeof window.PokerEngine === 'object');
  $('nextBtn').click(); // 开始第一手
  await new Promise(r => setTimeout(r, 200));
  console.log('player cards rendered:', $('playerCards').textContent.trim().length > 0);
  console.log('prop shown:', $('propDesc').textContent.includes('道具卡'));
  // Use the prop (whatever it is) to exercise that path
  await new Promise(r => setTimeout(r, 1600));
  if (!$('propBtn').disabled) { $('propBtn').click(); console.log('prop used ok, btn text:', $('propBtn').textContent); }
  let steps = 0, ended = false;
  while (steps++ < 160) {
    if ($('nextBtn').style.display !== 'none' && steps > 1) { ended = true; break; }
    if ($('callBtn').style.display !== 'none') $('callBtn').click();
    await new Promise(r => setTimeout(r, 90));
  }
  console.log('hand ended:', ended);
  console.log('log:', $('log').textContent.split('\n')[0]);
  console.log('stats games:', $('statGames').textContent, 'pending:', $('statPending').textContent);
  console.log('community cards html has card divs:', ($('community').querySelectorAll('.card').length === 5));
  const ok = ended && $('statGames').textContent === '1';
  console.log(ok ? 'FRONTEND TEST PASS' : 'FRONTEND TEST FAIL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
