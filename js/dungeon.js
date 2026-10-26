// 던전 한 층 만들기(디아블로식): 큰 바둑판(셀)에서 시작방 → … → 보스방으로 이어지는 '큰길'을 한 줄로 내고,
// 큰길 중간 방에서 옆으로 빠지는 '샛길 방'(막다른 보물방)을 붙인다. 보스방은 큰길 끝 방 하나와만 이어져서 반드시 마지막에 만난다.
// 복도는 이웃한 두 셀 안에서만 꺾이므로 다른 방을 가로질러 지름길이 생기지 않는다.
// 좌표는 층 왼쪽 위 = (0, 0) 인 픽셀, 칸 = 16px. tiles: 0 = 벽(막힘), 1 = 바닥.
const Dungeon = (() => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const CW = 18, CH = 15, GC = 6, GR = 4;  // 셀 하나 크기(칸) · 셀 가로 · 세로 수
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // 큰길: 셀 위를 겹치지 않게 걷는 길(mainLen 칸). 막히면 다시 굴린다
  function walkPath(mainLen, gc = GC, gr = GR) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const path = [[rnd(0, gc - 1), rnd(0, gr - 1)]], used = new Set([path[0].join()]);
      while (path.length < mainLen) {
        const [cx, cy] = path[path.length - 1];
        const opts = DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < gc && y < gr && !used.has(x + ',' + y));
        if (!opts.length) break;
        const n = opts[rnd(0, opts.length - 1)];
        path.push(n); used.add(n.join());
      }
      if (path.length === mainLen) return { path, used };
    }
    return null;
  }

  function generate(def) {
    if (def.raid) return Raid.level(def);  // 최종 보스 레이드: 넓은 방 하나(js/raid.js)
    if (def.roomMaps) return generateRooms(def);
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

  // ── 방 하나 = 맵 하나(끝없는 심연, 2026-10-25 사용자: 던파식 '다음 방 = 다음 맵') ──
  // 방 지도(던파 던전 지도): 작은 바둑판(RGC x RGR) 위 큰길(시작 → … → 수호자) + 샛길 방 2. 이음은 문으로만 — 실제 칸 위에서는 방마다 떨어진 섬이다.
  // 섬끼리 RGAP 칸 떨어져 있어서 몹이 넘어오거나 벽 너머로 맞는 일이 없다. 문 = 방 둘레 가운데 3칸 틈(이웃 방 쪽만), 걸어 들어가면 그 방의 마주 보는 문 앞으로(world.js doorCheck).
  // 방 = 화면 하나쯤 되는 네모 + 방마다 다른 기둥 배치. 시작 방은 작게, 수호자 방은 크게.
  const RGC = 5, RGR = 4, RGAP = 12, ROW = 3;
  const OPP = { r: 'l', l: 'r', u: 'd', d: 'u' };
  function generateRooms(def) {
    const branches = 2, mainLen = Math.max(3, def.rooms - branches);
    const { path, used } = walkPath(mainLen, RGC, RGR);
    const cells = path.map(([gx, gy], i) => ({ gx, gy, main: true, idx: i }));
    for (let b = 0, tries = 0; b < branches && tries < 200; tries++) {
      const parent = cells[rnd(1, mainLen - 2)];
      const opts = DIRS.map(([dx, dy]) => [parent.gx + dx, parent.gy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < RGC && y < RGR && !used.has(x + ',' + y));
      if (!opts.length) continue;
      const [gx, gy] = opts[rnd(0, opts.length - 1)];
      used.add(gx + ',' + gy);
      cells.push({ gx, gy, main: false, parent });
      b++;
    }
    // 방 크기(2026-10-26 사용자 '방 하나가 너무 크다' → 약 절반: 30~40 × 17~22 → 24~30 × 12~15, 화면 하나쯤 · 수호자 40 × 23 → 32 × 17 · 시작 24 × 14 → 20 × 11)
    cells.forEach(c => {
      const boss = c.main && c.idx === mainLen - 1, start = c.main && c.idx === 0;
      c.w = boss ? 32 : start ? 20 : rnd(24, 30);
      c.h = boss ? 17 : start ? 11 : rnd(12, 15);
      c.boss = boss;
    });
    // 실제 자리: ROW 개씩 줄로(줄 높이 = 그 줄 가장 큰 방), 섬 사이 RGAP 칸
    let W = 0, y = RGAP;
    for (let i = 0; i < cells.length; i += ROW) {
      const row = cells.slice(i, i + ROW), rh = Math.max(...row.map(c => c.h));
      let x = RGAP;
      for (const c of row) { c.x = x; c.y = y + ((rh - c.h) >> 1); x += c.w + RGAP; }
      W = Math.max(W, x);
      y += rh + RGAP;
    }
    const H = y;
    const tiles = new Uint8Array(W * H);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tiles[y * W + x]);
    const set = (x, y, v) => { if (x > 0 && y > 2 && x < W - 1 && y < H - 2) tiles[y * W + x] = v; };
    const rooms = cells.map(c => {
      const r = { x: c.x, y: c.y, w: c.w, h: c.h, cx: c.x + (c.w >> 1), cy: c.y + (c.h >> 1), boss: c.boss, main: c.main, branch: !c.main, order: c.main ? c.idx : -1, gx: c.gx, gy: c.gy, doors: [] };
      c.room = r;
      for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) set(xx, yy, 1);
      return r;
    });
    // 문: 이웃 두 방 사이 — 서로 마주 보는 변 가운데 3칸 틈(1칸 깊이). ax, ay = 이 문으로 들어올 때 서는 자리(방 안쪽)
    const doorOn = (r, d, to) => {
      const t = [];
      for (let k = -1; k <= 1; k++) {
        const tx = d === 'r' ? r.x + r.w : d === 'l' ? r.x - 1 : r.cx + k, ty = d === 'd' ? r.y + r.h : d === 'u' ? r.y - 1 : r.cy + k;
        set(tx, ty, 1); t.push(ty * W + tx);
      }
      const x = (d === 'r' ? r.x + r.w : d === 'l' ? r.x - 1 : r.cx) * T + 8, y = (d === 'd' ? r.y + r.h : d === 'u' ? r.y - 1 : r.cy) * T + 8;
      const v = { r: [-1, 0], l: [1, 0], u: [0, 1], d: [0, -1] }[d];
      r.doors.push({ dir: d, to, tiles: t, x, y, ax: x + v[0] * 30, ay: y + v[1] * 30 + 4 });
    };
    const link = (a, b) => {
      const d = b.gx > a.gx ? 'r' : b.gx < a.gx ? 'l' : b.gy > a.gy ? 'd' : 'u';
      doorOn(a.room, d, rooms.indexOf(b.room)); doorOn(b.room, OPP[d], rooms.indexOf(a.room));
    };
    for (let i = 1; i < mainLen; i++) link(cells[i - 1], cells[i]);
    for (const c of cells) if (!c.main) link(c.parent, c);
    const lv = { def, W, H, tiles, rooms, at, drops: [], chests: [], columns: [], stairs: null, roomMaps: true, cleared: new Set([0]), visited: new Set([0]) };
    lv.start = rooms[0];
    lv.boss = cells[mainLen - 1].room;
    lv.explored = new Uint8Array(W * H);
    // 기둥 배치: 방마다 하나(없음 · 네 귀 · 두 줄 · 가운데 넷 · 흩어짐) — 문 앞 길(가운데 줄)은 비운다
    const lane = (r, x, y) => Math.abs(x - r.cx) < 3 || Math.abs(y - r.cy) < 3;
    for (const r of rooms) {
      if (r === lv.start) continue;
      const cs = [], kind = r.boss ? 1 : rnd(0, 4);
      if (kind === 1) for (const c of [[r.x + 4, r.y + 3], [r.x + r.w - 5, r.y + 3], [r.x + 4, r.y + r.h - 3], [r.x + r.w - 5, r.y + r.h - 3]]) cs.push(c);
      if (kind === 2) for (let x = r.x + 5; x < r.x + r.w - 4; x += 5) { cs.push([x, r.y + 4]); cs.push([x, r.y + r.h - 4]); }
      if (kind === 3) for (const [dx, dy] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) cs.push([r.cx + dx, r.cy + dy]);
      if (kind === 4) for (let k = 0; k < 6; k++) cs.push([rnd(r.x + 3, r.x + r.w - 4), rnd(r.y + 3, r.y + r.h - 3)]);
      for (const c of cs) if (!lane(r, c[0], c[1]) && !lv.columns.some(o => Math.abs(o[0] - c[0]) < 2 && Math.abs(o[1] - c[1]) < 2)) lv.columns.push(c);
    }
    lv.crates = new Set();
    for (const r of rooms) {
      if (r === lv.start || r.boss) continue;
      for (let k = 0; k < (def.crates || 0) * 2; k++) {
        const cx = rnd(r.x + 1, r.x + r.w - 2), cy = Math.random() < 0.5 ? r.y + 1 : r.y + r.h - 2;
        if (lane(r, cx, cy)) continue;
        const key = cx + ',' + cy;
        if (lv.crates.has(key)) continue;
        lv.crates.add(key); lv.columns.push([cx, cy]);
      }
    }
    lv.decor = { skulls: [], banners: new Set() };
    for (let k = 0; k < Math.round(rooms.length * 5 * (def.skulls ?? 1)); k++) { const r = rooms[rnd(0, rooms.length - 1)]; lv.decor.skulls.push([(r.x + rnd(1, r.w - 2)) * T + 8, (r.y + rnd(1, r.h - 2)) * T + 12]); }
    lv.canvas = paint(lv);  // 문은 열린 채로 그려 두고, 닫힌 문은 world.js 가 칸을 막고 위에 막을 그린다
    return lv;
  }
  // 방 번호(그 방 바닥 네모 안이면), 아니면 -1
  const roomIdx = (lv, x, y) => lv.rooms.findIndex(r => x >= r.x * T && x < (r.x + r.w) * T && y >= r.y * T && y < (r.y + r.h) * T);

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
        // 벽 앞면(+ 가끔 깃발 · 구멍). def.banners = 정해 둔 자리 깃발, def.plain = 무작위 장식 없음(마을, 2026-10-25 사용자: 깃발은 던전 입구 양옆만)
        const k = Math.random();
        const fixed = lv.def.banners && lv.def.banners.find(b => b[0] === x && b[1] === y);
        const deco = k < 0.07 ? lv.def.banner : k < 0.13 ? wallDecor[Math.floor(Math.random() * wallDecor.length)] : 'wall_mid';
        put(fixed ? fixed[2] : lv.def.plain ? 'wall_mid' : deco, x, y);
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
    if (lv.def.veins) paintVeins(lv, g);
    return c;
  }
  // 살아 있는 심연(끝없는 심연): 방마다 바닥을 기어가는 핏빛 혈관 — 1px 도트 줄(아래 그늘 한 줄) + 시작점 살덩이 마디.
  // 점 목록(lv.veins)은 world.js drawVeins 가 맥박 빛을 흘리는 데 쓴다
  function paintVeins(lv, g) {
    lv.veins = [];
    lv.rooms.forEach((r, ri) => {
      for (let k = Math.round(r.w * r.h / 60); k > 0; k--) {
        let x = (r.x + rnd(1, r.w - 2)) * T + rnd(0, 15), y = (r.y + rnd(1, r.h - 2)) * T + rnd(0, 15), a = Math.random() * Math.PI * 2;
        const pts = [], len = rnd(40, 120);
        for (let i = 0; i < len; i++) {
          a += (Math.random() - 0.5) * 0.45;
          x += Math.cos(a); y += Math.sin(a) * 0.8;
          const px = Math.round(x), py = Math.round(y), n = pts.length;
          if (lv.at(Math.floor(px / T), Math.floor((py + 1) / T)) !== 1) break;
          if (!n || pts[n - 2] !== px || pts[n - 1] !== py) pts.push(px, py);
        }
        if (pts.length >= 24) lv.veins.push({ ri, pts, ph: Math.random() * 0.35 });
      }
    });
    for (const v of lv.veins) {
      const P = v.pts;
      g.fillStyle = '#1a0610'; for (let i = 0; i < P.length; i += 2) g.fillRect(P[i], P[i + 1] + 1, 1, 1);
      g.fillStyle = LIVING.vein; for (let i = 0; i < P.length; i += 2) g.fillRect(P[i], P[i + 1], 1, 1);
      g.fillStyle = '#8a2050'; g.fillRect(P[0] - 1, P[1] - 1, 3, 2); g.fillStyle = LIVING.vein; g.fillRect(P[0] - 1, P[1] + 1, 3, 1);
    }
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

  return { generate, paint, bfs, walkable, move, los, spotIn, roomAt, roomIdx };
})();
