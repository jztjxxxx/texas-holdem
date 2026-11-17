// Engine tests: hand evaluator cases + chip conservation over simulated hands.
const E = require('../frontend/poker-engine.js');
const C = (r, s) => ({ r, s }); // s: 0♠ 1♥ 2♦ 3♣
let fails = 0;
function eq(name, got, want) { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fails++; console.log('FAIL', name, 'got', got, 'want', want); } else console.log('ok  ', name); }
function beats(name, a, b) { const ok = E.compareScore(E.evaluateBest(a), E.evaluateBest(b)) > 0; if (!ok) { fails++; console.log('FAIL', name); } else console.log('ok  ', name); }

// Evaluator cases
eq('royal flush', E.evaluate5([C(14,0),C(13,0),C(12,0),C(11,0),C(10,0)]), [8,14]);
eq('wheel straight', E.evaluate5([C(14,0),C(5,1),C(4,2),C(3,3),C(2,0)]), [4,5]);
eq('four of a kind', E.evaluate5([C(9,0),C(9,1),C(9,2),C(9,3),C(2,0)])[0], 7);
eq('full house', E.evaluate5([C(9,0),C(9,1),C(9,2),C(2,3),C(2,0)]), [6,9,2]);
eq('flush', E.evaluate5([C(14,1),C(11,1),C(8,1),C(5,1),C(2,1)])[0], 5);
eq('two pair', E.evaluate5([C(14,0),C(14,1),C(8,2),C(8,3),C(2,0)]), [2,14,8,2]);
beats('pair of aces beats pair of kings',
  [C(14,0),C(14,1),C(8,2),C(5,3),C(2,0),C(9,1),C(3,2)],
  [C(13,0),C(13,1),C(8,2),C(5,3),C(2,0),C(9,1),C(3,2)]);
beats('flush beats straight',
  [C(14,1),C(11,1),C(8,1),C(5,1),C(2,1),C(9,0),C(3,2)],
  [C(9,0),C(8,1),C(7,2),C(6,3),C(5,0),C(2,1),C(3,2)]);
eq('best-of-7 picks board straight', E.evaluateBest([C(2,0),C(3,1),C(9,2),C(8,3),C(7,0),C(6,1),C(5,2)]), [4,9]);

// Seeded RNG for reproducibility
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

// Simulate 300 hands: player strategy = mostly call, sometimes raise; respond-call when asked.
let rng = mulberry32(42);
let pStack = 100000, bStack = 100000, hands = 0, errors = 0;
for (let i = 0; i < 300; i++) {
  if (pStack < 100 || bStack < 100) { pStack += 100000; bStack += 100000; }
  const startTotal = pStack + bStack;
  const h = new E.PokerHand({ playerStack: pStack, botStack: bStack, rng });
  let guard = 0;
  while (h.phase !== 'over' && guard++ < 100) {
    if (h.totalChips() !== startTotal) { errors++; console.log('FAIL conservation mid-hand', i); break; }
    const r = rng();
    if (h.phase === 'respond') h.playerAct(r < 0.85 ? 'call' : 'fold');
    else h.playerAct(r < 0.7 ? 'call' : (r < 0.9 ? 'raise' : 'fold'));
  }
  if (h.phase !== 'over') { errors++; console.log('FAIL hand did not finish', i); }
  if (h.playerStack + h.botStack !== startTotal) { errors++; console.log('FAIL conservation end', i, h.playerStack + h.botStack, startTotal); }
  if (h.playerStack < 0 || h.botStack < 0) { errors++; console.log('FAIL negative stack', i); }
  pStack = h.playerStack; bStack = h.botStack; hands++;
}
console.log('simulated hands:', hands, 'errors:', errors);
if (errors) fails++;
console.log(fails === 0 ? 'ALL ENGINE TESTS PASS' : ('FAILURES: ' + fails));
process.exit(fails ? 1 : 0);
