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
// 蒙特卡洛粗略胜率：把对手手牌和剩余公共牌当随机，模拟很多次摊牌（平局算半赢）
function estimateEquity(hole, community, rng, iterations) {
  const iters = iterations || 250;
  const used = new Set();
  hole.concat(community || []).forEach(c => used.add(c.s * 100 + c.r));
  const rest = createDeck().filter(c => !used.has(c.s * 100 + c.r));
  let score = 0;
  for (let i = 0; i < iters; i++) {
    const d = rest.slice();
    // 部分洗牌，只取前面需要的几张
    const need = 2 + (5 - (community ? community.length : 0));
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(rng() * (d.length - k));
      [d[k], d[j]] = [d[j], d[k]];
    }
    const botHole = [d[0], d[1]];
    const board = (community || []).concat(d.slice(2, need));
    const ps = evaluateBest(hole.concat(board));
    const bs = evaluateBest(botHole.concat(board));
    const cmp = compareScore(ps, bs);
    score += cmp > 0 ? 1 : cmp === 0 ? 0.5 : 0;
  }
  return score / iters;
}

// ---------- 机器人 AI ----------
// 起手牌强度（0..1）：给范围采样当先验——对子/同花/连张/高牌
function preflopScore(hole) {
  const [a, b] = hole.map(c => c.r).sort((x, y) => y - x);
  let v;
  if (a === b) v = 0.45 + (a / 14) * 0.4;                    // 口袋对
  else v = (a / 14) * 0.38 + (b / 14) * 0.14;                // 高牌
  if (hole[0].s === hole[1].s) v += 0.05;                    // 同花
  if (Math.abs(a - b) === 1) v += 0.04;                      // 连张
  return Math.min(1, v);
}
// 范围加权胜率：对手手牌不再是纯随机，而是按他的行动范围采样。
// range.minScore：候选手牌起手分低于它时，只以 range.bluff 的概率被接受（留诈唬份额）；
// 玩家加注越凶，范围越紧，机器人算出的胜率自然越低——不用再靠拍脑袋打折。
function estimateEquityVsRange(hole, community, rng, iterations, range) {
  const iters = iterations || 300;
  const used = new Set();
  hole.concat(community || []).forEach(c => used.add(c.s * 100 + c.r));
  const rest = createDeck().filter(c => !used.has(c.s * 100 + c.r));
  const minScore = range && typeof range.minScore === 'number' ? range.minScore : 0;
  const bluff = range && typeof range.bluff === 'number' ? range.bluff : 0.15;
  let score = 0;
  for (let i = 0; i < iters; i++) {
    const d = rest.slice();
    const need = 2 + (5 - (community ? community.length : 0));
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(rng() * (d.length - k));
      [d[k], d[j]] = [d[j], d[k]];
    }
    let oppHole = [d[0], d[1]];
    if (minScore > 0) {
      let tries = 0;
      while (preflopScore(oppHole) < minScore && rng() >= bluff && tries < 30) {
        const j1 = 2 + Math.floor(rng() * (d.length - 2)); [d[0], d[j1]] = [d[j1], d[0]];
        const j2 = 3 + Math.floor(rng() * (d.length - 3)); [d[1], d[j2]] = [d[j2], d[1]];
        oppHole = [d[0], d[1]];
        tries++;
      }
    }
    const board = (community || []).concat(d.slice(2, need));
    const ps = evaluateBest(hole.concat(board));
    const bs = evaluateBest(oppHole.concat(board));
    const cmp = compareScore(ps, bs);
    score += cmp > 0 ? 1 : cmp === 0 ? 0.5 : 0;
  }
  return score / iters;
}
// 返回 'fold' | 'call' | 'raise'（call 在 toCall=0 时即让牌）
// strength 是胜率估算（对随机手牌的蒙特卡洛胜率）；面对跟注时按底池赔率算账：
// 跟注划算的门槛 need = toCall / (pot + toCall)，胜率高于门槛才跟，高很多才反加。
function botDecide(strength, toCall, pot, rng, aggro) {
  const ag = aggro || 0; // 自主意识：胆量偏移，借大钱/上头时变大
  if (toCall === 0) {
    if (strength > 0.60 - ag * 0.10) return 'raise';
    if (strength < 0.25 && rng() < 0.10 + ag * 0.10) return 'raise';     // 偶尔诈唬，上头时更爱唬
    return 'call';
  }
  const need = toCall / (pot + toCall);
  if (strength > 0.72 - ag * 0.06) return 'raise';                       // 胜率压倒性领先，反加做大奖池
  if (strength > need + 0.03 - ag * 0.06) return 'call';                 // 赔率划算才跟，不再无脑跟
  if (strength < 0.30 && rng() < 0.05 + ag * 0.05) return 'raise';       // 偶尔弱牌反加诈唬
  return 'fold';
}
// 机器人加注量：按牌力和奖池定，不再固定 40；强牌压大、诈唬压小，带随机抖动
function botRaiseBy(strength, pot, toCall, stack, minBy, rng) {
  const maxBy = stack - toCall;
  if (maxBy <= 0) return 0;
  let frac;
  if (strength > 0.75) frac = 0.7 + rng() * 0.5;
  else if (strength > 0.55) frac = 0.45 + rng() * 0.3;
  else frac = 0.3 + rng() * 0.15; // 诈唬/半诈唬，小一点
  let by = Math.round((pot * frac) / 5) * 5;
  by = Math.max(minBy, Math.min(by, maxBy));
  return by;
}

