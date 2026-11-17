'use strict';
/* poker-engine.js —— 单挑德州扑克引擎（练手/备用项目版，规则简化见 README）
   纯逻辑，不碰页面：牌型评估 + 机器人 AI + 一手牌的状态机。浏览器和 Node 测试共用。 */

// ---------- 牌与牌型评估 ----------
function createDeck() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) deck.push({ r, s });
  return deck;
}
function shuffle(deck, rng) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
// 评估恰好 5 张，返回可直接比大小的数组 [类别, 踢脚...]，越大越强
function evaluate5(cards) {
  const ranks = cards.map(c => c.r).sort((a, b) => b - a);
  const flush = cards.every(c => c.s === cards[0].s);
  const uniq = [...new Set(ranks)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq.join(',') === '14,5,4,3,2') straightHigh = 5; // 轮子顺 A-2-3-4-5
  }
  const counts = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  // 按 张数 多到少、同张数点大到小 排
  const groups = Object.entries(counts)
    .map(([r, n]) => ({ r: +r, n }))
    .sort((a, b) => b.n - a.n || b.r - a.r);
  const g = groups.map(x => x.n), gr = groups.map(x => x.r);
  if (straightHigh && flush) return [8, straightHigh];
  if (g[0] === 4) return [7, gr[0], gr[1]];
  if (g[0] === 3 && g[1] === 2) return [6, gr[0], gr[1]];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (g[0] === 3) return [3, gr[0], ...gr.slice(1).sort((a, b) => b - a)];
  if (g[0] === 2 && g[1] === 2) { const pairs = gr.slice(0, 2).sort((a, b) => b - a); return [2, ...pairs, gr[2]]; }
  if (g[0] === 2) return [1, gr[0], ...gr.slice(1).sort((a, b) => b - a)];
  return [0, ...ranks];
}
function compareScore(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; }
  return 0;
}
// 评估 5~7 张里的最佳 5 张
function evaluateBest(cards) {
  let best = null;
  const idx = cards.map((_, i) => i);
  function* combos(arr, k, start = 0, cur = []) {
    if (cur.length === k) { yield cur.slice(); return; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); yield* combos(arr, k, i + 1, cur); cur.pop(); }
  }
  for (const c of combos(idx, 5)) {
    const s = evaluate5(c.map(i => cards[i]));
    if (!best || compareScore(s, best) > 0) best = s;
  }
  return best;
}
const HAND_NAMES = ['高牌', '一对', '两对', '三条', '顺子', '同花', '葫芦', '四条', '同花顺'];
function handName(score, cards7) {
  if (score[0] === 8 && score[1] === 14) return '皇家同花顺';
  return HAND_NAMES[score[0]];
}

// ---------- 机器人 AI ----------
function botStrength(botHole, community, rng) {
  if (community.length >= 3) {
    const s = evaluateBest(botHole.concat(community));
    let v = s[0] / 8 + (s[1] || 0) / 200;
    // 有听牌潜力给一点加分（4 张同花 / 4 张连张粗略判断）
    return Math.min(1, v + rng() * 0.05);
  }
  const [a, b] = botHole.map(c => c.r).sort((x, y) => y - x);
  let v;
  if (a === b) v = 0.45 + (a / 14) * 0.4;                    // 口袋对
  else v = (a / 14) * 0.38 + (b / 14) * 0.14;                // 高牌
  if (botHole[0].s === botHole[1].s) v += 0.05;              // 同花
  if (Math.abs(a - b) === 1) v += 0.04;                      // 连张
  return Math.min(1, v);
}
// 返回 'fold' | 'call' | 'raise'（call 在 toCall=0 时即让牌）
function botDecide(strength, toCall, pot, rng) {
  if (toCall === 0) {
    if (strength > 0.62) return 'raise';
    if (strength < 0.22 && rng() < 0.12) return 'raise';     // 偶尔诈唬
    return 'call';
  }
  const pricey = toCall > pot * 0.9;
  if (strength > (pricey ? 0.55 : 0.5)) return 'raise';
  if (strength > (pricey ? 0.38 : 0.28)) return 'call';
  if (rng() < 0.08) return 'call';                           // 偶尔不信邪跟一把
  return 'fold';
}

