// Broke-flow tests: first bust -> gift modal (+500 once); second bust -> slider loan modal.
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

  // --- first bust: gift modal ---
  window.eval('playerStack = 5');
  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 150));
  eq('modal shown', $('brokeModal').classList.contains('show'), true);
  eq('gift block visible', $('giftBlock').style.display !== 'none', true);
  eq('loan block hidden', $('loanBlock').style.display, 'none');
  eq('gift modal has no dismiss button (forced claim)', $('giftBlock').querySelector('.modalLater'), null);
  eq('loan modal keeps its dismiss button', !!$('loanBlock').querySelector('.modalLater'), true);
  $('claimGiftBtn').click();
  eq('gift +500', L.get().playerStack, 505);
  eq('rescues marked used', L.get().loan.rescues, 1);
  eq('modal closed after claim', $('brokeModal').classList.contains('show'), false);

  // --- second bust: slider loan modal ---
  window.eval('playerStack = 5');
  $('nextBtn').click();
  await new Promise(r => setTimeout(r, 150));
  eq('modal shown again', $('brokeModal').classList.contains('show'), true);
  eq('loan block visible', $('loanBlock').style.display !== 'none', true);
  eq('gift block hidden', $('giftBlock').style.display, 'none');
  const slider = $('loanSlider');
  slider.value = '3000';
  slider.dispatchEvent(new window.Event('input', { bubbles: true }));
  eq('preview amount follows slider', $('loanAmtText').textContent, '3000');
  if (!$('loanRatePreview').textContent.includes('负债 3000')) { console.log('FAIL rate preview', $('loanRatePreview').textContent); fails++; }
  $('confirmLoanBtn').click();
  eq('loan taken via slider', L.get().loan.p, 3000);
  eq('stack after loan', L.get().playerStack, 3005);
  eq('modal closed after loan', $('brokeModal').classList.contains('show'), false);

  console.log(fails === 0 ? 'RESCUE TEST PASS' : ('RESCUE FAILURES: ' + fails));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
