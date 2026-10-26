// Lv.100 유니크 제작(2026-10-26 사용자): 광산 도시 실베인 '심연 장인 고른' → '유니크 제작', overlay 'craft'.
// Lv.100 유니크는 떨어지지 않고(UNIQUE_CRAFT_LV) 여기서만 만든다. 재료 = data.js CRAFT(핵 · 정수 · 강화 주문서 · 전설 보석 · 골드).
// 왼쪽 = 만들 유니크 줄(내 직업 무기 두 종류 + 투구 · 갑옷 · 장갑 · 신발 · 목걸이 · 반지), 오른쪽 = 고른 유니크(그림 · 이름 · 효과 · 기본 능력치)
// · 재료(가진 수 / 필요 수 — 모자라면 붉게) · 제작 버튼. 만들기 전에 예 / 아니요를 묻고, 만든 장비는 가방으로(가득 차면 못 만듦).
// 장비 기본 능력치는 늘 같다(절대 규칙) — 같은 부위 Lv.100 유니크는 누가 만들어도 같은 수치.
const Craft = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  let sel = 0, glowT = 0, made = null, last = performance.now();
  const cache = {};  // 미리 보기 장비(줄마다 한 번만 만들어 둠)

  const uniqOf = slot => Object.keys(UNIQUES).find(u => UNIQUES[u].slot === slot);
  const rows = prof => [...clsOf(prof).weapons.map(k => ({ slot: 'weapon', kind: k })), ...SLOTS.filter(s => s !== 'weapon').map(s => ({ slot: s }))];
  const keyOf = r => r.slot + ':' + (r.kind || '');
  function preview(r) {
    const k = keyOf(r);
    return cache[k] || (cache[k] = Items.make(CRAFT.lv, { slot: r.slot, kind: r.kind, rarity: 3, uniq: uniqOf(r.slot) }));
  }
  const gemEl = slot => (GEMS.might.slots.includes(slot) ? 'might' : 'guard');
  const BLESSED = { g: 'any', r: 0 };  // 재료 주문서 = 축복받은 강화 주문서만(2026-10-26 사용자 — 재료는 한 가지로만, CLAUDE.md)
  const scrollHave = prof => prof.scrolls['any:0'] || 0;
  const gemHave = (prof, el) => prof.stones[el + ':' + CRAFT.gemSize] || 0;  // 전설만(2026-10-26 사용자: 태초는 안 받음)
  // 재료 줄: 이름 · 그림 · 가진 수 · 필요 수
  function needs(prof, slot) {
    const el = gemEl(slot);
    return [
      { name: '심연의 핵', icon: 'core', have: prof.cores || 0, need: CRAFT.cores },
      { name: '심연 정수', icon: 'essence', have: prof.essence || 0, need: CRAFT.essence },
      { name: SCROLL_NAMES[BLESSED.r], icon: 'scroll', have: scrollHave(prof), need: CRAFT.scrolls },
      { name: STONE_SIZES[CRAFT.gemSize].name + ' ' + GEMS[el].stone, icon: 'gem', el, have: gemHave(prof, el), need: CRAFT.gems },
      { name: '골드', icon: 'gold', have: prof.gold, need: CRAFT.gold },
    ];
  }
  // 이미 가진 Lv.100 같은 유니크(무기는 같은 종류) — 가방 · 낀 것
  function owned(prof, r) {
    const u = uniqOf(r.slot), same = it => it && it.uniq === u && it.ilvl >= CRAFT.lv && (r.slot !== 'weapon' || Items.base(it).kind === r.kind);
    return prof.bag.some(same) || same(prof.equip[r.slot]);
  }

  function open(prof) { sel = 0; glowT = 0; made = null; last = performance.now(); }

  // 만들기: 재료 · 가방 확인 → 예 / 아니요 → 재료를 쓰고 가방에
  function tryCraft(prof) {
    const r = rows(prof)[sel], need = needs(prof, r.slot), short = need.filter(n => n.have < n.need);
    if (short.length) { Sfx.deny(); Game.toast('재료가 모자라요: ' + short.map(n => n.name.replace(/ \(.*\)/, '')).join(' · ')); return; }
    if (prof.bag.indexOf(null) < 0) { Sfx.deny(); Game.toast('가방이 가득 찼어요 — 한 칸 비워 주세요'); return; }
    const it = preview(r);
    Game.overlay({ type: 'confirm', text: Items.nameOf(it) + '을(를) 만들까요?',
      sub: '핵 ' + CRAFT.cores + ' · 정수 ' + CRAFT.essence + ' · 축복 주문서 ' + CRAFT.scrolls + ' · ' + STONE_SIZES[CRAFT.gemSize].name + ' 보석 ' + CRAFT.gems + ' · ' + CRAFT.gold + 'G 를 써요',
      defaultYes: true, yes: () => make(prof, r) });
  }
  function make(prof, r) {
    const slot = prof.bag.indexOf(null);
    if (slot < 0) return;
    const el = gemEl(r.slot);
    prof.cores -= CRAFT.cores;
    prof.essence -= CRAFT.essence;
    for (let n = 0; n < CRAFT.scrolls; n++) Items.takeScroll(prof, BLESSED);  // 축복받은 것만
    for (let n = 0; n < CRAFT.gems; n++) Elements.take(prof, { el, size: CRAFT.gemSize });  // 전설만
    prof.gold -= CRAFT.gold;
    made = Items.make(CRAFT.lv, { slot: r.slot, kind: r.kind, rarity: 3, uniq: uniqOf(r.slot) });
    prof.bag[slot] = made;
    glowT = 2.2;
    Game.changed();
    Sfx.forgeStart(); Sfx.unique();
    Coop.brag({ kind: 'craft', item: made });  // 파티면 머리 위 말풍선 '유니크 제작!' · 친구 화면 알림
  }

  function update(o, prof) {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now; glowT = Math.max(0, glowT - dt);
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
    const n = rows(prof).length;
    if (Input.nav('up')) { sel = (sel + n - 1) % n; made = null; }
    if (Input.nav('down')) { sel = (sel + 1) % n; made = null; }
    if (Input.wasPressed('ok')) tryCraft(prof);
  }

  function matIcon(ctx, m, x, y) {
    if (m.icon === 'core') Gfx.coreIcon(ctx, x, y, 21);
    else if (m.icon === 'essence') Gfx.essenceIcon(ctx, x, y, 20);
    else if (m.icon === 'scroll') Gfx.scrollIcon(ctx, { g: 'any', r: 0 }, x, y, 20);
    else if (m.icon === 'gem') Gfx.stoneIcon(ctx, { el: m.el, size: CRAFT.gemSize }, x, y, 20);
    else T_(ctx, 'G', x, y + 6, 16, '#ffd34d', 'center');
  }

  const CX = 712;
  function draw(ctx, o, prof) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });
    ctx.imageSmoothingEnabled = false;
    const rs = rows(prof), r = rs[sel], it = preview(r);
    // ── 왼쪽: 만들 유니크 고르기 ──
    Gfx.panel(ctx, 24, 24, 440, 470, { border: '#c06aff' });
    T_(ctx, '유니크 제작', 44, 62, 22, '#e8c8ff');
    T_(ctx, '착용 Lv.' + CRAFT.lv + ' · 혈석', 444, 62, 14, GEAR_TIERS[tierOf(CRAFT.lv)].tint, 'right');
    rs.forEach((row, i) => {
      const y = 78 + i * 44, on = sel === i, pv = preview(row);
      UI.zone(40, y, 408, 40, { on: () => sel === i, pick: () => { if (sel !== i) made = null; sel = i; } });
      Gfx.panel(ctx, 40, y, 408, 40, { border: on ? '#c06aff' : '#3a2e36', bg: '#1d151b' });
      Gfx.icon(ctx, pv, 64, y + 20, 26);
      T_(ctx, Items.nameOf(pv), 88, y + 18, 14, on ? '#ffd36a' : RARITY[3].color);
      T_(ctx, (row.slot === 'weapon' ? (GEAR_FORMS.weapon.find(f => f.kind === row.kind) || {}).noun || '무기' : SLOT_NAMES[row.slot]) + ' · ' + UNIQUES[uniqOf(row.slot)].fx, 88, y + 33, 11, '#9a8e96');
      if (owned(prof, row)) T_(ctx, '✔ 가지고 있음', 436, y + 26, 11, '#7dff8a', 'right');
    });
    T_(ctx, '부위마다 정해진 유니크 효과 · 기본 능력치는 늘 같아요', 44, 452, 12, '#9a8e96');
    T_(ctx, 'Lv.' + CRAFT.lv + ' 유니크는 던전에서 안 떨어지고 여기서만 만들어요', 44, 474, 12, '#9a8e96');

    // ── 오른쪽: 고른 유니크 + 재료 ──
    Gfx.panel(ctx, 488, 24, 448, 470, { border: '#c06aff', bg: '#140e18' });
    const time = performance.now() / 1000;
    if (glowT > 0) {  // 방금 만듦: 등급 색 빛기둥
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(CX, 110, 4, CX, 110, 120);
      g.addColorStop(0, 'rgba(255,170,60,' + (0.5 * glowT / 2.2) + ')'); g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g; ctx.fillRect(CX - 140, 0, 280, 240); ctx.restore();
    }
    Gfx.icon(ctx, it, CX, 104 + Math.sin(time * 2.5) * 3, 72);
    T_(ctx, made ? '만들었다! — 가방에 넣었어요' : Items.nameOf(it), CX, 172, made ? 16 : 20, made ? '#7dff8a' : RARITY[3].color, 'center');
    const U = UNIQUES[uniqOf(r.slot)];
    T_(ctx, '유니크 · ' + SLOT_NAMES[r.slot] + ' · 착용 Lv.' + Items.req(it), CX, 194, 12, '#c8b8a0', 'center');
    T_(ctx, '★ ' + U.fx + ' — ' + U.desc, CX, 214, 12, '#ffd36a', 'center');
    // 기본 능력치 · 등급 고정 옵션 · 무기 특성(설명 줄에서 이름 · 등급 줄 · ★ · 보석 줄은 빼고)
    Items.describe(it, prof).slice(2).filter(l => l.t[0] !== '★' && !l.t.startsWith('보석')).slice(0, 2)
      .forEach((l, i) => T_(ctx, l.t, CX, 234 + i * 16, 11, l.c || '#e8dcc8', 'center'));
    // 재료
    T_(ctx, '재료', 508, 276, 15, '#e8c8ff');
    const need = needs(prof, r.slot);
    need.forEach((m, i) => {
      const y = 286 + i * 30, ok = m.have >= m.need;
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(504, y, 416, 26);
      matIcon(ctx, m, 522, y + 13);
      T_(ctx, m.name, 542, y + 18, 13, '#e8e0d0');
      T_(ctx, (m.icon === 'gold' ? fmtNum(m.have) + ' / ' + fmtNum(m.need) : m.have + ' / ' + m.need), 912, y + 18, 13, ok ? '#7dff8a' : '#ff7a6a', 'right');
    });
    const all = need.every(m => m.have >= m.need);
    const by = 446, bw = 300, bx = CX - bw / 2;
    UI.zone(bx, by, bw, 40, { key: 'ok', now: true });
    Gfx.panel(ctx, bx, by, bw, 38, { border: all ? '#c06aff' : '#5a4650', bg: '#1d151b' });
    T_(ctx, (all ? '제작하기 ' : '재료가 모자라요 ') + L('ok'), CX, by + 25, 15, all ? '#e8c8ff' : '#8a7e88', 'center');
    if (Input.touchMode()) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 496, 960, 44);
    T_(ctx, '고르기 ↑↓ · 제작 ' + L('ok') + ' · 닫기 ' + L('back'), 480, 522, 13, '#8a7e88', 'center');
  }

  return { open, update, draw };
})();
