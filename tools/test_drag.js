// Layout + drag tests: prop hand lives on the table, log lives in the right sidebar,
// dragging a card into the bet zone plays it; dragging it elsewhere snaps back unused.
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
  const card = () => doc.querySelector('#propHand .propCard:not(.gone)');

  eq('prop hand is on the table', !!doc.querySelector('.table #propHand .propCard'), true);
  eq('four prop cards dealt at match start', doc.querySelectorAll('#propHand .propCard').length, 4);
  eq('fan layout css present', html.includes('--rot: -13deg') && html.includes('scale(1.45)') && html.includes('transform-origin: 50% 118%'), true);
  eq('no prop cards below the table', !!doc.querySelector('.propArea .propCard'), false);
  eq('log lives in the right sidebar', $('hintPanel').contains($('log')), true);

  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 1800));
  eq('card active after deal', card().className.includes('disabled'), false);

  $('betZone').getBoundingClientRect = () => ({ left: 0, top: 0, right: 600, bottom: 200, width: 600, height: 200, x: 0, y: 0 });
  const fire = (target, type, x, y) => target.dispatchEvent(new window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));

  fire(card(), 'pointerdown', 50, 300);
  fire(window, 'pointermove', 50, 500);
  fire(window, 'pointerup', 50, 500);
  await new Promise(r => setTimeout(r, 250));
  eq('drag outside: card not used', card().className.includes('gone'), false);
  eq('drag outside: transform reset', card().style.transform, '');

  const target = card();
  fire(target, 'pointerdown', 50, 300);
  fire(window, 'pointermove', 300, 120);
  eq('zone highlights while dragging over it', $('betZone').classList.contains('dropHot'), true);
  fire(window, 'pointerup', 300, 120);
  await new Promise(r => setTimeout(r, 150));
  const flying = !!doc.querySelector('.propCard.flying');
  await new Promise(r => setTimeout(r, 1300));
  eq('drag into zone: card played (flying seen)', flying, true);
  eq('drag into zone: that card consumed', target.className.includes('gone'), true);
  eq('other cards remain', doc.querySelectorAll('#propHand .propCard:not(.gone)').length, 3);

  console.log(fails === 0 ? 'DRAG TEST PASS' : ('DRAG FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
