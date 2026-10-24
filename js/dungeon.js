// 던전 한 층 만들기(디아블로식): 큰 바둑판(셀)에서 시작방 → … → 보스방으로 이어지는 '큰길'을 한 줄로 내고,
// 큰길 중간 방에서 옆으로 빠지는 '샛길 방'(막다른 보물방)을 붙인다. 보스방은 큰길 끝 방 하나와만 이어져서 반드시 마지막에 만난다.
// 복도는 이웃한 두 셀 안에서만 꺾이므로 다른 방을 가로질러 지름길이 생기지 않는다.
// 좌표는 층 왼쪽 위 = (0, 0) 인 픽셀, 칸 = 16px. tiles: 0 = 벽(막힘), 1 = 바닥.
const Dungeon = (() => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const CW = 18, CH = 15, GC = 6, GR = 4;  // 셀 하나 크기(칸) · 셀 가로 · 세로 수
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // 큰길: 셀 위를 겹치지 않게 걷는 길(mainLen 칸). 막히면 다시 굴린다
  function walkPath(mainLen) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const path = [[rnd(0, GC - 1), rnd(0, GR - 1)]], used = new Set([path[0].join()]);
      while (path.length < mainLen) {
        const [cx, cy] = path[path.length - 1];
        const opts = DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < GC && y < GR && !used.has(x + ',' + y));
        if (!opts.length) break;
        const n = opts[rnd(0, opts.length - 1)];
        path.push(n); used.add(n.join());
      }
      if (path.length === mainLen) return { path, used };
    }
    return null;
  }

  function generate(def) {
    const W = GC * CW + 2, H = GR * CH + 4;
    const tiles = new Uint8Array(W * H);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tiles[y * W + x]);
    const set = (x, y, v) => { if (x > 0 && y > 2 && x < W - 1 && y < H - 2) tiles[y * W + x] = v; };
    const branches = Math.min(3, Math.max(2, def.rooms - 7));
    const mainLen = Math.min(GC * GR - branches, def.rooms - branches);
    const { path, used } = walkPath(mainLen);
    // 셀 목록: 큰길(0 = 시작, 마지막 = 보스) + 샛길(큰길 중간 방에 붙은 막다른 방)
    const cells = path.map(([gx, gy], i) => ({ gx, gy, main: true, idx: i }));
    for (let b = 0, tries = 0; b < branches && tries < 200; tries++) {
      const parent = cells[rnd(1, mainLen - 2)];
      const opts = DIRS.map(([dx, dy]) => [parent.gx + dx, parent.gy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < GC && y < GR && !used.has(x + ',' + y));
      if (!opts.length) continue;
      const [gx, gy] = opts[rnd(0, opts.length - 1)];
      used.add(gx + ',' + gy);
      cells.push({ gx, gy, main: false, parent });
      b++;
    }
    // 셀 안에 방 놓기(보스방은 셀을 거의 꽉 채우는 큰 방)
    const rooms = [];
    for (const c of cells) {
      const boss = c.main && c.idx === mainLen - 1;
      const w = boss ? CW - 3 : rnd(9, CW - 5), h = boss ? CH - 4 : rnd(7, CH - 6);
      const x = c.gx * CW + 1 + rnd(1, CW - w - 1), y = c.gy * CH + 3 + rnd(0, CH - h - 2);
      const r = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), boss, main: c.main, branch: !c.main, order: c.main ? c.idx : -1 };
      c.room = r;
      rooms.push(r);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, 1);
    }
    // 복도(3칸 너비): 이웃 셀 둘 사이 경계선에서 꺾는 Z 모양
    const hx = (y, x0, x1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let k = -1; k <= 1; k++) set(x, y + k, 1); };
    const vy = (x, y0, y1) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let k = -1; k <= 1; k++) set(x + k, y, 1); };
    const link = (a, b) => {
      const A = a.room, B = b.room;
      if (a.gy === b.gy) { const bx = Math.max(a.gx, b.gx) * CW + 1; hx(A.cy, A.cx, bx); vy(bx, A.cy, B.cy); hx(B.cy, bx, B.cx); }
      else { const by = Math.max(a.gy, b.gy) * CH + 3; vy(A.cx, A.cy, by); hx(by, A.cx, B.cx); vy(B.cx, by, B.cy); }
    };
    for (let i = 1; i < mainLen; i++) link(cells[i - 1], cells[i]);
    for (const c of cells) if (!c.main) link(c.parent, c);
    // 1칸짜리 바닥 틈 · 1칸 벽 메우기(그림이 깨지지 않게)
    for (let pass = 0; pass < 2; pass++) for (let y = 3; y < H - 3; y++) for (let x = 1; x < W - 1; x++) {
      if (at(x, y) === 0 && at(x, y - 1) === 1 && at(x, y + 1) === 1) set(x, y, 1);
      if (at(x, y) === 0 && at(x - 1, y) === 1 && at(x + 1, y) === 1) set(x, y, 1);
    }
    const lv = { def, W, H, tiles, rooms, at, drops: [], chests: [], columns: [], stairs: null };
    lv.start = cells[0].room;
    lv.boss = cells[mainLen - 1].room;
    lv.explored = new Uint8Array(W * H);
    // 기둥(장애물 · 꾸밈): 넓은 방 몇 개에
    for (const r of rooms) {
      if (r === lv.start || r.w < 11 || r.h < 8 || Math.random() >= (def.cols ?? 0.5)) continue;  // 던전마다 기둥 많고 적음
      const cs = [[r.x + 2, r.y + 2], [r.x + r.w - 3, r.y + 2], [r.x + 2, r.y + r.h - 2], [r.x + r.w - 3, r.y + r.h - 2]];
      for (const c of cs) lv.columns.push(c);
    }
    // 상자(묘지의 관 · 요새 바리케이드): 방 가장자리에 막히는 것으로
    lv.crates = new Set();
    for (const r of rooms) {
      if (r === lv.start || r.boss) continue;
      for (let k = 0; k < (def.crates || 0); k++) {
        const side = rnd(0, 3);
        const cx = side < 2 ? rnd(r.x + 1, r.x + r.w - 2) : side === 2 ? r.x + 1 : r.x + r.w - 2;
        const cy = side >= 2 ? rnd(r.y + 1, r.y + r.h - 2) : side === 0 ? r.y + 1 : r.y + r.h - 2;
        if (Math.abs(cx - r.cx) < 2 || Math.abs(cy - r.cy) < 2) continue;  // 방 가운데 줄(복도 입구 쪽)은 비운다
        const key = cx + ',' + cy;
        if (lv.crates.has(key)) continue;
        lv.crates.add(key); lv.columns.push([cx, cy]);
      }
    }
    lv.decor = { skulls: [], banners: new Set() };
    for (let k = 0; k < Math.round(rooms.length * 2 * (def.skulls ?? 1)); k++) { const r = rooms[rnd(0, rooms.length - 1)]; lv.decor.skulls.push([(r.x + rnd(1, r.w - 2)) * T + 8, (r.y + rnd(1, r.h - 2)) * T + 12]); }
    lv.canvas = paint(lv);
    return lv;
  }

  // 칸 거리(막히지 않은 칸으로만): 보스방 찾기 · 몹 길찾기
  function bfs(lv, sx, sy, limit = 1e9) {
    const { W, H, tiles } = lv;
    const d = new Int16Array(W * H).fill(-1);
    const q = new Int32Array(W * H);
    let h = 0, t = 0;
    d[sy * W + sx] = 0; q[t++] = sy * W + sx;
    while (h < t) {
      const i = q[h++], x = i % W, y = (i / W) | 0;
      if (d[i] >= limit) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (tiles[j] !== 1 || d[j] >= 0) continue;
        d[j] = d[i] + 1; q[t++] = j;
      }
    }
    return d;
  }

  // ── 그림: 바닥 + 0x72 벽(바닥 아래 = 벽 앞면, 그 위 = 윗면, 바닥 위쪽 = 아래 테두리, 옆 = 옆 테두리) ──
  function paint(lv) {
    const { W, H, at } = lv;
    const c = document.createElement('canvas');
    c.width = W * T; c.height = H * T;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#000';
    g.fillRect(0, 0, c.width, c.height);  // 바깥은 검정(색 입히기가 바깥까지 물들지 않게)
    const put = (n, x, y) => Gfx.spr(g, n, x * T, y * T, { topLeft: true });
    const wallDecor = lv.def.wall || ['wall_hole_1', 'wall_hole_2'];
    const floorName = () => { const k = Math.random(); return k < 0.93 ? 'floor_1' : ['floor_2', 'floor_3', 'floor_4', 'floor_5', 'floor_7', 'floor_8'][Math.floor((k - 0.93) / 0.0117) % 6]; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (at(x, y) === 1) { put(floorName(), x, y); continue; }
      const below = at(x, y + 1) === 1, above = at(x, y - 1) === 1;
      const left = at(x - 1, y) === 1, right = at(x + 1, y) === 1;
      if (below) {
        // 벽 앞면(+ 가끔 깃발 · 구멍)
        const k = Math.random();
        put(k < 0.07 ? lv.def.banner : k < 0.13 ? wallDecor[Math.floor(Math.random() * wallDecor.length)] : 'wall_mid', x, y);
        if (left) put('wall_outer_mid_right', x, y);
        if (right) put('wall_outer_mid_left', x, y);
        continue;
      }
      if (at(x, y + 2) === 1 && at(x, y + 1) === 0) put('wall_top_mid', x, y);  // 앞면 위 윗면
      if (above) { put(floorName(), x, y); put('wall_top_mid', x, y); }       // 바닥 아래쪽 테두리
      if (right) put('wall_outer_mid_left', x, y);
      if (left) put('wall_outer_mid_right', x, y);
    }
    for (const [sx, sy] of lv.decor.skulls) Gfx.spr(g, 'skull', sx, sy);
    const s = lv.start;
    if (s) Gfx.spr(g, 'floor_ladder', s.cx * T, s.cy * T, { topLeft: true });  // 마을은 사다리 없음
    // 던전 분위기 색: 곱하기로 입혀 같은 벽돌을 늪 · 묘지 · 얼음 · 요새 · 용암처럼 보이게
    if (lv.def.tint) {
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = lv.def.tint;
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over';
    }
    return c;
  }

  // ── 충돌 ──
  // 막힌 칸의 충돌 상자. 바로 위가 바닥인 막힌 칸(아래 테두리)은 위쪽 10px 까지 걸어 들어갈 수 있다(그림이 바닥으로 보여서)
  function solidRect(lv, tx, ty) {
    const top = lv.at(tx, ty - 1) === 1 && lv.at(tx, ty + 1) !== 1 ? 10 : 0;
    return { x0: tx * T, x1: tx * T + T, y0: ty * T + top, y1: ty * T + T };
  }
  const colRect = ([cx, cy]) => ({ x0: cx * T + 1, x1: cx * T + T - 1, y0: cy * T + 6, y1: cy * T + T });
  const hitRect = (b, x, y, r) => {
    const nx = Math.max(b.x0, Math.min(b.x1, x)), ny = Math.max(b.y0, Math.min(b.y1, y));
    return (x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r;
  };

  // 발 위치 (x, y), 반지름 r 이 서 있을 수 있나
  function walkable(lv, x, y, r) {
    const tx0 = Math.floor((x - r) / T), tx1 = Math.floor((x + r) / T);
    const ty0 = Math.floor((y - r) / T), ty1 = Math.floor((y + r) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (lv.at(tx, ty) === 1) continue;
      if (hitRect(solidRect(lv, tx, ty), x, y, r)) return false;
    }
    for (const c of lv.columns) if (Math.abs(c[0] * T + 8 - x) < 24 && Math.abs(c[1] * T + 8 - y) < 24 && hitRect(colRect(c), x, y, r)) return false;
    return true;
  }

  // 축마다 따로 움직여 벽에 미끄러지게
  function move(lv, e, dx, dy, r) {
    if (dx) { if (walkable(lv, e.x + dx, e.y, r)) e.x += dx; else e.hitWall = true; }
    if (dy) { if (walkable(lv, e.x, e.y + dy, r)) e.y += dy; else e.hitWall = true; }
  }

  // 두 점 사이가 벽에 막히지 않았나(시야)
  function los(lv, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      if (lv.at(Math.floor(x / T), Math.floor(y / T)) !== 1) return false;
    }
    return true;
  }

  // 방 안 빈 자리
  function spotIn(lv, r, avoid, minDist) {
    for (let k = 0; k < 40; k++) {
      const x = (r.x + 1 + Math.random() * (r.w - 2)) * T, y = (r.y + 1 + Math.random() * (r.h - 2)) * T;
      if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < minDist) continue;
      if (walkable(lv, x, y, 8)) return { x, y };
    }
    return { x: r.cx * T + 8, y: r.cy * T + 8 };
  }

  const roomAt = (lv, x, y) => lv.rooms.find(r => x >= r.x * T && x < (r.x + r.w) * T && y >= r.y * T && y < (r.y + r.h) * T);

  return { generate, paint, bfs, walkable, move, los, spotIn, roomAt };
})();
