// Layout + drag tests: prop card lives on the table, log lives in the right sidebar,
// dragging the card into the bet zone plays it; dragging it elsewhere snaps back unused.
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

  eq('prop card is on the table', !!doc.querySelector('.table #propCard'), true);
  eq('prop card no longer below the table', !!doc.querySelector('.propArea #propCard'), false);
  eq('log lives in the right sidebar', $('hintPanel').contains($('log')), true);

  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 1800)); // dealing finishes
  eq('card active after deal', $('propCard').className.includes('disabled'), false);

  // stub the bet zone's rect so jsdom has geometry
  $('betZone').getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 200, width: 600, height: 200, x: 0, y: 0 });
  const fire = (target, type, x, y) => target.dispatchEvent(new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));

  // drag OUTSIDE the zone -> snaps back, not used
  fire($('propCard'), 'pointerdown', 50, 300);
  fire(window, 'pointermove', 50, 500);
  fire(window, 'pointerup', 50, 500);
  await new Promise(r => setTimeout(r, 250));
  eq('drag outside: card not used', $('propCard').className.includes('used'), false);
  eq('drag outside: transform reset', $('propCard').style.transform, '');

  // drag INTO the bet zone -> played
  fire($('propCard'), 'pointerdown', 50, 300);
  fire(window, 'pointermove', 300, 120);
  eq('zone highlights while dragging over it', $('betZone').classList.contains('dropHot'), true);
  fire(window, 'pointerup', 300, 120);
  await new Promise(r => setTimeout(r, 150));
  const flying = !!doc.querySelector('.propCard.flying');
  await new Promise(r => setTimeout(r, 1300));
  eq('drag into zone: card played (flying seen)', flying, true);
  eq('drag into zone: card used', $('propCard').className.includes('used'), true);

  console.log(fails === 0 ? 'DRAG TEST PASS' : ('DRAG FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
