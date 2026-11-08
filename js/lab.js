// 끝없는 심연 3단계 '심연 실험장'(2026-11-08 사용자 '이제까지 설정으로 3단계 만들자' — 메모/abyss-story-plan.md, 수치 data.js LAB · ENEMIES · BROOD_RULE).
// 그림(시안 tools/lab-sketch.js · lab-boss-sketch.js · lab-raid-sketch.js · lab-scene-sketch.js 그대로) · 새 몹 넷 행동 · 실패작 다섯 기믹 · 실험장 풍경 ·
// 최종 보스 '분열의 어미'(본체 + 복제체 — 체력은 하나, 같은 색일 때만 피해 · 다른 색을 치면 회복). 레이드 방 · 남은 시간 · 기록은 js/raid.js · world.js 틀을 그대로 쓴다.
// 방장 · 혼자가 계산하고(think · state · cut · part · update), 파티 손님은 몹 소식 + snap(색 · 공명 · 웅덩이)으로 그림만 따라 그린다.
const Lab = (() => {
  // ── 그림 ── 테두리(o)는 ol() 이 둘레에 두른다(분열의 어미 · 복제체는 시안에 테두리까지 적혀 있음)
  const PAL = {
    o: '#120a14', k: '#2a1a24',
    f: '#7a4a4e', F: '#b47a72', h: '#e2b0a0', E: '#e0705e',
    g: '#2e5a14', G: '#6cb02a', l: '#c8ff6a',
    m: '#3e3e4a', M: '#6e6e7e', W: '#b4b4c4',
    r: '#5a3220', R: '#9a5a2a',
    q: '#a8d8e0', Q: '#4e7a88',
    s: '#2a1418', b: '#d8ccb0', B: '#9a8a70',
    c: '#7a7a88', C: '#c8c8d4',
    y: '#ffe066', t: '#5fe0d0', T: '#2a8a88', w: '#ece0cc', d: '#a8987e', U: '#5a8ae0', u: '#2a4a8a',
  };
  const pad = rows => { const w = Math.max(...rows.map(r => r.length)); return rows.map(r => r.padEnd(w, '.')); };
  const mir = half => half.map(r => r + [...r].reverse().join(''));
  const remap = (rows, m) => rows.map(r => [...r].map(ch => m[ch] || ch).join(''));
  const over = (rows, x, y, lines) => { const g = rows.map(r => [...r]); lines.forEach((ln, j) => [...ln].forEach((ch, i) => { if (ch !== '.' && g[y + j] && x + i < g[0].length) g[y + j][x + i] = ch === '_' ? '.' : ch; })); return g.map(r => r.join('')); };
  const bob = rows => ['.'.repeat(rows[0].length), ...rows.slice(0, -1)];
  const breath = (rows, at) => ['.'.repeat(rows[0].length), ...rows.slice(0, at), ...rows.slice(at + 1)];
  const ol = rows => {
    const W = rows[0].length + 2, H = rows.length + 2;
    const g = [Array(W).fill('.'), ...rows.map(r => ['.', ...r, '.']), Array(W).fill('.')];
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== '.' && g[y][x] !== 'o';
    const out = g.map(r => r.slice());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '.' && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) out[y][x] = 'o';
    return out.map(r => r.join(''));
  };
  const canvasOf = (rows, pal = PAL, white) => {
    const c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => { const col = pal[ch]; if (!col) return; g.fillStyle = white ? (ch === 'o' ? '#3a3a44' : '#f4f4ff') : col; g.fillRect(x, y, 1, 1); }));
    return c;
  };
  const put = (name, rows, pal) => Gfx.put(name, canvasOf(rows, pal));
  const anim = (name, a, b, pal, white) => { const A = canvasOf(a, pal, white), B = canvasOf(b || a, pal, white); for (let i = 0; i < 4; i++) Gfx.put(name + '_anim_f' + i, i < 2 ? A : B); };

  // 몹 넷(tools/lab-sketch.js)
  const VAT = pad(['....WWWWWWWW....', '...WMMMMMMMMW...', '..mmmmmmmmmmmm..', '..mQqGGGGGGqQm..', '..mQGGlGGGGGQm..', '..mQGGkkkkGGQm..',
    '..mQGkkkkkkGQm..', '..mqGkkykkkGQm..', '..mQGkkkkkkGQm..', '..mQGGkkkkGGQm..', '..mQGGGkkGGlQm..', '..mQGGGGGGGGQm..',
    '..mqGlGGGGGGQm..', '..mQGGGGGGGGQm..', '..mmmmmmmmmmmm..', '...MMMMMMMMMM...', '..RrrrrrrrrrrR..', '..r.r......r.r..']);
  const VAT_BROKEN = pad(['................', '................', '................', '................', '................', '................', '................', '..mq........qm..', '..mQ.......qQm..', '..mQq.....q.Qm..', '..mQ.q...q..Qm..', '..mQGG.q.GGGQm..', '..mqGlGGGGGGQm..', '..mQGGGGGGGGQm..', '..mmmmmmmmmmmm..', '...MMMMMMMMMM...', '..RrrrrrrrrrrR..', '..r.r......r.r..']);
  const SPAWN = mir(['........', '.....FFF', '...FFhhF', '..FhhFFF', '.FhFFFFF', '.FFkyyFF', '.FFkykFF', 'FFFFFFFF', 'FfFFFssF', 'FfFFsGFF', '.fFFFGFf', '.ffFFlFf', '..ffFGff', '...f..l.', '...f....']);
  const GRAFT = pad(['......FFFF........', '.....FhhFFF.......', '.....FkyFyF..bbb..', '.....FFFFFF.bByb..', '......FssF...bbb..', '...FFFFFFFFFFsBs..',
    '..FhFFFFFFFFFFMWM.', '.FhFFsFFFFFFFFMWM.', '.FFFFsFFFFFfFFmMm.', '.FfFFsFFFFFfF.mMm.', '.FfFFFFFFFFfF.MWM.', '.Ff.FFFFFFFf..mMm.',
    '.hF.FfFFFFfF..RRR.', '..F.FFFFFFFF..R.R.', '....fFFFFFFf......', '....fFF..FFf......', '....fF....Ff......', '...ffF....Fff.....', '...kkk....kkk.....']);
  const GRAFT_BIT = pad(['..bbbb....', '.bByBBb...', 'bBbbbsFF..', 'bbbbbsFhF.', '.F.F.F.F..', 'F..F.F..F.']);
  const BLOAT = mir(['........', '......mW', '......Mg', '....FFFG', '...FhFFF', '..FhFFFF', '..FFkyFF', '.FFFkkFF', '.FFGFFFF', 'FFFFGFFF', 'FFhFFGGF',
    'FFFFFFlG', 'FfFFFFGF', '.fFFGFFF', '.ffFFFFf', '..ffFFff', '...fff..', '..kkkk..']);
  const BLOAT_RAGE = remap(BLOAT, { F: 'E', G: 'l', g: 'G', h: 'y' });
  const CHAIN = mir(['.c......', '..C.....', '..c.....', '..Mm....', '..mF..FF', '...F.FhF', '...FFFkF', '....FFyF', '....fFFF', '....FFss', '.....bFF',
    '....bbBF', '....bBbF', '....FbbF', '....fFFF', '.....fFF', '....fF..', '....fF..', '...mMm..', '...cC...']);
  const CHAIN_FREE = over(CHAIN, 0, 0, ['________________', '________________', '________________', '________________', '______....______']);
  const CHAIN_FREE2 = over(CHAIN_FREE, 0, 10, ['...F........F...', '..FF........FF..', '..Ff........fF..', '..F..........F..', '.mM..........Mm.', '.c............c.']);
  // 실패작 다섯(tools/lab-boss-sketch.js — 왼쪽 반 16칸을 좌우로 뒤집어 붙임)
  const STITCH = mir([
    '................', '...........FFFFF', '.........FFhhhhF', '........FhhFFFFF', '........FhFFFFFF', '........FFkkyFFF',
    '...MW...FFkyyFFF', '...mM..FFFFFFsFF', '..FFFFFFFFFFsFsF', '.FhhFFFFFFFFFFFF', '.FhFFFFtFFFFFFFF', 'FhFFFFFtsFFFFFFF',
    'FFFFFFFtFFFFFFFt', 'FfFFFFsTFFFFFFFt', 'FfFFFFFFFFFFFFFt', 'FfFFFFFFFFFFFFFt', '.fFFFFFFFFFFFFFT', '.ffFFFFFFFFFFFFF',
    '..fhFFfFFFFFFFFF', '..fFFf.fFFFFFFFF', '..fFF..ffFFFFFFF', '..hFF...fFFFFFFF', '.FhFFF..ffFFFFFF', '.kkkkk...fFFFfff',
    '.........fFFf...', '........ffFFf...', '........fFFFf...', '.......kkkkkk...']);
  const BROOD = mir([
    '................', '..........TTTTTT', '.........WMMMMMM', '........mmmmmmmm', '........mQqGGGGG', '........mQGGlGGk',
    '........mQGGkkkk', '........mQGkkkky', '........mQGGkkkk', '........mqGGGGGG', '........mmmmmmmm', '......FFFFFFFFFF',
    '.....FhhFFFFFFFF', '..m.FhFFkyyFFFFF', '.mM.FFFFkkFFFsss', 'mM..FFFFFFFFFFFF', 'M..mMFFFFFFFFFFF', 'M.mM..fFFFFFFFFF',
    'M.M..mM.ffFFFFFF', '..M.mM...mMfffff', '..M.M...mM.....m', '..k.M...M......M', '....k...M......M', '........k......k']);
  const MELT = mir([
    '................', '..........FFFFFF', '.........FhhFFFF', '.........FhFFFFF', '.........FkyFFkF', '.........FFFFFFF',
    '..........FGGFFF', '......FFFFFlGFFF', '.....FhFFFFFFFFF', '....FhFFFFFFFFGF', '....FFFFGFFFFFFF', '...FFFFFlFFFFFFF',
    '...FfFFGFFFFFFFF', '...Ff.GFFFFFFFFF', '...f..lFFFFFFFFF', '......GfFFFFFFFF', '.......ffFFFFFFF', '.......fFFFFFFFF',
    '......ffFFGFFFFF', '.....GGfFFlFFFFF', '...GGGGGGGGGGGGG', '.gGGlGGGGGGGGGGG', '..ggggggggggggGG']);
  const ZERO = mir([
    '................', '...........mmmmm', '..........mMWWWW', '..........mMMMMM', '..........mMkyMM', '..........mMMMMM',
    '...........mmssm', 'c.........FFmmmm', '.C......FFFFFFFF', '..c...FFhhFFFFFF', '...CmMFhFFFFFFFF', '....MmFFFFFFFFFF',
    '......FFFFFFFFTT', '......FFFFFFFFtT', '......fFFFFFFFFF', '......fFFFFFFFFF', '.......fFFFFFFFF', '.......bbbbbbbbb',
    '.......BbbBbbbBb', '........fFFF....', '........fFFF....', '........fFFF....', '........fFFF....', '.......mMMMm....', '.......kkkkk....']);  // 2026-11-08: 다리가 짧아 보여 한 줄 늘림(메모 '다듬을 것')
  const EYE = mir([
    '................', '..............Wm', '...........mmmMM', '........WWWWWWWW', '.......WMMMMMMMM', '......mmmmmmmmmm',
    '......mQqGGGGGGG', '......mQGwwGGGGG', '......mQGwkGGGww', '......mQGGGGGGwy', '......mQGGtwGGwk', '......mqGGwkGGGG',
    '......mQGGGGGwwG', '......mQGlGGGwkG', '......mQGGGGGGGG', '......mmmmmmmmmm', '.......MMMMMMMMM', '......RrrrrrrrRR',
    '.....mM.....mM..', '....mM.....mM...', '...mM.....mM....', '...k......k.....']);
  // 상태 그림: 봉합체 실밥(왼쪽 x7 · 오른쪽 x24 · 가운데 x15~16)이 하나씩 끊김 → 다 끊으면 가운데가 벌어짐 / 배양 모체 뚜껑 깨짐 / 굳은 흘러내리는 자 / 깨진 유리병
  const seam = (rows, xs, to) => rows.map((r, y) => [...r].map((ch, x) => (xs.includes(x) && (ch === 't' || ch === 'T' || (ch === 's' && y >= 10 && y <= 16)) ? to : ch)).join(''));
  const STITCH2 = seam(STITCH, [7, 8], 'f'), STITCH1 = seam(STITCH2, [23, 24], 'f');
  const STITCH0 = seam(STITCH1, [15, 16], 'k').map((r, y) => (y >= 11 && y <= 16 ? r.slice(0, 14) + (y % 2 ? 'lt' : 'tl').padEnd(4, 'k').slice(0, 4) + r.slice(18) : r));
  const BROOD_OPEN = over(BROOD, 0, 0, ['________________________________', '_____________q____q_____________']);
  const MELT_HARD = remap(MELT, { F: 'T', h: 't', f: 'Q', G: 'q', l: 'w', g: 'Q' });
  const EYE_OPEN = remap(EYE, { q: '.', Q: 'k', G: 'g', l: 'G', t: 'k' });
  const ZERO_BOUND = ZERO;
  // 분열의 어미 · 복제체(tools/lab-raid-sketch.js) — X/x = 지금 색, 기호 ● ▲ ■(색약 배려)
  const MOTHER = mir([
    '................', '...........ooooo', '.........ooFFFFF', '........oFhhFFFX', '.......oFhFFFFFX', '......oFhFFFFFFX',
    '..ooo.oFFFFFFFFX', '.oFFFooFFoooFFFX', 'oFhFFFoFoyyyoFFX', 'oFFFFFoFoyoyoFFX', 'oFoyoFoFoyyyoFFX', 'oFFFFFoFFoooFFFX',
    'ofFFFfoFFFFFFFFX', '.offfo.oFFFFFFFX', '..ooo..oFFFsssss', '.......oFFswswsw', '.......ofFsssss', '......offFFFFFFX',
    '......offfFFFFFX', '.....offfffFFFFX', '.....ooffffffffx', '....ooffffffffff', '...ooffffFffffff', '...offfffffffxff',
    '...offsfffffsfff', '...ooffffffffffx', '....oooooooooooo', '................']);
  const TWIN = mir(['..........', '......oooo', '....ooFFFF', '...oFhhFFF', '..oFhFoooo', '..oFFFFoyy', '..oFFFFoyk', '..oFFFFFoo', '.oFFFFFFFX', '.oFFFFFsws', '.ofFFFFFFX', '.offFFFFFx', '..offfffff', '..offo.off', '...oo...oo']);
  const RC = [['#ff6a5a', '#9a2028', '●', '붉은'], ['#6a9cff', '#24408e', '▲', '푸른'], ['#ffd84a', '#9a7418', '■', '노란']];
  const SYM = {
    '●': ['..ooo..', '.oXXXo.', 'oXXXXXo', 'oXXXXXo', 'oXXXXXo', '.oXXXo.', '..ooo..'],
    '▲': ['...o...', '..oXo..', '..oXo..', '.oXXXo.', '.oXXXo.', 'oXXXXXo', 'ooooooo'],
    '■': ['ooooooo', 'oXXXXXo', 'oXXXXXo', 'oXXXXXo', 'oXXXXXo', 'oXXXXXo', 'ooooooo'],
  };
  const EYEBALL = ['.www.', 'wwkww', 'wkykw', 'wwkww', '.www.'];
  const NEEDLE = ['.........tT', '........tT.', 'WWMMMMMmmt.', '.c.c.C.c...', 'c.c...c.c..'];  // 실바늘: 쇠바늘 몸 · 청록 바늘귀 · 실 다리
  // 풍경 장식(tools/lab-scene-sketch.js)
  const PIPE = ['.MMMMMM.', '.mmmmmm.', '..mMWm..', '..mMWm..', '..mMWm..', '..mMWm..', '..mMWm..', '.RRRRRR.', '.R.mW.R.', '.RRRRRR.',
    '..mMWm..', '..mMWm..', '..mMWm..', '..mMWm..', '.mmmmmm.', '.MGGGGM.', '...GG...', '...l....', '...G....'];
  const CAGE = ['mmmmmmmmmmmmmmmm', 'MWMWMWMWMWMWMWMW', 'M..M..M..M..M..M', 'M..M..M..M..M..M', 'M..MkkMk.M..M..M', 'M..MkkMkkM..M..M', 'M..MkyMykM..M..M', 'M..MkkMkkM..M..M', 'M..MkkMkkM..M..M', 'M..M.kM.kM..M..M', 'M..M..M..M..M..M', 'M..M..M..M..M..M', 'M..M..M..M..M..M', 'mmmmmmmmmmmmmmmm', 'RrrrrrrrrrrrrrrR', 'r..............r'];
  const TABLE = ['........q.......qq.......q......', '.......qGq.....qEEq.....qUq.....', '......qGGGq...qEEEEq...qUUUq....', '......qGlGq...qEEEEq...qUUUq....',
    '.......qq......qqqq.....qqq.....', 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM', 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', 'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
    '.mM........................Mm...', '.mM...bbbbbb...........ss..Mm...', '.mM...BbbbbB..........s..s.Mm...', '.mM........................Mm...',
    '.mM........................Mm...', 'kmMk......................kMmk..'];
  const GRATE = ['mMmMmMmMmMmMmMmM', 'Mg.g.g.g.g.g.g.m', 'mMmMmMmMmMmMmMmM', 'Mg.G.g.G.g.G.g.m', 'mMmMmMmMmMmMmMmM', 'Mg.g.l.g.g.g.l.m', 'mMmMmMmMmMmMmMmM', 'Mg.G.g.g.G.g.g.m', 'mMmMmMmMmMmMmMmM'];
  const CHAIN_H = ['.mm.', '.cC.', '..c.', '.C..', '.c..', '..C.', '..c.', '.C..', '.c..', '..C.', '.mMm', 'mM.M'];
  const SHARDS = ['..q.....', '.qQ...q.', '......Qq', '.q......'];
  const JAR = ['.mmmm.', '.MWWM.', 'qQGGQq', 'qGkkGq', 'qGkyGq', 'qGGlGq', 'qQGGQq', '.mmmm.'];
  const PROP = {};
  function bake() {
    anim('lab_vat', ol(VAT)); put('lab_vat_broken', ol(VAT_BROKEN));
    anim('lab_spawn', ol(SPAWN), ol(bob(SPAWN)));
    anim('lab_graft', ol(GRAFT), ol(bob(GRAFT))); anim('lab_bit', ol(GRAFT_BIT), ol(bob(GRAFT_BIT)));
    anim('lab_bloat', ol(BLOAT), ol(bob(BLOAT))); anim('lab_bloat_rage', ol(BLOAT_RAGE), ol(bob(BLOAT_RAGE)));
    anim('lab_chain', ol(CHAIN)); anim('lab_chain_free', ol(CHAIN_FREE2), ol(bob(CHAIN_FREE2)));
    const mid = (name, rows, at) => { const o = ol(rows); anim(name, o, breath(o, at)); };
    mid('lab_stitch', STITCH, 13); mid('lab_stitch_2', STITCH2, 13); mid('lab_stitch_1', STITCH1, 13); mid('lab_stitch_0', STITCH0, 13);
    mid('lab_brood', BROOD, 12); mid('lab_brood_open', BROOD_OPEN, 12);
    mid('lab_melt', MELT, 10); mid('lab_melt_hard', MELT_HARD, 10);
    mid('lab_zero', ZERO, 13); mid('lab_zero_bound', ZERO_BOUND, 13);
    mid('lab_eye', EYE, 15); mid('lab_eye_open', EYE_OPEN, 15);
    anim('lab_eyeball', ol(EYEBALL));
    anim('lab_needle', ol(NEEDLE), ol(over(NEEDLE, 0, 3, ['c.c.c.C.c..', '.c...c.c.c.'])));
    // 분열의 어미 · 복제체: 색마다 잠김(어둡게) · 공명(밝게) + 버팀(하얀 실루엣)
    for (const [nm, rows, at] of [['lab_mother', MOTHER, 14], ['lab_twin', TWIN, 7]]) {
      const B = breath(rows, at);
      RC.forEach(([hi, lo], c) => {
        anim(nm + '_c' + c, rows, B, Object.assign({}, PAL, { X: hi, x: lo, F: '#8a5e5a', f: '#5a3a3e', h: '#b48a80' }));
        anim(nm + '_c' + c + 'L', rows, B, Object.assign({}, PAL, { X: '#ffffff', x: hi, F: '#d89a8a', f: '#a8686a', h: '#ffe0d0' }));
      });
      anim(nm + '_W', rows, B, Object.assign({}, PAL, { X: '#fff', x: '#fff' }), true);
      anim(nm, rows, B, Object.assign({}, PAL, { X: RC[0][0], x: RC[0][1] }));  // 기본 이름(키 재기 · 고르기 줄 아이콘)
    }
    RC.forEach(([hi], c) => Gfx.put('lab_sym' + c, canvasOf(SYM[RC[c][2]], { o: '#120a14', X: hi })));
    // 약물 배양조(레이드): 배양조 그림을 그 색 약물로
    RC.forEach(([hi, lo], c) => {
      const pal = Object.assign({}, PAL, { G: hi, l: '#ffffff', g: lo });
      anim('lab_tank' + c, ol(VAT), null, pal); Gfx.put('lab_tank' + c + '_broken', canvasOf(ol(VAT_BROKEN), pal));
    });
    for (const [k, rows] of Object.entries({ pipe: PIPE, cage: CAGE, table: TABLE, grate: GRATE, chain: CHAIN_H, shards: SHARDS, jar: JAR, vat: VAT, vatB: VAT_BROKEN })) PROP[k] = canvasOf(ol(rows));
  }
  bake();

  // ── 공통 ──
  const live = e => !e.dying && e.state !== 'dead';
  const TEAL = '#5fe0d0', ACID = '#6cb02a', ACID_HI = '#c8ff6a';
  const peopleOf = () => [World.player, ...World.remotes].filter(t => t && !t.dead);
  const now = () => World.time;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pickOf = a => a[Math.floor(Math.random() * a.length)];
  const dot = (e, src) => { const tp = unit(src.x - e.x, src.y - e.y, e.fv); return e.fv.x * tp.x + e.fv.y * tp.y; };  // 친 사람이 앞(+1) · 등 뒤(-1)
  const sayOnce = (e, key, s, t = 3) => { if (e[key]) return; e[key] = 1; World.say(s, t); };
  const isLab = () => !!(World.level && World.level.def.lab);

  // ── 몹 생각(enemy.js move 상태) — 처리했으면 true ──
  function think(e, dt, lv, p) {
    const d = e.def;
    if (d.brood) { motherThink(e, dt, lv, p); return true; }
    if (d.lab) { midThink(e, dt, lv, p); return true; }
    if (d.hatch) { vatThink(e, dt, lv, p); return true; }
    if (d.rage && !e.raging && e.hp < e.maxHp * d.rage.at) {  // 폭주체: 약물이 끓어 붉게 · 빨라짐(행동은 보통 몹 그대로)
      e.raging = true; e.speedMul *= d.rage.speed; e.windupMul *= d.rage.wind;
      World.text(e.x, e.y, e.h + 6, '끓어오른다!', '#ff7a5a'); World.sparks(e.x, e.y, e.h * 0.5, 10, ACID_HI, true); Sfx.spell();
    }
    if (d.bound) { chainThink(e, dt, lv, p); return true; }
    return false;
  }
  // 배양조: 깨어나면 first 초 뒤부터 every 초마다 실험체 하나(모두 n) — 다 나오면 빈 배양조는 깨져 사라짐(전리품 없음). 그 전에 부수면 덜 나옴
  function vatThink(e, dt, lv, p) {
    const H = e.def.hatch;
    e.moving = false; e.kx = 0; e.ky = 0;
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (e.hatchT === undefined) { e.hatchT = H.first + Math.random() * 0.6; e.hatched = 0; }
    if ((e.hatchT -= dt) > 0) return;
    e.hatchT = H.every;
    const u = p && !p.dead ? unit(p.x - e.x, p.y - e.y, { x: 0, y: 1 }) : { x: 0, y: 1 };
    const c = World.spawn('lab_spawn', e.x + u.x * 10, e.y + u.y * 8 + 2, { spawn: true });
    c.minion = true; c.ri = e.ri; c.spawnT = 0.45; c.kx = u.x * 90; c.ky = u.y * 70; c.atkCd = 0.5;
    if (!Dungeon.walkable(lv, c.x, c.y, c.r)) { c.x = e.x; c.y = e.y + 4; }
    World.sparks(e.x, e.y, 10, 10, '#a8d8e0', true); World.sparks(e.x, e.y, 8, 8, ACID_HI, true); Sfx.stone();
    if (!e.hatched) World.text(e.x, e.y, 26, '배양조가 깨진다!', ACID_HI);
    if (++e.hatched >= H.n) {  // 다 깨어남: 빈 배양조는 무너져 사라짐(처치로 안 셈)
      World.dust(e.x, e.y, 8);
      e.dying = true; e.hp = 0; e.state = 'dead'; e.t = 0; e.rewarded = true; e.minion = true;
    }
  }
  // 사슬 묶인 실험체: 처음 자리(기둥) 둘레 leash 안에서만 — 체력이 snapHp 아래거나 깨어난 뒤 snapT 초면 사슬이 끊겨 날뜀
  function chainThink(e, dt, lv, p) {
    const B = e.def.bound;
    if (e.ax === undefined) { e.ax = e.x; e.ay = e.y; e.bound = true; e.wokeAt = now(); }
    if (e.bound && (e.hp < e.maxHp * B.snapHp || now() - e.wokeAt > B.snapT)) {
      e.bound = false; e.speedMul *= B.speed; e.windupMul *= B.wind;
      World.text(e.x, e.y, e.h + 8, '사슬이 끊겼다 — 날뛴다!', '#ff7a5a', true); World.sparks(e.x, e.y - 10, 6, 12, '#c8c8d4', true); World.shake(2); Sfx.chest();
    }
    aiMove(e, dt, lv, p);
    if (e.bound) {  // 사슬 끝: 기둥 쪽으로 붙잡힘
      const dx = e.x - e.ax, dy = e.y - e.ay, dd = Math.hypot(dx, dy);
      if (dd > B.leash) { e.x = e.ax + dx / dd * B.leash; e.y = e.ay + dy / dd * B.leash; e.moving = false; }
    }
  }

  // ── 실패작(중간 보스) ──
  const HINT = {
    stitch: '봉합체 — 실밥은 큰 공격 뒤 틈(청록 빛)에만 끊어진다! 끊으면 실바늘이 다시 꿰매러 간다 — 닿기 전에 잡아라',
    brood: '배양 모체 — 등 뒤 청록 뚜껑을 깨면 낳기가 멈추고 드러난다! 몸은 천천히 돈다, 빙 돌아라',
    melt: '흘러내리는 자 — 녹아 흐르는 웅덩이는 빨아들이고 장판을 남긴다, 대시로 빠져나와라! 솟아오른 뒤 굳은(청록) 동안 쳐라',
    zero: '구속체 — 사슬이 끊길수록 채찍이 길어진다! 둘 이상 끊겼을 때 앞에서 가슴 자물쇠를 쳐 다시 묶으면 기절',
    eye: '관찰체 — 청록으로 빛나는 눈만 터뜨려라(다른 눈은 표식)! 바라보는 부채꼴 안에 오래 서 있어도 표식 — 셋이면 응시 광선',
  };
  function midInit(e, lv) {
    const d = e.def, k = d.lab;
    e.lInit = true; e.sweepCd = 1; e.exposeT = 0;
    if (k === 'stitch') e.stitches = d.stitch.n;
    if (k === 'brood') { e.lid = d.lid.hits; e.hatchT = 3; }
    if (k === 'melt') e.meltCd = 4;
    if (k === 'zero') { e.chainLv = 0; e.chainT = d.chains.every; e.lockHits = 0; e.lashCd = 2; }
    if (k === 'eye') { e.gazeA = Math.atan2(e.fv.y, e.fv.x); e.marks = new Map(); e.eyeA = 0; spawnEyes(e); }
    World.say(HINT[k], 3.4);
  }
  function midThink(e, dt, lv, p) {
    const d = e.def, k = d.lab;
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (!e.lInit) midInit(e, lv);
    if (p.dead) return;
    if (d.sweep && e.sweepCd <= 0 && groundDist(p.x - e.x, p.y - e.y) <= d.sweep.r + BODY_R) { faceTo(e, p); Sunken.sweep(e, false); return; }
    if (k === 'melt' && e.meltCd <= 0) {  // 웅덩이로 녹아듦
      e.state = 'meltSink'; e.t = d.melt.sink; e.under = true; e.kx = 0; e.ky = 0;
      World.text(e.x, e.y, e.h + 6, '녹아내린다…', ACID_HI); World.dust(e.x, e.y, 10); Sfx.spell();
      return;
    }
    if (k === 'zero' && e.lashCd <= 0) {
      const C = d.chains, len = C.len[e.chainLv], pd = Math.hypot(p.x - e.x, p.y - e.y);
      if (pd < len + 8 && Dungeon.los(lv, e.x, e.y - 4, p.x, p.y - 4)) {
        faceTo(e, p); e.chargeV = unit(p.x - e.x, p.y - e.y, e.fv); e.lashLen = len;
        e.state = 'lashWind'; e.t = e.windupT = C.wind[e.chainLv]; e.lashCd = C.cd[e.chainLv]; e.kx = 0; e.ky = 0;
        World.text(e.x, e.y, e.h + 8, '사슬 채찍!', '#ffd36a');
        sayOnce(e, 'lashSeen', '사슬 채찍 — 붉은 띠 옆으로 비켜라! 사슬이 끊길수록 길어진다', 2.4);
        return;
      }
    }
    if (k === 'brood') { broodBossThink(e, dt, lv, p); return; }
    bossThink(e, dt, lv, p);
  }
  // 배양 모체: 천천히 돎(등 뒤를 노릴 틈) — 공격은 지금 보는 쪽으로(내려찍기 · 탄은 사람 쪽)
  function broodBossThink(e, dt, lv, p) {
    const d = e.def, L = d.lid;
    e.moving = false; e.atkCd -= dt;
    turnTo(e, p, L.turn * dt);
    const pd = Math.hypot(p.x - e.x, p.y - e.y);
    if (e.atkCd <= 0) {
      const r = Math.random();
      if (pd < 46) { if (r < 0.55) { e.state = 'slam'; e.t = e.windupT = d.slam.windup; } else { e.state = 'windup'; e.t = e.windupT = d.atk.windup; } }
      else if (r < 0.45) { e.state = 'fan'; e.t = e.windupT = d.fan.windup; }
      else { e.state = 'chargeWind'; e.t = e.windupT = d.charge.windup; e.chargeV = { x: e.fv.x, y: e.fv.y }; }
      e.atkCd = (1.3 + Math.random() * 0.8) * (d.cdMul || 1);
      return;
    }
    if (pd > 30) {
      const u = unit(p.x - e.x, p.y - e.y, e.fv), step = d.speed * dt;
      mobMove(lv, e, u.x * step, u.y * step); e.moving = true; e.walkT += dt;
    }
  }
  // 관찰체 떠다니는 눈(부품): 차례로 하나만 빛남(lit)
  function spawnEyes(e) {
    const E = e.def.eyes;
    e.eyeN = E.n; e.litI = Math.floor(Math.random() * E.n); e.relitT = 0;
    for (let i = 0; i < E.n; i++) {
      const o = World.spawn('lab_eyeball', e.x, e.y, { spawn: true });
      o.hp = o.maxHp = 1; o.ri = e.ri; o.owner = e.id; o.idx = i; o.spawnT = 0.5;
    }
    eyePlace(e);
  }
  const eyesOf = e => World.enemies().filter(o => o.def.part === 'eye' && o.owner === e.id && live(o));
  function eyePlace(e) {
    const E = e.def.eyes;
    for (const o of eyesOf(e)) {
      const a = e.eyeA + o.idx / E.n * Math.PI * 2;
      o.x = e.x + Math.cos(a) * E.orbit; o.y = e.y + Math.sin(a) * E.orbit * GROUND_Y; o.z = 10;
    }
  }
  // 상태(enemy.js 가 모르는 것) — 처리했으면 true
  function state(e, dt, lv, p) {
    const d = e.def;
    switch (e.state) {
      case 'meltSink':  // 웅덩이로 녹아듦(안 맞음)
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'melted'; e.t = d.melt.under; }
        return true;
      case 'melted': {  // 웅덩이째 노리는 사람 쪽으로 흘러옴(안 맞음)
        const M = d.melt;
        e.t -= dt; e.moving = true; e.walkT += dt;
        if (!p.dead) { const u = unit(p.x - e.x, p.y - e.y, e.fv); mobMove(lv, e, u.x * M.flow * dt, u.y * M.flow * dt); }
        if (Math.random() < dt * 8) World.sparks(e.x + (Math.random() - 0.5) * 20, e.y, 2, 1, ACID_HI, false);
        e.poolT = (e.poolT || 0) - dt;
        const hurtNow = e.poolT <= 0;
        if (hurtNow) e.poolT = M.pool.every;
        for (const t of peopleOf()) {  // 빨아들이기(대시 중엔 안 끌림) · 웅덩이 몸 위면 피해(그림 = 판정 — 바닥 타원 pool.r)
          if (World.roomOf(t) !== e.ri) continue;
          const gd = groundDist(t.x - e.x, t.y - e.y);
          if (gd <= M.pull.r && gd > 3 && t.state !== 'dodge') { const u = unit(e.x - t.x, e.y - t.y, { x: 0, y: 0 }); Dungeon.move(lv, t, u.x * M.pull.speed * dt, u.y * M.pull.speed * dt, BODY_R); }
          if (hurtNow && gd <= M.pool.r + BODY_R) hurtPlayer(t, { x: e.x, y: e.y + 1, disarmT: e.disarmT, disarmCut: e.disarmCut }, d.slam.dmg * e.dmgMul * M.pool.dmg, 0);
        }
        if ((e.trailT = (e.trailT || 0) - dt) <= 0) {  // 지나간 자리 약물 장판
          e.trailT = M.trail.every;
          (lv.labTrail || (lv.labTrail = [])).push({ x: e.x, y: e.y, r: M.trail.r, t: M.trail.life, life: M.trail.life, ri: e.ri, dmg: d.slam.dmg * e.dmgMul * M.trail.dmg });
        }
        if (e.t <= 0) { e.state = 'meltRise'; e.t = e.windupT = d.melt.rise; e.lx = p.x; e.ly = p.y; Sfx.spell(); }
        return true;
      }
      case 'meltRise': {  // 바닥 예고(판정 r) — 앞 follow 몫은 노리는 사람을 따라감 → 그 자리에서 솟아 굳음
        const M = d.melt;
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t > e.windupT * (1 - M.follow) && !p.dead) { e.lx = p.x; e.ly = p.y; }
        if (e.t <= 0) {
          if (Dungeon.walkable(lv, e.lx, e.ly, e.r)) { e.x = e.lx; e.y = e.ly; }
          e.under = false;
          World.shake(5); World.dust(e.x, e.y, 14); Sfx.blast();
          World.fx({ type: 'nova', x: e.x, y: e.y, r: M.r, col: ACID, el: '', tier: 0, bare: true, seed: Math.random() * 1000, t: 0, life: 0.35 });
          for (const t of peopleOf()) if (groundDist(t.x - e.x, t.y - e.y) <= M.r + BODY_R) hurtPlayer(t, e, d.slam.dmg * e.dmgMul * M.dmg, 220);
          e.state = 'hardened'; e.t = M.hard; e.meltCd = M.every;
          World.text(e.x, e.y, e.h + 10, '굳었다 — 지금!', TEAL, true);
        }
        return true;
      }
      case 'hardened':  // 굳음(청록) — 제대로 맞음, 안 움직임
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'move'; e.atkCd = 0.5; World.text(e.x, e.y, e.h + 6, '다시 물렁해졌다', '#c8d0b8'); }
        return true;
      case 'lashWind':
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) {
          e.state = 'lash'; e.t = 0.18; World.shake(4); Sfx.dash();
          const C = d.chains;
          for (const t of peopleOf()) if (inBand(e, t, e.lashLen, C.w)) hurtPlayer(t, e, d.slam.dmg * e.dmgMul * C.dmg, C.knock);
        }
        return true;
      case 'lash':
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'recover'; e.t = 0.6; }
        return true;
      case 'labDown':  // 다시 묶임(구속체) · 유리병이 깨짐(관찰체) — 기절, 더 아프게 맞음
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'move'; e.atkCd = 0.6; if (d.lab === 'eye') { spawnEyes(e); World.text(e.x, e.y, e.h + 8, '눈이 다시 떠올랐다', '#ffe066'); } }
        return true;
      case 'gazeWind':  // 응시 광선 준비(눈이 붉게) → 표식이 가득 찬 사람에게(못 피함)
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) {
          const G = d.gaze;
          for (const t of peopleOf()) {
            if ((e.marks.get(t) || 0) < G.max) continue;
            e.marks.set(t, 0); t.labMarks = 0;
            World.fx({ type: 'shock', x: t.x, y: t.y, r: 14, t: 0, life: 0.35 });
            World.sparks(t.x, t.y, 16, 16, '#ffe066', true);
            hurtPlayer(t, { x: e.x, y: e.y, pct: G.pct, unavoid: true }, 0, 160);
            e.beam = { x: t.x, y: t.y, t: 0.25 };
          }
          World.shake(6); Sfx.blast();
          e.state = 'recover'; e.t = 0.6;
        }
        return true;
      case 'fleshWind': {  // 분열의 어미 살덩이 내려찍기: 노리는 사람 발밑 원(판정 r) — 앞 follow 몫은 따라감
        const F = BR().flesh;
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t > e.windupT * (1 - F.follow) && !p.dead) { e.lx = p.x; e.ly = p.y; }
        if (e.t <= 0) {
          World.shake(6); World.dust(e.lx, e.ly, 14); Sfx.stone();
          World.fx({ type: 'shock', x: e.lx, y: e.ly, r: F.r, t: 0, life: 0.3 });
          for (const t of peopleOf()) if (groundDist(t.x - e.lx, t.y - e.ly) <= F.r + BODY_R) hurtPlayer(t, { x: e.lx, y: e.ly + 1, disarmT: e.disarmT, disarmCut: e.disarmCut }, d.slam.dmg * e.dmgMul * F.dmg, 200);
          e.state = 'recover'; e.t = 0.6;
        }
        return true;
      }
      case 'spitWind':  // 새끼 뱉기: 분열체(졸개 — 드롭 없음)
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) {
          const S = BR().spit;
          for (let k = 0; k < S.n; k++) {
            const a = Math.atan2(p.y - e.y, p.x - e.x) + (k - (S.n - 1) / 2) * 0.6;
            const c = World.spawn('splitter', e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 10, { spawn: true });
            c.minion = true; c.ri = e.ri; c.spawnT = 0.35; c.kx = Math.cos(a) * 160; c.ky = Math.sin(a) * 120;
            if (!Dungeon.walkable(World.level, c.x, c.y, c.r)) { c.x = e.x; c.y = e.y + 6; }
          }
          World.text(e.x, e.y, e.h + 8, '새끼를 뱉었다!', '#ff7ab0'); World.sparks(e.x, e.y, e.h * 0.5, 12, '#c8306a', true); Sfx.spell();
          e.state = 'recover'; e.t = 0.6;
        }
        return true;
      case 'phaseShift':
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (e.t <= 0) { e.state = 'move'; e.atkCd = 1; }
        return true;
    }
    return false;
  }
  // 바닥 띠 안인지(판정 = 그림): 몸에서 chargeV 쪽 0 ~ len, 옆으로 w
  function inBand(e, t, len, w) {
    const v = e.chargeV, dx = t.x - e.x, dy = t.y - e.y, along = dx * v.x + dy * v.y, side = Math.abs(dx * v.y - dy * v.x);
    return along >= -BODY_R && along <= len + BODY_R && side <= w + BODY_R;
  }

  // ── 피해 배율(Sunken.cut 맨 앞에서 부름 — combat.js · elements.js · paladin.js · 출혈) ── { m, s, armor } · null = 그대로 · undefined = 실험장 것 아님
  const OPEN_STATES = ['recover', 'tired'];
  function cut(e, src) {
    const d = e.def;
    if (d.brood || d.part === 'twin') return bodyCut(e);
    if (d.part === 'tank') { if (src) tankHit(e); return { m: 0, s: '', armor: true }; }
    if (d.part === 'eye') return eyeballCut(e, src);
    if (d.part === 'needle') return { m: 1e-9, s: '', armor: true };  // 실바늘: 한 대에 1씩(hp 대)
    if (!d.lab) return undefined;
    const k = d.lab;
    if (k === 'stitch') {
      if (e.exposeT > 0) return { m: d.stitch.mul, s: '' };
      if (e.stitches > 0 && src && stitchOpen(e) && !(e.stitchT > now())) {
        e.stitchT = now() + d.stitch.gap; e.stitches--;
        World.sparks(e.x, e.y, e.h * 0.55, 12, TEAL, true); Sfx.stone();
        flingNeedle(e, src);
        World.text(e.x, e.y, e.h + 10, e.stitches ? '실밥이 끊어졌다! (남은 ' + e.stitches + ')' : '실밥이 다 끊어졌다 — 실바늘을 잡아라!', TEAL, !e.stitches);
        sayOnce(e, 'needleSeen', '실바늘이 다시 꿰매러 간다 — 봉합체에 닿기 전에 잡아라!', 2.6);
      }
      return { m: d.stitch.cut, s: e.stitches > 0 ? (stitchOpen(e) ? '' : '실밥') : needlesOf(e).length ? '실바늘이 남았다' : '꿰매는 중', armor: true };  // 드러남이 끝나고 다시 꿰매기까지도 단단함
    }
    if (k === 'brood') {
      const L = d.lid;
      if (e.exposeT > 0) return { m: L.mul, s: '' };
      if (e.lid > 0) {
        if (src && dot(e, src) < -L.cone && !(e.lidT > now())) {
          e.lidT = now() + 0.18; e.lid--;
          World.sparks(e.x - e.fv.x * 10, e.y, e.h * 0.85, 10, TEAL, true); Sfx.stone();
          if (!e.lid) { e.exposeT = L.expose; World.text(e.x, e.y, e.h + 12, '뚜껑이 깨졌다 — 낳기가 멈췄다!', TEAL, true); World.shake(4); Sfx.chest(); return { m: L.mul, s: '' }; }
          World.text(e.x, e.y, e.h + 12, '뚜껑 ' + e.lid, TEAL);
          return { m: L.cut, s: '', armor: true };
        }
        return { m: L.cut, s: '단단하다', armor: true };
      }
      return { m: L.cut, s: '뚜껑이 다시 자란다', armor: true };
    }
    if (k === 'melt') {
      if (e.state === 'hardened') return { m: d.melt.mul, s: '' };
      return { m: d.melt.soft, s: '물렁', armor: true };
    }
    if (k === 'zero') {
      const C = d.chains, L = d.lock;
      if (e.state === 'labDown') return { m: L.mul, s: '' };
      if (src && e.chainLv > 0 && dot(e, src) > L.cone && !(e.lockT > now())) {
        e.lockT = now() + 0.2;
        if (++e.lockHits >= L.hits) {
          const lvBroke = e.chainLv;
          e.lockHits = 0; e.chainLv = 0; e.chainT = C.every;
          if (lvBroke >= L.stunAt) {  // 크게 풀렸을 때 다시 묶으면 기절(딜 타임)
            e.state = 'labDown'; e.t = L.bind[lvBroke]; e.kx = 0; e.ky = 0;
            World.text(e.x, e.y, e.h + 12, '다시 묶였다 — 기절!', TEAL, true); World.shake(5); Sfx.chest();
            return { m: L.mul, s: '' };
          }
          World.text(e.x, e.y, e.h + 12, '다시 묶었다', '#c8d0b8'); World.sparks(e.x, e.y - e.h * 0.5, 6, 10, '#c8c8d4', true); Sfx.stone();
          sayOnce(e, 'lockSeen', '사슬이 ' + L.stunAt + '개 넘게 끊겼을 때 묶어야 기절한다 — 버틸수록 위험하지만 딜 타임이 생긴다', 3);
        }
        World.sparks(e.x + e.fv.x * 6, e.y, e.h * 0.5, 8, TEAL, true);
        World.text(e.x, e.y, e.h + 12, '자물쇠 ' + e.lockHits + '/' + L.hits, TEAL);
      }
      return { m: C.cut, s: '', armor: true };
    }
    if (k === 'eye') {
      if (e.state === 'labDown') return { m: d.eyes.mul, s: '' };
      if (eyesOf(e).length) return { m: 0, s: '유리병이 막는다', armor: true };
      return null;
    }
    return null;
  }
  // 봉합체: 실밥이 끊기는 틈 = 큰 공격(내려찍기 · 후려치기 · 돌진) 뒤 회복 · 기둥 기절(bigRec — update 가 상태 바뀜을 보고 정함)
  const stitchOpen = e => e.state === 'tired' || (e.state === 'recover' && !!e.bigRec);
  const needlesOf = e => World.enemies().filter(o => o.def.part === 'needle' && o.owner === e.id && live(o));
  // 실바늘: 끊은 사람 반대쪽(없으면 아무 쪽)으로 fling 만큼 튀어나감 — 걸을 수 있는 자리
  function flingNeedle(e, src) {
    const N = e.def.needle, lv = World.level;
    const a0 = src ? Math.atan2(e.y - src.y, e.x - src.x) : Math.random() * Math.PI * 2;
    let x = e.x, y = e.y;
    for (let i = 0; i < 12; i++) {
      const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5, nx = e.x + Math.cos(a) * N.fling, ny = e.y + Math.sin(a) * N.fling * 0.7;
      if (Dungeon.walkable(lv, nx, ny, 5) && Dungeon.roomIdx(lv, nx, ny) === e.ri) { x = nx; y = ny; break; }
    }
    const o = World.spawn('lab_needle', x, y, { spawn: true });
    o.hp = o.maxHp = N.hp; o.ri = e.ri; o.owner = e.id; o.spawnT = 0.35;
    World.sparks(x, y, 6, 8, '#c8c8d4', true);
  }
  // 관찰체 눈: 빛나는 하나만 터짐(1대) — 다른 눈을 치면 친 사람에게 표식
  function eyeballCut(e, src) {
    const o = World.enemies().find(m => m.id === e.owner);
    if (!o || e.idx === o.litI) return { m: 1e-9, s: '', armor: true };
    if (src && !(src.eyeT > now())) { src.eyeT = now() + 0.5; addMark(o, src, 1); World.text(src.x, src.y, 40, '빛나는 눈부터!', '#ffe066'); }
    return { m: 0, s: '', armor: true };
  }
  function addMark(o, t, n) {
    const G = o.def.gaze, v = Math.min(G.max, (o.marks.get(t) || 0) + n);
    o.marks.set(t, v); t.labMarks = v; t.markOut = 0;
    World.text(t.x, t.y, 44, '표식 ' + v + '/' + G.max, '#ffe066');
  }

  // ── 쓰러짐(world.js onKill 맨 앞) — 쓰러지지 않고 이어지면 true ──
  function onKill(e) {
    const d = e.def;
    if (d.graft) {  // 접붙인 마물: 붙어 있던 조각이 떨어져 기어 옴(졸개)
      for (let k = 0; k < d.graft.n; k++) {
        const a = Math.random() * Math.PI * 2, c = World.spawn(d.graft.type, e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 4, { spawn: true });
        c.minion = true; c.ri = e.ri; c.spawnT = 0.3; c.kx = Math.cos(a) * 130; c.ky = Math.sin(a) * 100; c.atkCd = 0.6;
      }
      World.text(e.x, e.y, e.h + 6, '조각이 떨어져 나왔다!', '#ff7ab0'); World.sparks(e.x, e.y, 8, 10, '#b47a72', true);
    }
    if (d.burst) World.field({ blast: true, acidBlast: true, x: e.x, y: e.y, r: d.burst.r, delay: d.burst.delay, life: d.burst.delay + 0.3, dmg: d.atk.dmg * e.dmgMul * d.burst.dmg, tick: 99 });  // 폭주체: 예고 원 = 판정
    return false;
  }
  function partDied(e) {
    const d = e.def;
    if (d.part === 'eye') {
      World.sparks(e.x, e.y, 12, 12, '#ffe066', true); Sfx.stone();
      const o = World.enemies().find(m => m.id === e.owner);
      if (!o || !live(o)) return;
      const left = eyesOf(o).filter(m => m !== e);
      if (!left.length) {
        o.state = 'labDown'; o.t = o.def.eyes.expose; o.kx = 0; o.ky = 0;
        World.text(o.x, o.y, o.h + 12, '유리병이 깨졌다 — 지금!', TEAL, true); World.shake(5); Sfx.chest();
      } else { o.litI = -1; o.relitT = o.def.eyes.relight; o.nextEyes = left.map(m => m.idx); }  // 잠깐 뒤 남은 눈 중 하나가 빛남(eyeTick)
    }
    if (d.part === 'twin') { const m = motherOf(); if (m && live(m) && pool && pool.hp <= 0) killMother(m); }
    if (d.part === 'needle') { World.sparks(e.x, e.y, 6, 10, '#c8c8d4', true); Sfx.stone(); World.text(e.x, e.y, 24, '실바늘을 잡았다!', TEAL); }
  }
  // 실험장 부품(enemy.js updateEnemy): 눈 = 관찰체 둘레를 돎 · 복제체 = 따로 움직임 · 배양조 = 다시 차기
  function part(e, dt, lv, p) {
    e.walkT += dt;
    if (e.def.part === 'twin') { twinTick(e, dt, lv, p); return; }
    e.kx = 0; e.ky = 0;
    if (e.spawnT > 0) e.spawnT -= dt;  // 솟는 중(부품은 enemy.js 가 안 줄여 줌)
    if (e.def.part === 'eye') {
      const o = World.enemies().find(m => m.id === e.owner);
      if (!o || !live(o)) { e.dying = true; e.hp = 0; e.state = 'dead'; e.t = 0.6; }
      return;
    }
    if (e.def.part === 'needle') {  // 봉합체에게 기어가 닿으면 실밥 하나를 다시 꿰맴
      const o = World.enemies().find(m => m.id === e.owner);
      if (!o || !live(o) || o.exposeT > 0) { e.dying = true; e.hp = 0; e.state = 'dead'; e.t = 0.6; return; }
      if (e.spawnT > 0) return;
      const dx = o.x - e.x, dy = o.y - e.y, dd = Math.max(1, Math.hypot(dx, dy));
      e.fv = unit(dx, dy, e.fv); e.moving = true;
      Dungeon.move(lv, e, dx / dd * e.def.speed * dt, dy / dd * e.def.speed * dt, e.r);
      if (dd < o.r + e.r + 2) {
        o.stitches = Math.min(o.def.stitch.n, (o.stitches || 0) + 1);
        World.text(o.x, o.y, o.h + 10, '실바늘이 실밥을 다시 꿰맸다!', '#ff9a6a', true); World.sparks(o.x, o.y, o.h * 0.55, 10, TEAL, true); Sfx.spell();
        e.dying = true; e.hp = 0; e.state = 'dead'; e.t = 0.6;
      }
      return;
    }
    if (e.def.part === 'tank' && e.broken && (e.refillT -= dt) <= 0) {
      e.broken = false; e.hits = 0;
      World.text(e.x, e.y, 30, RC[e.col][3] + ' 배양조가 다시 찼다', RC[e.col][0]); World.sparks(e.x, e.y, 10, 10, RC[e.col][0], true);
    }
  }

  // ── 방 전체(world.js update — 방장 · 혼자) ──
  function update(dt, lv) {
    for (const e of World.enemies()) {
      if (!e.def.lab || !e.lInit || !live(e)) continue;
      const d = e.def, k = d.lab;
      if (e.sweepCd > 0) e.sweepCd -= dt;
      if (k === 'stitch') {  // 틈 판정: 큰 공격(내려찍기 · 후려치기 · 돌진)이 끝나 회복으로 넘어갔는지
        if (e.state !== e.prevSt) { if (e.state === 'recover') e.bigRec = ['slam', 'sweep', 'charge'].includes(e.prevSt); e.prevSt = e.state; }
        if (e.stitches === 0 && !(e.exposeT > 0) && !(e.restitchT > 0) && !needlesOf(e).length) {  // 실밥도 실바늘도 없음 → 드러남
          e.exposeT = d.stitch.expose; World.text(e.x, e.y, e.h + 10, '몸이 벌어졌다 — 지금!', TEAL, true); World.say('지금 쳐라!', 1.6); World.shake(4); Sfx.chest();
        }
      }
      if (e.exposeT > 0 && (e.exposeT -= dt) <= 0) {
        if (k === 'stitch') e.restitchT = d.stitch.restitch;
        if (k === 'brood') e.regrowT = d.lid.regrow;
      }
      if (e.restitchT > 0 && (e.restitchT -= dt) <= 0) { e.stitches = d.stitch.n; World.text(e.x, e.y, e.h + 8, '다시 꿰맸다!', '#c8d0b8'); World.sparks(e.x, e.y, e.h * 0.5, 10, TEAL, true); }
      if (e.regrowT > 0 && (e.regrowT -= dt) <= 0) { e.lid = d.lid.hits; World.text(e.x, e.y, e.h + 8, '뚜껑이 다시 닫혔다', '#c8d0b8'); }
      if (k === 'melt' && e.meltCd > 0 && e.state !== 'hardened') e.meltCd -= dt;
      if (k === 'zero') {
        if (e.lashCd > 0) e.lashCd -= dt;
        if (e.state !== 'labDown' && e.chainLv < d.chains.max && (e.chainT -= dt) <= 0) {
          e.chainLv++; e.chainT = d.chains.every; e.lockHits = 0;
          World.text(e.x, e.y, e.h + 12, e.chainLv >= d.chains.max ? '사슬이 다 끊어졌다!' : '사슬이 끊어졌다! (' + e.chainLv + '/' + d.chains.max + ')', '#ff7a5a', true);
          World.sparks(e.x, e.y - e.h * 0.6, 6, 14, '#c8c8d4', true); World.shake(3); Sfx.roar();
          if (e.chainLv === d.lock.stunAt) World.say('지금이다 — 앞에서 가슴 자물쇠를 ' + d.lock.hits + '대 쳐서 다시 묶으면 기절!', 2.6);  // 2026-11-08 사용자: 딜 타임이 언제 열리는지 보이게
        }
      }
      if (k === 'brood' && !(e.exposeT > 0) && e.state !== 'dead' && (e.hatchT -= dt) <= 0) {  // 배양조에서 실험체(뚜껑이 깨진 동안은 멈춤)
        const B = d.nest;
        e.hatchT = B.every;
        const n = World.enemies().filter(m => m.minion && m.type === B.type && live(m) && m.ri === e.ri).length;
        for (let i = 0; i < Math.min(B.n, B.max - n); i++) {
          const a = Math.random() * Math.PI * 2, c = World.spawn(B.type, e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 10, { spawn: true });
          c.minion = true; c.ri = e.ri; c.spawnT = 0.5;
          if (!Dungeon.walkable(lv, c.x, c.y, c.r)) { c.x = e.x; c.y = e.y + 6; }
        }
        if (n < B.max) { World.text(e.x, e.y, e.h + 10, '배양조가 실험체를 낳는다!', ACID_HI); World.sparks(e.x, e.y - e.h * 0.8, 6, 10, ACID_HI, true); Sfx.spell(); }
      }
      if (k === 'eye') eyeTick(e, dt);
    }
    if (lv.labTrail && lv.labTrail.length) {  // 흘러내리는 자가 지나간 약물 장판: 위에 있으면 0.5초마다 피해(그림 = 판정, 바닥 타원 r)
      for (const w of lv.labTrail) w.t -= dt;
      lv.labTrail = lv.labTrail.filter(w => w.t > 0);
      for (const t of peopleOf()) {
        if (t.trailHurtT > World.time) continue;
        const w = lv.labTrail.find(o => o.ri === World.roomOf(t) && groundDist(t.x - o.x, t.y - o.y) <= o.r + BODY_R * 0.5);
        if (w && hurtPlayer(t, { x: t.x, y: t.y + 1, hazard: true }, w.dmg, 0) !== 'miss') t.trailHurtT = World.time + 0.5;
      }
    }
    const m = motherOf();
    if (m && m.lInit && live(m)) broodUpdate(dt, lv, m);
  }
  // 관찰체: 눈이 둘레를 돎 · 부채꼴 응시(천천히 사람 쪽으로 돎) — 안에 hold 초 서 있으면 표식, 밖에 decay 초면 하나씩 사라짐
  function eyeTick(e, dt) {
    const G = e.def.gaze, E = e.def.eyes;
    e.eyeA += E.spin * dt;
    eyePlace(e);
    if (e.litI === -1 && (e.relitT -= dt) <= 0) {  // 다음 눈이 빛남(무작위)
      const left = eyesOf(e).map(m => m.idx);
      if (left.length) { e.litI = left[Math.floor(Math.random() * left.length)]; const o = eyesOf(e).find(m => m.idx === e.litI); if (o) World.text(o.x, o.y, 26, '빛났다!', TEAL); }
    }
    if (e.state === 'move' && peopleOf().some(t => (e.marks.get(t) || 0) >= G.max)) { e.state = 'gazeWind'; e.t = e.windupT = 0.7; World.text(e.x, e.y, e.h + 10, '응시!', '#ff6a5a', true); Sfx.spell(); }
    if (e.state === 'labDown' || e.spawnT > 0) return;
    const p = e.tgt || World.player;
    if (p && !p.dead) {
      const want = Math.atan2((p.y - e.y) / GROUND_Y, p.x - e.x), da = Math.atan2(Math.sin(want - e.gazeA), Math.cos(want - e.gazeA));
      e.gazeA += Math.max(-G.turn * dt, Math.min(G.turn * dt, da));
    }
    for (const t of peopleOf()) {
      if (World.roomOf(t) !== e.ri) continue;
      if (inGaze(e, t)) {
        t.markOut = 0;
        if ((t.gazeIn = (t.gazeIn || 0) + dt) >= G.hold) { t.gazeIn = 0; addMark(e, t, 1); }
      } else {
        t.gazeIn = 0;
        if ((e.marks.get(t) || 0) > 0 && (t.markOut = (t.markOut || 0) + dt) >= G.decay) { t.markOut = 0; const v = e.marks.get(t) - 1; e.marks.set(t, v); t.labMarks = v; }
      }
    }
    if (e.beam && (e.beam.t -= dt) <= 0) e.beam = null;
  }
  function inGaze(e, t) {
    const G = e.def.gaze, dx = t.x - e.x, dy = (t.y - e.y) / GROUND_Y, dd = Math.hypot(dx, dy);
    if (dd > G.r || dd < 4) return false;
    const a = Math.atan2(dy, dx);
    return Math.abs(Math.atan2(Math.sin(a - e.gazeA), Math.cos(a - e.gazeA))) <= G.arc / 2 * Math.PI / 180;
  }

  // ══ 최종 보스 '분열의 어미' ══
  // 몸(본체 · 복제체)마다 색 b.col(0 붉은 ● · 1 푸른 ▲ · 2 노란 ■). 체력은 하나(pool) — 몸마다 hp 를 pool 로 잇는다(Object.defineProperty)
  let BRc = null;
  const BR = () => BRc || (BRc = raidRule(3));
  let pool = null, B = null, motherId = 0;
  const motherOf = () => World.enemies().find(e => e.def.brood && live(e)) || null;
  const bodiesOf = () => World.enemies().filter(e => (e.def.brood || e.def.part === 'twin') && live(e));
  function bindPool(e) {
    Object.defineProperty(e, 'hp', { get: () => (pool ? pool.hp : 0), set: v => setPool(v), configurable: true, enumerable: true });
    Object.defineProperty(e, 'maxHp', { get: () => (pool ? pool.max : 1), set: () => {}, configurable: true, enumerable: true });
  }
  function setPool(v) {
    if (!pool) return;
    let nv = Math.min(pool.max, v);
    if (B && nv < pool.hp) {
      if (B.res && nv <= B.res.floor) { nv = B.res.floor; brace(); }
      const thr = B.phase <= BR().phases.length ? BR().phases[B.phase - 1] * pool.max : 0;
      if (thr && nv <= thr) { nv = thr; pool.hp = nv; phaseUp(); return; }
    }
    pool.hp = Math.max(0, nv);
  }
  function broodInit(m, lv) {
    const R = BR();
    m.lInit = true; motherId = m.id;
    pool = { hp: m.hp, max: m.maxHp };
    bindPool(m);
    m.col = 0;
    B = { phase: 1, nextT: R.every[0], warned: false, res: null, since: 0, gapT: 0, floodT: R.flood.first, flood: null, pools: [] };
    spawnTwin(m, lv, 1);
    const r = lv.boss;
    [[r.x + 3, r.cy], [r.x + r.w - 4, r.cy], [r.cx, r.y + 2]].forEach(([x, y], c) => {
      const t = World.spawn('lab_tank', x * T + 8, y * T + 12, { spawn: true });
      t.col = c; t.ri = m.ri; t.hits = 0; t.broken = false;
    });
    World.say('분열의 어미 — 몸들의 색이 같을 때(공명)만 피해가 들어간다! 다른 색 몸을 치면 회복된다', 4.5);
  }
  function spawnTwin(m, lv, col) {
    const a = Math.random() * Math.PI * 2, t = World.spawn('lab_twin', m.x + Math.cos(a) * 40, m.y + Math.sin(a) * 26, { spawn: true });
    if (!Dungeon.walkable(lv, t.x, t.y, t.r)) { t.x = m.x; t.y = m.y + 20; }
    t.ri = m.ri; t.dmgMul = m.dmgMul; t.col = col; t.atkCd = 1.5; t.armorCut = m.armorCut;
    bindPool(t);
    World.sparks(t.x, t.y, 10, 14, '#c8306a', true); World.dust(t.x, t.y, 10);
    return t;
  }
  function killMother(m) {
    if (!live(m)) return;
    m.dying = true; m.state = 'dead'; m.t = 0;
    World.onKill(m);
  }
  // 공명 시작 · 끝 · 버팀 · 단계
  function startRes(col, n) {
    const R = BR(), big = n >= 3;
    B.res = { col, t: R.deal, floor: pool.hp - pool.max * R.cap * (big ? R.bigCap : 1), big, braced: false };
    B.since = 0;
    const m = motherOf();
    if (m) World.text(m.x, m.y, m.h + 16, (big ? '큰 공명! ' : '공명! ') + RC[col][2], RC[col][0], true);
    World.say((big ? '큰 공명 — ' : '공명 — ') + RC[col][3] + ' ' + RC[col][2] + ' 몸을 쳐라! 다른 색을 치면 회복된다', 2.4);
    Sfx.chest(); World.shake(3);
  }
  function endRes(quiet) {
    if (!B || !B.res) return;
    B.res = null; B.gapT = BR().gap;
    rerollNow(false);
    B.nextT = BR().every[B.phase - 1]; B.warned = false;
    if (!quiet) { const m = motherOf(); if (m) World.text(m.x, m.y, m.h + 14, '다시 이어졌다', '#c8c8d4'); }
  }
  function brace() {
    if (!B.res || B.res.braced) return;
    B.res.braced = true; B.res.t = Math.min(B.res.t, 0.7);
    const m = motherOf();
    if (m) World.text(m.x, m.y, m.h + 16, '버팀!', '#ffffff', true);
    Sfx.stone();
  }
  function phaseUp() {
    const R = BR(), m = motherOf();
    B.phase++;
    endRes(true);
    if (!m) return;
    m.state = 'phaseShift'; m.t = m.windupT = R.shift; m.kx = 0; m.ky = 0;
    World.shake(7); World.dust(m.x, m.y, 18); Sfx.roar();
    const W = R.wave;
    World.field({ wave: true, x: m.x, y: m.y, delay: W.delay, speed: W.speed, w: W.w, pct: W.pct, tick: 99, life: W.delay + W.maxR / W.speed });
    if (B.phase === 2) {
      const used = bodiesOf().map(b => b.col), col = [0, 1, 2].find(c => !used.includes(c));
      spawnTwin(m, World.level, col === undefined ? 2 : col);
      World.text(m.x, m.y, m.h + 20, '분열!', '#ff7ab0', true);
      World.say('분열 — 복제체가 하나 더! 짝이 없는 몸은 폭주한다', 3);
    }
    if (B.phase === 3) { B.floodT = 4; World.text(m.x, m.y, m.h + 20, '약물이 끓어오른다!', ACID_HI, true); World.say('약물 범람이 시작된다 — 색이 더 자주 바뀐다!', 3); }
  }
  // 색 다시 고르기: want = 둘을 같은 색으로(공명 기회). 웅덩이에 고정된 몸(lockT)은 그대로
  function pickNext(force) {
    const R = BR(), bodies = bodiesOf(), free = shuffle(bodies.filter(b => !(b.lockT > 0)));
    if (!free.length) return;
    const want = force === true || (force !== false && (Math.random() < R.match || B.since >= R.force));
    if (want) {
      const locked = bodies.find(b => b.lockT > 0), c = locked ? locked.col : Math.floor(Math.random() * 3);
      let have = bodies.filter(b => b.lockT > 0 && b.col === c).length;
      for (const b of free) {
        if (have < 2) { b.next = c; have++; continue; }
        const used = new Set([c, ...bodies.filter(o => o !== b && o.next !== undefined).map(o => o.next)]);
        b.next = pickOf([0, 1, 2].filter(x => !used.has(x)).concat([0, 1, 2].filter(x => x !== c)).slice(0, 1));
      }
    } else {
      const used = new Set(bodies.filter(b => b.lockT > 0).map(b => b.col));
      for (const b of free) { const opts = [0, 1, 2].filter(x => !used.has(x)); b.next = opts.length ? pickOf(opts) : pickOf([0, 1, 2]); used.add(b.next); }
    }
  }
  function applyNext() { for (const b of bodiesOf()) if (b.next !== undefined) { if (!(b.lockT > 0)) b.col = b.next; b.next = undefined; } }
  function rerollNow(want) { pickNext(want); applyNext(); }
  function groups() {
    const n = [0, 0, 0];
    for (const b of bodiesOf()) if (!(b.spawnT > 0)) n[b.col]++;
    return n;
  }
  function broodUpdate(dt, lv, m) {
    const R = BR();
    B.since += dt;
    if (B.gapT > 0) B.gapT -= dt;
    const bodies = bodiesOf();
    for (const b of bodies) if (b.lockT > 0) b.lockT -= dt;
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {  // 몸끼리 겹치지 않게(부품이라 enemy.js 밀어내기에서 빠짐)
      const a = bodies[i], b = bodies[j], dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy), min = a.r + b.r;
      if (dd < min && dd > 0.01) { const k = (min - dd) * 0.5; if (!a.def.brood) Dungeon.move(lv, a, -dx / dd * k, -dy / dd * k, a.r); Dungeon.move(lv, b, dx / dd * k, dy / dd * k, b.r); }
    }
    // 약물 웅덩이: 들어간 몸은 그 색으로 고정
    for (const w of B.pools) {
      w.t -= dt;
      for (const b of bodies) if (groundDist(b.x - w.x, b.y - w.y) <= w.r && !(B.flood && B.flood.on)) {
        if (b.col !== w.col) { b.col = w.col; World.text(b.x, b.y, b.h + 6, RC[w.col][2], RC[w.col][0]); World.sparks(b.x, b.y, 6, 6, RC[w.col][0], true); }
        b.lockT = R.tank.lock; b.next = undefined;
      }
    }
    B.pools = B.pools.filter(w => w.t > 0);
    // 약물 범람(3단계): 예고 → 모든 몸이 한 색(큰 공명) · 깨끗한 발판 밖은 아픔
    if (B.phase >= 3 && m.state !== 'phaseShift') {
      const F = R.flood;
      if (!B.flood && !B.res && (B.floodT -= dt) <= 0) {
        const r = lv.boss, pads = [];
        for (let i = 0; i < F.pads; i++) for (let tries = 0; tries < 40; tries++) {
          const x = (r.x + 4 + Math.random() * (r.w - 8)) * T, y = (r.y + 4 + Math.random() * (r.h - 8)) * T;
          if (pads.every(q => Math.hypot(q.x - x, q.y - y) > F.padR * 3)) { pads.push({ x, y }); break; }
        }
        B.flood = { col: Math.floor(Math.random() * 3), warn: F.warn, t: F.t, pads, on: false, tick: 0 };
        World.text(m.x, m.y, m.h + 18, '약물 범람!', ACID_HI, true); World.say('약물 범람 — 깨끗한 발판(흰 고리) 위로! 모든 몸이 한 색이 된다', 3); Sfx.roar(); World.shake(4);
      }
      const fl = B.flood;
      if (fl) {
        if (!fl.on && (fl.warn -= dt) <= 0) { fl.on = true; for (const b of bodies) { b.col = fl.col; b.lockT = fl.t; b.next = undefined; } Sfx.blast(); World.shake(5); }
        if (fl.on) {
          for (const b of bodies) { b.col = fl.col; b.lockT = Math.max(b.lockT || 0, 0.2); }
          if ((fl.tick -= dt) <= 0) {
            fl.tick = 0.5;
            for (const t of peopleOf()) if (!fl.pads.some(q => groundDist(t.x - q.x, t.y - q.y) <= F.padR)) { hurtPlayer(t, { x: t.x, y: t.y + 1, pct: F.pct, unavoid: true, hazard: true }, 0, 0); World.sparks(t.x, t.y, 4, 4, ACID_HI, false); }
          }
          if ((fl.t -= dt) <= 0) { B.flood = null; B.floodT = F.every; for (const b of bodies) b.lockT = 0; if (B.res) endRes(); else rerollNow(false); }
        }
      }
    }
    // 공명 중
    if (B.res) {
      const n = groups()[B.res.col];
      if (n < 2) endRes();
      else {
        if (n >= 3 && !B.res.big) { B.res.big = true; B.res.floor -= pool.max * R.cap * (R.bigCap - 1); World.text(m.x, m.y, m.h + 18, '큰 공명!', RC[B.res.col][0], true); Sfx.chest(); }
        if ((B.res.t -= dt) <= 0) endRes();
      }
      return;
    }
    if (m.state === 'phaseShift') return;
    // 잠김: 색 바꾸기(warn 초 전에 깜빡) · 같은 색이 생기면 공명
    const every = R.every[B.phase - 1];
    if (B.gapT <= 0) {
      if (!B.warned && (B.nextT -= dt) <= R.warn) { B.warned = true; pickNext(); }
      else if (B.warned && (B.nextT -= dt) <= 0) { applyNext(); B.nextT = every; B.warned = false; }
      const g = groups(), c = g.indexOf(Math.max(...g));
      if (g[c] >= 2) startRes(c, g[c]);
    }
  }
  // 몸 피해: 잠김 = 0 · 공명 색 = 그대로 · 다른 색 = 회복(× heal) · 버팀 = 0 · 단계 바뀌는 중 = 0
  function bodyCut(e) {
    const m = motherOf();
    if (!B || !m || m.state === 'phaseShift' || e.spawnT > 0 || m.spawnT > 0) return { m: 0, s: '무적', armor: true };
    if (!B.res) return { m: 0, s: '팅', armor: true };
    if (B.res.braced) return { m: 0, s: '버팀', armor: true };
    if (e.col === B.res.col) return { m: 1, s: '', armor: true };
    return { m: -BR().heal, s: '회복!', armor: true };
  }
  // 약물 배양조를 침: hits 대면 깨져 그 색 웅덩이
  function tankHit(e) {
    if (e.broken || e.spawnT > 0 || e.tankT > now()) return;
    e.tankT = now() + 0.15; e.flash = 0.1;
    World.sparks(e.x, e.y, 12, 6, '#a8d8e0', true);
    if (++e.hits < BR().tank.hits) return;
    const R = BR().tank;
    e.broken = true; e.refillT = R.refill;
    B.pools.push({ x: e.x, y: e.y + 8, r: R.r, col: e.col, t: R.pool });
    World.text(e.x, e.y, 30, RC[e.col][3] + ' 약물이 쏟아졌다!', RC[e.col][0], true); World.sparks(e.x, e.y, 10, 18, RC[e.col][0], true); World.shake(3); Sfx.blast();
    sayOnce(B, 'tankSeen', '웅덩이에 들어간 몸은 그 색으로 굳는다 — 몸들을 꾀어 색을 맞춰라!', 3.2);
  }
  // 본체 생각: 천천히 다가오며 살덩이 내려찍기 · 새끼 뱉기 · 가까우면 내려찍기 · 탄
  function motherThink(e, dt, lv, p) {
    const d = e.def;
    e.moving = false;
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (!e.lInit) broodInit(e, lv);
    if (p.dead) return;
    faceTo(e, p);
    e.atkCd -= dt;
    const pd = Math.hypot(p.x - e.x, p.y - e.y);
    if (e.atkCd <= 0) {
      const r = Math.random(), rage = 0.7 + 0.3 * pool.hp / pool.max;
      const minions = World.enemies().filter(m => m.minion && live(m) && m.ri === e.ri).length;
      if (pd < 52 && r < 0.4) { e.state = 'slam'; e.t = e.windupT = d.slam.windup; }
      else if (r < 0.72) { e.state = 'fleshWind'; e.t = e.windupT = BR().flesh.wind; e.lx = p.x; e.ly = p.y; World.text(e.x, e.y, e.h + 8, '내려찍기!', '#ffd36a'); }
      else if (minions < BR().spit.max) { e.state = 'spitWind'; e.t = e.windupT = 0.7; }
      else { e.state = 'fan'; e.t = e.windupT = d.fan.windup; }
      e.atkCd = (2.0 + Math.random() * 0.8) * rage;
      return;
    }
    if (pd > 44) { const step = d.speed * dt; mobMove(lv, e, e.fv.x * step, e.fv.y * step); e.moving = true; e.walkT += dt; }
  }
  // 복제체: 빠르게 따라붙어 휘두르기 · 돌진(붉은 띠 예고 = 판정) · 산성 침(부채꼴 탄). 짝 없는 몸(2단계부터) = 외톨이 폭주
  function lonelyOf(e) { return B && B.phase >= 2 && bodiesOf().filter(b => b.col === e.col).length < 2; }
  function twinTick(e, dt, lv, p) {
    const m = motherOf(), d = e.def, W = BR().twin;
    if (e.dying || !m) { e.dying = true; e.state = 'dead'; e.t = 0; return; }
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (!p || p.dead) { e.moving = false; return; }
    const lone = lonelyOf(e), sp = d.speed * (lone ? BR().lonely.speed : 1) * (e.slowUntil > now() ? e.slowK : 1);
    const pd = Math.hypot(p.x - e.x, p.y - e.y);
    e.moving = false;
    if (m.state === 'phaseShift') return;
    switch (e.state) {
      case 'move':
        faceTo(e, p);
        e.atkCd -= dt * (lone ? 1 / BR().lonely.cd : 1);
        if (e.atkCd <= 0) {
          const r = Math.random();
          if (pd < 32) { e.state = 'swingWind'; e.t = e.windupT = d.atk.windup; }
          else if (pd < 170 && r < 0.55) { e.state = 'dashWind'; e.t = e.windupT = W.dash.wind; e.chargeV = unit(p.x - e.x, p.y - e.y, e.fv); }
          else { e.state = 'acidWind'; e.t = e.windupT = W.acid.wind; }
          e.atkCd = 1.5 + Math.random() * 0.8;
          break;
        }
        if (pd > 34) { Dungeon.move(lv, e, e.fv.x * sp * dt, e.fv.y * sp * dt, e.r); e.moving = true; e.walkT += dt; }
        break;
      case 'swingWind':
        e.t -= dt;
        if (e.t <= 0) {
          World.fx({ type: 'swipe', x: e.x, y: e.y, fv: e.fv, r: d.atk.reach[1], t: 0, life: 0.15, enemy: true });
          for (const t of peopleOf()) if (inHitbox(e, e.fv, d.atk, t, BODY_R)) hurtPlayer(t, e, 15 * e.dmgMul * W.swing, d.atk.knock);
          e.state = 'twRecover'; e.t = d.atk.recovery;
        }
        break;
      case 'dashWind':
        e.t -= dt;
        if (e.t <= 0) { e.state = 'dash'; e.t = W.dash.time; e.dashHit = []; Sfx.dash(); }
        break;
      case 'dash': {
        e.t -= dt;
        const ox = e.x, oy = e.y;
        Dungeon.move(lv, e, e.chargeV.x * W.dash.speed * dt, e.chargeV.y * W.dash.speed * dt, e.r);
        for (const t of peopleOf()) if (!e.dashHit.includes(t) && Math.hypot(t.x - e.x, t.y - e.y) < e.r + BODY_R + 4 && hurtPlayer(t, e, 15 * e.dmgMul * W.dash.dmg, 200) !== 'miss') e.dashHit.push(t);
        if (e.t <= 0 || Math.hypot(e.x - ox, e.y - oy) < W.dash.speed * dt * 0.3) { e.state = 'twRecover'; e.t = 0.5; World.dust(e.x, e.y, 6); }
        break;
      }
      case 'acidWind':
        e.t -= dt;
        if (e.t <= 0) {
          const A = W.acid, base = Math.atan2(p.y - e.y, p.x - e.x);
          for (let k = 0; k < A.n; k++) {
            const a = base + (k / (A.n - 1) - 0.5) * (Math.PI / 3);
            World.shoot({ x: e.x, y: e.y - e.h * 0.5, vx: Math.cos(a) * A.speed, vy: Math.sin(a) * A.speed, dmg: 10 * e.dmgMul * A.dmg, knock: 80, color: ACID_HI, life: 3, r: 3 });
          }
          Sfx.spell(); e.state = 'twRecover'; e.t = 0.6;
        }
        break;
      case 'twRecover':
        e.t -= dt;
        if (e.t <= 0) e.state = 'move';
        break;
      default:
        e.state = 'move';
    }
  }

  // ── 그리기 ──
  // 그림 이름 바꾸기(art.js): 배양조 깨짐 · 폭주 · 사슬 풀림 · 실패작 상태 · 분열의 어미 색
  function spriteOf(e, name) {
    const d = e.def, f = name.slice(-1);
    if (d.brood || d.part === 'twin') {
      const nm = d.brood ? 'lab_mother' : 'lab_twin';
      const res = (B && B.res) || (World.mirror && snapRes);
      if (res && res.braced) return nm + '_W_anim_f' + f;
      return nm + '_c' + (e.col || 0) + (res && res.col === e.col ? 'L' : '') + '_anim_f' + f;
    }
    if (d.part === 'tank') return 'lab_tank' + (e.col || 0) + (e.broken ? '_broken' : '_anim_f0');
    if (d.hatch && e.hatched >= d.hatch.n) return 'lab_vat_broken';
    if (d.rage && (e.raging || e.hp < e.maxHp * d.rage.at)) return 'lab_bloat_rage_anim_f' + f;
    if (d.bound && (e.bound === false || e.hp < e.maxHp * d.bound.snapHp)) return 'lab_chain_free_anim_f' + f;
    if (d.lab === 'stitch') return 'lab_stitch' + (e.exposeT > 0 ? '_0' : e.stitches === 2 ? '_2' : e.stitches === 1 ? '_1' : e.stitches === 0 ? '_0' : '') + '_anim_f' + f;
    if (d.lab === 'brood' && (e.exposeT > 0 || e.lid === 0)) return 'lab_brood_open_anim_f' + f;
    if (d.lab === 'melt' && e.state === 'hardened') return 'lab_melt_hard_anim_f' + f;
    if (d.lab === 'eye' && e.state === 'labDown') return 'lab_eye_open_anim_f' + f;
    return name;
  }
  // 몹 그림을 따로 그리는 때(그렸으면 true): 녹아든 흘러내리는 자 · 솟기 예고
  function drawMob(ctx, e, time, o) {
    const d = e.def, x = Math.round(e.x), y = Math.round(e.y);
    if (d.lab === 'melt' && (e.state === 'melted' || e.state === 'meltSink' || e.under)) {  // 웅덩이째 흘러다님(안 맞음)
      const k = e.state === 'meltSink' ? 1 - e.t / d.melt.sink : 1;
      ctx.save();
      const M = d.melt, R = M.pool.r * k;  // 웅덩이 몸 = 판정(pool.r)
      if (e.state === 'melted') {  // 빨아들이는 둘레(pull.r): 점선 고리 + 안으로 빨려드는 줄
        ctx.save(); ctx.strokeStyle = 'rgba(200,255,106,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.ellipse(x, y, M.pull.r, M.pull.r * GROUND_Y, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + i, ph = 1 - ((time * 2 + i * 0.37) % 1), r1 = R + (M.pull.r - R) * ph, r2 = Math.max(R, r1 - 9); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1 * GROUND_Y); ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2 * GROUND_Y); ctx.stroke(); }
        ctx.restore();
      }
      ctx.save();
      ctx.fillStyle = 'rgba(46,90,20,0.8)'; ctx.beginPath(); ctx.ellipse(x, y, R + 2, (R + 2) * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(108,176,42,0.85)'; ctx.beginPath(); ctx.ellipse(x - 2, y - 1, R * 0.65, R * 0.65 * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ACID_HI; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = ACID_HI; for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x + Math.cos(time * 3 + i * 2) * R * 0.5), Math.round(y + Math.sin(time * 4 + i) * R * 0.3), 2, 2);
      ctx.fillStyle = '#ffe066'; ctx.fillRect(x - 3, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1);  // 웅덩이 속 노란 눈
      ctx.restore();
      if (e.state === 'meltSink') Gfx.spr(ctx, 'lab_melt_anim_f0', x, y + Math.round(k * 20), Object.assign({}, o, { alpha: 1 - k }));
      return true;
    }
    return false;
  }
  // 그림 위 덧그림(art.js 몸 다음): 실밥 틈 빛 · 뚜껑 쪽 호 · 사슬 · 자물쇠 · 눈 · 표식 · 분열의 어미 기호 · 버팀
  function drawOver(ctx, e, x, y, time) {
    const d = e.def;
    if (e.state === 'dead') return;
    const s = e.scale || 1;
    if (d.bound && e.bound !== false && e.ax !== undefined) {  // 사슬: 몸 → 처음 자리(기둥) 바닥 고리
      ctx.save(); ctx.strokeStyle = '#a8a8b8'; ctx.lineWidth = 1; ctx.setLineDash([2, 1]);
      ctx.beginPath(); ctx.moveTo(x, y - e.h * 0.7); ctx.lineTo(e.ax, e.ay - 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#6e6e7e'; ctx.fillRect(Math.round(e.ax) - 2, Math.round(e.ay) - 3, 4, 3); ctx.restore();
    }
    if (d.lab === 'stitch' && e.stitches > 0 && !(e.exposeT > 0) && stitchOpen(e)) {  // 틈: 실밥이 청록으로 맥동
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 + 0.14 * Math.sin(time * 16);
      ctx.fillStyle = TEAL; ctx.beginPath(); ctx.ellipse(x, y - e.h * 0.5, e.r, e.h * 0.22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if ((d.lab === 'stitch' || d.lab === 'brood') && e.exposeT > 0) { ctx.fillStyle = TEAL; for (let k = 0; k < 3; k++) { const a = time * 6 + k * 2.1; ctx.fillRect(Math.round(x + Math.cos(a) * 10), Math.round(y - e.h - 3 + Math.sin(a) * 2), 2, 2); } }
    if (d.lab === 'brood' && e.lid > 0 && !(e.exposeT > 0)) {  // 뚜껑 쪽(등 뒤 ± cone): 발밑 청록 호
      const L = d.lid, a = Math.atan2(-e.fv.y / GROUND_Y, -e.fv.x), w = Math.acos(L.cone), R = e.r + 8;
      ctx.save(); ctx.strokeStyle = 'rgba(95,224,208,' + (0.5 + 0.25 * Math.sin(time * 6)) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * GROUND_Y, 0, a - w, a + w); ctx.stroke(); ctx.restore();
    }
    if (d.lab === 'zero' && e.state !== 'labDown') {  // 남은 사슬(묶인 것): 어깨 → 바닥 쇠고리 · 가슴 자물쇠(사슬이 끊겼을 때 청록 맥동)
      const left = d.chains.max - e.chainLv;
      ctx.save(); ctx.strokeStyle = '#a8a8b8'; ctx.lineWidth = 1; ctx.setLineDash([2, 1]);
      for (let i = 0; i < left; i++) { const a = Math.PI * (0.25 + i * 0.25), ax = e.x + Math.cos(a + Math.PI) * 30 * (i % 2 ? 1 : -1), ay = e.y + 10; ctx.beginPath(); ctx.moveTo(x + (i % 2 ? 10 : -10) * s, y - e.h * 0.6); ctx.lineTo(ax, ay); ctx.stroke(); }
      ctx.restore();
      const ready = e.chainLv >= d.lock.stunAt;  // 지금 묶으면 기절(딜 타임)
      if (e.chainLv > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ready ? 0.65 + 0.35 * Math.sin(time * 14) : 0.3 + 0.2 * Math.sin(time * 10); ctx.fillStyle = TEAL; ctx.beginPath(); ctx.arc(x + (e.fv.x < 0 ? -1 : 1), y - e.h * 0.55, ready ? 8 : 5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      // 머리 위: 끊긴 사슬 수(사슬 N/3) · 둘 이상이면 '앞에서 자물쇠!'(깜빡) + 자물쇠 맞힌 수
      ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 8px ' + Gfx.FONT;
      const line = (s, yy, col) => { ctx.fillStyle = '#000'; ctx.fillText(s, x + 0.5, yy + 0.5); ctx.fillStyle = col; ctx.fillText(s, x, yy); };
      line('사슬 ' + e.chainLv + '/' + d.chains.max, y - e.h - 6, ready ? '#ff9a6a' : '#c8c8d4');
      if (ready) line('앞에서 자물쇠! ' + (e.lockHits || 0) + '/' + d.lock.hits, y - e.h - 16, Math.floor(time * 6) % 2 ? TEAL : '#ffffff');
      ctx.restore();
    }
    if (d.lab === 'zero' && e.state === 'labDown') { ctx.fillStyle = '#ffe066'; for (let k = 0; k < 3; k++) { const a = time * 6 + k * 2.1; ctx.fillRect(Math.round(x + Math.cos(a) * 9), Math.round(y - e.h - 3 + Math.sin(a) * 2), 2, 2); } }
    if (d.lab === 'eye' && e.state === 'labDown') { ctx.fillStyle = TEAL; for (let k = 0; k < 3; k++) { const a = time * 6 + k * 2.1; ctx.fillRect(Math.round(x + Math.cos(a) * 10), Math.round(y - e.h - 3 + Math.sin(a) * 2), 2, 2); } }
    if (d.part === 'eye') {  // 빛나는 눈(지금 터뜨릴 것): 청록 빛
      const o = World.enemies().find(m => m.id === e.owner);
      if (o && e.idx === o.litI) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 9); const g = ctx.createRadialGradient(x, y - e.z, 0, x, y - e.z, 9); g.addColorStop(0, 'rgba(95,224,208,0.9)'); g.addColorStop(1, 'rgba(95,224,208,0)'); ctx.fillStyle = g; ctx.fillRect(x - 9, y - e.z - 9, 18, 18); ctx.restore(); }
    }
    if (d.brood || d.part === 'twin') {  // 머리 위 색 기호(바뀌기 전 깜빡) · 웅덩이 고정 = 작은 고리
      const blink = (B && B.warned && e.next !== undefined && e.next !== e.col) || (World.mirror && e.snapWarn);
      const c = blink && Math.floor(time * 10) % 2 ? (e.next !== undefined ? e.next : e.col) : e.col;
      const sy = Math.round(y - (e.h + 6) - (d.brood ? 4 : 0));
      if (!(blink && Math.floor(time * 20) % 4 === 0)) Gfx.spr(ctx, 'lab_sym' + (c || 0), x, sy, { scale: d.brood ? 2 : 1.5 });
      if (e.lockT > 0) { ctx.save(); ctx.strokeStyle = RC[e.col || 0][0]; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r + 4, (e.r + 4) * GROUND_Y, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      const res = (B && B.res) || (World.mirror && snapRes);
      if (res && res.col === e.col && !res.braced) {  // 공명: 둘레 그 색 빛
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 + 0.2 * Math.sin(time * 8);
        const R2 = e.r * 2.2, g = ctx.createRadialGradient(x, y - e.h * 0.5, 0, x, y - e.h * 0.5, R2); g.addColorStop(0, RC[e.col][0]); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - R2, y - e.h * 0.5 - R2, R2 * 2, R2 * 2); ctx.restore();
      }
    }
    if (d.part === 'needle') {  // 실바늘 → 봉합체로 이어진 실(어디로 가는지)
      const o = World.enemies().find(m => m.id === e.owner);
      if (o && live(o)) { ctx.save(); ctx.strokeStyle = 'rgba(95,224,208,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.lineDashOffset = time * 8; ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(o.x, o.y - o.h * 0.5); ctx.stroke(); ctx.restore(); }
    }
    if (d.part === 'tank' && !e.broken) {  // 칠 수 있는 배양조: 아래 그 색 빛 + 남은 대수
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 4 + e.col);
      ctx.fillStyle = RC[e.col][0]; ctx.beginPath(); ctx.ellipse(x, y - 9, 9, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      Gfx.spr(ctx, 'lab_sym' + e.col, x, Math.round(y - 30), {});
    }
  }
  // 바닥(world.js 장판과 같은 층): 흘러내리는 자 솟기 · 사슬 채찍 띠 · 관찰체 응시 부채꼴 · 살덩이 내려찍기 · 복제체 돌진 · 약물 웅덩이 · 범람 발판
  function ground(ctx, lv, time, ri) {
    const circle = (x, y, R, k) => {
      ctx.save();
      ctx.fillStyle = 'rgba(255,40,30,' + (0.12 + 0.2 * k) + ')'; ctx.strokeStyle = 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, R * k, R * GROUND_Y * k, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };
    const band = (e, len, w, k, hot) => {
      const a = Math.atan2(e.chargeV.y, e.chargeV.x);
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(a);
      ctx.fillStyle = hot ? 'rgba(200,255,106,0.45)' : 'rgba(255,40,30,' + (0.12 + 0.2 * k) + ')';
      ctx.strokeStyle = hot ? 'rgba(255,255,255,0.9)' : 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')'; ctx.lineWidth = 1;
      ctx.fillRect(0, -w, len, w * 2); ctx.strokeRect(0, -w, len, w * 2);
      if (!hot) { ctx.beginPath(); ctx.moveTo(len * k, -w); ctx.lineTo(len * k, w); ctx.stroke(); }
      ctx.restore();
    };
    if (B && lv.def.raid) {  // 약물 웅덩이(판정 r = 바닥 타원) · 범람
      for (const w of B.pools) {
        const fade = Math.min(1, w.t / 1);
        ctx.save(); ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = RC[w.col][1]; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r, w.r * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.7 * fade; ctx.fillStyle = RC[w.col][0]; ctx.beginPath(); ctx.ellipse(w.x - 3, w.y - 1, w.r * 0.6, w.r * 0.6 * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = fade; ctx.strokeStyle = RC[w.col][0]; ctx.lineWidth = 1; ctx.setLineDash([3, 2]); ctx.lineDashOffset = -time * 6; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r, w.r * GROUND_Y, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);  // 점선(공격 예고 붉은 원과 헷갈리지 않게) + 가운데 기호
        Gfx.spr(ctx, 'lab_sym' + w.col, Math.round(w.x), Math.round(w.y + 4), { scale: 1.5, alpha: fade });
        ctx.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(w.x + Math.cos(time * 2 + i * 2.1) * w.r * 0.5), Math.round(w.y + Math.sin(time * 2.6 + i) * w.r * 0.3 * GROUND_Y), 1, 1);
        ctx.restore();
      }
      const fl = B.flood;
      if (fl) {
        const r = lv.boss, k = fl.on ? 1 : 1 - fl.warn / BR().flood.warn;
        ctx.save();
        ctx.fillStyle = RC[fl.col][1]; ctx.globalAlpha = 0.12 + 0.28 * k; ctx.fillRect(r.x * T, r.y * T, r.w * T, r.h * T);
        ctx.globalAlpha = 1;
        for (const q of fl.pads) {  // 깨끗한 발판(판정 padR = 흰 고리)
          const R = BR().flood.padR;
          ctx.fillStyle = 'rgba(20,16,24,0.85)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 + 0.4 * Math.sin(time * 8)) + ')'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        ctx.restore();
      }
    }
    for (const w of lv.labTrail || []) {  // 약물 장판(판정 r = 바닥 타원)
      if (w.ri !== ri) continue;
      const a = Math.min(1, w.t / 0.6), k = Math.min(1, (w.life - w.t) / 0.15);
      ctx.save(); ctx.globalAlpha = 0.75 * a;
      ctx.fillStyle = '#2e5a14'; ctx.beginPath(); ctx.ellipse(w.x, w.y, w.r * k, w.r * k * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8 * a; ctx.fillStyle = ACID; ctx.beginPath(); ctx.ellipse(w.x - 1, w.y, w.r * 0.6 * k, w.r * 0.6 * k * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    for (const e of World.enemies()) {
      if (e.ri !== ri || !live(e)) continue;
      const d = e.def;
      if (e.state === 'meltRise') circle(e.lx, e.ly, d.melt.r, 1 - e.t / e.windupT);
      if (e.state === 'fleshWind') circle(e.lx, e.ly, BR().flesh.r, 1 - e.t / e.windupT);
      if ((e.state === 'lashWind' || e.state === 'lash') && e.chargeV) band(e, e.lashLen || d.chains.len[0], d.chains.w, e.state === 'lash' ? 1 : 1 - e.t / e.windupT, e.state === 'lash');
      if (e.state === 'dashWind' && e.chargeV) { const W = BR().twin.dash; ctx.save(); ctx.strokeStyle = 'rgba(255,60,40,' + (0.2 + 0.35 * (1 - e.t / e.windupT)) + ')'; ctx.lineWidth = e.r * 2; ctx.beginPath(); ctx.moveTo(e.x, e.y - 4); ctx.lineTo(e.x + e.chargeV.x * W.speed * W.time, e.y - 4 + e.chargeV.y * W.speed * W.time); ctx.stroke(); ctx.restore(); }
      if (d.lab === 'eye' && e.lInit && e.state !== 'labDown' && e.gazeA !== undefined) {  // 응시 부채꼴(판정 = 그림)
        const G = d.gaze, h = G.arc / 2 * Math.PI / 180;
        ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1, GROUND_Y);
        const hot = e.state === 'gazeWind';
        ctx.fillStyle = hot ? 'rgba(255,90,60,' + (0.2 + 0.15 * Math.sin(time * 30)) + ')' : 'rgba(255,224,102,0.10)';
        ctx.strokeStyle = hot ? 'rgba(255,120,80,0.8)' : 'rgba(255,224,102,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, G.r, e.gazeA - h, e.gazeA + h); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
  }
  // 어둠 위(world.js draw): 표식(내 머리 위 노란 눈) · 응시 광선 · 범람 알림
  function labels(ctx) {
    for (const t of peopleOf()) {
      const n = t.labMarks || 0;
      for (let i = 0; i < n; i++) { const x = Math.round(t.x - (n - 1) * 4 + i * 8), y = Math.round(t.y - 42); ctx.fillStyle = '#120a14'; ctx.fillRect(x - 3, y - 2, 7, 5); ctx.fillStyle = '#ffe066'; ctx.fillRect(x - 2, y - 1, 5, 3); ctx.fillStyle = '#2a1a24'; ctx.fillRect(x, y - 1, 1, 3); }
    }
    for (const e of World.enemies()) if (e.beam && live(e)) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,224,102,' + (e.beam.t * 3) + ')'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(e.x, e.y - e.h * 0.6); ctx.lineTo(e.beam.x, e.beam.y - 10); ctx.stroke(); ctx.restore();
    }
  }
  // 빛(어둠 다음): 배양조 · 약물 웅덩이 둘레를 'lighter' 로 밝힘
  function light(ctx, lv, time) {
    if (!lv.labLights) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const L of lv.labLights) {
      if (!inViewOf(L.x, L.y)) continue;
      const r = L.r + Math.sin(time * 2 + L.x) * 2, g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, r);
      g.addColorStop(0, 'rgba(160,230,80,' + L.a + ')'); g.addColorStop(1, 'rgba(160,230,80,0)');
      ctx.fillStyle = g; ctx.fillRect(L.x - r, L.y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
  const inViewOf = (x, y) => { const p = World.player; return !p || (Math.abs(x - p.x) < 400 && Math.abs(y - p.y) < 300); };

  // ── 풍경: 바닥 그림(dungeon.js paint — 색을 곱한 뒤) — 윗벽 앞 배양조 줄 · 약물 관 · 철창 · 실험대 · 표본 병 · 사슬 / 바닥 배수 철망 · 유리 조각 · 약물 얼룩 · 서류 ──
  function paintLab(lv, g) {
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    lv.labLights = []; lv.labDrips = [];
    const draw = (c, x, bottom) => g.drawImage(c, Math.round(x - c.width / 2), Math.round(bottom - c.height));
    lv.rooms.forEach((r, ri) => {
      if (r.main && lv.def.raid) return;  // 레이드 방: 장식은 둘레 바닥 얼룩만(배양조 셋이 따로 섬)
      const top = r.y * T + 5;
      const busy = [];
      for (let x = r.x + 1; x < r.x + r.w - 1;) {
        const kind = Math.random();
        const pk = kind < 0.32 ? 'vat' : kind < 0.42 ? 'vatB' : kind < 0.62 ? 'pipe' : kind < 0.72 ? 'cage' : kind < 0.82 ? 'table' : kind < 0.92 ? 'jar' : 'chain';
        const c = PROP[pk], wTiles = Math.ceil(c.width / T), cx = x * T + c.width / 2;
        if (x + wTiles > r.x + r.w - 1) break;
        if (Math.random() < 0.75) {
          draw(c, cx, pk === 'pipe' ? top - 2 : pk === 'chain' ? top + 4 : top);
          if (pk === 'vat') { lv.labLights.push({ x: cx, y: top - 8, r: 18, a: 0.16 }); if (Math.random() < 0.3 && pk === 'vat') draw(PROP.shards, cx + 6, top + 6); }
          if (pk === 'vatB') draw(PROP.shards, cx + rnd(-6, 6), top + rnd(4, 10));
          if (pk === 'pipe') lv.labDrips.push({ ri, x: Math.round(cx) - 1, y0: top - 2, y1: top + rnd(10, 22), ph: Math.random() * 2 });
          if (pk === 'jar') lv.labLights.push({ x: cx, y: top - 4, r: 10, a: 0.12 });
          busy.push(cx);
        }
        x += wTiles + rnd(1, 3);
      }
      // 바닥: 배수 철망 · 유리 조각 · 약물 얼룩 · 서류 조각(판정 없는 꾸밈)
      for (let k = Math.max(1, Math.round(r.w * r.h / 110)); k > 0; k--) { const x = (r.x + rnd(2, r.w - 3)) * T, y = (r.y + rnd(3, r.h - 2)) * T; g.drawImage(PROP.grate, x, y); lv.labLights.push({ x: x + 8, y: y + 4, r: 12, a: 0.1 }); }
      for (let k = Math.round(r.w * r.h / 24); k > 0; k--) {
        const x = (r.x + rnd(1, r.w - 2)) * T + rnd(0, 15), y = (r.y + rnd(2, r.h - 2)) * T + rnd(0, 15), kind = Math.random();
        if (kind < 0.3) { g.fillStyle = 'rgba(108,176,42,0.35)'; g.fillRect(x, y, rnd(2, 4), 1); g.fillRect(x + 1, y + 1, rnd(1, 3), 1); }
        else if (kind < 0.45) { g.fillStyle = '#a8d8e0'; g.fillRect(x, y, 1, 1); g.fillStyle = '#4e7a88'; g.fillRect(x + 1, y + 1, 1, 1); }
        else if (kind < 0.55) { g.fillStyle = '#d8ccb0'; g.fillRect(x, y, 3, 2); g.fillStyle = '#9a8a70'; g.fillRect(x, y + 1, 3, 1); }
        else if (kind < 0.62) { g.fillStyle = 'rgba(122,40,40,0.45)'; g.fillRect(x, y, 2, 2); g.fillRect(x + 2, y + 1, 1, 1); }
      }
    });
  }
  // 지금 방: 약물 관에서 떨어지는 방울(판정 없는 꾸밈)
  function drawLab(ctx, lv, time, ri) {
    if (!lv.labDrips) return;
    for (const d of lv.labDrips) {
      if (d.ri !== ri) continue;
      const u = ((time * 0.7 + d.ph) % 1.4) / 1.4;
      if (u > 1) continue;
      const y = d.y0 + (d.y1 - d.y0) * u * u;
      ctx.fillStyle = u > 0.92 ? 'rgba(200,255,106,0.5)' : ACID_HI;
      if (u > 0.92) ctx.fillRect(d.x - 2, Math.round(d.y1), 5, 1); else ctx.fillRect(d.x, Math.round(y), 1, 2);
    }
  }

  // 파티 손님에게: 몸 색 · 공명 · 웅덩이 · 범람 · 실패작 상태(방장 → 손님 snap)
  let snapRes = null;
  function snap() {
    const lv = World.level;
    if (!lv || !lv.def.lab) return undefined;
    const ms = World.enemies().filter(e => e.def.lab && e.lInit && live(e)).map(e => [e.id, e.stitches ?? e.lid ?? e.chainLv ?? 0, e.exposeT > 0 ? 1 : 0, Math.round((e.gazeA || 0) * 100) / 100, e.litI || 0]);
    const out = { ms, tr: (lv.labTrail || []).map(w => [Math.round(w.x), Math.round(w.y), w.r, Math.round(w.t * 10) / 10, w.life, w.ri]) };
    if (B && motherOf()) {
      out.b = bodiesOf().map(b => [b.id, b.col, b.lockT > 0 ? 1 : 0, b.next ?? -1]);
      out.r = B.res ? [B.res.col, B.res.braced ? 1 : 0] : null;
      out.w = B.warned ? 1 : 0;
      out.p = B.pools.map(w => [Math.round(w.x), Math.round(w.y), w.r, w.col, Math.round(w.t * 10) / 10]);
      out.f = B.flood ? [B.flood.col, B.flood.on ? 1 : 0, Math.round(B.flood.warn * 10) / 10, B.flood.pads.map(q => [Math.round(q.x), Math.round(q.y)])] : null;
      out.t = World.enemies().filter(e => e.def.part === 'tank').map(e => [e.id, e.col, e.broken ? 1 : 0]);
    }
    return out;
  }
  function unsnap(a) {
    if (!a) return;
    const byId = id => World.enemies().find(e => e.id === id);
    if (World.level && a.tr) World.level.labTrail = a.tr.map(([x, y, r, t, life, ri]) => ({ x, y, r, t, life, ri, dmg: 0 }));
    for (const [id, n, ex, ga, li] of a.ms || []) {
      const e = byId(id); if (!e) continue;
      e.lInit = true; e.exposeT = ex ? 1 : 0; e.gazeA = ga; e.litI = li;
      if (e.def.lab === 'stitch') e.stitches = n; if (e.def.lab === 'brood') e.lid = n; if (e.def.lab === 'zero') e.chainLv = n;
    }
    if (a.b) {
      for (const [id, col, lk, nx] of a.b) { const e = byId(id); if (e) { e.col = col; e.lockT = lk ? 1 : 0; e.next = nx >= 0 ? nx : undefined; e.snapWarn = !!a.w; } }
      snapRes = a.r ? { col: a.r[0], braced: !!a.r[1] } : null;
      B = B || { phase: 1, pools: [], res: null };
      B.pools = (a.p || []).map(([x, y, r, col, t]) => ({ x, y, r, col, t }));
      B.flood = a.f ? { col: a.f[0], on: !!a.f[1], warn: a.f[2], pads: a.f[3].map(([x, y]) => ({ x, y })) } : null;
      B.res = null; B.warned = false;
      for (const [id, col, br] of a.t || []) { const e = byId(id); if (e) { e.col = col; e.broken = !!br; } }
    }
  }
  // 새 레이드 · 새 층: 이전 판 상태 지움(world.js descend · start 뒤 populate 전에 불러도 되고, 어미가 처음 생각할 때 다시 만든다)
  function reset() { pool = null; B = null; snapRes = null; }

  return { think, state, cut, onKill, part, partDied, update, spriteOf, drawMob, drawOver, ground, labels, light, paintLab, drawLab, snap, unsnap, reset, isLab, RC,
    get brood() { return B; }, get pool() { return pool; } };
})();