// ---------- 一手牌状态机 ----------
class PokerHand {
  constructor(opts) {
    this.rng = opts.rng || Math.random;
    this.raiseSize = opts.raiseSize || 40;
    const sb = opts.smallBlind || 10, bb = opts.bigBlind || 20;
    this.playerStack = opts.playerStack; this.botStack = opts.botStack;
    const deck = shuffle(createDeck(), this.rng);
    this._deck = deck; this._next = 0;
    const draw = () => this._deck[this._next++];
    this.playerHole = [draw(), draw()]; this.botHole = [draw(), draw()];
    this.community = [];
    this.pot = 0; this.playerBet = 0; this.botBet = 0;
    this.playerContrib = 0; this.botContrib = 0;
    this.street = 0; // 0 翻前 1 翻牌 2 转牌 3 河牌
    this.phase = 'player'; // player | respond | over
    this.botRaisedThisHand = false;
    this.playerRaisedThisHand = false;
    this.lastBotAction = null; this.result = null; this.swapped = false;
    this._contribute('player', sb); this._contribute('bot', bb);
  }
  _contribute(side, amount) {
    const stackKey = side === 'player' ? 'playerStack' : 'botStack';
    const real = Math.max(0, Math.min(amount, this[stackKey]));
    this[stackKey] -= real; this.pot += real;
    if (side === 'player') { this.playerBet += real; this.playerContrib += real; }
    else { this.botBet += real; this.botContrib += real; }
    return real;
  }
  toCall() { return this.phase === 'respond' ? this.botBet - this.playerBet : this.botBet - this.playerBet; }
  totalChips() { return this.playerStack + this.botStack + this.pot; }
  swapPlayerCard() {
    if (this.swapped || this.phase === 'over') return false;
    this.playerHole[1] = this._deck[this._next++];
    this.swapped = true; return true;
  }
  playerAct(action) {
    if (this.phase === 'over') return;
    if (action === 'fold') return this._endByFold('bot');
    if (this.phase === 'respond') {
      // 只剩 跟注 / 弃牌 两个选择
      if (action === 'call' || action === 'check') { this._contribute('player', this.toCall()); return this._advanceStreet(); }
      return;
    }
    if (action === 'raise') {
      this.playerRaisedThisHand = true;
      this._contribute('player', this.toCall());
      this._contribute('player', this.raiseSize);
      // 机器人对加注只回应一次：弃 / 跟（不反加，简化规则）
      const s = botStrength(this.botHole, this.community, this.rng);
      const d = botDecide(s, this.playerBet - this.botBet, this.pot, this.rng);
      if (d === 'fold') { this.lastBotAction = 'fold'; return this._endByFold('player'); }
      this.lastBotAction = 'call';
      this._contribute('bot', this.playerBet - this.botBet);
      return this._advanceStreet();
    }
    if (action === 'call' || action === 'check') {
      this._contribute('player', this.toCall());
      if (this.playerStack === 0 || this.botStack === 0) return this._runOut();
      // 机器人回合：让牌，或加注一次把决定推回给玩家
      const s = botStrength(this.botHole, this.community, this.rng);
      const d = botDecide(s, 0, this.pot, this.rng);
      if (d === 'raise') {
        this.botRaisedThisHand = true; this.lastBotAction = 'raise';
        this._contribute('bot', this.raiseSize);
        if (this.botStack === 0 || this.playerStack === 0) {
          // 机器人全下式加注：玩家若筹码已空则直接摊牌，否则仍需回应
          if (this.playerStack === 0) return this._runOut();
        }
        this.phase = 'respond'; return;
      }
      this.lastBotAction = 'check';
      return this._advanceStreet();
    }
  }
  _advanceStreet() {
    this.playerBet = 0; this.botBet = 0;
    if (this.playerStack === 0 || this.botStack === 0) return this._runOut();
    this.street++;
    if (this.street === 1) { this.community.push(this._deck[this._next++], this._deck[this._next++], this._deck[this._next++]); }
    else if (this.street === 2 || this.street === 3) { this.community.push(this._deck[this._next++]); }
    else if (this.street >= 4) return this._showdown();
    this.phase = 'player';
  }
  _runOut() {
    while (this.community.length < 5) this.community.push(this._deck[this._next++]);
    this.street = 3;
    return this._showdown();
  }
  _endByFold(winner) {
    if (winner === 'player') this.playerStack += this.pot; else this.botStack += this.pot;
    this.result = { winner, byFold: true, potWon: this.pot };
    this.pot = 0; this.phase = 'over';
  }
  _showdown() {
    const ps = evaluateBest(this.playerHole.concat(this.community));
    const bs = evaluateBest(this.botHole.concat(this.community));
    const cmp = compareScore(ps, bs);
    const potWon = this.pot;
    let winner = 'tie';
    if (cmp > 0) { winner = 'player'; this.playerStack += this.pot; }
    else if (cmp < 0) { winner = 'bot'; this.botStack += this.pot; }
    else { const half = Math.floor(this.pot / 2); this.playerStack += half; this.botStack += this.pot - half; }
    this.result = {
      winner, byFold: false, potWon,
      playerScore: ps, botScore: bs,
      playerHand: handName(ps), botHand: handName(bs),
      botBluffWin: winner === 'bot' && bs[0] <= 1 && this.botRaisedThisHand,
      playerBluffWin: winner === 'player' && ps[0] <= 1 && this.playerRaisedThisHand
    };
    this.pot = 0; this.phase = 'over';
  }
}

const PokerEngine = { createDeck, shuffle, evaluate5, evaluateBest, compareScore, handName, botStrength, botDecide, PokerHand, HAND_NAMES };
if (typeof module !== 'undefined' && module.exports) module.exports = PokerEngine;
if (typeof window !== 'undefined') window.PokerEngine = PokerEngine;