// ---------- 一手牌状态机 ----------
const MAX_RAISES_PER_STREET = 3;
class PokerHand {
  constructor(opts) {
    this.rng = opts.rng || Math.random;
    this.botAggro = opts.botAggro || 0;
    this.sb = opts.smallBlind || 10;
    this.bb = opts.bigBlind || 20;
    this.dealer = opts.dealer === 'bot' ? 'bot' : 'player'; // 庄家=小盲
    this.playerStack = opts.playerStack; this.botStack = opts.botStack;
    const deck = shuffle(createDeck(), this.rng);
    this._deck = deck; this._next = 0;
    const draw = () => this._deck[this._next++];
    this.playerHole = [draw(), draw()]; this.botHole = [draw(), draw()];
    this.community = [];
    this.pot = 0; this.playerBet = 0; this.botBet = 0;
    this.playerContrib = 0; this.botContrib = 0;
    this.street = 0; // 0 翻前 1 翻牌 2 转牌 3 河牌
    this.phase = 'player'; // player = 等玩家行动 | over = 本手结束（机器人行动在内部同步完成）
    this.turn = this.dealer; // 翻前庄家（小盲）先动
    this.raisesThisStreet = 0;
    this.playerRaisedThisStreet = false;
    this.lastRaiseBy = this.bb;
    this._acted = { player: false, bot: false };
    this.botRaisedThisHand = false;
    this.playerRaisedThisHand = false;
    this.playerRaises = 0;
    this.lastBotAction = null; this.lastBotRaiseBy = 0; this.result = null; this.swapped = false;
    const other = this.dealer === 'player' ? 'bot' : 'player';
    this._contribute(this.dealer, this.sb); this._contribute(other, this.bb);
    if (this.turn === 'bot') this._botAct();
  }
  _contribute(side, amount) {
    const stackKey = side === 'player' ? 'playerStack' : 'botStack';
    const real = Math.max(0, Math.min(amount, this[stackKey]));
    this[stackKey] -= real; this.pot += real;
    if (side === 'player') { this.playerBet += real; this.playerContrib += real; }
    else { this.botBet += real; this.botContrib += real; }
    return real;
  }
  _stack(side) { return side === 'player' ? this.playerStack : this.botStack; }
  _bet(side) { return side === 'player' ? this.playerBet : this.botBet; }
  toCall() { return Math.max(0, this.botBet - this.playerBet); } // 玩家视角：还需跟多少
  _toCallFor(side) { return side === 'player' ? this.botBet - this.playerBet : this.playerBet - this.botBet; }
  minRaiseBy() { return Math.max(10, this.lastRaiseBy); }
  totalChips() { return this.playerStack + this.botStack + this.pot; }
  swapPlayerCard() {
    if (this.swapped || this.phase === 'over') return false;
    this.playerHole[1] = this._deck[this._next++];
    this.swapped = true; return true;
  }
  // 玩家行动入口；机器人回合在内部同步结算，所以返回时要么等玩家、要么本手结束
  playerAct(action, raiseBy) {
    if (this.phase === 'over' || this.turn !== 'player') return;
    this._applyAction('player', action, raiseBy);
  }
  _applyAction(side, action, raiseBy) {
    const other = side === 'player' ? 'bot' : 'player';
    const tc = this._toCallFor(side);
    if (action === 'fold') { this._endByFold(other); return; }
    if (action === 'raise') {
      const maxBy = this._stack(side) - tc;
      if (maxBy <= 0 || this.raisesThisStreet >= MAX_RAISES_PER_STREET) {
        // 加不了就当跟注处理
        this._contribute(side, tc);
        this._acted[side] = true;
      } else {
        let by = (typeof raiseBy === 'number' && isFinite(raiseBy)) ? Math.floor(raiseBy) : this.minRaiseBy();
        by = Math.max(Math.min(this.minRaiseBy(), maxBy), Math.min(by, maxBy));
        this._contribute(side, tc + by);
        if (by >= this.lastRaiseBy) this.lastRaiseBy = by;
        this.raisesThisStreet++;
        this._acted[side] = true; this._acted[other] = false;
        if (side === 'player') { this.playerRaisedThisHand = true; this.playerRaisedThisStreet = true; this.playerRaises++; } else { this.botRaisedThisHand = true; this.lastBotRaiseBy = by; }
      }
    } else { // call / check
      this._contribute(side, tc);
      this._acted[side] = true;
    }
    if (side === 'bot') this.lastBotAction = action === 'raise' ? 'raise' : (tc > 0 ? 'call' : 'check');
    this._afterAction(side);
  }
  _afterAction(side) {
    if (this.phase === 'over') return;
    const other = side === 'player' ? 'bot' : 'player';
    // 没筹码的一方视为已行动
    if (this._stack('player') === 0) this._acted.player = true;
    if (this._stack('bot') === 0) this._acted.bot = true;
    if (this._acted.player && this._acted.bot) return this._closeBettingRound();
    this.turn = other;
    this.phase = this.turn === 'player' ? 'player' : this.phase;
    if (this.turn === 'bot') this._botAct();
  }
  _closeBettingRound() {
    // 一方全下且投入较少时，把多投的部分退回，保证奖池两边对等
    if (this.playerBet !== this.botBet) {
      const diff = Math.abs(this.playerBet - this.botBet);
      if (this.playerBet > this.botBet) { this.playerBet -= diff; this.playerContrib -= diff; this.pot -= diff; this.playerStack += diff; }
      else { this.botBet -= diff; this.botContrib -= diff; this.pot -= diff; this.botStack += diff; }
    }
    if (this.playerStack === 0 || this.botStack === 0) return this._runOut();
    this._advanceStreet();
  }
  _botAct() {
    if (this.phase === 'over' || this.turn !== 'bot') return;
    const tc = this._toCallFor('bot');
    // 真胜率：按对手行动范围加权的蒙特卡洛胜率——玩家加注越凶，假定的对手范围越紧
    let range = { minScore: 0, bluff: 1 };
    if (this.playerRaises >= 2) range = { minScore: 0.52, bluff: 0.10 };
    else if (this.playerRaisedThisStreet) range = { minScore: 0.42, bluff: 0.15 };
    else if (this.playerRaises === 1) range = { minScore: 0.34, bluff: 0.20 };
    let s = estimateEquityVsRange(this.botHole, this.community, this.rng, this.community.length >= 3 ? 300 : 150, range);
    s = Math.max(0, Math.min(1, s + (this.rng() - 0.5) * 0.04));
    let d = botDecide(s, tc, this.pot, this.rng, this.botAggro);
    if (d === 'raise') {
      const by = botRaiseBy(s, this.pot, tc, this.botStack, this.minRaiseBy(), this.rng);
      if (by <= 0 || this.raisesThisStreet >= MAX_RAISES_PER_STREET) d = 'call';
      else { this._applyAction('bot', 'raise', by); return; }
    }
    if (d === 'fold' && tc === 0) d = 'call'; // 没人下注时不弃牌
    this._applyAction('bot', d === 'raise' ? 'call' : d);
  }
  _advanceStreet() {
    this.playerBet = 0; this.botBet = 0;
    this.raisesThisStreet = 0; this.playerRaisedThisStreet = false; this.lastRaiseBy = this.bb;
    this._acted = { player: false, bot: false };
    if (this.playerStack === 0 || this.botStack === 0) return this._runOut();
    this.street++;
    if (this.street === 1) { this.community.push(this._deck[this._next++], this._deck[this._next++], this._deck[this._next++]); }
    else if (this.street === 2 || this.street === 3) { this.community.push(this._deck[this._next++]); }
    else if (this.street >= 4) return this._showdown();
    // 翻后由非庄家先行动
    this.turn = this.dealer === 'player' ? 'bot' : 'player';
    if (this._stack(this.turn) === 0) { this._acted[this.turn] = true; this.turn = this.turn === 'player' ? 'bot' : 'player'; }
    if (this.turn === 'bot') this._botAct();
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

const PokerEngine = { createDeck, shuffle, evaluate5, evaluateBest, compareScore, handName, estimateEquity, estimateEquityVsRange, preflopScore, botDecide, botRaiseBy, PokerHand, HAND_NAMES, MAX_RAISES_PER_STREET };
if (typeof module !== 'undefined' && module.exports) module.exports = PokerEngine;
if (typeof window !== 'undefined') window.PokerEngine = PokerEngine;
