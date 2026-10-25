// 그림 그리기 도우미: 0x72 아틀라스(atlas.js 의 FRAMES), 아이템 아이콘, 글자 · 상자.
// <img> 로만 읽으므로 file:// 에서도 된다(픽셀 읽기 getImageData 는 쓰지 않는다).
const Gfx = (() => {
  const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  const atlas = new Image();
  atlas.src = 'assets/dt/atlas.png';
  // 주인공 그림(16x28 칸 9개: 서기 4 · 달리기 4 · 맞음 1). 직업마다 같은 몸 · 다른 의상(2026-10-25 사용자)
  // hero = 검사(0x72 엘프 남자 색 바꿈 — 갈색 머리 · 강철 갑옷, 2026-10-24 사용자 고름),
  // mage = 마법사(검사 몸 + 파란 로브 · 금빛 띠 · 끝이 꺾인 뾰족 모자, 2026-10-25 사용자 고름 B)
  const SHEETS = {}, HERO = {};
  // 검사 몸 + 의상 시트(16x28 × 9칸): 직업 hero · mage, 마을 NPC kael(파수꾼 카엘) · miner(늙은 광부) · gambler(도박꾼 단지) — tools/npc-outfit.js 로 구움
  for (const id of ['hero', 'mage', 'assassin', 'kael', 'miner', 'gambler']) {  // assassin = 암살자(2026-10-25, tools/class-outfit.js)
    const img = new Image();
    img.src = 'assets/dt/' + id + '.png';
    ['idle_anim_f0', 'idle_anim_f1', 'idle_anim_f2', 'idle_anim_f3', 'run_anim_f0', 'run_anim_f1', 'run_anim_f2', 'run_anim_f3', 'hit_anim_f0']
      .forEach((k, i) => { HERO[id + '_' + k] = [i * 16, 0, 16, 28]; SHEETS[id + '_' + k] = img; });
  }
  // 암살자 무기 도트(2026-10-25 사용자: 양손 무기 — 아틀라스에 카타르 · 싸이가 없어서 코드로 그려 둔다). 칼끝이 위, 손잡이가 아래(아틀라스 무기와 같은 방향)
  // o 테두리 · w 날 빛 · a 강철 · d 어두운 강철 · g/G 금빛 날밑 · r/R 붉은 손잡이 감개
  const WPIX_PAL = { o: '#1a1418', w: '#f4f8ff', a: '#b8c4d4', d: '#6a7488', g: '#d8a840', G: '#8a5a20', r: '#a02830', R: '#5a1018' };
  const WPIX = {
    // 카타르: 길고 곧은 세모 날 + 금빛 날밑 + 짧은 H 손잡이(양옆 막대 사이 가로 손잡이, 어둡게 — 크면 상자처럼 보임)
    weapon_katar: ['...o...', '..owo..', '..owo..', '..owo..', '.owado.', '.owado.', '.owado.', '.owado.', '.owado.', '.oaado.', 'oggggGo', 'od.r.do', 'od.R.do', 'oo...oo'],
    // 싸이: 가늘고 긴 가운데 날 + 양옆으로 휜 갈래(받아치는 데 쓰는 날) + 감은 손잡이
    weapon_sai: ['....o....', '...owo...', '...owo...', '...owo...', '...oao...', '...oao...', '.o.oao.o.', 'oaooaooao', 'oaooaooao', '.oaoaoao.', '..oaaao..', '...ogo...', '...oro...', '...oRo...', '...oro...', '...oGo...', '....o....'],
  };
  for (const name in WPIX) {
    const rows = WPIX[name], c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (WPIX_PAL[ch]) { g.fillStyle = WPIX_PAL[ch]; g.fillRect(x, y, 1, 1); } }));
    SHEETS[name] = c; FRAMES[name] = [0, 0, c.width, c.height];
  }
  const ok = img => img instanceof HTMLCanvasElement || (img.complete && img.naturalWidth > 0);
  const ready = () => ok(atlas);

  // 색 입힌 그림 · 번쩍임(한 색 실루엣)은 한 번 만들어 두고 다시 쓴다(2026-10-25 사용자: 폰에서 버벅임 — 예전엔 매 프레임 임시 캔버스에 다시 칠했다)
  const recolorCache = new Map();
  function recolored(img, name, f, col, alpha, flash) {
    const key = name + '|' + col + '|' + alpha + '|' + (flash ? 1 : 0);
    let c = recolorCache.get(key);
    if (c) return c;
    const [fx, fy, fw, fh] = f;
    c = document.createElement('canvas');
    c.width = fw; c.height = fh;
    const g = c.getContext('2d');
    g.drawImage(img, fx, fy, fw, fh, 0, 0, fw, fh);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = flash ? 1 : alpha;
    g.fillStyle = col;
    g.fillRect(0, 0, fw, fh);
    recolorCache.set(key, c);
    return c;
  }

  // 그림 한 칸. 기본 기준점 = 발밑 가운데. o: { flip, alpha, flash, scale, rot, topLeft }
  function spr(ctx, name, x, y, o = {}) {
    const img = SHEETS[name] || atlas, f = HERO[name] || FRAMES[name];
    if (!f || !ok(img)) return;
    const [fx, fy, fw, fh] = f;
    let src = img, sx = fx, sy = fy;
    // 색 입히기(같은 몸으로 다른 몹 · 보스): 반쯤 덧칠 / 번쩍임: 한 색 실루엣
    if (o.flash) { src = recolored(img, name, f, o.flash === true ? '#ffffff' : o.flash, 1, true); sx = 0; sy = 0; }
    else if (o.tint) { src = recolored(img, name, f, o.tint, o.tintAlpha || 0.5, false); sx = 0; sy = 0; }
    const s = o.scale || 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale((o.flip ? -1 : 1) * s, s);
    if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
    if (o.topLeft) ctx.drawImage(src, sx, sy, fw, fh, 0, 0, fw, fh);
    else if (o.center) ctx.drawImage(src, sx, sy, fw, fh, -fw / 2, -fh / 2, fw, fh);
    else ctx.drawImage(src, sx, sy, fw, fh, -fw / 2, -fh + (o.grip || 0), fw, fh);  // grip = 기준점을 그림 아래에서 위로 올림(무기 손잡이를 쥐게)
    ctx.restore();
  }

  // 'knight_m_run_anim' + 시간 → 'knight_m_run_anim_f2'
  function anim(base, t, fps = 8, n = 4) {
    return base + '_f' + (Math.floor(t * fps) % n);
  }

  // ── 아이템 아이콘 (무기는 아틀라스, 나머지는 16x16 점그림을 색만 바꿔 쓴다) ──
  const SHAPES = {
    helmet: ['................', '......####......', '....##bbaa##....', '...#bbaaaaaa#...', '...#baaaaaaa#...', '..#aaaaaaaaaa#..',
      '..#aaaaaaaaaa#..', '..#a########a#..', '..#a#dddddd#a#..', '..#a##dddd##a#..', '..#aa#dddd#aa#..', '..#caa#dd#aac#..',
      '...#cca##acc#...', '....##c##c##....', '......#..#......', '................'],
    armor: ['................', '...###....###...', '..#bba#..#abb#..', '..#baaa##aaab#..', '..#aaaaaaaaaa#..', '...#aaaaaaaa#...',
      '...#abaaaaba#...', '...#aaaaaaaa#...', '...#aaa##aaa#...', '...#aaaaaaaa#...', '...#caaaaaac#...', '...#cccccccc#...',
      '...#c#dddd#c#...', '...##......##...', '................', '................'],
    gloves: ['................', '......#.#.#.....', '.....#a#a#a#....', '.....#a#a#a##...', '.....#aaaaa#a#..', '....##aaaaaaa#..',
      '...#b#aaaaaa#...', '...#ba#aaaaa#...', '....#aaaaaaa#...', '....#aaaaaa#....', '....#cccccc#....', '....#cbbbbc#....',
      '....#cccccc#....', '....########....', '................', '................'],
    boots: ['................', '................', '....######......', '....#baaa#......', '....#baaa#......', '....#aaaa#......',
      '....#aaaa#......', '....#aaaa#......', '....#aaaa##.....', '....#aaaaaa##...', '....#aaaaaaaa#..', '...#caaaaaaaa#..',
      '...#cccccccccc#.', '...############.', '................', '................'],
    amulet: ['................', '...##......##...', '...#a#....#a#...', '....#a#..#a#....', '.....#a##a#.....', '......#aa#......',
      '.....######.....', '....#bbaaac#....', '...#baggggac#...', '...#agggggac#...', '...#aggggacc#...', '....#aaaacc#....',
      '.....#cccc#.....', '......####......', '................', '................'],
    gem: ['................', '................', '......####......', '.....#bbaa#.....', '....#bbaaaa#....', '...#bbaaaaac#...',
      '..#baaaaaaacc#..', '..#aaaaaaaacc#..', '...#aaaaaacc#...', '....#aaaacc#....', '.....#aacc#.....', '......#cc#......',
      '.......##.......', '................', '................', '................'],
    jewel: ['................', '................', '.....######.....', '....#bbaaaa#....', '...#bbaaaaac#...', '..#bbaa##aacc#..',
      '..#baa#bb#acc#..', '..#aaa#ba#acc#..', '..#aaaa##aacc#..', '..#caaaaaaacc#..', '...#caaaaacc#...', '....#cccccc#....',
      '.....######.....', '................', '................', '................'],
    // 2026-10-24 사용자 '빈약해 보인다': 완전한(4) · 전설(5) · 태초(6)는 그림을 따로 — 더 크고 화려하게(e = 아주 밝게 · w = 흰 반짝임 · y/o = 금)
    gem4: ['................', '....########....', '...#ebbbbbaa#...', '..#ebwbbbaaaa#..', '.#ebbbbbaaaaac#.', '#cccccccccccccc#',
      '.#beaaabaaaacc#.', '..#baaabaaacc#..', '...#aaabaacc#...', '....#aabacc#....', '.....#aacc#.....', '......#cc#......',
      '.......##.......', '................', '................', '................'],
    gem5: ['.w............w.', '...y########y...', '...#ebbbbbaa#...', '..#ebwbbbaaaa#..', '.#ebbbbbaaaaac#.', 'oyyoyyoyyoyyoyyo',
      '.#beaaabaaaacc#.', '..#baaabaaacc#..', '.y.#aaabaacc#.y.', '....#aabacc#....', '.....#aacc#.....', '......#cc#......',
      '.......yy.......', '................', '................', '................'],
    gem6: ['..y....yy....y..', '..yy..yooy..yy..', '..yoyyoyyoyyoy..', '...yyyyyyyyyy...', '..#ebbbbbbaaa#..', '.#ebwwbbbaaaac#.',
      '#ebbwbbbaaaaacc#', '#cccccccccccccc#', '.#beaaabaaaacc#.', '..#baaabaaacc#..', '...#aaabaacc#...', 'w...#aabacc#...w',
      '.....#aacc#.....', '......#cc#......', '.......##.......', '................'],
    jewel4: ['................', '.....######.....', '...##ebbbaa##...', '..#ebbwbaaaaa#..', '.#ebwbbaaaaaac#.', '.#ebbaa##aaaac#.',
      '#ebbaa#ee#aaacc#', '#bbaaa#eb#aaacc#', '#baaaa#bb#aaacc#', '#aaaaaa##aaaacc#', '.#caaaaaaaaacc#.', '.#ccaaaaaaaccc#.',
      '..#cccaaaaccc#..', '...##cccccc##...', '.....######.....', '................'],
    jewel5: ['w....oyyyyo....w', '...yy######yy...', '..y#ebbbaaaa#y..', '.y#ebbwbaaaaa#y.', 'y#ebwbaa##aaac#y', 'y#ebba#ee#aacc#y',
      'o#bbaa#eb#aacc#o', 'o#baaa#bb#aacc#o', 'y#aaaaa##aaacc#y', 'y#caaaaaaaaacc#y', '.y#ccaaaaaccc#y.', '.y#cccaaaaccc#y.',
      '..y#cccccccc#y..', '...yy######yy...', 'w....oyyyyo....w', '................'],
    jewel6: ['..y....yy....y..', '...y..yooy..y...', '....yyyyyyyy....', '..#ebbwbbaaaa#..', '.#ebwbba##aaac#.', 'y#ebba#ee#aacc#y',
      'o#bbaa#eb#aacc#o', 'y#baaaa##aaacc#y', 'y#aaaaaaaaaacc#y', '.#caaaaaaaaacc#.', '..#ccaaaaaccc#..', '...#cccccccc#...',
      'w...##yyyy##...w', '.....yyooyy.....', '................', '................'],
    scroll: ['................', '................', '..##########....', '.#bbbbbbbbbb#...', '.#b#aaaaaaa#b#..', '..#aaaaaaaaa#...',
      '..#addddddda#...', '..#aaaaaaaaa#...', '..#adddddaaa#...', '..#aaaaaaaaa#...', '..#addddddda#...', '...#aaaaaaaaa#..',
      '..#b#aaaaaaa#b#.', '...#bbbbbbbbbb#.', '....##########..', '................'],
    ring: ['................', '................', '................', '......#gg#......', '.....#gbgg#.....', '......####......',
      '.....#baac#.....', '....#a#..#c#....', '...#a#....#c#...', '...#a#....#c#...', '...#a#....#c#...', '....#a#..#c#....',
      '.....#cccc#.....', '......####......', '................', '................'],
  };
  const iconCache = {};
  function mix(hex, k, toward) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const t = toward === 'white' ? 255 : 0;
    return 'rgb(' + c.map(v => Math.round(v + (t - v) * k)).join(',') + ')';
  }
  function shapeIcon(shape, tint) {
    const key = shape + tint;
    if (iconCache[key]) return iconCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const pal = { '#': '#1c1418', a: tint, b: mix(tint, 0.45, 'white'), c: mix(tint, 0.4, 'black'), d: '#2a1e24', g: '#e04a5a',
      e: mix(tint, 0.78, 'white'), w: '#ffffff', y: '#ffd36a', o: '#a8701c' };
    SHAPES[shape].forEach((row, y) => {
      for (let x = 0; x < 16; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        g.fillStyle = pal[ch];
        g.fillRect(x, y, 1, 1);
      }
    });
    iconCache[key] = c;
    return c;
  }
  // 재질 색을 덧칠한 그림 한 칸(무기 아이콘) — 만들어 두고 다시 씀. 진하게 칠해 단계마다 색이 또렷하게
  const WEAPON_TINT = 0.68;
  const tintCache = {};
  function tinted(name, tint) {
    const key = name + tint;
    if (tintCache[key]) return tintCache[key];
    const [fx, fy, fw, fh] = FRAMES[name];
    const c = document.createElement('canvas');
    c.width = fw; c.height = fh;
    const g = c.getContext('2d');
    g.drawImage(SHEETS[name] || atlas, fx, fy, fw, fh, 0, 0, fw, fh);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = WEAPON_TINT;
    g.fillStyle = tint;
    g.fillRect(0, 0, fw, fh);
    if (ok(atlas)) tintCache[key] = c;
    return c;
  }
  // 아이템 아이콘을 (cx, cy) 가운데에 size 크기로
  // 어두운 재질(흑요석 등)은 칸 바탕에 묻혀서 둘레에 옅은 빛을 두른다(2026-10-25 사용자: 장비가 잘 안 보임)
  const darkTint = hex => { const n = parseInt(hex.slice(1), 16); return (((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 60; };
  function icon(ctx, item, cx, cy, size) {
    const b = Items.base(item);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (b.tint && darkTint(b.tint)) { ctx.shadowColor = 'rgba(225,215,245,0.95)'; ctx.shadowBlur = Math.max(2, size / 9); }
    if (b.slot === 'weapon') {
      const [fx, fy, fw, fh] = FRAMES[b.icon];
      // 메뉴(큰 칸)는 정수 배로 또렷하게, 바닥에 떨어진 작은 그림은 줄여서
      const raw = size / Math.max(fw, fh) * 1.25;
      const s = size >= 24 ? Math.max(1, Math.floor(raw)) : raw;
      ctx.translate(Math.round(cx), Math.round(cy));
      ctx.rotate(Math.PI / 4);
      if (b.tint) ctx.drawImage(tinted(b.icon, b.tint), 0, 0, fw, fh, -fw * s / 2, -fh * s / 2, fw * s, fh * s);
      else ctx.drawImage(SHEETS[b.icon] || atlas, fx, fy, fw, fh, -fw * s / 2, -fh * s / 2, fw * s, fh * s);
    } else {
      // 방어구 · 장신구 16px 그림: 칸에 맞게 크게(예전엔 내림이라 가방 칸에서 1배 16px 로 작았다)
      const s = Math.max(1, Math.round(size / 16) - (Math.round(size / 16) * 16 > size + 6 ? 1 : 0));
      ctx.drawImage(shapeIcon(b.icon, b.tint), Math.round(cx - 8 * s), Math.round(cy - 8 * s), 16 * s, 16 * s);
    }
    ctx.restore();
  }

  // 전설 · 태초 테두리 오로라: 빛 덩이 셋이 돌 둘레를 천천히 돌며 색이 바뀐다(은은하게)
  // 전설 = 초록 · 하늘 · 보라(극광), 태초 = 금 · 분홍 · 하늘(조금 더 밝게)
  const AURORA = { 5: [150, 190, 275], 6: [45, 330, 195] };
  function aurora(ctx, cx, cy, r, size) {
    const hues = AURORA[size] || AURORA[6], t = performance.now() / 1000, strong = size >= 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    hues.forEach((h, i) => {
      const a = t * (0.6 + i * 0.25) + i * 2.1, d = r * 0.42;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
      const hue = h + Math.sin(t * 0.8 + i) * 18, al = (strong ? 0.34 : 0.26) * (0.75 + 0.25 * Math.sin(t * 1.7 + i * 1.3));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'hsla(' + hue + ',90%,62%,' + al + ')');
      g.addColorStop(1, 'hsla(' + hue + ',90%,62%,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    ctx.restore();
  }

  // 속성석 아이콘: 속성 색 보석, 크기가 클수록 크게 + 크기 단계 숫자(작은 그림은 점). 전설 · 태초는 오로라
  function stoneIcon(ctx, s, cx, cy, size) {
    const col = ELEMENTS[s.el].color;
    // 크기 단계가 클수록 크게: 조각 0.55 … 큰 0.78, 완전한 · 전설 · 태초는 따로 그린 큰 그림을 1.0 · 1.08 · 1.16
    const k = s.size >= 4 ? 1 + (s.size - 4) * 0.08 : 0.55 + 0.075 * s.size;
    const px = size * k;
    const base = ELEMENTS[s.el].shape || 'gem', shape = s.size >= 4 && SHAPES[base + s.size] ? base + s.size : base;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (s.size >= 5) {
      aurora(ctx, cx, cy - size * 0.08, px * 0.62, s.size);
      // 돌 테두리를 따라 도는 빛(색이 천천히 바뀜)
      const h = (AURORA[s.size] || AURORA[6])[Math.floor(performance.now() / 1400) % 3];
      ctx.shadowColor = 'hsla(' + h + ',90%,65%,0.8)';
      ctx.shadowBlur = Math.max(3, size * 0.14);
    }
    ctx.drawImage(shapeIcon(shape, col), Math.round(cx - px / 2), Math.round(cy - px / 2 - size * 0.08), Math.round(px), Math.round(px));
    ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    if (size >= 16) {
      // 크기 단계 숫자(조각 1 … 태초 7): 오른쪽 아래, 검은 테두리
      const fs = Math.max(9, Math.round(size * 0.42)), tx = Math.round(cx + size * 0.46), ty = Math.round(cy + size * 0.5);
      ctx.font = 'bold ' + fs + 'px ' + FONT; ctx.textAlign = 'right';
      ctx.lineWidth = Math.max(2, fs / 4); ctx.strokeStyle = '#000'; ctx.strokeText(String(s.size + 1), tx, ty);
      ctx.fillStyle = s.size >= 4 ? '#ffd36a' : '#ffffff'; ctx.fillText(String(s.size + 1), tx, ty);  // 완전한(5)부터 금색
    } else {
      const dot = Math.max(1, Math.round(size / 16));
      for (let i = 0; i <= s.size; i++) {
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(cx - (s.size * dot * 1.5) + i * dot * 3 - dot / 2), Math.round(cy + size * 0.42), dot, dot);
      }
    }
    ctx.restore();
  }

  // 주문서 아이콘: 성공률 색 두루마리
  function scrollIcon(ctx, s, cx, cy, size) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(shapeIcon('scroll', scrollColor(s)), Math.round(cx - size / 2), Math.round(cy - size / 2), Math.round(size), Math.round(size));
    ctx.restore();
  }

  // 심연 정수 아이콘(2026-10-25): 보랏빛 수정 도트(12x12, 칸마다 계산 — 마름모 몸 · 왼쪽 밝은 면 · 오른쪽 어두운 면 · 흰 반짝)
  let essCanvas = null;
  function essenceIcon(ctx, cx, cy, size) {
    if (!essCanvas) {
      const N = 12, c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d');
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = Math.abs(x + 0.5 - 6) / 4.2, dy = Math.abs(y + 0.5 - 6) / 5.8;
        if (dx + dy > 1) continue;
        const edge = dx + dy > 0.78;
        g.fillStyle = edge ? '#2a1050' : x < 5 ? (y < 5 ? '#e8c8ff' : '#b070f0') : x > 6 ? '#6a30b0' : '#9a58e8';
        g.fillRect(x, y, 1, 1);
      }
      g.fillStyle = '#ffffff'; g.fillRect(4, 3, 1, 2);
      essCanvas = c;
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(essCanvas, Math.round(cx - size / 2), Math.round(cy - size / 2), Math.round(size), Math.round(size));
    ctx.restore();
  }

  // ── 글자 · 상자 (메뉴는 960x540 좌표에서 그린다) ──
  function text(ctx, s, x, y, size, color, align = 'left', weight = 'bold') {
    s = fmtGold(s);  // 골드 쉼표(12345G → 12,345G)
    ctx.font = weight + ' ' + size + 'px ' + FONT;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillText(s, x + Math.max(1, size / 14), y + Math.max(1, size / 14));
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
  function panel(ctx, x, y, w, h, o = {}) {
    ctx.fillStyle = o.bg || '#150e13';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = o.border || '#5a4650';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    if (o.hi) { ctx.strokeStyle = o.hi; ctx.strokeRect(x + 3, y + 3, w - 6, h - 6); }
  }
  function bar(ctx, x, y, w, h, k, fg, bg = '#2a1418') {
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fg; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), h);
  }

  return { WEAPON_TINT, FONT, mix, ready, spr, anim, icon, stoneIcon, scrollIcon, essenceIcon, text, panel, bar };
})();
