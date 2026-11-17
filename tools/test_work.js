// Third-modal flow: gift used + debt maxed + no chips -> gate modal (only work button)
// -> shout "可恶 赔惨了" x3 -> bot confirms -> debt zeroed, kicked off the table.
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

  eq('no stray panel work button', $('workBtn'), null);
  eq('no work entry in loan modal', $('workFromModalBtn'), null);

  // Stage-3 state: gift already used, debt at cap, chips gone
  L.borrow(20000);
  eq('debt at cap', L.get().loan.p, 20000);
  L.get().loan.rescues = 1;
  window.eval('playerStack = 5');
  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 150));
  eq('gate modal (3rd) shown', $('workGateModal').classList.contains('show'), true);
  eq('broke modal NOT shown', $('brokeModal').classList.contains('show'), false);
  eq('gate shows the debt', $('gateDebt').textContent, '20000');
  eq('gate has exactly one button', $('workGateModal').querySelectorAll('button').length, 1);

  $('gateWorkBtn').click();
  eq('gate closed', $('workGateModal').classList.contains('show'), false);
  eq('shout modal shown', $('workModal').classList.contains('show'), true);
  eq('phrase shown', $('shoutText').textContent.includes('可恶 赔惨了'), true);

  $('shoutBtn').click(); $('shoutBtn').click();
  eq('count after 2 shouts', $('shoutCount').textContent, '已喊 2 / 3 遍');
  eq('bot not confirmed yet', $('botConfirm').style.display, 'none');
  $('shoutBtn').click();
  eq('bot confirm appears at 3', $('botConfirm').style.display !== 'none', true);

  $('botConfirmBtn').click();
  eq('debt zeroed', L.get().loan.p, 0);
  eq('player kicked: stack reset', L.get().playerStack, 1000);
  eq('bot stack reset too', L.get().botStack, 1000);
  eq('work count recorded', L.get().meta.workCount, 1);
  eq('shout modal closed', $('workModal').classList.contains('show'), false);

  console.log(fails === 0 ? 'WORK TEST PASS' : ('WORK FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
