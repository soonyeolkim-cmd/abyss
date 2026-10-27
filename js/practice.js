// 연습장(2026-10-27 사용자: 딜 측정용) — 마을 허수아비에게 말을 걸면 들어가는 작은 방 하나 + 허수아비(data.js ENEMIES.dummy).
// 허수아비는 안 움직이고 · 안 때리고 · 안 쓰러진다(체력은 매 프레임 다시 가득). 받은 피해를 모아
// 초당 피해(최근 5초 · 전체) · 총 피해 · 가장 큰 한 방 · 치명타 비율 · 어디서 나온 피해인지(기술 칸 · 속성)를 화면 왼쪽 위에 보여 준다.
// 방어: 'mob' = 내 레벨 보통 몹 · 'boss' = Lv.100 심연 보스. 전리품 · 경험치 · 기록 없음. 일시정지 메뉴에서 다시 재기 · 나가기.
// 피해는 combat.js hitEnemy(직접 친 것: 기술 칸 · 치명타) · elements.js damage(속성 피해)가 add 로 알려 준다.
const Practice = (() => {
  const RECENT = 5, IDLE = 3;  // 최근 5초 · 3초 넘게 안 때리면 전체 시간도 멈춤
  const ARMOR = { mob: '보통 몹', boss: 'Lv.' + UNIQUE_CRAFT_LV + ' 보스' };
  let st = null;
  function reset() { st = { log: [], total: 0, first: null, fightT: 0, last: -99, max: 0, hits: 0, crits: 0, by: {} }; }
  reset();

  // 마을 허수아비 → 고르기(허수아비 수 · 방어) → 들어가기
  function menu(prof) {
    if (Net.linked) { Game.toast('파티 중에는 연습장에 못 들어가요'); return; }
    const go = (count, armor) => () => { reset(); Game.startRun(def(prof, count, armor), 0); };
    Game.overlay({ type: 'choice', title: '허수아비 — 연습장', items: [
      { label: '허수아비 1개 · ' + ARMOR.mob + ' 방어', go: go(1, 'mob') },
      { label: '허수아비 1개 · ' + ARMOR.boss + ' 방어', go: go(1, 'boss') },
      { label: '허수아비 5개 · ' + ARMOR.mob + ' 방어', go: go(5, 'mob') },
      { label: '허수아비 5개 · ' + ARMOR.boss + ' 방어', go: go(5, 'boss') },
    ] });
  }
  function def(prof, count, armor) {
    return { id: 'practice', practice: true, name: '연습장', lv: prof.lv, ilvl: [prof.lv, prof.lv], pool: [], boss: null, needs: null, hazard: null,
      music: Town.where === 'silvane' ? 'silvane' : 'belloc', count, armor, plain: true, cols: 0, skulls: 0 };
  }
  // 방: 광장만 한 방 하나(Raid.level 처럼). 아래 가운데로 들어와 위쪽 허수아비를 마주 본다
  function level(def) {
    const RW = 22, RH = 12, G = 4, W = RW + G * 2, H = RH + G * 2;
    const tiles = new Uint8Array(W * H);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tiles[y * W + x]);
    const r = { x: G, y: G, w: RW, h: RH, cx: G + (RW >> 1), cy: G + (RH >> 1), main: true, branch: false, order: 0, gx: 0, gy: 0, doors: [] };
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y * W + x] = 1;
    const lv = { def, W, H, tiles, rooms: [r], at, drops: [], chests: [], columns: [], stairs: null, roomMaps: true, cleared: new Set([0]), visited: new Set([0]) };
    lv.boss = r; lv.start = { cx: r.cx, cy: r.y + r.h - 3 };
    lv.explored = new Uint8Array(W * H);
    lv.crates = new Set();
    lv.decor = { skulls: [], banners: new Set() };
    lv.canvas = Dungeon.paint(lv);
    return lv;
  }
  // 허수아비 자리: 하나 = 가운데 위, 다섯 = 붙어 선 무리(광역 기술이 다 닿게)
  function spots(lv) {
    const r = lv.rooms[0], x = r.cx * T + 8, y = (r.y + 4) * T;
    return lv.def.count === 1 ? [[x, y]] : [[x, y], [x - 24, y + 8], [x + 24, y + 8], [x - 12, y - 14], [x + 12, y - 14]];
  }
  function setup(e, def) {
    e.awake = true; e.maxHp = e.hp = 1e9; e.ri = 0;
    if (def.armor === 'boss') e.armorCut = Math.min(0.65, ENEMY_CUT(UNIQUE_CRAFT_LV) * earlyT(UNIQUE_CRAFT_LV) * ENEMY_SCALE.bossDef);  // 심연 보스와 같은 방어
  }

  // 피해 기록: src = 기술 칸(basic · charge · wave · dash) · 'el:fire' 같은 속성 · 칸이 없는 탄 이름(화염구 등), crit = 직접 친 것만(치명타 비율)
  function add(dmg, src, crit) {
    if (!dmg) return;
    const now = World.time;
    if (st.first === null) st.first = now;
    st.log.push([now, dmg]); st.total += dmg; st.max = Math.max(st.max, dmg); st.last = now;
    if (crit !== undefined) { st.hits++; if (crit) st.crits++; }
    const k = src || 'etc';
    st.by[k] = (st.by[k] || 0) + dmg;
  }
  function update(dt, enemies) {
    for (const e of enemies) if (e.def.dummy) { e.hp = e.maxHp; e.dying = false; }
    if (st.total && World.time - st.last < IDLE) st.fightT += dt;
    const cut = World.time - RECENT;
    while (st.log.length && st.log[0][0] < cut) st.log.shift();
  }

  // 화면 왼쪽 위 측정판(hud.js, 960x540 좌표)
  const num = n => Math.round(n).toLocaleString('en-US');
  const srcName = (k, prof) => (k.startsWith('el:') ? (ELEMENTS[k.slice(3)] ? ELEMENTS[k.slice(3)].name : k.slice(3)) + ' 속성 피해' : clsOf(prof).slotNames[k] || (k === 'etc' ? '기타' : k));
  function hud(ctx, prof) {
    const d = World.level.def, x = 14, w = 300;
    const recentSum = st.log.reduce((a, l) => a + l[1], 0);
    const recentDps = recentSum / Math.max(1, Math.min(RECENT, World.time - (st.first ?? World.time)));
    const allDps = st.total / Math.max(1, st.fightT);
    const rows = Object.entries(st.by).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const h = 138 + Math.max(1, rows.length) * 18;
    ctx.fillStyle = 'rgba(12,8,14,0.78)'; ctx.fillRect(x, 12, w, h);
    ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, 12.5, w - 1, h - 1);
    const T_ = (s, tx, ty, size, col, al) => Gfx.text(ctx, s, tx, ty, size, col, al);
    T_('연습장 · 허수아비 ' + d.count + ' · ' + ARMOR[d.armor] + ' 방어', x + 12, 32, 12, '#c8b8a0');
    T_('초당 피해 (최근 ' + RECENT + '초)', x + 12, 56, 12, '#9a8e96');
    T_(num(recentDps), x + w - 12, 58, 22, '#ffd36a', 'right');
    T_('초당 피해 (전체)', x + 12, 80, 12, '#9a8e96');
    T_(num(allDps) + '  ·  ' + Math.floor(st.fightT / 60) + ':' + String(Math.floor(st.fightT % 60)).padStart(2, '0'), x + w - 12, 81, 14, '#f0e0b8', 'right');
    T_('총 ' + num(st.total) + ' · 가장 큰 한 방 ' + num(st.max), x + 12, 102, 12, '#c8b8a0');
    T_('치명타 ' + (st.hits ? Math.round(st.crits / st.hits * 100) : 0) + '% (' + st.crits + ' / ' + st.hits + '번)', x + 12, 120, 12, '#c8b8a0');
    rows.forEach(([k, v], i) => {  // 어디서 나온 피해인지: 막대 + 비율
      const y = 134 + i * 18, pct = v / st.total;
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 12, y, w - 24, 14);
      ctx.fillStyle = k.startsWith('el:') && ELEMENTS[k.slice(3)] ? ELEMENTS[k.slice(3)].color : '#c8a050';
      ctx.globalAlpha = 0.55; ctx.fillRect(x + 12, y, Math.round((w - 24) * pct), 14); ctx.globalAlpha = 1;
      T_(srcName(k, prof), x + 16, y + 11, 11, '#f0e6d2');
      T_(Math.round(pct * 100) + '% · ' + num(v), x + w - 16, y + 11, 11, '#f0e6d2', 'right');
    });
    if (!st.total) T_('허수아비를 때리면 재기 시작해요', x + 12, 146, 12, '#8a7e88');
    T_('다시 재기 · 나가기 = 메뉴', x + 12, 12 + h - 6, 10, '#6a6068');
  }

  return { menu, def, level, spots, setup, add, update, reset, hud };
})();
