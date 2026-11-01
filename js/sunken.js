// 끝없는 심연 2단계 '가라앉은 심연'(2026-11-01 사용자 '110 렙제 준비' — 메모/abyss-stage2-plan.md, 수치 data.js SUNKEN · ENEMIES).
// 그림(시안 tools/sunken-sketch.js 그대로) · 새 몹 다섯 행동 · 기사 다섯 기믹 · 바다 풍경. 최종 보스 '삼지창의 왕'은 js/raid.js 틀에 얹는다.
// 방장 · 혼자가 계산하고(think · state · cut · onKill), 파티 손님은 몹 소식(상태 · 깃발)으로 그림만 따라 그린다.
const Sunken = (() => {
  // ── 그림 ── 테두리(o)는 손으로 안 적고 ol() 이 둘레에 두른다(NO_OL 글자 = 촉수 · 줄기처럼 테두리 없이)
  const PAL = {
    o: '#0a0e18', k: '#101828', n: '#1a2a4c', N: '#2a4274', B: '#3e64a8', L: '#6a9ad8', f: '#c4e2ff',
    g: '#5a4a22', G: '#a8843a', Y: '#e8c860', c: '#8a2a22', C: '#e0603a', h: '#ff9a6a', s: '#1e4a32', S: '#3e8a52',
    y: '#ffe066', t: '#5fe0d0', T: '#2a8a88', w: '#dcd4c4', b: '#8a8478', r: '#3a2418', R: '#7a4a30', p: '#5a7a8a', P: '#8ab0bc',
    v: '#a8b8d0', V: '#e8f0ff', d: '#5a6a88', l: '#6a9ad8', e: '#3e64a8', m: '#2a4274', q: '#a8843a',
  };
  const NO_OL = 'lemq';
  const ol = rows => {
    const W = rows[0].length + 2, H = rows.length + 2;
    const g = [Array(W).fill('.'), ...rows.map(r => ['.', ...r, '.']), Array(W).fill('.')];
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== '.' && g[y][x] !== 'o' && !NO_OL.includes(g[y][x]);
    const out = g.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) out[y][x] = 'o';
    return out.map(r => r.join(''));
  };
  const mir = half => half.map(r => r + [...r].reverse().join(''));
  const over = (rows, x, y, lines) => {
    const g = rows.map(r => [...r]);
    lines.forEach((ln, j) => [...ln].forEach((ch, i) => { if (ch !== '.' && g[y + j] && x + i < g[0].length) g[y + j][x + i] = ch; }));
    return g.map(r => r.join(''));
  };
  const remap = (rows, m) => rows.map(r => [...r].map(ch => m[ch] || ch).join(''));
  const bob = rows => ['.'.repeat(rows[0].length), ...rows.slice(0, -1)];
  const breath = (rows, at) => ['.'.repeat(rows[0].length), ...rows.slice(0, at), ...rows.slice(at + 1)];  // 윗몸이 한 칸 내려앉는 숨
  const canvasOf = rows => {
    const c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
    return c;
  };
  const put = (name, rows) => Gfx.put(name, canvasOf(rows));
  const anim = (name, a, b) => { const A = canvasOf(a), B = canvasOf(b || a); for (let i = 0; i < 4; i++) Gfx.put(name + '_anim_f' + i, i < 2 ? A : B); };

  const SOLDIER = ['...........f....', '..........fLf...', '...........L....', '....RRRRR..q....', '...RGGGGGR.q....', '..RGYGGGGGRq....',
    '..rRRRRRRRrq....', '...kkkkkkk.q....', '...kfkkkfk.q....', '...kkkkkkk.q....', '....kkkkk..q....', '..sNNNNNNNsPq...',
    '.sNNBNNNNNNPq...', '.PNBBBNSNNN.q...', '.PNNBNNSNNN.q...', '..NNNNNSsNN.q...', '..nNNNNNNNn.q...', '...nn...nn..q...',
    '...nn...nn......', '..RRr...RRr.....'];
  const JELLY_A = ['................', '.....LLLLLL.....', '...LLffffffLL...', '..LffLLLLLLffL..', '.LfLLBBBBBBLLfL.', '.LfLBByyyyBBLLL.',
    '.LLLByyfyyyBLLL.', '.BLLBByyyyBBLLB.', '..BBBBBBBBBBBB..', '..e.l..e.e..l.e.', '..e..l.e..e.l.e.', '.e...l..e.e..l..',
    '.e..l...e..e.l..', '..e.l..e...e..l.', '..e..l.e..e...l.', '...e.l..e.e..l..', '.....l...e......', '................'];
  const JELLY_B = ['................', '................', '.....LLLLLL.....', '...LLffffffLL...', '..LffLLLLLLffL..', '.LfLLBBBBBBLLfL.',
    '.LfLBByyyyBBLLL.', '.LLLByyfyyyBLLL.', '.BLLBByyyyBBLLB.', '..BBBBBBBBBBBB..', '...e.l.e..e.l.e.', '..e..l..e.e..l.e',
    '..e.l..e..e..l..', '.e..l..e...e.l..', '.e...l..e..e..l.', '..e..l..e.e..l..', '...e..l..e......', '................'];
  const CRAB = ['.......wwwww......', '.....wwbbbbbww....', '....wbbGGGGGbbw...', '...wbGGwwwwwGbbw..', '...wbGwbbbbbwGbw..', '..wbbGwbGGGbwGbbw.',
    '..wbbGwbGwGbwGbbw.', '..wbbGwbbbGbwGbbw.', '..wbbGGwwwwwGbbw..', '...wbbbGGGGGbbw...', '....wwwwwwwwwww...', '.hh..y.CCCC.y..hh.',
    'hCCh.c.CCCC.c.hCCh', 'CCCCcCCCCCCCCcCCCC', 'cCCcCCCCCCCCCCcCCc', '.cc.ccCccccCcc.cc.', '....c.c....c.c....'];
  const CRAB_HIDE = ['..................', '..................', '..................', '.......wwwww......', '.....wwbbbbbww....', '....wbbGGGGGbbw...',
    '...wbGGwwwwwGbbw..', '...wbGwbbbbbwGbw..', '..wbbGwbGGGbwGbbw.', '..wbbGwbGwGbwGbbw.', '..wbbGwbbbGbwGbbw.', '..wbbGGwwwwwGbbw..',
    '..wbbbbGGGGGbbbbw.', '..wbbbbbbbbbbbbbw.', '...wkkkkkkkkkkkw..', '....wwwwwwwwwww...', '..................'];
  const ANGLER = ['............yy....', '...........yfy....', '............y.....', '...........m......', '..........m.......', '....NNNNNNNN......',
    '..NNBBBBBBBBNN....', '.NBByyBBBBBBBBN..N', 'NBBByyBBBBBBBBBNNN', 'NBBBBBBBBBBBBBBBNN', 'kwkwkwkwkBBBBBBBN.', 'kkkkkkkkkkBBBBBNN.',
    'kwkwkwkwkBBBBBN..N', 'NNNNNNNNNNNNNNNNNN', '.nn..nn....nn..nn.'];
  const LURE = ['..yy', '.yfy', '..y.', '.m..', 'm...', 'm...'];  // 땅속 아귀: 빛 미끼만
  const PRIEST = ['...........LLL..', '..........LfLfL.', '..........LLyLL.', '...........LfL..', '....NNNN....q...', '...NBBBBN...q...',
    '..NBBNNBBN..q...', '..NBkkkkBN..q...', '..NBkykyBN..q...', '..NNkkkkNN..q...', '..NSNPPNSN.Pq...', '.NNSBBBBSNNPq...',
    '.NBBSBBBBSBN.q..', '.NBBBSBBSBBN.q..', '.NBBBBSSBBBN.q..', '.NBBBBBBBBBN.q..', '.NBBBBBBBBBBNq..', 'NBBBBBBBBBBBNq..',
    'NNBBBBBBBBBNNq..', 'nNNNNNNNNNNNn...', '.nnnnnnnnnnn....'];
  const KNIGHT_HALF = [
    '..............11', '.............111', '..............11', '..........222222', '.........2332222', '........23222222',
    '........22222222', '........24444444', '........24454444', '........24444444', '........82222222', '.........8822222',
    '...7777...888888', '..76666788666666', '.766666676667666', '.666666686676666', '.866666686666666', '..88888866666666',
    '...9668.86666666', '...9668.86666666', '...9668.88666666', '...9668..8888888', '..77668..9999999', '..76666..9999999',
    '..86668..9999999', '...888..88888888', '..........86668.', '..........86668.', '..........86768.', '..........86668.',
    '.........886668.', '.........000000.'];
  const knight = (map, overs) => ol(overs.reduce((rows, [x, y, lines]) => over(rows, x, y, lines), remap(mir(KNIGHT_HALF), map)));
  const Q = n => Array(n).fill('..q');
  const KNIGHTS = {
    knight_anchor: knight({ 1: 'C', 2: 'R', 3: 'G', 4: 'k', 5: 'y', 6: 'R', 7: 'G', 8: 'r', 9: 'n', 0: 'r' },
      [[24, 6, ['....vvv.', '...v...v', '....vvv.', '..dvvvvd', ...Array(14).fill('.....v..'), 'd....v..', 'vv...v..', '.vv..v..', '..vvvvvv', '....vvv.']],
       [1, 18, ['b.', 'b.', '.b', 'b.', '.b']]]),
    knight_tide: knight({ 1: 'f', 2: 'B', 3: 'L', 4: 'k', 5: 'y', 6: 'B', 7: 'L', 8: 'N', 9: 'n', 0: 'N' },
      [[11, 0, ['...f......', '..ff......', '.fLf......']], [18, 0, ['......f...', '......ff..', '......fLf.']],
       [27, 0, ['.Y.', 'YYY', '.G.', ...Array(25).fill('.q.')]]]),
    knight_bubble: knight({ 1: 'L', 2: 'N', 3: 'B', 4: 'k', 5: 'y', 6: 'N', 7: 'B', 8: 'n', 9: 'k', 0: 'n' },
      [[3, 13, ['.ff..', 'f..f.', 'f..f.', '.ff..']], [22, 15, ['..ff...', '.f..f..', '.f..f..', '..ff...']], [13, 19, ['.ff.', 'f..f', '.ff.']],
       [9, 3, ['.f.', 'f.f', '.f.']], [26, 21, ['...VV', '..VVd', '.VVd.', 'VVd..']]]),
    knight_lamp: knight({ 1: 'k', 2: 'n', 3: 'N', 4: 'k', 5: 'y', 6: 'n', 7: 'N', 8: 'k', 9: 'k', 0: 'k' },
      [[8, 2, ['.nnnnnnnnnnnnnnn', 'nNNNNNNNNNNNNNNn']], [26, 6, [...Q(14), '.GqG', '.GGG', 'GyyyG', 'yyyyy', 'yyfyy', 'GyyyG', '.GGG']]]),
    knight_mirror: knight({ 1: 'V', 2: 'v', 3: 'V', 4: 'k', 5: 'L', 6: 'v', 7: 'V', 8: 'd', 9: 'N', 0: 'd' },
      [[0, 15, ['.LLLL.', 'LffffL', 'LfLLfL', 'LfLLfL', 'LffffL', 'LLLLLL', '.LLLL.']], [27, 10, ['..V', ...Array(10).fill('.VV'), 'GGGG', '.G..']]]),
  };
  const LAMP_AT = { x: 30, y: 27 };  // 등불의 기사 등불 자리(그림 칸, 왼쪽 위 기준 — 빛 그리기)
  const KING_HALF = [
    '........................', '......................C.', '...............C......CC', '...............Ch...C.CC', '...............CC..ChCCC',
    '................CCCCCCCC', '................GGGGGGGG', '..............GGYGGGGwGG', '..............GGGGGGGGGG', '.............ngggggggggg',
    '.............nGkkkkkkkkk', '.............nGkkkykkkkk', '.............nGkkkkkkkkk', '.............nGgkkkkkkkk', '..............GsSSSSSSSS',
    '..............sSSsSSSSSS', '......GGGGG...sSSsSSSsSS', '....GGYGGwGGG.sSsSSsSSsS', '...GYGGGGGGwGGGsSSsSSSSs', '..GGGwGGGGGGGGGGsSSSsSSS',
    '..GGGGGGGGwGGGGgsSSSSsSS', '..gGGGGGGGGGGGGGgsSsSSSS', '..NgggggggggggggGgsSSsSS', '..NNNBBBBBNNNGGGGGgSSSsS', '..NNBBBBBBBNNGGGGGGGsSSS',
    '..NNBBBBBBBNNGGYGGGGGGsS', '..NNBBBBBBBNNGGGGGGGGGGG', '..NNBBBBBBBNNgGGGGGGGGGw', '..NNNBBBBBNNNggGGGGGGGww', '..NNNNBBBNNNNNgggGGGGGGw',
    '..NNNNNNNNNNNNNgggggGGGG', '..NNNNNNNNNNNNNNggggggGG', '..NNNNNGGGGNNNNNNNgggggg', '..NNNNGGYGGGNNNNNNNNNNNN', '..NNNNGGGGGGNNNNNGGGGGGG',
    '..NNNNNGGGGNNNNNNGgggggg', '..NNNNNNNNNNNNNNNGgGGGgG', '..NNNNNNNNNNNNNNNGgGGGgG', '..nNNNNNNNNNNNNNNGgGGGgG', '..nNNNNNNNNNNNNNNGgGGGgG',
    '..nnNNNNNNNNNNNNNNggggg.', '...nnNNNNNNNNNNNNNGGGG..', '....nnNNNNNNNNNNNNGYGG..', '.....nnnNNNNNNNNNNGGGG..', '.......nnnnnNNNNNggggg..',
    '...........nnnnnnGGGGG..', '................gGGGGGg.', '...............ggggggggg', '........................'];
  const KING_OPEN = { 26: '..NNBBBBBBBNNGGGGGGGGtTT', 27: '..NNBBBBBBBNNgGGGGGGtttt', 28: '..NNNBBBBBNNNggGGGGGtttf', 29: '..NNNNBBBNNNNNgggGGGtTTT' };
  const TRIDENT = ['Y..Y..Y', 'Y..Y..Y', 'Y..Y..Y', 'YY.Y.YY', '.YYYYY.', '..GGG..', ...Array(39).fill('...q...')];
  const KING_HAND = ['..GGGG.', '.GYGGGG', '.GGGGGg', '.gGGGgg', '..ggg..'];
  const NO_TRIDENT = ['.......', '.......', '.......', '.......', '.......', '.......', ...Array(39).fill('.......')];
  const king = (open, armed) => ol(over(over(mir(KING_HALF.map((r, i) => (open && KING_OPEN[i]) || r)), 0, 0, armed ? TRIDENT : NO_TRIDENT), 0, 22, KING_HAND));
  // 부품: 박힌 닻 · 발광 산호 · 수문(청록 = 부술 것) · 삼지창(가운데 청록 = 칠 것)
  const ANCHOR = ['....vvv....', '...v...v...', '....vvv....', '..dvvvvvd..', '.....v.....', '.....v.....', '.....v.....', '.....v.....',
    'v....v....v', 'vv...v...vv', '.vv..v..vv.', '..vvvvvvv..', 'nnnnnnnnnnn'];
  const CORAL = ['..y....y..', '.yCy..yCy.', '..C.yy.C..', '..CyCCyC..', '...CCCC...', '.y.CCCC.y.', '.CyCChCyC.', '..CCCCCC..', '...cCCc...', '...cccc...', 'nnnnnnnnnn'];
  const SLUICE = ['......tt......', '.bbbbbttbbbbb.', 'bwwwwwwwwwwwwb', 'bwGGGGGGGGGGwb', 'bwGLLGLLGLLGwb', 'bwGLLGLLGLLGwb', 'bwGLfGLfGLfGwb', 'bwGLLGLLGLLGwb',
    'bwGLLGLLGLLGwb', 'bwGBBGBBGBBGwb', 'bwGBBGBBGBBGwb', 'bwGGGGGGGGGGwb', 'bwwwwwwwwwwwwb', 'bbbbbbbbbbbbbb'];
  const JAIL = ['...ffff...', '.ff....ff.', '.f.V....f.', 'f.VV.....f', 'f.V......f', 'f........f', 'f........f', '.f......f.', '.ff....ff.', '...ffff...'];
  const TRIDENT_PART = ['Y..Y..Y', 'Y..Y..Y', 'YY.Y.YY', '.YYYYY.', '..GtG..', '...G...', ...Array(13).fill('...G...'), '...g...'];
  function bake() {
    anim('drowned', ol(SOLDIER), ol(bob(SOLDIER)));
    anim('jelly', ol(JELLY_A), ol(JELLY_B));
    anim('crab', ol(CRAB)); put('crab_hide', ol(CRAB_HIDE));
    anim('angler', ol(ANGLER)); put('angler_lure', LURE);
    anim('tidecaller', ol(PRIEST));
    for (const k in KNIGHTS) anim(k, KNIGHTS[k], breath(KNIGHTS[k], 13));
    const K = king(false, true);
    anim('sunken_king', K, breath(K, 44));
    put('sunken_king_open', king(true, true));
    put('sunken_king_bare', king(false, false));  // 삼지창을 던진 뒤(맨손)
    anim('sunk_anchor', ol(ANCHOR)); anim('coral_lamp', ol(CORAL)); anim('sluice', ol(SLUICE)); anim('trident_part', ol(TRIDENT_PART)); anim('bubble_jail', JAIL);
  }
  bake();

  // ── 공통 ──
  const live = e => !e.dying && e.state !== 'dead';
  const TEAL = '#5fe0d0', WATER = '#6a9ad8', FOAM = '#bcd8ff';
  const peopleOf = () => [World.player, ...World.remotes].filter(t => t && !t.dead);
  const kOf = e => e.def.knight;
  const knightIn = (lv, kind) => World.enemies().find(e => e.def.knight === kind && live(e) && e.awake);

  // ── 몹 생각(enemy.js move 상태) — 처리했으면 true ──
  function think(e, dt, lv, p) {
    const d = e.def;
    if (d.lure) { anglerThink(e, dt, lv, p); return true; }
    if (d.knight) { knightThink(e, dt, lv, p); return true; }
    return false;
  }
  // 심해 아귀: 땅속(안 맞음)에서 빛 미끼만 보이며 천천히 다가옴 → trig 안이면 덥석 예고(바닥 타원 = 판정) → 덥석 → 휘청(맞음) → 다시 숨음
  function anglerThink(e, dt, lv, p) {
    const L = e.def.lure;
    e.moving = false;
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (p.dead) return;
    e.atkCd -= dt;
    const pd = Math.hypot(p.x - e.x, p.y - e.y);
    if (!e.under) { e.state = 'sink'; e.t = 0.3; return; }
    if (pd < L.trig && e.atkCd <= 0) { e.state = 'lureWind'; e.t = e.windupT = L.wind; e.under = false; faceTo(e, p); return; }
    if (pd > MOB_LEASH || pd < 10) return;
    const dir = Dungeon.los(lv, e.x, e.y - 4, p.x, p.y - 4) ? unit(p.x - e.x, p.y - e.y, e.fv) : World.flowDir(e);
    if (dir) { Dungeon.move(lv, e, dir.x * e.def.speed * dt, dir.y * e.def.speed * dt, e.r); e.moving = true; e.walkT += dt; }
  }

  // ── 몹 · 기사만의 상태(enemy.js 가 모르는 것) — 처리했으면 true ──
  function state(e, dt, lv, p) {
    const d = e.def;
    switch (e.state) {
      case 'bubble':  // 익사한 병사: 거품 속에 누워 있음 → 다시 일어남
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (Math.random() < dt * 6) World.ember(e, FOAM);
        if (e.t <= 0) { e.hp = Math.max(1, Math.round(e.maxHp * d.revive.hp)); e.state = 'getup'; e.t = 0.4; World.text(e.x, e.y, e.h + 6, '다시 일어났다!', FOAM); World.dust(e.x, e.y, 6); }
        return true;
      case 'shell':  // 소라게: 껍데기 속 → 나오자마자 집게
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { faceTo(e, p); e.state = 'windup'; e.t = e.windupT = d.atk.windup; }
        return true;
      case 'lureWind':  // 아귀 덥석 예고
        e.t -= dt;
        if (e.t <= 0) {
          World.shake(3); World.dust(e.x, e.y, 10); Sfx.blast();
          for (const t of [p, ...World.remotes]) if (t && !t.dead && groundDist(t.x - e.x, t.y - e.y) <= d.lure.r + BODY_R) hurtPlayer(t, e, d.atk.dmg * e.dmgMul * 1.4, d.atk.knock);
          e.state = 'daze'; e.t = d.lure.daze; World.text(e.x, e.y, e.h + 6, '휘청!', TEAL);
        }
        return true;
      case 'daze':  // 아귀 휘청 → 숨음
        e.t -= dt;
        if (e.t <= 0) { e.state = 'sink'; e.t = 0.3; e.atkCd = d.lure.cd; }
        return true;
      case 'anchorWind': case 'anchorHold': case 'anchorBack': case 'reel': case 'kDown': case 'lampHide':
      case 'spinWind': case 'spin': case 'rushWind': case 'rush': case 'jailWind': case 'mirrorGuard': case 'sweepWind': case 'sweep': case 'thrustWind': case 'thrust':
        knightState(e, dt, lv, p);
        return true;
    }
    return false;
  }

  // 몹 공격 준비가 끝남(enemy.js windup) — 처리했으면 true: 물의 사제 = 소용돌이
  function windupEnd(e, p) {
    const W = e.def.whirl;
    if (!W) return false;
    World.field({ whirl: true, x: p.x, y: p.y, r: W.r, delay: W.delay, life: W.delay + W.t, pull: W.pull, dmg: e.def.atk.dmg * e.dmgMul * W.dmg, tick: 99 });
    Sfx.spell();
    e.state = 'recover'; e.t = e.def.atk.recovery;
    return true;
  }
  // 소용돌이(방장 · 혼자, world.js updateFields): delay 뒤 t 초 동안 안(바닥 타원 r)의 사람을 가운데로 끌고 0.5초마다 피해
  function whirlTick(f, dt, people) {
    if (f.t < f.delay) return;
    f.hurtT = (f.hurtT || 0) - dt;
    const hurt = f.hurtT <= 0;
    if (hurt) f.hurtT = 0.5;
    for (const t of people) {
      if (t.dead || groundDist(t.x - f.x, t.y - f.y) > f.r + BODY_R * 0.5) continue;
      const u = unit(f.x - t.x, f.y - t.y, { x: 0, y: 0 }), d = Math.hypot(f.x - t.x, f.y - t.y);
      if (d > 3 && t.state !== 'dodge') Dungeon.move(World.level, t, u.x * f.pull * dt, u.y * f.pull * dt, BODY_R);
      if (hurt) hurtPlayer(t, { x: f.x, y: f.y + 1 }, f.dmg, 0);
    }
  }
  // 그림: 바닥 타원(판정 r) 안에서 도는 물결 호 · 가운데 소용돌이 — 예고 동안은 흐린 테두리만
  function drawWhirl(ctx, f, time) {
    const pre = f.t < f.delay, fade = Math.min(1, (f.life - f.t) / 0.4), k = pre ? f.t / f.delay : 1;
    ctx.save();
    ctx.translate(f.x, f.y); ctx.scale(1, GROUND_Y);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = 'rgba(106,154,216,' + (pre ? 0.4 + 0.4 * Math.sin(time * 20) : 0.7) + ')'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(42,66,116,' + (0.18 + 0.15 * k) + ')'; ctx.beginPath(); ctx.arc(0, 0, f.r * k, 0, Math.PI * 2); ctx.fill();
    if (!pre) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const rr = f.r * (0.3 + 0.27 * i), a = -time * (3 - i * 0.6) + j * 2.1;
        ctx.strokeStyle = i === 0 ? FOAM : WATER; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, rr, a, a + 1.2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── 피해 배율(combat.js hitEnemy · elements.js · paladin.js · 출혈) ── { m 배율, s 알림 글, armor 경직 · 밀림 없음 } 또는 null
  function cut(e, src) {
    const d = e.def;
    if (d.knight === 'mirror' && World.enemies().some(c => c.def.clone && live(c) && c.ri === e.ri)) return { m: 0, s: '잔상이 지킨다', armor: true };  // 에코: 잔상(물 분신)이 하나라도 남아 있으면 안 맞음(2026-11-01 사용자)
    if (d.heave && !d.heave.includes(e.state) && !(e.spawnT > 0)) return { m: 0, s: '닻에 막힘', armor: true };  // 브란: 닻을 든 동안 면역
    if (d.guard && e.state === 'mirrorGuard' && src) {  // 거울 반사: 앞에서 치면 되돌림 · 등 뒤에서 치면 거울이 깨짐(속성 · 지속 피해는 src 없이 그대로)
      const G = d.guard, tp = unit(src.x - e.x, src.y - e.y, e.fv), dot = e.fv.x * tp.x + e.fv.y * tp.y;
      if (dot > G.cone) {
        if (!(src.reflT > World.time)) {
          src.reflT = World.time + 0.4;
          World.fx({ type: 'shock', x: src.x, y: src.y, r: 12, t: 0, life: 0.3 });  // 맞는 사람 발밑(판정 = 그 사람)
          World.sparks(src.x, src.y, 14, 10, FOAM, true);
          hurtPlayer(src, e, d.atk.dmg * e.dmgMul * G.reflect, 140);
        }
        return { m: 0, s: '반사!', armor: true };
      }
      if (dot < -G.cone) {
        e.state = 'kDown'; e.t = G.back;
        World.text(e.x, e.y, e.h + 10, '거울이 깨졌다 — 휘청!', TEAL, true); World.shake(4); Sfx.chest();
        World.sparks(e.x + e.fv.x * 14, e.y, e.h * 0.5, 16, FOAM, true);
        return { m: G.mul, s: '' };
      }
    }
    if (d.shell && e.state === 'shell') return { m: d.shell.cut, s: '팅!', armor: true };
    if (d.knightPart) return { m: 1e-9, s: '', armor: true };  // 부품: 한 대에 1씩(닻 2대 · 산호 1대)
    if (d.bubble) {
      if (e.bubbles > 0) return { m: d.bubble.cut, s: '거품', armor: true };
      if (e.exposeT > 0) return { m: d.bubble.mul, s: '' };
    }
    if (d.lamp && !(World.level && World.level.litT > 0) && e.state !== 'kDown') return { m: 0, s: '어둠 속', armor: true };  // 루멘: 빛이 없으면 안 맞음
    if ((d.anchor || d.lamp || d.guard) && e.state === 'kDown') return { m: (d.anchor || d.lamp || d.guard).mul, s: '' };
    return null;
  }
  // 맞은 뒤(살아 있으면): 소라게 숨기 · 거품 한 겹 · 물거울 분신 흔들림
  function onHit(e, src) {
    const d = e.def;
    if (d.shell && (e.state === 'move' || e.state === 'hurt')) { e.state = 'shell'; e.t = d.shell.t; e.kx = 0; e.ky = 0; Sfx.stone(); }
    if (d.bubble && e.bubbles > 0 && !(e.popT > World.time) && src !== 'dot') {
      e.popT = World.time + 0.15; e.bubbles--;
      World.sparks(e.x, e.y, e.h * 0.6, 8, FOAM, true);
      if (!e.bubbles) { e.exposeT = d.bubble.expose; World.text(e.x, e.y, e.h + 10, '거품 갑옷이 터졌다!', TEAL, true); World.say('거품 갑옷이 터졌다 — 지금 쳐라!', 2); World.shake(3); Sfx.chest(); }
    }
  }
  // 쓰러짐(world.js onKill 맨 앞) — 쓰러지지 않고 이어지면 true: 익사한 병사 거품 · 분신 터짐 · 해파리 전기 · 부품
  function onKill(e) {
    const d = e.def;
    if (d.revive && !e.revived) {
      e.revived = true; e.dying = false; e.hp = 1; e.state = 'bubble'; e.t = d.revive.t; e.kx = 0; e.ky = 0; e.vz = 0; e.z = 0;
      World.text(e.x, e.y, e.h + 4, '꼬르륵…', FOAM);
      return true;
    }
    if (d.clone) { splash(e); return false; }
    if (d.deathZap) World.field({ blast: true, zap: true, x: e.x, y: e.y, r: d.deathZap.r, delay: d.deathZap.delay, life: d.deathZap.delay + 0.3, dmg: 10 * e.dmgMul, tick: 99 });
    return false;
  }
  function splash(c) {  // 분신이 터지며 물을 튀김: 둘레(splash, 바닥 타원 = 판정) 사람 느려짐
    const R = ENEMIES.knight_mirror.mirror.splash;
    World.fx({ type: 'nova', x: c.x, y: c.y, r: R, col: WATER, el: '', tier: 0, bare: true, seed: Math.random() * 1000, t: 0, life: 0.35 });
    World.sparks(c.x, c.y, 10, 14, FOAM, true);
    for (const t of peopleOf()) if (groundDist(t.x - c.x, t.y - c.y) <= R + BODY_R) { t.slowT = Math.max(t.slowT || 0, 1.5); World.text(t.x, t.y, 40, '느려짐', '#9fe0ff'); }
  }
  function popClone(c, quiet) {
    if (!live(c)) return;
    c.dying = true; c.hp = 0; c.state = 'dead'; c.t = 0.9;
    if (!quiet) splash(c); else World.sparks(c.x, c.y, 10, 10, FOAM, true);
  }

  // ── 기사 기믹 ──
  function knightThink(e, dt, lv, p) {
    const d = e.def, k = d.knight;
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (!e.kInit) {
      e.kInit = true;
      if (k === 'bubble') { e.bubbles = d.bubble.n; e.limitT = d.bubble.limit; if (d.bubble.limit) World.say('거품 갑옷을 ' + d.bubble.limit + '초 안에 다 터뜨려라 — 못 하면 거품 감옥!', 3); }
      if (k === 'anchor') e.anchorCd = 3;
      if (k === 'lamp') spawnCorals(e, lv);
      if (k === 'mirror') e.cloneCd = 4;
      if (k === 'tide') { e.tideT = d.tide.every; e.tideA = Math.random() * Math.PI * 2; }
      e.sigCd = 5; e.ambushN = 0; e.sweepCd = 1; e.thrustCd = 1.5;
      if (d.dmgK) e.dmgMul *= d.dmgK;
      if (d.heave) World.say('닻을 든 동안은 피해가 안 들어간다 — 닻을 던져 박았을 때 쳐라!', 3);
    }
    if (d.sweep && e.sweepCd <= 0 && !p.dead && groundDist(p.x - e.x, p.y - e.y) <= d.sweep.r + BODY_R) { faceTo(e, p); sweep(e, false); return; }
    if (d.thrust && e.thrustCd <= 0 && !p.dead && e.state === 'move') {  // 오필 길게 찌르기: 후려치기 거리 밖 ~ 창 길이 안
      const pd = Math.hypot(p.x - e.x, p.y - e.y);
      if (pd > 40 && pd < d.thrust.len && Dungeon.los(lv, e.x, e.y - 4, p.x, p.y - 4)) {
        faceTo(e, p); e.chargeV = unit(p.x - e.x, p.y - e.y, e.fv);
        e.state = 'thrustWind'; e.t = e.windupT = d.thrust.wind; e.thrustCd = d.thrust.cd; e.kx = 0; e.ky = 0;
        World.text(e.x, e.y, e.h + 8, '찌르기!', '#ffd36a');
        if (!e.thrustSeen) { e.thrustSeen = 1; World.say('길게 찌르기 — 붉은 띠 옆으로 비켜라!', 2.4); }
        return;
      }
    }
    if (k === 'lamp' && !(lv.litT > 0) && !p.dead) {  // 어둠(산호 빛이 꺼짐): 안 맞고 숨어서 기습만 — 기습 하나가 끝나면 다시 사라짐
      if (!e.darkSeen) { e.darkSeen = 1; World.say('어둠 속 루멘에겐 공격이 안 통한다 — 발광 산호를 쳐서 빛을 밝혀라!', 3); }
      e.state = 'lampHide'; e.t = d.lamp.gap; e.under = true; World.dust(e.x, e.y, 8);
      return;
    }
    if (k === 'anchor' && e.anchorCd <= 0 && !p.dead) {
      e.anchorCd = d.anchor.cd; anchorSpot(e, p, lv);
      e.state = 'anchorWind'; e.t = e.windupT = d.anchor.wind; faceTo(e, p);
      World.text(e.x, e.y, e.h + 8, '닻을 던진다!', '#ffd36a');
      return;
    }
    if (k === 'mirror' && e.cloneCd <= 0 && !World.enemies().some(c => c.def.clone && live(c) && c.ri === e.ri)) {
      e.cloneCd = d.mirror.cd;
      for (let i = 0; i < d.mirror.n; i++) {
        const a = Math.random() * Math.PI * 2, c = World.spawn('knight_clone', e.x + Math.cos(a) * 34, e.y + Math.sin(a) * 22, { spawn: true });
        c.hp = c.maxHp = 1; c.minion = true; c.ri = e.ri; c.fv = e.fv;
        if (!Dungeon.walkable(lv, c.x, c.y, c.r)) { c.x = e.x; c.y = e.y; }
      }
      // 진짜도 자리를 바꿔 섞임
      const a = Math.random() * Math.PI * 2, nx = e.x + Math.cos(a) * 30, ny = e.y + Math.sin(a) * 20;
      if (Dungeon.walkable(lv, nx, ny, e.r)) { e.x = nx; e.y = ny; }
      World.sparks(e.x, e.y, e.h * 0.5, 16, FOAM, true); Sfx.spell();
      World.text(e.x, e.y, e.h + 10, '물거울!', FOAM, true);
      if (!e.cloneSeen) { e.cloneSeen = 1; World.say('잔상을 모두 없애야 진짜 에코에게 공격이 들어간다!', 3); }
    }
    if (e.sigCd <= 0 && !p.dead && signature(e, p)) return;
    bossThink(e, dt, lv, p);
  }
  // 기사 고유 패턴 시작(data.js ENEMIES 기사 spin · rush · jail · guard) — 시작했으면 true
  const SIG_HINT = { anchor: '닻 휘돌리기 — 고리 안쪽(기사 품)은 안전하다, 파고들어라!', tide: '해류 삼연 돌진 — 세 번 이어 달려든다! 기둥에 박히게 하면 기절한다',
    bubble: '거품 감옥 — 발밑 원을 피하라! 갇히면 연타로 터뜨려라', mirror: '거울 반사 — 앞에서 치면 되돌아온다, 등 뒤로 돌아가 거울을 깨라!' };
  function signature(e, p) {
    const d = e.def, k = d.knight;
    if (k === 'anchor' && d.spin && e.anchorCd > 1.5) { e.state = 'spinWind'; e.t = e.windupT = d.spin.wind; e.sigCd = d.spin.cd; World.text(e.x, e.y, e.h + 8, '닻 휘돌리기!', '#ffd36a'); }
    else if (k === 'tide' && d.rush) { e.sigCd = d.rush.cd; e.rushN = d.rush.n; rushStart(e, p, d.rush.wind); World.text(e.x, e.y, e.h + 8, '해류 돌진!', '#ffd36a'); }
    else if (k === 'bubble' && d.jail && d.jail.cd) { e.state = 'jailWind'; e.t = e.windupT = d.jail.wind; e.sigCd = d.jail.cd; e.lx = p.x; e.ly = p.y; faceTo(e, p); World.text(e.x, e.y, e.h + 8, '거품 감옥!', '#ffd36a'); Sfx.spell(); }
    else if (k === 'mirror' && d.guard) { e.state = 'mirrorGuard'; e.t = e.windupT = d.guard.t; e.sigCd = d.guard.cd; faceTo(e, p); World.text(e.x, e.y, e.h + 8, '거울 반사!', FOAM, true); Sfx.spell(); }
    else return false;
    if (!e.sigSeen) { e.sigSeen = 1; World.say(SIG_HINT[k], 3); }
    return true;
  }
  // 거품 감옥에 가둠(이미 갇혀 있으면 그대로)
  function trap(e, t) {
    if (World.enemies().some(m => m.def.part === 'jail' && live(m) && m.hold === t)) return;
    const J = e.def.jail, j = World.spawn('bubble_jail', t.x, t.y, {});
    j.hp = j.maxHp = J.hits; j.ri = e.ri; j.hold = t; j.t = J.t; j.owner = e.id;
    World.sparks(t.x, t.y, 12, 12, FOAM, true);
    World.text(t.x, t.y, 44, '거품에 갇혔다 — 연타!', TEAL, true);
    // 2026-11-01 사용자 '갇힌 줄 모르고 패턴이 넘어간다 — 순간 입력을 멈추고 잘 보이게': 잠깐 멈춤(hitstop — 파티면 모두) · 흔들림 · 소리, 화면 가운데 큰 알림판은 hud.js(jailOf)
    World.hitstop(0.45); World.shake(5); Sfx.blast();
  }
  // 이 사람을 가둔 거품(hud 알림판): 방장 · 혼자 = hold, 파티 손님 = 내 자리에 붙어 있는 거품
  function jailOf(t) {
    return World.enemies().find(m => m.def.part === 'jail' && live(m) && (m.hold === t || (World.mirror && Math.hypot(m.x - t.x, m.y - t.y) < 8))) || null;
  }
  // 거품 감옥 연타(2026-11-01 사용자 '방향키랑 공격 버튼 막 눌러야 풀리게 — 몇 번 눌렸고 남았는지는 안 보이게'): 갇힌 사람이 공격 · 방향을 누를 때마다 1,
  // jail.mash 번이면 터짐. 친구가 거품을 hits 대 쳐서 터뜨리는 것은 그대로. 내 몸 = game.js 화면 프레임(bufferPlayerInput 대신), 파티 손님 = 방장에게 mash 소식
  let stickDir = '';
  function mash(p) {
    const j = jailOf(p);
    if (!j) { stickDir = ''; return false; }
    const DIRS = ['left', 'right', 'up', 'down'];
    let n = Input.wasPressed('attack') ? 1 : 0;
    for (const a of DIRS) if (Input.wasPressed(a)) n++;  // 방향키 · 십자키
    // 스틱(패드 · 폰): 크게 기울인 쪽이 바뀔 때마다 1
    const m = Input.move(), keys = DIRS.some(a => Input.isDown(a));
    const dir = keys || Math.max(Math.abs(m.x), Math.abs(m.y)) < 0.6 ? '' : Math.abs(m.x) >= Math.abs(m.y) ? (m.x > 0 ? 'r' : 'l') : (m.y > 0 ? 'd' : 'u');
    if (dir && dir !== stickDir) n++;
    stickDir = dir;
    if (!n) return true;
    j.flash = 0.08; j.wobT = performance.now() / 1000;  // 누를 때마다 거품이 출렁(남은 수는 안 보임)
    World.sparks(j.x, j.y, 14, 3, FOAM, true); Sfx.blub();
    if (World.mirror) Net.send({ t: 'mash', n }); else addMash(j, n);
    return true;
  }
  function addMash(j, n) {
    if (!live(j) || (j.mash = (j.mash || 0) + n) < ENEMIES.knight_bubble.jail.mash) return;
    j.hp = 0; j.dying = true; j.state = 'dead'; j.t = 0.6;
    World.onKill(j);  // → partDied: '탈출!'
  }
  // 파티 방장: 손님이 보낸 연타(coop.js mash 소식) — 그 손님 몸을 가둔 거품에
  function mashFrom(pid, n) {
    const q = World.remotes.find(r => r.pid === pid), j = q && jailOf(q);
    if (j) addMash(j, n);
  }
  // 오필 거품 갑옷 시간(update — 어떤 상태든 흐름): 드러남(exposeT)이 끝나면 방 안 모두를 강제로 거품 감옥에(대시로도 못 피함) → regrow 초 뒤 갑옷 다시
  function bubbleTick(e, dt) {
    const d = e.def, B = d.bubble;
    // 거품 갑옷 제한 시간(2026-11-01 사용자 '몸에 달린 방울을 몇 초 안에 다 못 없애면 갇히는 패턴'): 갑옷이 있는 동안 B.limit 초가 흐르고, 다 지나면 방 안 모두 거품 감옥 → 다시 B.limit 초
    if (B.limit && e.bubbles > 0 && !(e.exposeT > 0)) {
      if (e.limitT === undefined) e.limitT = B.limit;
      if ((e.limitT -= dt) <= 0) {
        e.limitT = B.limit;
        World.text(e.x, e.y, e.h + 10, '거품을 다 못 터뜨렸다 — 거품 감옥!', '#ff6a5a', true); Sfx.spell(); World.shake(3);
        for (const t of peopleOf()) if (World.roomOf(t) === e.ri) trap(e, t);
      }
    }
    if (e.exposeT > 0 && (e.exposeT -= dt) <= 0) {
      e.regrowT = d.bubble.regrow;
      if (d.jail && d.bubble.trapAfter) {
        World.text(e.x, e.y, e.h + 10, '거품 감옥!', '#ffd36a', true); Sfx.spell(); World.shake(3);
        for (const t of peopleOf()) if (World.roomOf(t) === e.ri) trap(e, t);
      }
    }
    if (e.regrowT > 0 && (e.regrowT -= dt) <= 0) { e.bubbles = d.bubble.n; e.limitT = B.limit; World.text(e.x, e.y, e.h + 8, '거품 갑옷!', FOAM, true); World.sparks(e.x, e.y, e.h * 0.5, 12, FOAM, true); }
  }
  // 후려치기(세렌 · 오필): wall = 기둥에 박음(기절 없이 온 쪽으로 돌아섬) — sweepWind(바닥 부채꼴 예고) → sweep(판정 한 번)
  function sweep(e, wall) {
    const W = e.def.sweep;
    if (wall) {
      e.fv = e.chargeV ? { x: -e.chargeV.x, y: -e.chargeV.y } : { x: -e.fv.x, y: -e.fv.y };
      World.text(e.x, e.y, e.h + 6, '쿵 — 후려친다!', '#ffd36a');
    } else World.text(e.x, e.y, e.h + 8, '후려치기!', '#ffd36a');
    if (!e.sweepSeen) { e.sweepSeen = 1; World.say(W.wall ? '조류 후려치기 — 붙거나 기둥에 박히면 크게 후려친다, 부채꼴 밖으로!' : '후려치기 — 붙으면 앞을 크게 후려친다, 부채꼴 밖으로!', 2.6); }
    e.state = 'sweepWind'; e.t = e.windupT = W.wind; e.kx = 0; e.ky = 0; e.sweepCd = W.cd;
  }
  // 끝없는 심연 중간 보스(1단계 · 2단계 기사) 돌진이 막힘(enemy.js 보통 돌진 · 세렌 해류 돌진): 벽이면 그냥 멈춤, 기둥이면 그 기둥이 무너지며 SUNKEN.pillarStun 초 기절(세렌은 기절 없이 후려치기)
  function chargeBlocked(e, lv) {
    const i = e.def.noStun ? -1 : lv.columns.findIndex(c => Math.hypot(c[0] * T + 8 - e.x, c[1] * T + 12 - e.y) < e.r + 18);  // noStun(브란) = 기둥도 벽처럼
    if (i < 0) {
      if (e.state === 'rush' && --e.rushN > 0 && !World.player.dead) { rushStart(e, World.player, e.def.rush.wind2); return; }
      e.rushN = 0; e.state = 'recover'; e.t = 0.5; World.dust(e.x, e.y, 6);
      return;
    }
    const c = lv.columns.splice(i, 1)[0], cx = c[0] * T + 8, cy = c[1] * T + 12;
    World.dust(cx, cy, 16); World.shake(6); Sfx.stone();
    World.text(cx, cy, 30, '기둥이 무너졌다!', '#ffd36a', true);
    e.rushN = 0;
    if (e.def.sweep && e.def.sweep.wall) { sweep(e, true); return; }
    e.state = 'tired'; e.t = SUNKEN.pillarStun; e.kx = 0; e.ky = 0;
    if (e.def.sweep) e.sweepCd = Math.max(e.sweepCd || 0, SUNKEN.pillarStun + 1.5);  // 세렌 · 오필: 기절이 풀리자마자 후려치지 않게(풀린 뒤 1.5초)
    World.text(e.x, e.y, e.h + 6, '쿵 — 기절!', TEAL, true);
  }
  // 중간 보스방 기둥 다시 솟기(2026-11-01 사용자 '기둥 다 부서졌는데 리필 안 됨' — 1 · 2단계 모두): 넷 다 무너지면 SUNKEN.pillarRefill 초 뒤 다시 넷.
  // 누가(몹 · 사람) 서 있는 자리는 비켜날 때까지 기다렸다가 솟음(끼임 방지). 파티 손님에게는 snap 의 기둥 목록(pc)으로 같이 감
  function pillars(dt, lv) {
    const r = lv.boss;
    if (!r || !r.pillars0 || World.mirror) return;  // 파티 손님은 방장 기둥 목록을 받기만
    const has = c => lv.columns.some(o => o[0] === c[0] && o[1] === c[1]);
    if (r.pillarT === undefined) { if (!r.pillars0.some(has)) r.pillarT = SUNKEN.pillarRefill; return; }
    if ((r.pillarT -= dt) > 0) return;
    const busy = [...World.enemies().filter(live), ...peopleOf()];
    let up = 0;
    for (const c of r.pillars0) {
      const x = c[0] * T + 8, y = c[1] * T + 12;
      if (has(c) || busy.some(o => Math.hypot(o.x - x, o.y - y) < (o.r || 6) + 16)) continue;
      lv.columns.push(c.slice()); World.dust(x, y, 12); up++;
    }
    if (up && !r.pillarSaid) { r.pillarSaid = true; World.text(r.cx * T + 8, r.cy * T, 30, '기둥이 다시 솟았다!', '#ffd36a', true); World.shake(3); Sfx.stone(); }
    if (r.pillars0.every(has)) { r.pillarT = undefined; r.pillarSaid = false; }
  }
  // 길게 찌르기 띠 안인지(판정 = 그림): 기사 발에서 chargeV 쪽 0 ~ len, 옆으로 w 안(몸 반지름만큼 여유)
  function inThrust(e, t) {
    const T2 = e.def.thrust, v = e.chargeV, dx = t.x - e.x, dy = t.y - e.y, along = dx * v.x + dy * v.y, side = Math.abs(dx * v.y - dy * v.x);
    return along >= -BODY_R && along <= T2.len + BODY_R && side <= T2.w + BODY_R;
  }
  // 바닥 부채꼴 안인지(판정 = 그림): 땅 기준 거리 r · 바라보는 쪽 ± arc/2
  function inSweep(e, t) {
    const W = e.def.sweep, dx = t.x - e.x, dy = (t.y - e.y) / GROUND_Y;
    if (Math.hypot(dx, dy) > W.r + BODY_R) return false;
    const a = Math.atan2(dy, dx), f = Math.atan2(e.fv.y / GROUND_Y, e.fv.x);
    return Math.abs(Math.atan2(Math.sin(a - f), Math.cos(a - f))) <= W.arc / 2 * Math.PI / 180 || Math.hypot(dx, dy) < e.r;
  }
  function rushStart(e, p, wind) {
    e.state = 'rushWind'; e.t = e.windupT = wind; e.kx = 0; e.ky = 0;
    faceTo(e, p); e.chargeV = unit(p.x - e.x, p.y - e.y, e.fv);
  }
  // 닻 떨어질 자리: 노리는 사람 발밑 — 기사에게서 minD(화면 거리) 보다 가까우면 기사 → 사람 쪽으로 minD 까지 밀어냄(닻과 기사를 한꺼번에 베어 닻이 저절로 부서지지 않게).
  // 벽 · 기둥이면 조금씩 기사 쪽으로 당기되 minD 안쪽은 안 됨 → 그래도 안 되면 다른 쪽(둘레 여덟 방향)
  function anchorSpot(e, p, lv) {
    const A = e.def.anchor, ok = (x, y) => Dungeon.walkable(lv, x, y, 4) && Dungeon.roomIdx(lv, x, y) === e.ri;
    const dx = p.x - e.x, dy = p.y - e.y, gd = Math.hypot(dx, dy);  // 화면 거리(칼이 닿는 거리와 같은 잣대 — 바닥 기준이면 위아래가 너무 가까움)
    if (gd >= A.minD && ok(p.x, p.y)) { e.lx = p.x; e.ly = p.y; return; }
    const a0 = gd > 1 ? Math.atan2(dy, dx) : Math.atan2(e.fv.y, e.fv.x);
    for (let i = 0; i < 8; i++) {
      const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI / 4;
      for (const R of [Math.max(A.minD, gd), A.minD]) { const x = e.x + Math.cos(a) * R, y = e.y + Math.sin(a) * R; if (ok(x, y)) { e.lx = x; e.ly = y; return; } }
    }
    e.lx = p.x; e.ly = p.y;
  }
  function knightState(e, dt, lv, p) {
    const d = e.def;
    switch (e.state) {
      case 'spinWind':  // 닻 휘돌리기 예고: 고리(판정)가 붉게 차오름
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'spin'; e.t = d.spin.t; Sfx.dash(); }
        break;
      case 'spin': {  // 고리 안(rIn ~ rOut)에 걸친 사람을 every 초마다 — 안쪽은 안전
        const S = d.spin;
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (!p.dead) { const u = unit(p.x - e.x, p.y - e.y, e.fv); Dungeon.move(lv, e, u.x * d.speed * S.move * dt, u.y * d.speed * S.move * dt, e.r); e.walkT += dt; }
        for (const t of peopleOf()) {
          const gd = groundDist(t.x - e.x, t.y - e.y), key = 'spin' + e.id;
          if (gd + BODY_R < S.rIn || gd - BODY_R > S.rOut || t[key] > World.time) continue;
          if (hurtPlayer(t, e, d.slam.dmg * e.dmgMul * S.dmg, 150) !== 'miss') t[key] = World.time + S.every;
        }
        if (e.t <= 0) { e.state = 'tired'; e.t = S.dizzy; World.text(e.x, e.y, e.h + 8, '어지럽다!', TEAL, true); World.dust(e.x, e.y, 10); }
        break;
      }
      case 'rushWind':  // 해류 돌진 예고(돌진 줄)
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'rush'; e.t = d.rush.time; e.rushHit = []; Sfx.dash(); }
        break;
      case 'rush': {
        e.t -= dt; e.hitWall = false;
        mobMove(lv, e, e.chargeV.x * d.rush.speed * dt, e.chargeV.y * d.rush.speed * dt);
        if (Math.random() < dt * 20) World.sparks(e.x, e.y, 6, 1, FOAM, false);
        for (const t of peopleOf()) if (!e.rushHit.includes(t) && Math.hypot(t.x - e.x, t.y - e.y) < e.r + BODY_R + 4 && hurtPlayer(t, e, d.charge.dmg * e.dmgMul, 220) !== 'miss') e.rushHit.push(t);
        if (e.hitWall) {
          chargeBlocked(e, lv);
        } else if (e.t <= 0) {
          if (--e.rushN > 0 && !p.dead) rushStart(e, p, d.rush.wind2);
          else { e.state = 'recover'; e.t = 0.6; }
        }
        break;
      }
      case 'jailWind': {  // 거품 감옥 예고: 앞 60% 동안 노리는 사람을 따라감 → 끝에 원 안이면 갇힘
        const J = d.jail;
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t > e.windupT * 0.4 && !p.dead) { e.lx = p.x; e.ly = p.y; }
        if (e.t <= 0) {
          World.sparks(e.lx, e.ly, 8, 12, FOAM, true); Sfx.stone();
          for (const t of peopleOf()) {
            if (groundDist(t.x - e.lx, t.y - e.ly) > J.r + BODY_R) continue;
            if (t.iframes > 0 || t.state === 'dodge' || t.safe) { World.text(t.x, t.y, 40, '피함', FOAM); continue; }
            trap(e, t);
          }
          e.state = 'recover'; e.t = 0.5;
        }
        break;
      }
      case 'sweepWind':
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) {
          e.state = 'sweep'; e.t = d.sweep.active; World.shake(5); Sfx.blast();
          for (const t of peopleOf()) if (inSweep(e, t)) hurtPlayer(t, e, d.slam.dmg * e.dmgMul * d.sweep.dmg, d.sweep.knock);
        }
        break;
      case 'sweep':
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'recover'; e.t = d.sweep.rec; }
        break;
      case 'thrustWind':
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) {
          e.state = 'thrust'; e.t = d.thrust.active; World.shake(3); Sfx.dash();
          for (const t of peopleOf()) if (inThrust(e, t)) hurtPlayer(t, e, d.slam.dmg * e.dmgMul * d.thrust.dmg, d.thrust.knock);
        }
        break;
      case 'thrust':
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'recover'; e.t = d.thrust.rec; e.atkCd = Math.max(e.atkCd, 0.6); }
        break;
      case 'mirrorGuard': {  // 거울 반사: 제자리에서 노리는 사람 쪽으로 천천히 돎(cut 이 앞 · 등 뒤를 가름)
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (!p.dead) {
          const want = Math.atan2(p.y - e.y, p.x - e.x), cur = Math.atan2(e.fv.y, e.fv.x);
          const da = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)), step = d.guard.turn * dt;
          const a = cur + Math.max(-step, Math.min(step, da));
          e.fv = { x: Math.cos(a), y: Math.sin(a) };
        }
        if (e.t <= 0) { e.state = 'move'; e.atkCd = 0.4; }
        break;
      }
      case 'anchorWind': {  // 예고 앞 follow 몫은 노리는 사람을 따라가다 멈춤 → 그 뒤 박힐 자리로 빨아들임(대시 중이면 안 끌림)
        const A = d.anchor;
        e.t -= dt;
        if (e.t > e.windupT * (1 - A.follow)) anchorSpot(e, p, lv);
        else for (const t of peopleOf()) {
          if (t.state === 'dodge') continue;
          const gd = groundDist(t.x - e.lx, t.y - e.ly);
          if (gd > A.pullR || gd < 2) continue;
          const u = unit(e.lx - t.x, e.ly - t.y, { x: 0, y: 0 });
          Dungeon.move(lv, t, u.x * A.pull * dt, u.y * A.pull * dt, BODY_R);
        }
        if (e.t <= 0) {
          World.shake(4); World.dust(e.lx, e.ly, 12); Sfx.stone();
          World.fx({ type: 'shock', x: e.lx, y: e.ly, r: A.r, t: 0, life: 0.3 });
          let hit = false;
          for (const t of peopleOf()) if (groundDist(t.x - e.lx, t.y - e.ly) <= A.r + BODY_R && hurtPlayer(t, { x: e.lx, y: e.ly + 1 }, d.slam.dmg * e.dmgMul, 200) !== 'miss') hit = true;
          if (hit) {  // 맞힘: 닻을 바로 회수 — 박힌 닻 · 넘어뜨릴 기회 없음
            e.state = 'anchorBack'; e.t = A.back; Sfx.dash();
            World.text(e.x, e.y, e.h + 8, '닻을 회수했다!', '#ffd36a');
            break;
          }
          const a = World.spawn('sunk_anchor', e.lx, e.ly, {});
          a.hp = a.maxHp = ENEMIES.sunk_anchor.hp; a.ri = e.ri; a.owner = e.id;
          e.anchor = a; e.state = 'anchorHold'; e.t = A.reel;
          World.text(e.lx, e.ly, 28, '닻을 부숴라!', TEAL, true);
        }
        break;
      }
      case 'anchorBack':  // 맞힌 닻을 끌어와 다시 듦(안 맞음 — heave 밖)
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'recover'; e.t = 0.4; }
        break;
      case 'anchorHold':  // 사슬을 당기는 중(제자리) — 닻이 부서지면 partDied 가 넘어뜨림
        e.t -= dt; e.kx = 0; e.ky = 0; faceTo(e, { x: e.lx, y: e.ly });
        if (e.t <= 0) { e.state = 'reel'; e.t = 0.35; e.sx = e.x; e.sy = e.y; e.hitDone = false; Sfx.dash(); }
        break;
      case 'reel': {  // 닻 자리로 날아듦(지나는 길에 닿으면 돌진 피해)
        e.t -= dt;
        const k2 = Math.min(1, 1 - e.t / 0.35);
        const nx = e.sx + (e.lx - e.sx) * k2, ny = e.sy + (e.ly - e.sy) * k2;
        if (Dungeon.walkable(lv, nx, ny, e.r * 0.6)) { e.x = nx; e.y = ny; }
        if (!e.hitDone) for (const t of peopleOf()) if (Math.hypot(t.x - e.x, t.y - e.y) < e.r + BODY_R + 4) { e.hitDone = true; hurtPlayer(t, e, d.charge.dmg * e.dmgMul, 220); }
        if (e.t <= 0) {
          if (e.anchor && live(e.anchor)) { e.anchor.dying = true; e.anchor.hp = 0; e.anchor.state = 'dead'; e.anchor.t = 0.9; }
          e.anchor = null; World.shake(4); World.dust(e.x, e.y, 12);
          e.state = 'recover'; e.t = 0.8;
        }
        break;
      }
      case 'kDown':  // 넘어짐 · 휘청(닻 부서짐 / 등불 들킴) — 더 아프게 맞음
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'move'; e.atkCd = 0.6; }
        break;
      case 'lampHide': {  // 등불을 끄고 사라짐(안 맞음) → 노리는 사람 등 뒤에서 나타나 기습
        e.t -= dt; e.moving = true; e.walkT += dt;
        const dir = World.flowDir(e);
        if (dir) Dungeon.move(lv, e, dir.x * d.speed * 1.3 * dt, dir.y * d.speed * 1.3 * dt, e.r);
        if (e.t <= 0) {
          e.under = false;
          const f = p.fv || { x: 1, y: 0 };
          for (const [vx, vy] of [[-f.x, -f.y], [f.y, -f.x], [-f.y, f.x]]) { const x = p.x + vx * 26, y = p.y + vy * 18; if (Dungeon.walkable(lv, x, y, e.r) && Dungeon.roomIdx(lv, x, y) === e.ri) { e.x = x; e.y = y; break; } }
          faceTo(e, p); World.dust(e.x, e.y, 8);
          e.state = 'windup'; e.windupT = e.t = d.atk.windup * 1.1;
        }
        break;
      }
    }
  }
  // 등불의 기사: 방 네 귀퉁이 발광 산호(부품)
  function spawnCorals(e, lv) {
    const r = lv.rooms[e.ri] || lv.boss;
    for (const [x, y] of [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 2], [r.x + r.w - 3, r.y + r.h - 2]]) {
      const c = World.spawn('coral_lamp', x * T + 8, y * T + 10, {});
      c.hp = c.maxHp = 1; c.ri = e.ri;
    }
  }
  // 기사 부품(updateEnemy): 가만히. 닻은 주인이 사라지면 같이
  function part(e, dt) {
    e.walkT += dt; e.kx = 0; e.ky = 0;
    if (e.def.part === 'jail') {  // 거품 감옥: 갇힌 사람을 붙잡아 둠 → t 초 안에 못 터뜨리면 터지며 최대 체력 pct
      const h = e.hold;
      if (!h || h.dead) { e.dying = true; e.hp = 0; e.state = 'dead'; e.t = 0.6; return; }
      h.x = e.x; h.y = e.y; h.kx = 0; h.ky = 0;
      if ((e.t -= dt) <= 0) {
        World.fx({ type: 'nova', x: e.x, y: e.y, r: 14, col: WATER, el: '', tier: 0, bare: true, seed: Math.random() * 1000, t: 0, life: 0.35 });
        World.sparks(e.x, e.y, 10, 18, FOAM, true); World.shake(4); Sfx.blast();
        hurtPlayer(h, { x: e.x, y: e.y + 1, pct: ENEMIES.knight_bubble.jail.pct, unavoid: true }, 0, 160);
        World.text(e.x, e.y, 40, '거품이 터졌다!', '#ff6a5a', true);
        e.dying = true; e.hp = 0; e.state = 'dead'; e.t = 0.6;
      }
      return;
    }
    if (e.def.part === 'anchor') { const o = World.enemies().find(m => m.id === e.owner); if (!o || !live(o) || (o.state !== 'anchorHold' && o.state !== 'reel')) { e.dying = true; e.hp = 0; e.state = 'dead'; e.t = 0.6; } }
  }
  function partDied(e) {
    World.sparks(e.x, e.y, 10, 14, e.def.part === 'lamp' ? '#ffe066' : e.def.part === 'jail' ? FOAM : '#c8d0e0', true); Sfx.stone();
    if (e.def.part === 'jail') { e.hold = null; World.text(e.x, e.y, 40, '탈출!', TEAL, true); }
    if (e.def.part === 'anchor') {
      const o = World.enemies().find(m => m.id === e.owner);
      if (o && live(o) && o.state === 'anchorHold') {
        o.state = 'kDown'; o.t = o.def.anchor.down; o.anchor = null;
        World.text(o.x, o.y, o.h + 10, '사슬이 끊겼다 — 넘어졌다!', TEAL, true); World.shake(4); Sfx.chest();
      }
    }
    if (e.def.part === 'lamp') {
      const lv = World.level; lv.litT = ENEMIES.knight_lamp.lamp.lit;
      World.text(e.x, e.y, 30, '빛이 밝아졌다!', '#ffe066', true);
      const o = World.enemies().find(m => m.def.knight === 'lamp' && live(m));
      if (o && o.state === 'lampHide') {
        o.under = false; o.state = 'kDown'; o.t = o.def.lamp.stun;
        World.text(o.x, o.y, o.h + 10, '들켰다 — 휘청!', TEAL, true); World.shake(3); Sfx.chest();
      }
    }
  }

  // ── 방 전체(world.js update — 방장 · 혼자) ──
  function update(dt, lv) {
    for (const e of World.enemies()) if (e.def.knight && e.kInit && live(e)) { if (e.anchorCd > 0) e.anchorCd -= dt; if (e.cloneCd > 0) e.cloneCd -= dt; if (e.sigCd > 0) e.sigCd -= dt; if (e.sweepCd > 0) e.sweepCd -= dt; if (e.thrustCd > 0) e.thrustCd -= dt; if (e.def.bubble) bubbleTick(e, dt); }  // 기믹 대기(어떤 상태든 흐름)
    if (lv.litT > 0) lv.litT -= dt;
    const lamp = knightIn(lv, 'lamp');  // 발광 산호를 다 쓰고 마지막 빛까지 꺼지면 1초 뒤 다시 넷(2026-11-01 사용자 '불빛 넷 다 소진되면 리필' — 예전엔 마지막 산호를 친 뒤 10초)
    if (lamp && lamp.kInit && !World.enemies().some(m => m.def.part === 'lamp' && live(m))) {
      if (lv.litT > 0) lv.coralT = 1;
      else if ((lv.coralT = (lv.coralT === undefined ? 1 : lv.coralT) - dt) <= 0) { lv.coralT = 1; spawnCorals(lamp, lv); World.text(lamp.x, lamp.y, lamp.h + 10, '발광 산호가 다시 빛난다!', '#ffe066', true); }
    }
    const tide = knightIn(lv, 'tide');
    if (tide && tide.kInit) {
      const D = tide.def.tide;
      if ((tide.tideT -= dt) <= 0) { tide.tideT = D.every; tide.tideA += Math.PI * (0.5 + Math.random()); World.say('물살이 바뀌었다!', 1.4); Sfx.spell(); }
      const vx = Math.cos(tide.tideA) * D.speed, vy = Math.sin(tide.tideA) * D.speed * 0.7;
      for (const t of peopleOf()) if (World.roomOf(t) === tide.ri && t.state !== 'dodge') Dungeon.move(lv, t, vx * dt, vy * dt, BODY_R);
    }
  }
  const tideOf = lv => { const t = knightIn(lv, 'tide'); return t && t.kInit ? t : null; };
  // 빛 반경 배율: 등불의 기사 방(깨어남 · 산호 빛이 꺼져 있음)
  function lightMul(lv, p) {
    const o = knightIn(lv, 'lamp');
    return o && o.ri === World.roomOf(p) && !(lv.litT > 0) ? o.def.lamp.dark : 1;
  }
  // 어둠 위 빛(world.js draw — 어둠 다음): 등불 · 발광 산호 둘레를 'lighter' 로 밝힘
  function light(ctx, lv, time) {
    const glow = (x, y, r, a, col) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const e of World.enemies()) {
      if (!live(e)) continue;
      if (e.def.knight === 'lamp' && e.state !== 'lampHide') {
        const s = e.scale || 1, flip = e.fv.x < 0, lx = e.x + (flip ? -1 : 1) * (LAMP_AT.x - 17) * s, ly = e.y - e.z - (34 - LAMP_AT.y) * s;
        glow(lx, ly, 46 + Math.sin(time * 7) * 3, 0.32, 'rgba(255,214,90,A)');
      }
      if (e.def.part === 'lamp') glow(e.x, e.y - 6, 22 + Math.sin(time * 4 + e.x) * 2, 0.28, 'rgba(255,224,102,A)');
    }
    ctx.restore();
  }

  // ── 그리기 ──
  // 몹 그림을 따로 그리는 때(그렸으면 true): 땅속 아귀 · 덥석 예고 · 숨은 소라게 · 거품 속 병사 · 숨은 등불 기사
  function drawMob(ctx, e, time, o) {
    const d = e.def, x = Math.round(e.x), y = Math.round(e.y);
    if (d.lure) {
      if (e.state === 'lureWind') {  // 덥석 예고 = 판정(lure.r) 바닥 타원이 차오름 + 미끼가 떨림
        const k = 1 - e.t / d.lure.wind, R = d.lure.r;
        ctx.save();
        ctx.fillStyle = 'rgba(255,40,30,' + (0.1 + 0.2 * k) + ')'; ctx.strokeStyle = 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(e.x, e.y, R * k, R * GROUND_Y * k, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        Gfx.spr(ctx, 'angler_anim_f0', x + (Math.floor(time * 30) % 2 ? 1 : -1), y + Math.round((1 - k) * 8), { flip: o.flip, alpha: 0.4 + 0.6 * k });
        return true;
      }
      if (e.under || e.state === 'sink') {  // 땅속: 빛 미끼만(살짝 흔들림) + 모래 구멍
        ctx.fillStyle = 'rgba(16,24,40,0.55)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
        Gfx.spr(ctx, 'angler_lure', x + Math.round(Math.sin(time * 3 + e.walkT) * 1.5), y);
        return true;
      }
    }
    if (d.part === 'jail') {  // 갇힌 사람을 감싼 큰 거품 + 터지기까지 남은 시간 호(파티 손님도 e.t 로)
      if (e.state === 'dead') return true;
      const wob = Math.max(0, 1 - (performance.now() / 1000 - (e.wobT || 0)) / 0.15);  // 연타할 때마다 잠깐 부풀었다 돌아옴
      const k = Math.max(0, Math.min(1, e.t / ENEMIES.knight_bubble.jail.t)), r = 11 + Math.sin(time * 6) * 0.8 + wob * 2, cy = y - 7;
      ctx.save();
      ctx.fillStyle = 'rgba(106,154,216,' + (0.18 + (e.flash > 0 ? 0.3 : 0)) + ')'; ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(196,226,255,0.85)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = k < 0.35 && Math.floor(time * 8) % 2 ? '#ff5a7a' : TEAL; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, cy, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 5, cy - 6, 2, 1); ctx.fillRect(x - 6, cy - 5, 1, 2);
      ctx.restore();
      return true;
    }
    if (d.shell && e.state === 'shell') { Gfx.spr(ctx, 'crab_hide', x, y, o); return true; }
    if (d.revive && e.state === 'bubble') {  // 누워서 거품에 싸임
      Gfx.spr(ctx, 'drowned_anim_f0', x, y + 3, Object.assign({}, o, { rot: (o.flip ? 1 : -1) * Math.PI / 2, alpha: 0.85 }));
      ctx.strokeStyle = 'rgba(188,216,255,0.8)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const a = time * 2 + i * 1.6, bx = x + Math.cos(a) * 7, by = y - 4 - ((time * 10 + i * 5) % 14); ctx.beginPath(); ctx.arc(bx, by, 1.5 + (i % 2), 0, Math.PI * 2); ctx.stroke(); }
      return true;
    }
    if (d.knight === 'lamp' && e.state === 'lampHide') {  // 사라짐: 발밑 거품 자국만(어디쯤인지 짐작)
      if (Math.floor(time * 6) % 2) { ctx.fillStyle = 'rgba(188,216,255,0.5)'; ctx.fillRect(x - 3, y - 1, 1, 1); ctx.fillRect(x + 2, y - 2, 1, 1); }
      return true;
    }
    return false;
  }
  // 그림 이름 바꾸기(art.js): 왕이 삼지창을 던진 뒤 맨손
  function spriteOf(e, name) {
    if (e.def.raid && e.def.sprite === 'sunken_king' && e.bare && e.state !== 'exposed') return 'sunken_king_bare';
    return name;
  }
  // 그림 위 덧그림(art.js 몸 다음): 거품 겹 · 기사 휘청 별 · 아귀 휘청
  function drawOver(ctx, e, x, y, time) {
    const d = e.def;
    if (d.bubble && e.bubbles > 0 && e.state !== 'dead') {  // 몸을 감싼 거품 겹(남은 수만큼 공)
      const n = e.bubbles, s = e.scale || 1;
      ctx.save(); ctx.strokeStyle = 'rgba(196,226,255,0.75)'; ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const a = time * 1.2 + i / n * Math.PI * 2, bx = x + Math.cos(a) * (e.r + 6) * s, by = y - e.h * 0.5 + Math.sin(a) * e.h * 0.35;
        ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(Math.round(bx) - 1, Math.round(by) - 2, 1, 1);
      }
      ctx.strokeStyle = 'rgba(196,226,255,' + (0.25 + 0.1 * Math.sin(time * 5)) + ')';
      ctx.beginPath(); ctx.ellipse(x, y - e.h / 2, e.r + 3, e.h / 2 + 2, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (d.bubble && d.bubble.limit && e.bubbles > 0 && e.limitT !== undefined && !(e.exposeT > 0) && e.state !== 'dead') {
      const left = Math.max(0, e.limitT), hot = left <= 3, s2 = Math.ceil(left) + '';
      ctx.save(); ctx.font = 'bold 14px ' + Gfx.FONT; ctx.textAlign = 'center';
      ctx.fillStyle = '#000'; ctx.fillText(s2, x + 0.5, y - e.h - 9.5);
      ctx.fillStyle = hot ? (Math.floor(time * 8) % 2 ? '#ffffff' : '#ff5a7a') : FOAM; ctx.fillText(s2, x, y - e.h - 10);
      ctx.restore();
    }
    if (d.bubble && e.exposeT > 0) { ctx.fillStyle = TEAL; for (let k = 0; k < 3; k++) { const a = time * 6 + k * 2.1; ctx.fillRect(Math.round(x + Math.cos(a) * 9), Math.round(y - e.h - 3 + Math.sin(a) * 2), 2, 2); } }
    if (e.state === 'kDown' || (d.lure && e.state === 'daze')) { ctx.fillStyle = '#ffe066'; for (let k = 0; k < 3; k++) { const a = time * 6 + k * 2.1; ctx.fillRect(Math.round(x + Math.cos(a) * 8), Math.round(y - e.h - 3 + Math.sin(a) * 2), 2, 2); } }
    if (d.spin && e.state === 'spin') {  // 고리 가운데를 도는 닻 + 고리 안에서만 보이는 사슬 조각(안쪽 안전한 곳엔 안 그림)
      const S = d.spin, a = (S.t - e.t) * 9, R = (S.rIn + S.rOut) / 2;
      const ax = e.x + Math.cos(a) * R, ay = e.y + Math.sin(a) * R * GROUND_Y;
      ctx.save(); ctx.strokeStyle = '#a8b8d0'; ctx.lineWidth = 1; ctx.setLineDash([2, 1]);
      ctx.beginPath(); ctx.moveTo(e.x + Math.cos(a) * S.rIn, e.y + Math.sin(a) * S.rIn * GROUND_Y - 6); ctx.lineTo(ax, ay - 6); ctx.stroke(); ctx.restore();
      for (let i = 1; i <= 3; i++) { ctx.globalAlpha = 0.25 / i; Gfx.spr(ctx, 'sunk_anchor_anim_f0', Math.round(e.x + Math.cos(a - i * 0.25) * R), Math.round(e.y + Math.sin(a - i * 0.25) * R * GROUND_Y)); }
      ctx.globalAlpha = 1;
      Gfx.spr(ctx, 'sunk_anchor_anim_f0', Math.round(ax), Math.round(ay));
    }
    if (d.guard && e.state === 'mirrorGuard') {  // 앞에 선 물거울(반짝이는 세로 판) + 발밑 되받아치는 쪽 호
      const s = e.scale || 1, mx = x + e.fv.x * (e.r + 5) * s, my = y - e.h * 0.5 + e.fv.y * 4, w = Math.acos(d.guard.cone), A = Math.atan2(e.fv.y / GROUND_Y, e.fv.x), R = e.r + 10;
      ctx.save();
      ctx.strokeStyle = 'rgba(196,226,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * GROUND_Y, 0, A - w, A + w); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(188,216,255,' + (0.35 + 0.15 * Math.sin(time * 9)) + ')';
      ctx.beginPath(); ctx.ellipse(mx, my, 3 + Math.abs(e.fv.y) * 6, e.h * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(mx), Math.round(my - e.h * 0.3 + ((time * 30) % (e.h * 0.6))), 1, 2);
      ctx.restore();
    }
    if (d.knight === 'anchor' && (e.state === 'anchorHold' || e.state === 'reel') && e.anchor) {  // 기사 손 → 닻 사슬
      ctx.save(); ctx.strokeStyle = '#a8b8d0'; ctx.lineWidth = 1; ctx.setLineDash([2, 1]);
      ctx.beginPath(); ctx.moveTo(x + (e.fv.x < 0 ? -12 : 12), y - e.h * 0.45); ctx.lineTo(e.anchor.x, e.anchor.y - 10); ctx.stroke(); ctx.restore();
    }
  }
  // 바닥(world.js 장판과 같은 층): 닻 예고 · 조류 물살 줄
  function ground(ctx, lv, time, ri) {
    const ring = (x, y, r1, r2, fill, line) => {  // 바닥 고리(r1 ~ r2) 채우기
      ctx.save(); ctx.fillStyle = fill; ctx.strokeStyle = line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, r2, r2 * GROUND_Y, 0, 0, Math.PI * 2); ctx.moveTo(x + r1, y); ctx.ellipse(x, y, r1, r1 * GROUND_Y, 0, 0, Math.PI * 2, true); ctx.fill('evenodd'); ctx.stroke();
      ctx.restore();
    };
    for (const e of World.enemies()) {
      if (e.ri !== ri || !live(e)) continue;
      const d = e.def;
      if (d.spin && (e.state === 'spinWind' || e.state === 'spin')) {  // 닻 휘돌리기 고리 = 판정
        const k = e.state === 'spin' ? 1 : 1 - e.t / e.windupT;
        if (e.state === 'spin') ring(e.x, e.y, d.spin.rIn, d.spin.rOut, 'rgba(168,184,208,0.16)', 'rgba(188,216,255,0.55)');
        else ring(e.x, e.y, d.spin.rIn, d.spin.rIn + (d.spin.rOut - d.spin.rIn) * k, 'rgba(255,40,30,' + (0.12 + 0.2 * k) + ')', 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')');
        if (e.state === 'spinWind') { ctx.save(); ctx.strokeStyle = 'rgba(255,80,60,0.6)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, d.spin.rOut, d.spin.rOut * GROUND_Y, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      }
      if (d.thrust && (e.state === 'thrustWind' || e.state === 'thrust') && e.chargeV) {  // 길게 찌르기 띠 = 판정(예고 붉게 차오름 · 찌를 때 흰 물빛)
        const T2 = d.thrust, v = e.chargeV, k = e.state === 'thrust' ? 1 : 1 - e.t / e.windupT, a = Math.atan2(v.y, v.x);
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
        ctx.fillStyle = e.state === 'thrust' ? 'rgba(196,226,255,0.5)' : 'rgba(255,40,30,' + (0.12 + 0.2 * k) + ')';
        ctx.strokeStyle = e.state === 'thrust' ? 'rgba(255,255,255,0.9)' : 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')'; ctx.lineWidth = 1;
        ctx.fillRect(0, -T2.w, T2.len, T2.w * 2); ctx.strokeRect(0, -T2.w, T2.len, T2.w * 2);
        if (e.state === 'thrustWind') { ctx.beginPath(); ctx.moveTo(T2.len * k, -T2.w); ctx.lineTo(T2.len * k, T2.w); ctx.stroke(); }
        ctx.restore();
      }
      if (d.sweep && (e.state === 'sweepWind' || e.state === 'sweep')) {
        const W = d.sweep, k = e.state === 'sweep' ? 1 : 1 - e.t / e.windupT, f = Math.atan2(e.fv.y / GROUND_Y, e.fv.x), h = W.arc / 2 * Math.PI / 180;
        ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, GROUND_Y);
        ctx.fillStyle = e.state === 'sweep' ? 'rgba(196,226,255,0.45)' : 'rgba(255,40,30,' + (0.12 + 0.2 * k) + ')';
        ctx.strokeStyle = e.state === 'sweep' ? 'rgba(255,255,255,0.9)' : 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, W.r, f - h, f + h); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (e.state === 'sweepWind') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, W.r * k, f - h, f + h); ctx.closePath(); ctx.stroke(); }
        ctx.restore();
      }
      if (d.rush && e.state === 'rushWind' && e.chargeV) {  // 해류 돌진 줄(몸이 지나갈 길)
        const L = d.rush.speed * d.rush.time, k = 1 - e.t / e.windupT;
        ctx.save(); ctx.strokeStyle = 'rgba(255,60,40,' + (0.2 + 0.35 * k) + ')'; ctx.lineWidth = e.r * 2;
        ctx.beginPath(); ctx.moveTo(e.x, e.y - 4); ctx.lineTo(e.x + e.chargeV.x * L, e.y - 4 + e.chargeV.y * L); ctx.stroke(); ctx.restore();
      }
      if (d.jail && e.state === 'jailWind' && e.lx !== undefined) {  // 거품 감옥 원 = 판정
        const R = d.jail.r, k = 1 - e.t / e.windupT;
        ctx.save();
        ctx.fillStyle = 'rgba(106,154,216,' + (0.15 + 0.25 * k) + ')'; ctx.strokeStyle = 'rgba(196,226,255,' + (0.5 + 0.5 * k) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(e.lx, e.ly, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(e.lx, e.ly, R * k, R * GROUND_Y * k, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    for (const e of World.enemies()) {
      if (e.state === 'anchorWind' && e.ri === ri) {
        const A = e.def.anchor, k = 1 - e.t / e.windupT;
        ctx.save();
        ctx.fillStyle = 'rgba(255,40,30,' + (0.12 + 0.2 * k) + ')'; ctx.strokeStyle = 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')';
        ctx.beginPath(); ctx.ellipse(e.lx, e.ly, A.r, A.r * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(e.lx, e.ly, A.r * k, A.r * GROUND_Y * k, 0, 0, Math.PI * 2); ctx.stroke();
        {  // 끌림 범위(pullR): 옅은 고리 + 안으로 빨려드는 줄
          const pulling = e.t <= e.windupT * (1 - A.follow);
          ctx.strokeStyle = 'rgba(188,216,255,' + (pulling ? 0.55 : 0.25) + ')'; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.ellipse(e.lx, e.ly, A.pullR, A.pullR * GROUND_Y, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
          if (pulling) for (let i = 0; i < 12; i++) {
            const a = i / 12 * Math.PI * 2 + i, ph = 1 - ((time * 2.2 + i * 0.37) % 1), r1 = A.r + (A.pullR - A.r) * ph, r2 = Math.max(A.r, r1 - 10);
            ctx.beginPath(); ctx.moveTo(e.lx + Math.cos(a) * r1, e.ly + Math.sin(a) * r1 * GROUND_Y); ctx.lineTo(e.lx + Math.cos(a) * r2, e.ly + Math.sin(a) * r2 * GROUND_Y); ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
    const tide = lv.tideShow;  // 손님은 방장 소식(tideA), 방장은 기사에서
    const t = tideOf(lv);
    const a = t ? t.tideA : tide;
    if (a === undefined || a === null) return;
    const r = lv.rooms[ri];
    if (!r || !lv.rooms[ri].boss) return;
    const vx = Math.cos(a), vy = Math.sin(a) * 0.7, len = 10;
    ctx.save(); ctx.strokeStyle = 'rgba(188,216,255,0.28)'; ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const sx = (r.x + 1 + ((i * 37) % (r.w - 2))) * T, sy = (r.y + 1 + ((i * 53) % (r.h - 2))) * T;
      const ph = ((time * 1.2 + i * 0.13) % 1) * 30;
      const px = sx + vx * ph, py = sy + vy * ph;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + vx * len, py + vy * len); ctx.stroke();
    }
    ctx.restore();
  }

  // ── 풍경: 바닥 그림(dungeon.js paint) — 해초 무더기 · 산호 조각 · 무너진 돌기둥 조각 · 모래 물결 ──
  function paintSea(lv, g) {
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    lv.bubbles = [];
    lv.rooms.forEach((r, ri) => {
      const n = Math.round(r.w * r.h / 30);
      for (let k = 0; k < n; k++) {
        const x = (r.x + rnd(1, r.w - 2)) * T + rnd(0, 15), y = (r.y + rnd(1, r.h - 2)) * T + rnd(0, 15), kind = Math.random();
        if (kind < 0.35) {  // 해초 무더기: 1px 줄 셋이 흔들리며 위로
          for (let s = 0; s < 3; s++) { let sx = x + s * 2 - 2; const h = rnd(4, 9); for (let j = 0; j < h; j++) { sx += (j % 3 === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0); g.fillStyle = j < h / 2 ? SEA.weed : SEA.weedLit; g.fillRect(sx, y - j, 1, 1); } }
        } else if (kind < 0.5) {  // 산호 조각
          g.fillStyle = SEA.coral; g.fillRect(x, y, 1, 3); g.fillRect(x - 1, y - 1, 1, 2); g.fillRect(x + 1, y - 2, 1, 3); g.fillStyle = '#ff9a6a'; g.fillRect(x + 1, y - 2, 1, 1);
        } else if (kind < 0.62) {  // 무너진 돌 조각(왕국 유적)
          g.fillStyle = '#4a5a7a'; g.fillRect(x, y, 4, 2); g.fillStyle = '#6a7a9a'; g.fillRect(x, y, 4, 1); g.fillStyle = '#2a3450'; g.fillRect(x + 1, y + 2, 3, 1);
        } else {  // 모래 물결
          g.fillStyle = 'rgba(188,216,255,0.10)'; for (let j = 0; j < 6; j++) g.fillRect(x + j, y + Math.round(Math.sin(j) * 1), 1, 1);
        }
      }
      for (let k = Math.round(r.w * r.h / 70); k > 0; k--) lv.bubbles.push({ ri, x: (r.x + rnd(1, r.w - 2)) * T + 8, y: (r.y + rnd(1, r.h - 2)) * T + 8, ph: Math.random() * 3 });
    });
  }
  // 지금 방 물결 빛(위에서 내려오는 빛 무늬) · 올라가는 거품 — 판정 없는 꾸밈
  function drawSea(ctx, lv, time, ri) {
    if (!lv.bubbles) return;
    const r = lv.rooms[ri];
    if (r) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const cx = (r.x + r.w * ((i * 0.37 + time * 0.03) % 1)) * T, cy = (r.y + r.h * ((i * 0.61 + 0.2) % 1)) * T, rr = 26 + (i % 3) * 8;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, 'rgba(106,154,216,' + (0.07 + 0.04 * Math.sin(time * 1.3 + i)) + ')'); g.addColorStop(1, 'rgba(106,154,216,0)');
        ctx.fillStyle = g; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      }
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(188,216,255,0.55)'; ctx.lineWidth = 1;
    for (const b of lv.bubbles) {
      if (b.ri !== ri) continue;
      const u = ((time * 0.45 + b.ph) % 1.6) / 1.6;
      if (u > 1) continue;
      ctx.globalAlpha = 1 - u;
      ctx.beginPath(); ctx.arc(b.x + Math.sin(time * 3 + b.ph) * 2, b.y - u * 34, 1 + (b.ph > 1.5 ? 0.5 : 0), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // 파티 손님에게: 조류 방향(방장 → 손님 snap)
  const snap = () => { const lv = World.level, t = lv && tideOf(lv); return t ? Math.round(t.tideA * 100) / 100 : undefined; };
  const unsnap = a => { if (World.level) World.level.tideShow = a; };

  return { jailOf, mash, mashFrom, pillars, sweep, chargeBlocked, think, state, windupEnd, whirlTick, drawWhirl, cut, onHit, onKill, part, partDied, update, lightMul, light, drawMob, spriteOf, drawOver, ground, paintSea, drawSea, snap, unsnap };
})();
