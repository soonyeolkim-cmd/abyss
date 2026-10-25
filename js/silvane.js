// 광산 도시 실베인(2026-10-25 사용자: 다음 마을을 미리 — 땅 위 야외, 벨록보다 밝게, 오르반 둘레 수레 · 철길 같은 광산 소품을 살려서, NPC 는 지금 사람 그대로).
// 은맥 도시: 위 = 하늘 · 먼 산 · 은빛 줄 박힌 절벽과 왕의 갱도 입구(던전 입구), 그 오른쪽 광산 마당(철길 · 광석 수레 · 은광석 더미 · 상자 = 오르반 자리),
// 가운데 돌 광장(은빛 분수), 윗길 · 아랫길 · 가운데 길(흙), 집(대장간 · 세공사 집 · 창고) · 엘린 노점 · 단지 천막, 나무 · 꽃 · 가로등.
// 마을 모듈(town.js)이 지도 · NPC · 사람을 다루고, 여기는 지도(막힘) · 그림만. 지도 그림은 한 번만 칸 단위로 그려 둔다(픽셀 읽기 없음).
const Silvane = (() => {
  const W = 40, H = 17;
  const px = (tx, ty, x) => ({ x: x !== undefined ? x : tx * T + 8, y: ty * T + 12 });
  // NPC 서는 자리(벨록과 같은 사람들)
  const POS = {
    smith: { ...px(5, 8), flip: false },          // 대장간 문 앞
    gate: px(19, 4, 20 * T),                       // 왕의 갱도 입구(절벽)
    shop: { x: 12 * T + 8, y: 7 * T + 9, flip: false },  // 노점 진열대 뒤(장사꾼 자리 — 앞에 서면 이름표가 진열 물약과 겹침)
    gambler: { ...px(27, 12, 28 * T), flip: false }, // 천막 앞
    jewel: { ...px(4, 12), flip: false },          // 세공사 집 문 앞
    vault: px(35, 13),                             // 창고 앞 아랫길의 보물 상자(문 앞이면 이름표가 간판과 겹침)
    kael: { ...px(16, 5), flip: false },           // 갱도 입구 왼쪽을 지킴
    miner: { ...px(29, 6), flip: false },          // 광산 마당 철길 아래
  };
  const SPAWN = { x: 20 * T, y: 6 * T + 12 };      // 갱도 입구 앞

  // 건물(발밑 칸 tx, ty, tw, th — 모두 막힘). 지붕은 위로 더 솟아 그 뒤로 걸어가면 가려진다
  const HOUSES = [
    { id: 'forge', tx: 2, ty: 5, tw: 6, th: 3, roof: ['#d06a50', '#b0483a', '#7a2e26'], wall: 'wood', door: 3, windows: [1.2, 4.8], chimney: 4.6, sign: 'anvil' },
    { id: 'jewel', tx: 2, ty: 10, tw: 5, th: 2, roof: ['#7aa8f0', '#4a7ad8', '#2e4e9a'], wall: 'plaster', door: 2.5, windows: [1, 4], crystal: true, sign: 'gem' },
    { id: 'vault', tx: 33, ty: 9, tw: 5, th: 3, roof: ['#8a8e98', '#6a6e78', '#44484f'], wall: 'stone', door: 2.5, double: true, windows: [], sign: 'chest' },
  ];
  const STALL = { tx: 10, ty: 6, tw: 5, th: 2 };   // 엘린 노점
  const TENT = { tx: 26, ty: 10, tw: 4, th: 2 };   // 단지 천막
  const RAIL_Y = 5 * T + 8, RAIL_X0 = 20 * T, RAIL_X1 = 35 * T + 4;  // 광산 마당 철길(가로) · 갱도에서 나오는 짧은 세로 갈래
  const CARTS = [[24, 5, 'silver'], [32, 5, 'mixed']];
  const ORE = [[26, 4], [34, 4]];
  const CRATES = [[36, 4], [37, 4], [37, 5]];
  const BUFFER = [36, 5];
  const LAMPS = [[15, 8], [24, 8], [15, 12], [24, 12], [22, 4]];
  const TREES = [[0, 5], [0, 7], [0, 9], [0, 11], [0, 13], [0, 15], [39, 5], [39, 7], [39, 9], [39, 11], [39, 13], [39, 15],
    [9, 4], [6, 15], [12, 15], [26, 15], [33, 15], [9, 11], [31, 9]];
  const JARS = [[25, 12, 1], [30, 12, 0.85]];
  const ANVIL = [8, 7], GEMSTAND = [7, 12];
  const FOUNTAIN = { x: 20 * T, y: 11 * T, tiles: [[19, 10], [20, 10], [19, 11], [20, 11]] };
  const FLOWERS = [];  // 꽃(바닥 그림에 박고, 나비가 그 둘레를 난다) — paint 에서 채움

  // 결정된 무작위(같은 칸은 늘 같은 값)
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  function build() {
    const tiles = new Uint8Array(W * H).fill(1);
    const block = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = 0; };
    for (let x = 0; x < W; x++) { for (let y = 0; y < 4; y++) block(x, y); block(x, 16); }
    for (let y = 0; y < H; y++) { block(0, y); block(W - 1, y); }
    for (const b of [...HOUSES, STALL, TENT]) for (let y = b.ty; y < b.ty + b.th; y++) for (let x = b.tx; x < b.tx + b.tw; x++) block(x, y);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tiles[y * W + x]);
    const m = { W, H, tiles, at, rooms: [], columns: [], hidden: new Set(), crates: new Set() };
    const col = c => { if (at(c[0], c[1])) { m.columns.push(c); m.hidden.add(c.join()); } };
    [...TREES, ...LAMPS, ...ORE, ...CRATES, BUFFER, ANVIL, GEMSTAND, ...FOUNTAIN.tiles].forEach(col);
    CARTS.forEach(c => col([c[0], c[1]])); JARS.forEach(c => col([c[0], c[1]]));
    m.canvas = paint(m); m.painted = true;
    return m;
  }

  // ── 바닥 그림(한 번) ──
  const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
  // 흙길: 윗길 · 아랫길(가로) · 가운데 길(세로) — 가장자리는 조금씩 울퉁불퉁
  function isPath(x, y) {
    const e = hash(x >> 2, y >> 3) * 3;
    if (y >= 8 * T + 1 - e && y < 9 * T + 10 + e && x >= T) return true;
    if (y >= 12 * T + 9 - e && y < 14 * T + 2 + e && x >= T) return true;
    if (x >= 19 * T - e && x < 21 * T + e && y >= 3 * T + 8) return true;
    return false;
  }
  const isPlaza = (x, y) => inRect(x, y, 15 * T, 8 * T, 25 * T, 12 * T + 10);
  const isYard = (x, y) => { const e = hash(x >> 3, 7) * 6; return inRect(x, y, 22 * T - e, 4 * T, 38 * T, 7 * T - 2 + e); };
  function paint() {
    const c = document.createElement('canvas'); c.width = W * T; c.height = H * T;
    const g = c.getContext('2d');
    // 하늘(0 ~ 30) · 먼 산 · 가까운 산
    const sky = g.createLinearGradient(0, 0, 0, 34);
    sky.addColorStop(0, '#7cc4f0'); sky.addColorStop(1, '#d4f0fc');
    g.fillStyle = sky; g.fillRect(0, 0, c.width, 34);
    for (let x = 0; x < c.width; x++) {
      const far = 14 + Math.sin(x * 0.045) * 5 + Math.sin(x * 0.13 + 1) * 2, near = 22 + Math.sin(x * 0.07 + 2) * 4 + Math.sin(x * 0.21) * 1.5;
      g.fillStyle = '#a8c0d8'; g.fillRect(x, Math.round(far), 1, 34 - Math.round(far));
      if (x % 7 < 3 && far < 12) { g.fillStyle = '#f4f8fc'; g.fillRect(x, Math.round(far), 1, 2); }  // 눈 덮인 봉우리
      g.fillStyle = '#7e9cb8'; g.fillRect(x, Math.round(near), 1, 34 - Math.round(near));
    }
    // 절벽(26 ~ 64): 위 풀 테두리 · 바위 결 · 은빛 줄
    for (let y = 26; y < 64; y++) for (let x = 0; x < c.width; x += 2) {
      const n = hash(x >> 1, y);
      let col = y < 30 + (hash(x >> 2, 1) * 3 | 0) ? (n < 0.5 ? '#6ab84a' : '#5aa040') : (y % 9 === 0 || (y + (x >> 4)) % 13 === 0) ? '#8a7c6e' : n < 0.33 ? '#a89a8a' : n < 0.66 ? '#9c8e7e' : '#b2a494';
      if (y >= 60) col = '#7a6c5e';
      g.fillStyle = col; g.fillRect(x, y, 2, 1);
    }
    g.fillStyle = '#d8e4f0';  // 은빛 줄(비스듬히)
    for (let k = 0; k < 14; k++) {
      const x0 = (hash(k, 3) * c.width) | 0, y0 = 36 + (hash(k, 4) * 20 | 0), len = 6 + (hash(k, 5) * 10 | 0);
      if (x0 > 280 && x0 < 360) continue;
      for (let i = 0; i < len; i++) g.fillRect(x0 + i, y0 + Math.round(i * 0.4), 1, 1);
    }
    // 땅(64 ~ 256): 풀 · 광산 마당 자갈 · 흙길 · 광장 돌
    for (let y = 64; y < 256; y += 2) for (let x = 0; x < c.width; x += 2) {
      const n = hash(x >> 1, y >> 1);
      let col;
      if (isPlaza(x, y)) {
        const bx = (x + ((y >> 3) % 2) * 8) % 16, by = y % 8;
        col = bx < 2 || by < 2 ? '#a8a49c' : n < 0.5 ? '#d2cec6' : '#c8c4bc';
      } else if (isPath(x, y)) col = n < 0.12 ? '#b89a70' : n < 0.55 ? '#d8bc92' : '#d0b086';
      else if (isYard(x, y)) col = n < 0.15 ? '#8e8274' : n < 0.6 ? '#bcb0a0' : '#b0a494';
      else col = n < 0.08 ? '#4e9a3e' : n < 0.5 ? '#6cb84c' : n < 0.9 ? '#64b048' : '#7cc458';
      g.fillStyle = col; g.fillRect(x, y, 2, 2);
    }
    // 풀숲(짙은 풀잎 V) · 들꽃
    for (let k = 0; k < 520; k++) {
      const x = (hash(k, 11) * c.width) | 0, y = 66 + (hash(k, 12) * 188 | 0);
      if (isPath(x, y) || isPlaza(x, y) || isYard(x, y)) continue;
      if (k % 4) { g.fillStyle = '#3e8a34'; g.fillRect(x, y, 1, 2); g.fillRect(x + 2, y, 1, 2); g.fillRect(x + 1, y + 1, 1, 2); }
      else {
        const fc = ['#ffffff', '#ffe060', '#ff8ab0', '#b8a0ff'][k % 16 >> 2];
        g.fillStyle = fc; g.fillRect(x, y, 2, 2); g.fillStyle = '#ffd040'; g.fillRect(x, y, 1, 1);
        if (k % 24 === 0) FLOWERS.push([x, y]);
      }
    }
    // 광장 둘레 꽃밭(네 귀퉁이 · 분수 양옆)
    for (const [fx, fy] of [[15.3, 8.2], [23.3, 8.2], [15.3, 11.6], [23.3, 11.6], [17, 10.2], [22.4, 10.2]]) {
      const x0 = fx * T, y0 = fy * T;
      g.fillStyle = '#7a5a3a'; g.fillRect(x0 - 1, y0 - 1, 22, 9);
      g.fillStyle = '#5a3a22'; g.fillRect(x0, y0, 20, 7);
      for (let i = 0; i < 9; i++) {
        g.fillStyle = '#3e8a34'; g.fillRect(x0 + 1 + i * 2, y0 + 2, 1, 4);
        g.fillStyle = ['#ff6a8a', '#ffe060', '#ffffff', '#b8a0ff'][(i + (fx | 0)) % 4]; g.fillRect(x0 + 1 + i * 2, y0 + 1, 2, 2);
      }
      FLOWERS.push([x0 + 10, y0]);
    }
    // 철길: 가로(광산 마당) + 갱도에서 내려오는 세로 갈래
    g.fillStyle = '#6a4a2a';
    for (let x = RAIL_X0 - 2; x < RAIL_X1; x += 5) g.fillRect(x, RAIL_Y - 5, 2, 10);
    for (let y = 58; y < RAIL_Y; y += 5) g.fillRect(RAIL_X0 - 5, y, 10, 2);
    g.fillStyle = '#9aa2b0';
    g.fillRect(RAIL_X0 - 3, RAIL_Y - 4, RAIL_X1 - RAIL_X0 + 3, 1); g.fillRect(RAIL_X0 + 3, RAIL_Y + 3, RAIL_X1 - RAIL_X0 - 3, 1);
    g.fillRect(RAIL_X0 - 3, 56, 1, RAIL_Y - 56 - 3); g.fillRect(RAIL_X0 + 3, 56, 1, RAIL_Y - 56 + 7);
    g.fillStyle = '#d8e0ea'; g.fillRect(RAIL_X0 - 3, RAIL_Y - 5, RAIL_X1 - RAIL_X0 + 3, 1);
    // 왕의 갱도 입구(절벽): 안쪽 어둠 · 나무 문틀 · 위 간판(글은 labels)
    const gx = 20 * T;
    for (let y = 36; y < 64; y++) { const t = (y - 36) / 28; g.fillStyle = 'rgb(' + Math.round(18 + 22 * t) + ',' + Math.round(14 + 16 * t) + ',' + Math.round(12 + 12 * t) + ')'; g.fillRect(gx - 17, y, 34, 1); }
    g.fillStyle = '#0a0806'; g.fillRect(gx - 13, 38, 26, 10);
    g.fillStyle = '#3a2414'; g.fillRect(gx - 21, 30, 6, 34); g.fillRect(gx + 15, 30, 6, 34); g.fillRect(gx - 24, 27, 48, 7);
    g.fillStyle = '#7a5434'; g.fillRect(gx - 20, 31, 4, 33); g.fillRect(gx + 16, 31, 4, 33); g.fillRect(gx - 23, 28, 46, 5);
    g.fillStyle = '#9a7048'; g.fillRect(gx - 20, 31, 1, 33); g.fillRect(gx + 16, 31, 1, 33); g.fillRect(gx - 23, 28, 46, 1);
    g.fillStyle = '#3a2414'; g.fillRect(gx - 14, 14, 28, 13); g.fillStyle = '#c8a070'; g.fillRect(gx - 13, 15, 26, 11); g.fillStyle = '#a87c4e'; g.fillRect(gx - 13, 24, 26, 2);  // 간판
    g.fillStyle = '#5a3a22'; g.fillRect(gx - 10, 26, 1, 2); g.fillRect(gx + 9, 26, 1, 2);
    // 아래 산울타리(맨 아래 줄)
    for (let x = 0; x < c.width; x += 2) for (let y = 256; y < 272; y += 2) { const n = hash(x, y); g.fillStyle = y < 258 + (n * 3 | 0) ? '#5aa848' : n < 0.4 ? '#2e6a2c' : '#3e7a34'; g.fillRect(x, y, 2, 2); }
    // 건물 · 노점 · 천막 그림자(땅 위, 오른쪽 아래로)
    g.fillStyle = 'rgba(20,40,10,0.22)';
    for (const b of [...HOUSES, STALL, TENT]) { g.fillRect(b.tx * T + 4, (b.ty + b.th) * T, b.tw * T, 4); g.fillRect((b.tx + b.tw) * T, b.ty * T + 6, 4, b.th * T - 2); }
    return c;
  }

  // ── 그림 조각(캐시) ──
  const cache = {};
  const mk = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')); return c; };
  // 집: 위로 솟은 지붕(기와 줄 · 용마루 · 처마 그림자) + 앞벽(나무 · 회벽 · 돌) + 문 · 창(꽃 상자) · 간판 · 굴뚝
  const PAD = 12, WALL = 22;
  function houseArt(b) {
    if (cache[b.id]) return cache[b.id];
    const bw = b.tw * T, rh = b.th * T - WALL + 12, w = bw + 8, h = PAD + rh + WALL + 2;
    return (cache[b.id] = mk(w, h, g => {
      const ox = 4, wy = PAD + rh;  // 벽 위 끝
      // 앞벽
      if (b.wall === 'wood') {
        g.fillStyle = '#b08a5a'; g.fillRect(ox, wy, bw, WALL);
        g.fillStyle = '#8a6a42'; for (let y = wy + 4; y < wy + WALL; y += 4) g.fillRect(ox, y, bw, 1);
        g.fillStyle = '#6a4a2a'; g.fillRect(ox, wy, 2, WALL); g.fillRect(ox + bw - 2, wy, 2, WALL);
      } else if (b.wall === 'plaster') {
        g.fillStyle = '#f2ece0'; g.fillRect(ox, wy, bw, WALL);
        g.fillStyle = '#7a5434'; g.fillRect(ox, wy, 2, WALL); g.fillRect(ox + bw - 2, wy, 2, WALL); g.fillRect(ox, wy + 2, bw, 2);
        for (let x = ox + 24; x < ox + bw - 8; x += 24) g.fillRect(x, wy, 2, WALL);
      } else {
        g.fillStyle = '#b4b0a8'; g.fillRect(ox, wy, bw, WALL);
        g.fillStyle = '#8a867e'; for (let y = wy; y < wy + WALL; y += 5) { g.fillRect(ox, y, bw, 1); for (let x = ox + ((y / 5) % 2 ? 0 : 5); x < ox + bw; x += 10) g.fillRect(x, y, 1, 5); }
        g.fillStyle = '#c8962e'; g.fillRect(ox, wy + 1, bw, 1);  // 금 띠(창고)
      }
      g.fillStyle = '#6a625a'; g.fillRect(ox - 1, wy + WALL - 2, bw + 2, 3);  // 주춧돌
      // 창: 유리 · 십자 틀 · 꽃 상자
      for (const wx of b.windows) {
        const x = ox + Math.round(wx * T) - 5, y = wy + 5;
        g.fillStyle = '#4a2e1a'; g.fillRect(x - 1, y - 1, 12, 10);
        g.fillStyle = '#a8dcf4'; g.fillRect(x, y, 10, 8); g.fillStyle = '#e8f8ff'; g.fillRect(x + 1, y + 1, 3, 2);
        g.fillStyle = '#4a2e1a'; g.fillRect(x + 4, y, 2, 8); g.fillRect(x, y + 3, 10, 2);
        g.fillStyle = '#6a4a2a'; g.fillRect(x - 2, y + 9, 14, 3);
        for (let i = 0; i < 5; i++) { g.fillStyle = ['#ff6a8a', '#ffe060', '#ff6a8a', '#ffffff', '#ffe060'][i]; g.fillRect(x - 1 + i * 3, y + 7, 2, 2); }
      }
      // 문
      const dw = b.double ? 22 : 12, dx = ox + Math.round(b.door * T) - dw / 2, dy = wy + WALL - 17;
      g.fillStyle = '#3a2414'; g.fillRect(dx - 2, dy - 2, dw + 4, 17);
      g.fillStyle = b.double ? '#5a5048' : '#7a4a26'; g.fillRect(dx, dy, dw, 15);
      g.fillStyle = b.double ? '#3a342e' : '#5a3418';
      if (b.double) { g.fillRect(dx + dw / 2 - 1, dy, 2, 15); g.fillStyle = '#8a8e98'; g.fillRect(dx, dy + 3, dw, 2); g.fillRect(dx, dy + 10, dw, 2); }
      else for (let x = dx + 3; x < dx + dw; x += 3) g.fillRect(x, dy, 1, 15);
      g.fillStyle = '#e8c040'; g.fillRect(b.double ? dx + dw / 2 - 3 : dx + dw - 3, dy + 7, 2, 2);
      // 간판(문 옆 쇠 팔에 걸림) + 그림
      const sx = Math.min(ox + bw - 14, dx + dw + 4), sy = wy + 2;
      g.fillStyle = '#3a3e48'; g.fillRect(sx - 1, sy, 13, 1); g.fillRect(sx + 1, sy, 1, 3); g.fillRect(sx + 9, sy, 1, 3);
      g.fillStyle = '#4a2e1a'; g.fillRect(sx, sy + 3, 11, 9); g.fillStyle = '#c8a070'; g.fillRect(sx + 1, sy + 4, 9, 7);
      const icon = { anvil: ['.........', '.ooooooo.', 'ooooooo..', '...ooo...', '..ooooo..'], gem: ['...o.....', '..ooo....', '.ooooo...', '..ooo....', '...o.....'], chest: ['.ooooooo.', '.o..o..o.', '.ooooooo.', '.o.....o.', '.ooooooo.'] }[b.sign];
      const ic = { anvil: '#3a3e48', gem: '#4a7ad8', chest: '#a8742a' }[b.sign];
      icon.forEach((row, r) => [...row].forEach((ch, i) => { if (ch === 'o') { g.fillStyle = ic; g.fillRect(sx + 1 + i, sy + 5 + r, 1, 1); } }));
      // 지붕(벽 위로): 기와 줄마다 어두운 선 · 엇갈린 이음매 · 위로 갈수록 밝게, 용마루 · 처마 그림자
      const [rl, rm, rd] = b.roof;
      g.fillStyle = rd; g.fillRect(0, PAD - 2, w, rh + 2);
      for (let y = PAD; y < PAD + rh; y++) {
        const row = Math.floor((y - PAD) / 4);
        g.fillStyle = (y - PAD) % 4 === 3 ? rd : row < 2 ? rl : rm;
        g.fillRect(1, y, w - 2, 1);
        if ((y - PAD) % 4 !== 3) { g.fillStyle = rd; for (let x = 1 + (row % 2) * 3; x < w - 1; x += 6) g.fillRect(x, y, 1, 1); }
      }
      g.fillStyle = rd; g.fillRect(0, PAD - 3, w, 3); g.fillStyle = rl; g.fillRect(1, PAD - 3, w - 2, 1);  // 용마루
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(ox, wy, bw, 2);  // 처마 그림자
      if (b.chimney) {  // 굴뚝(벽돌)
        const cx = Math.round(b.chimney * T) + ox - 4;
        g.fillStyle = '#5a2e22'; g.fillRect(cx - 1, 0, 10, PAD + 6);
        g.fillStyle = '#9a4a3a'; g.fillRect(cx, 1, 8, PAD + 4);
        g.fillStyle = '#7a3a2e'; for (let y = 3; y < PAD + 5; y += 3) g.fillRect(cx, y, 8, 1);
        g.fillStyle = '#3a3e48'; g.fillRect(cx - 2, 0, 12, 2);
      }
      if (b.crystal) {  // 세공사 집 용마루 위 결정(빛은 그릴 때)
        const cx = w / 2;
        for (const [dx, hh] of [[-4, 6], [0, 10], [4, 7]]) for (let r = 0; r < hh; r++) {
          const hw = Math.max(1, Math.round(2 * (r + 1) / hh));
          g.fillStyle = '#1a1030'; g.fillRect(cx + dx - hw - 1, PAD - 3 - hh + r, hw * 2 + 2, 1);
          g.fillStyle = r < 2 ? '#e8fcff' : '#6ad8ff'; g.fillRect(cx + dx - hw, PAD - 3 - hh + r, hw * 2, 1);
        }
      }
    }));
  }
  const housePos = b => ({ x: b.tx * T - 4, y: (b.ty + b.th) * T - (PAD + b.th * T - WALL + 12 + WALL) });
  // 엘린 노점: 줄무늬 차양(초록 · 흰) · 기둥 넷 · 나무 진열대 위 물약
  function stallArt() {
    if (cache.stall) return cache.stall;
    const bw = STALL.tw * T, w = bw + 8, h = STALL.th * T + 22;
    return (cache.stall = mk(w, h, g => {
      const ox = 4, base = h - 1;
      g.fillStyle = '#5a3a22'; for (const x of [ox + 1, ox + bw - 3]) g.fillRect(x, 8, 2, base - 8);
      g.fillStyle = '#3a2414'; g.fillRect(ox - 1, base - 13, bw + 2, 14);  // 진열대
      g.fillStyle = '#9a6a3a'; g.fillRect(ox, base - 12, bw, 12);
      g.fillStyle = '#b8844a'; g.fillRect(ox, base - 12, bw, 3);
      g.fillStyle = '#7a5030'; for (let x = ox + 10; x < ox + bw; x += 10) g.fillRect(x, base - 9, 1, 9);
      // 차양: 줄무늬 · 아래 물결 끝
      for (let x = 0; x < w; x++) {
        const s = Math.floor(x / 6) % 2, top = 2 + Math.round(Math.abs(x - w / 2) / (w / 2) * 3), bot = 16 + (x % 6 < 3 ? 2 : 0);
        g.fillStyle = s ? '#f4f4ec' : '#3a9a5a'; g.fillRect(x, top, 1, bot - top);
        g.fillStyle = s ? '#c8c8c0' : '#2a7040'; g.fillRect(x, bot - 1, 1, 1);
      }
      g.fillStyle = '#2a7040'; g.fillRect(0, 1, w, 2);
    }));
  }
  // 단지 천막: 보라 · 금 세로 줄무늬 종 모양 · 열린 문 · 꼭대기 깃발(그릴 때 펄럭)
  function tentArt() {
    if (cache.tent) return cache.tent;
    const bw = TENT.tw * T, w = bw + 8, h = TENT.th * T + 30;
    return (cache.tent = mk(w, h, g => {
      const cx = w / 2, base = h - 1, peak = 4;
      for (let y = peak; y <= base; y++) {
        const t = (y - peak) / (base - peak), hw = Math.round((w / 2 - 2) * Math.min(1, Math.pow(t, 0.6) * 1.05));
        for (let x = cx - hw; x < cx + hw; x++) {
          const s = Math.floor((x - cx + 64) / 6) % 2;
          g.fillStyle = t > 0.92 ? (s ? '#a8862a' : '#4a2a6a') : s ? '#e8c040' : '#6a3a8a';
          g.fillRect(x, y, 1, 1);
        }
        g.fillStyle = '#2a1a3a'; g.fillRect(cx - hw - 1, y, 1, 1); g.fillRect(cx + hw, y, 1, 1);
      }
      g.fillStyle = '#e8c040'; for (let x = 4; x < w - 4; x += 4) g.fillRect(x, base - 12, 2, 2);  // 금 술 띠
      // 열린 문(어두운 세모 + 걷어 올린 천)
      for (let y = base - 20; y <= base; y++) { const hw = Math.round((y - (base - 20)) * 0.45); g.fillStyle = '#1a0e1a'; g.fillRect(cx - hw, y, hw * 2, 1); }
      g.fillStyle = '#8a5ab0'; g.fillRect(cx - 9, base - 8, 3, 8); g.fillRect(cx + 6, base - 8, 3, 8);
      g.fillStyle = '#5a3a22'; g.fillRect(cx, 0, 1, peak + 2);
    }));
  }
  // 나무(둥근 잎 덩이 셋 겹침 · 밝은 윗면) — 크기 둘
  function treeArt(k) {
    const key = 'tree' + k;
    if (cache[key]) return cache[key];
    const r = k ? 11 : 14, w = r * 2 + 6, h = r * 2 + 16;
    return (cache[key] = mk(w, h, g => {
      const cx = w / 2;
      g.fillStyle = '#4a3020'; g.fillRect(cx - 3, h - 14, 6, 14); g.fillStyle = '#6a4a2a'; g.fillRect(cx - 2, h - 14, 3, 14);
      const blob = (x, y, rr, col) => { g.fillStyle = col; for (let dy = -rr; dy <= rr; dy++) { const hw = Math.round(Math.sqrt(rr * rr - dy * dy)); g.fillRect(Math.round(x - hw), Math.round(y + dy), hw * 2, 1); } };
      const cy = r + 2;
      blob(cx, cy + 1, r + 1, '#1e4a24');
      blob(cx - r * 0.45, cy + 2, r * 0.7, '#2e6a34'); blob(cx + r * 0.45, cy + 2, r * 0.7, '#2e6a34'); blob(cx, cy - 2, r * 0.8, '#3e8a40');
      blob(cx - r * 0.3, cy - r * 0.35, r * 0.45, '#5aa84a'); blob(cx - r * 0.35, cy - r * 0.45, r * 0.2, '#8ac860');
      for (let i = 0; i < 6; i++) { g.fillStyle = '#1e4a24'; g.fillRect(Math.round(cx - r * 0.6 + hash(i, k) * r * 1.2), Math.round(cy + hash(k, i) * r * 0.7), 2, 1); }
    }));
  }

  // ── 앞뒤 정렬 물건 + 바닥 위 움직이는 것 ──
  let T0 = 0;
  function world(ctx, list, time) {
    T0 = time;
    // 하늘: 흘러가는 구름 · 새 두 마리
    for (let i = 0; i < 4; i++) {
      const x = ((time * (4 + i) + i * 190) % (W * T + 80)) - 40, y = 4 + (i % 2) * 7;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(Math.round(x), y + 2, 26, 5); ctx.fillRect(Math.round(x) + 5, y, 14, 3); ctx.fillRect(Math.round(x) + 3, y + 6, 18, 2);
    }
    ctx.fillStyle = '#3a4a5a';
    for (let i = 0; i < 2; i++) {
      const bx = ((time * 22 + i * 300) % (W * T + 60)) - 30, by = 10 + i * 6 + Math.sin(time * 2 + i) * 2, f = Math.sin(time * 9 + i) > 0;
      ctx.fillRect(Math.round(bx) - 2, Math.round(by) - (f ? 1 : 0), 2, 1); ctx.fillRect(Math.round(bx), Math.round(by), 1, 1); ctx.fillRect(Math.round(bx) + 1, Math.round(by) - (f ? 1 : 0), 2, 1);
    }
    // 절벽 은빛 반짝 · 갱도 입구 양옆 등불
    for (let k = 0; k < 10; k++) {
      const x = (hash(k, 21) * W * T) | 0, y = 36 + (hash(k, 22) * 22 | 0);
      if (Math.sin(time * 2.5 + k * 1.7) > 0.85) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
    }
    for (const lx of [20 * T - 26, 20 * T + 24]) {
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(lx - 2, 38, 4, 6); ctx.fillStyle = '#ffd36a'; ctx.fillRect(lx - 1, 39, 2, 4);
      glow(ctx, lx, 41, 12, '255,200,100', 0.3 + 0.08 * Math.sin(time * 7 + lx));
    }
    // 건물 · 노점 · 천막
    for (const b of HOUSES) list.push({ y: (b.ty + b.th) * T, draw: () => {
      const pos = housePos(b);
      ctx.drawImage(houseArt(b), pos.x, pos.y);
      if (b.chimney) smoke(ctx, pos.x + Math.round(b.chimney * T) + 4, pos.y, time, 'rgba(230,230,235,');
      if (b.crystal) glow(ctx, pos.x + (b.tw * T + 8) / 2, pos.y + PAD - 8, 16, '110,210,255', 0.35 + 0.12 * Math.sin(time * 2));
    } });
    list.push({ y: (STALL.ty + STALL.th) * T, draw: () => {
      const x = STALL.tx * T - 4, y = (STALL.ty + STALL.th) * T - (STALL.th * T + 22) + 1;
      ctx.drawImage(stallArt(), x, y);
      [['flask_big_red', 10], ['flask_big_blue', 22], ['flask_red', 32], ['flask_big_green', 62], ['flask_big_yellow', 74]].forEach(([f, dx]) => Gfx.spr(ctx, f, x + dx, y + STALL.th * T + 9));  // 가운데는 엘린 자리
    } });
    list.push({ y: (TENT.ty + TENT.th) * T, draw: () => {
      const x = TENT.tx * T - 4, y = (TENT.ty + TENT.th) * T - (TENT.th * T + 30) + 1, cx = x + (TENT.tw * T + 8) / 2;
      ctx.drawImage(tentArt(), x, y);
      const wv = Math.round(Math.sin(time * 6) * 1);  // 깃발
      ctx.fillStyle = '#e83a4a'; ctx.fillRect(cx + 1, y - 1, 6, 2); ctx.fillRect(cx + 1, y + 1 + wv, 4, 2); ctx.fillRect(cx + 1, y + 3, 2, 1);
    } });
    // 광산 마당: 광석 수레 · 은광석 더미 · 상자 · 철길 끝 막이 · 등불 기둥
    for (const [cx, cy, kind] of CARTS) list.push({ y: (cy + 1) * T - 2, draw: () => cart(ctx, cx * T + 8, RAIL_Y + 3, kind, time) });
    for (const [ox, oy] of ORE) list.push({ y: (oy + 1) * T - 2, draw: () => orePile(ctx, ox * T + 8, (oy + 1) * T - 2, time, ox) });
    for (const [x, y] of CRATES) list.push({ y: (y + 1) * T - 4, draw: () => Gfx.spr(ctx, 'crate', x * T + 8, (y + 1) * T - 2) });
    list.push({ y: (BUFFER[1] + 1) * T - 2, draw: () => {
      const x = BUFFER[0] * T + 2, y = RAIL_Y - 8;
      ctx.fillStyle = '#3a2414'; ctx.fillRect(x - 1, y - 1, 12, 12); ctx.fillStyle = '#8a5a32'; ctx.fillRect(x, y, 10, 10);
      ctx.fillStyle = '#e8c040'; ctx.fillRect(x, y + 2, 10, 2); ctx.fillStyle = '#3a3e48'; ctx.fillRect(x, y + 6, 10, 2);
    } });
    for (const [lx, ly] of LAMPS) list.push({ y: (ly + 1) * T - 2, draw: () => lamp(ctx, lx * T + 8, (ly + 1) * T - 3, time) });
    // 나무(살랑) · 단지 항아리 · 대장간 모루 · 세공사 보석 받침
    TREES.forEach(([tx, ty], i) => list.push({ y: (ty + 1) * T - 2, draw: () => {
      const art = treeArt(i % 3 === 2 ? 1 : 0), sw = Math.round(Math.sin(time * 1.1 + i) * 0.7);
      ctx.fillStyle = 'rgba(20,40,10,0.25)'; ctx.fillRect(tx * T + 8 - 10, (ty + 1) * T - 4, 20, 4);
      ctx.drawImage(art, tx * T + 8 - art.width / 2 + sw, (ty + 1) * T - art.height);
    } }));
    for (const [x, y, k] of JARS) list.push({ y: (y + 1) * T - 2, draw: () => {
      const s = Math.round(17 * k);
      ctx.fillStyle = 'rgba(20,40,10,0.25)'; ctx.fillRect(x * T + 8 - 6, (y + 1) * T - 4, 12, 3);
      ctx.drawImage(Jar.jarArt(), Math.round(x * T + 8 - s / 2), (y + 1) * T - 1 - s, s, s);
    } });
    list.push({ y: (ANVIL[1] + 1) * T - 2, draw: () => anvil(ctx, ANVIL[0] * T + 8, (ANVIL[1] + 1) * T - 3, time) });
    list.push({ y: (GEMSTAND[1] + 1) * T - 2, draw: () => gemStand(ctx, GEMSTAND[0] * T + 8, (GEMSTAND[1] + 1) * T - 3, time) });
    list.push({ y: FOUNTAIN.y + 16, draw: () => fountain(ctx, time) });
  }

  // 앞(사람 위): 구름 그림자가 천천히 땅 위를 지나감 · 나비 · 비스듬한 햇살
  function front(ctx, time, cam) {
    ctx.fillStyle = 'rgba(30,50,90,0.10)';
    for (let i = 0; i < 2; i++) {
      const x = ((time * (6 + i * 2) + i * 330) % (W * T + 240)) - 120, y = 90 + i * 90;
      for (let dy = -22; dy <= 22; dy += 2) { const hw = Math.round(70 * Math.sqrt(1 - (dy / 23) ** 2)); ctx.fillRect(Math.round(x - hw), y + dy, hw * 2, 2); }
    }
    FLOWERS.slice(0, 4).forEach(([fx, fy], i) => {  // 나비: 꽃 둘레를 8자로
      const t = time * 0.8 + i * 2, x = fx + Math.sin(t) * 14, y = fy - 8 + Math.sin(t * 2) * 5, f = Math.sin(time * 18 + i) > 0;
      ctx.fillStyle = ['#ffffff', '#ffe060', '#ff8ab0', '#8ad8ff'][i];
      ctx.fillRect(Math.round(x) - (f ? 2 : 1), Math.round(y), f ? 2 : 1, 2); ctx.fillRect(Math.round(x) + 1, Math.round(y), f ? 2 : 1, 2);
      ctx.fillStyle = '#3a2a2a'; ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
    });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';  // 햇살
    for (let i = 0; i < 3; i++) {
      const x0 = cam.x + 60 + i * 150 + Math.sin(time * 0.3 + i) * 10;
      ctx.fillStyle = 'rgba(255,240,200,' + (0.035 + 0.015 * Math.sin(time * 0.7 + i)) + ')';
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 40, 0); ctx.lineTo(x0 - 60, 280); ctx.lineTo(x0 - 110, 280); ctx.fill();
    }
    ctx.restore();
  }

  // 화면 좌표 글: 갱도 간판
  function labels(ctx, sx, sy) {
    Gfx.text(ctx, '왕의 갱도', sx(20 * T), sy(24), 12, '#3a2414', 'center', 'bold');
  }

  // ── 작은 그림 ──
  function glow(ctx, x, y, r, rgb, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + rgb + ',' + Math.max(0, a) + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  function ell(ctx, cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (let dy = -ry; dy <= ry; dy++) { const hw = rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)); ctx.fillRect(Math.round(cx - hw), Math.round(cy + dy), Math.round(hw * 2), 1); }
  }
  function smoke(ctx, x, y, time, rgba) {
    for (let k = 0; k < 5; k++) {
      const u = (time * 0.35 + k / 5) % 1;
      ctx.fillStyle = rgba + (0.6 * (1 - u)) + ')';
      ctx.beginPath(); ctx.arc(x + u * 8 + Math.sin(u * 6 + k) * 2, y - u * 26, 1.5 + u * 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 광석 수레(벨록 오르반 수레와 같은 꼴, 실은 것만 다름): silver = 은광석, mixed = 은 · 금 · 푸른 알갱이
  function cart(ctx, cx, by, kind, time) {
    ctx.fillStyle = 'rgba(20,20,10,0.25)'; ctx.fillRect(cx - 9, by - 2, 18, 3);
    ctx.fillStyle = '#16181e'; ctx.fillRect(cx - 9, by - 15, 18, 3); ctx.fillRect(cx - 8, by - 12, 16, 8);
    ctx.fillStyle = '#5a5e68'; ctx.fillRect(cx - 7, by - 12, 14, 7);
    ctx.fillStyle = '#3a3e48'; ctx.fillRect(cx - 7, by - 9, 14, 1); ctx.fillRect(cx - 2, by - 12, 1, 7); ctx.fillRect(cx + 3, by - 12, 1, 7);
    ctx.fillStyle = '#8a92a0'; ctx.fillRect(cx - 8, by - 14, 16, 1);
    ctx.fillStyle = '#c8962e'; ctx.fillRect(cx - 6, by - 11, 1, 1); ctx.fillRect(cx + 5, by - 11, 1, 1);
    for (const wx of [cx - 5, cx + 4]) { ctx.fillStyle = '#16181e'; ctx.fillRect(wx - 2, by - 5, 4, 4); ctx.fillStyle = '#4a4e58'; ctx.fillRect(wx - 1, by - 4, 2, 2); }
    const rocks = kind === 'silver' ? ['#8a9098', '#a8b0b8', '#c0c8d0'] : ['#6a5e58', '#7a6e66', '#8a7e76'];
    for (const [dx, dy, r, i] of [[-5, -16, 3, 0], [0, -17, 4, 1], [5, -16, 3, 2], [-2, -19, 2, 2], [3, -19, 2, 1]]) ell(ctx, cx + dx, by + dy, r, Math.max(1, r - 1), rocks[i]);
    const specks = kind === 'silver' ? ['#ffffff', '#e8f0ff', '#ffffff', '#d8e4f0'] : ['#e8f0ff', '#ffd36a', '#6ab8ff', '#ffd36a'];
    [[-4, -17], [1, -19], [5, -17], [-1, -15]].forEach(([dx, dy], i) => { ctx.fillStyle = Math.sin(time * 3 + i * 1.9 + cx) > 0.2 ? specks[i] : rocks[0]; ctx.fillRect(cx + dx, by + dy, 1, 1); });
  }
  // 은광석 더미: 회색 바위 무더기 · 은빛 결 · 반짝, 곡괭이가 꽂혀 있음(하나 걸러)
  function orePile(ctx, cx, by, time, seed) {
    ctx.fillStyle = 'rgba(20,20,10,0.25)'; ctx.fillRect(cx - 10, by - 2, 20, 3);
    for (const [dx, dy, r, c] of [[-6, -3, 4, '#7a7e86'], [5, -3, 4, '#868a92'], [0, -5, 5, '#9aa0a8'], [-3, -9, 3, '#b0b6be'], [3, -9, 3, '#a0a6ae']]) { ell(ctx, cx + dx, by + dy, r + 1, r, '#3a3e44'); ell(ctx, cx + dx, by + dy, r, r - 1, c); }
    ctx.fillStyle = '#e8f0f8'; ctx.fillRect(cx - 2, by - 6, 3, 1); ctx.fillRect(cx + 3, by - 9, 2, 1); ctx.fillRect(cx - 6, by - 3, 2, 1);
    if (Math.sin(time * 3 + seed) > 0.6) { ctx.fillStyle = '#ffffff'; ctx.fillRect(cx, by - 8, 1, 1); ctx.fillRect(cx - 1, by - 7, 3, 1); }
    if (seed % 2 === 0) {  // 꽂힌 곡괭이
      ctx.fillStyle = '#5a3a22'; for (let i = 0; i < 10; i++) ctx.fillRect(cx + 6 - Math.round(i * 0.3), by - 8 - i, 1, 1);
      ctx.fillStyle = '#2a2422'; ctx.fillRect(cx - 1, by - 20, 9, 3); ctx.fillStyle = '#9aa2b0'; ctx.fillRect(cx, by - 19, 7, 1);
    }
  }
  // 가로등: 쇠 기둥 · 등(낮이라 은은하게)
  function lamp(ctx, x, by, time) {
    ctx.fillStyle = 'rgba(20,40,10,0.25)'; ctx.fillRect(x - 4, by - 1, 8, 3);
    ctx.fillStyle = '#2a2e36'; ctx.fillRect(x - 1, by - 22, 3, 22); ctx.fillRect(x - 3, by - 2, 7, 2);
    ctx.fillStyle = '#4a4e58'; ctx.fillRect(x, by - 22, 1, 20);
    ctx.fillStyle = '#2a2e36'; ctx.fillRect(x - 3, by - 28, 7, 7); ctx.fillStyle = '#ffe8a0'; ctx.fillRect(x - 2, by - 27, 5, 5);
    ctx.fillStyle = '#2a2e36'; ctx.fillRect(x - 4, by - 29, 9, 1);
    glow(ctx, x, by - 25, 10, '255,220,140', 0.18 + 0.05 * Math.sin(time * 5 + x));
  }
  // 모루(대장간 밖): 달군 쇳덩이 · 불티
  function anvil(ctx, x, y, time) {
    ctx.fillStyle = 'rgba(20,40,10,0.25)'; ctx.fillRect(x - 8, y - 1, 16, 3);
    ctx.fillStyle = '#16181e'; ctx.fillRect(x - 7, y - 5, 14, 6); ctx.fillRect(x - 4, y - 9, 8, 5); ctx.fillRect(x - 10, y - 13, 20, 5); ctx.fillRect(x - 14, y - 12, 5, 3);
    ctx.fillStyle = '#3a3e48'; ctx.fillRect(x - 6, y - 4, 12, 4);
    ctx.fillStyle = '#2e3138'; ctx.fillRect(x - 3, y - 8, 6, 4);
    ctx.fillStyle = '#4a4e58'; ctx.fillRect(x - 9, y - 12, 18, 3); ctx.fillRect(x - 13, y - 11, 4, 1);
    ctx.fillStyle = '#9aa2b0'; ctx.fillRect(x - 9, y - 12, 18, 1);
    ctx.fillStyle = '#ff9a3a'; ctx.fillRect(x - 2, y - 15, 5, 2); ctx.fillStyle = '#ffe08a'; ctx.fillRect(x - 1, y - 15, 2, 1);
    glow(ctx, x, y - 14, 10, '255,140,50', 0.25 + 0.1 * Math.sin(time * 4));
    const ph = time % 1.3;
    if (ph < 0.4) for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.45, sp = 22 + (i % 3) * 8;
      ctx.fillStyle = i % 2 ? '#ffd36a' : '#ff8a30';
      ctx.fillRect(Math.round(x + Math.cos(a) * sp * ph), Math.round(y - 15 + Math.sin(a) * sp * ph + 60 * ph * ph), 1, 1);
    }
  }
  // 보석 받침대(세공사 집 옆): 떠 있는 깎은 보석, 색이 천천히 바뀜
  const GEM_ROWS = ['..ooooo..', '.oLWLMLo.', 'oLLMMMDDo', 'oMMMMMDDo', '.oMMMDDo.', '..oMMDo..', '...oDo...', '....o....'];
  const GEM_HUES = [['#e0c0ff', '#b070ff', '#6a30b0', '180,120,255'], ['#ffc8e8', '#ff70c0', '#a03070', '255,120,200'], ['#c8f4ff', '#6ad8ff', '#2a80b0', '110,210,255']];
  function gemStand(ctx, cx, by, time) {
    ctx.fillStyle = 'rgba(20,40,10,0.25)'; ctx.fillRect(cx - 7, by - 1, 14, 3);
    ctx.fillStyle = '#2a2422'; ctx.fillRect(cx - 7, by - 4, 14, 5); ctx.fillRect(cx - 4, by - 13, 8, 10); ctx.fillRect(cx - 6, by - 16, 12, 4);
    ctx.fillStyle = '#d8d4cc'; ctx.fillRect(cx - 6, by - 3, 12, 3); ctx.fillRect(cx - 3, by - 12, 6, 9); ctx.fillRect(cx - 5, by - 15, 10, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 3, by - 12, 1, 9);
    ctx.fillStyle = '#c8962e'; ctx.fillRect(cx - 5, by - 14, 10, 1);
    const [l, m, d, rgb] = GEM_HUES[Math.floor(time / 4) % 3], gy = by - 28 + Math.round(Math.sin(time * 2) * 1.5);
    glow(ctx, cx, gy + 4, 14, rgb, 0.4);
    GEM_ROWS.forEach((row, r) => [...row].forEach((ch, c) => {
      const col = { o: '#1a1030', L: l, M: m, D: d, W: Math.sin(time * 4) > 0.3 ? '#ffffff' : l }[ch];
      if (col) { ctx.fillStyle = col; ctx.fillRect(cx - 4 + c, gy + r, 1, 1); }
    }));
  }
  // 은빛 분수: 넓은 돌 수반 · 맑은 물 · 물결 · 가운데 기둥 위 그릇 두 단 · 솟는 물 · 떨어지는 물방울
  function fountain(ctx, time) {
    const cx = FOUNTAIN.x, cy = FOUNTAIN.y + 2;
    ctx.fillStyle = 'rgba(20,40,10,0.22)'; ell(ctx, cx + 2, cy + 11, 19, 5, 'rgba(20,40,10,0.22)');
    ell(ctx, cx, cy + 5, 18, 10, '#5a5650'); ell(ctx, cx, cy, 18, 10, '#5a5650');
    ell(ctx, cx, cy + 5, 17, 9, '#a8a49c'); ell(ctx, cx, cy, 17, 9, '#e8e4dc');
    ell(ctx, cx, cy, 14, 6, '#3a8ad0'); ell(ctx, cx, cy + 1, 13, 5, '#5aaae8');
    ctx.fillStyle = '#c8ecff';
    for (let k = 0; k < 2; k++) {
      const u = (time * 0.7 + k * 0.5) % 1, rx = 3 + u * 10, ry = 1.2 + u * 4;
      ctx.globalAlpha = 1 - u;
      for (let a = 0; a < 18; a++) { const an = a / 18 * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(an) * rx), Math.round(cy + 1 + Math.sin(an) * ry), 1, 1); }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#5a5650'; ctx.fillRect(cx - 3, cy - 16, 6, 17);
    ctx.fillStyle = '#d8d4cc'; ctx.fillRect(cx - 2, cy - 15, 4, 16); ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 2, cy - 15, 1, 16);
    ell(ctx, cx, cy - 15, 7, 2, '#5a5650'); ell(ctx, cx, cy - 15, 6, 1, '#e8e4dc'); ctx.fillStyle = '#8acdf8'; ctx.fillRect(cx - 4, cy - 16, 8, 1);
    ell(ctx, cx, cy - 22, 4, 1, '#5a5650'); ctx.fillStyle = '#e8e4dc'; ctx.fillRect(cx - 3, cy - 22, 6, 1); ctx.fillStyle = '#d8d4cc'; ctx.fillRect(cx - 1, cy - 21, 2, 5);
    ctx.fillStyle = '#e8f8ff';
    const jet = 4 + Math.round(Math.sin(time * 9) * 1.5);
    ctx.fillRect(cx - 1, cy - 23 - jet, 2, jet); ctx.fillRect(cx, cy - 25 - jet, 1, 1);
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const u = (time * 1.3 + k / 3) % 1;
      ctx.fillRect(Math.round(cx + side * (6 + u * 7)), Math.round(cy - 15 + u * 14 - Math.sin(u * Math.PI) * 3), 1, 2);
    }
    glow(ctx, cx, cy, 22, '150,210,255', 0.12);
  }

  return { build, paint: () => paint(), world, front, labels, POS, SPAWN };
})();
