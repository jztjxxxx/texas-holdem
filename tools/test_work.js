// Work-off-debt tests: shout "可恶 赔惨了" x3 -> bot confirms -> debt zeroed, kicked off the table.
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

  eq('work button disabled without debt', $('workBtn').disabled, true);
  L.borrow(2000);
  eq('debt in place', L.get().loan.p, 2000);
  eq('work button enabled with debt', $('workBtn').disabled, false);

  $('workBtn').click();
  eq('work modal shown', $('workModal').classList.contains('show'), true);
  eq('debt shown in modal', $('workDebt').textContent, '2000');
  eq('phrase shown', $('shoutText').textContent.includes('可恶 赔惨了'), true);

  $('shoutBtn').click(); $('shoutBtn').click();
  eq('count after 2 shouts', $('shoutCount').textContent, '已喊 2 / 3 遍');
  eq('bot not confirmed yet', $('botConfirm').style.display, 'none');
  $('shoutBtn').click();
  eq('count after 3 shouts', $('shoutCount').textContent, '已喊 3 / 3 遍');
  eq('bot confirm appears', $('botConfirm').style.display !== 'none', true);
  eq('shout button disabled after 3', $('shoutBtn').disabled, true);

  $('botConfirmBtn').click();
  eq('debt zeroed', L.get().loan.p, 0);
  eq('player kicked: stack reset', L.get().playerStack, 1000);
  eq('bot stack reset too', L.get().botStack, 1000);
  eq('work count recorded', L.get().meta.workCount, 1);
  eq('modal closed', $('workModal').classList.contains('show'), false);

  console.log(fails === 0 ? 'WORK TEST PASS' : ('WORK FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
