// 던전 화면 HUD(디아블로식): 아래 돌판 — 왼쪽 빨간 체력 구슬 · 오른쪽 파란 기력 구슬 · 물약 벨트 · 가운데 기술(속성석) 칸 · 맨 아래 경험치.
// 위 — 가운데 대상 이름표(보스 · 고유 · 정예), 오른쪽 자동 지도. 모두 960x540 좌표.
const Hud = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  const PY = 540 - HUD_H * SCALE;  // 돌판 윗선

  // 구슬: k = 차 있는 정도(0~1)
  function globe(ctx, cx, cy, r, k, col, dark, label) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.fillStyle = '#120c10'; ctx.fill();
    ctx.strokeStyle = '#6a5440'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = dark; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const top = cy + r - 2 * r * Math.max(0, Math.min(1, k));
    const g = ctx.createLinearGradient(0, top, 0, cy + r);
    g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
    ctx.fillStyle = g; ctx.fillRect(cx - r, top, r * 2, cy + r - top);
    // 출렁이는 윗면 · 유리 반짝임
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(cx - r, top, r * 2, 2);
    const shine = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 2, cx - r * 0.35, cy - r * 0.45, r * 0.9);
    shine.addColorStop(0, 'rgba(255,255,255,0.35)'); shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    if (label) T_(ctx, label, cx, cy + 6, 14, '#ffffff', 'center');
  }

  // 기술 아이콘(2026-10-24 사용자 '게임과 어울리게'): 선 그림 대신 16x16 도트를 계산으로 찍고 검은 테두리를 둘러 2배로 그린다.
  // 칸 모양 = (x, y) → 0 없음 · 1 본색 · 2 밝은색. dash 화살 + 속도선, spin 도는 고리 + 화살촉, wave 초승달, circle 마법진, orb 빛 구슬 + 꼬리
  const PIX = {
    dash: (x, y) => {
      if ((y === 3 || y === 12) && x <= 4) return 1;
      if ((y === 7 || y === 8) && x <= 9) return x > 4 ? 2 : 1;
      if (x >= 9 && x <= 14 && Math.abs(y + 0.5 - 8) <= (14.5 - x) * 0.95) return y < 8 ? 2 : 1;
      return 0;
    },
    spin: (x, y) => {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 8, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const hx = 8 + Math.cos(-0.35) * 5.4, hy = 8 + Math.sin(-0.35) * 5.4;
      if (Math.hypot(x + 0.5 - hx, y + 0.5 - hy - 1) <= 2.3) return 2;  // 화살촉
      if (d >= 4.2 && d <= 6.6 && !(a > -1.5 && a < -0.35)) return dy < 0 ? 2 : 1;
      return 0;
    },
    wave: (x, y) => {
      const o = Math.hypot(x + 0.5 - 3, y + 0.5 - 8), i = Math.hypot(x + 0.5 - 0.5, y + 0.5 - 8);
      return o <= 9.6 && i > 9 && x >= 4 ? (x >= 10 ? 2 : 1) : 0;
    },
    circle: (x, y) => {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 9, e = Math.hypot(dx / 7.4, dy / 4.4);
      if (e >= 0.72 && e <= 1.0) return dy < 0 ? 2 : 1;
      if (Math.abs(dx) + Math.abs(dy) * 1.8 <= 1.6) return 2;  // 가운데 빛
      if ((Math.abs(dx) <= 0.6 && Math.abs(Math.abs(dy) - 2.2) <= 0.6) || (Math.abs(dy) <= 0.6 && Math.abs(Math.abs(dx) - 3.6) <= 0.6)) return 1;  // 룬 점
      return 0;
    },
    orb: (x, y) => {
      const d = Math.hypot(x + 0.5 - 10.5, y + 0.5 - 8);
      if (d <= 1.9) return 2;
      if (d <= 3.8) return 1;
      if (x >= 1 && x <= 7 && Math.abs(y + 0.5 - 8) <= (x - 1) * 0.32 + 0.4) return 1;
      return 0;
    },
  };
  const pixCache = {};
  function mixW(hex, k) { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; return 'rgb(' + c.map(v => Math.round(v + (255 - v) * k)).join(',') + ')'; }
  function pixIcon(kind, col) {
    const key = kind + col;
    if (pixCache[key]) return pixCache[key];
    const f = PIX[kind], c = document.createElement('canvas');
    c.width = c.height = 18;
    const g = c.getContext('2d'), at = (x, y) => (x < 0 || y < 0 || x > 15 || y > 15 ? 0 : f(x, y));
    const pal = { 1: col, 2: mixW(col, 0.4) };
    for (let y = -1; y <= 16; y++) for (let x = -1; x <= 16; x++) {
      const v = at(x, y);
      if (v) { g.fillStyle = pal[v]; g.fillRect(x + 1, y + 1, 1, 1); continue; }
      let edge = false;  // 둘레 8칸에 무늬가 있으면 검은 테두리
      for (let j = -1; j <= 1 && !edge; j++) for (let i = -1; i <= 1; i++) if (at(x + i, y + j)) { edge = true; break; }
      if (edge) { g.fillStyle = '#120c10'; g.fillRect(x + 1, y + 1, 1, 1); }
    }
    pixCache[key] = c;
    return c;
  }
  function skillIcon(ctx, kind, cx, cy, col) {
    if (!PIX[kind]) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixIcon(kind, col), Math.round(cx - 18), Math.round(cy - 18), 36, 36);
    ctx.restore();
  }

  function box(ctx, x, y, s, on) {
    ctx.fillStyle = '#1a1216'; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = on || '#4a3a30'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
  }

  function cool(ctx, x, y, s, k, sec) {
    if (k <= 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(x + 2, y + 2, s - 4, Math.round((s - 4) * k));
    T_(ctx, sec.toFixed(1), x + s / 2, y + s / 2 + 5, 12, '#ffffff', 'center');
  }

  // 보석 합계: 묶음마다 이름 · 칸(낀 보석 색 네모, 빈 칸은 테두리만) · 합친 효과(장비 레벨 곡선 반영 = 가방 창과 같은 값)
  // 보석 묶음 = 끼울 수 있는 보석 종류대로(2026-10-24 사용자: 무기 · 장신구는 공격 보석이라 한 줄)
  const GEM_GROUPS = [{ name: '무기 · 장신구', slots: ['weapon', 'amulet', 'ring'] }, { name: '방어구', slots: ['helmet', 'armor', 'gloves', 'boots'] }];
  const GEM_MAIN = ['dmg', 'crit', 'def', 'hp'];
  const GEM_SHORT = { dmg: '피해', crit: '치명', critDmg: '치피', def: '방어', hp: '체력', stamina: '기력' };
  function gemSummary(ctx, prof, x, y, p) {
    GEM_GROUPS.forEach((gr, i) => {
      const yy = y + i * 12, sum = {}, gems = [];
      for (const slot of gr.slots) {
        const it = prof.equip[slot];
        if (!it) continue;
        for (const g of it.gems || []) {
          gems.push(g);
          if (!g) continue;
          const gs = gemStats(g);
          for (const k in gs) sum[k] = (sum[k] || 0) + (k === 'def' || k === 'hp' ? Math.round(gs[k] * POWER(it.ilvl)) : gs[k]);
        }
      }
      T_(ctx, gr.name, x, yy, 10, '#c8b8a0');
      gems.forEach((g, j) => {
        const qx = x + 66 + j * 8, qy = yy - 7;
        if (g) { ctx.fillStyle = ELEMENTS[g.el].color; ctx.fillRect(qx, qy, 6, 6); }
        else { ctx.strokeStyle = '#6a5a64'; ctx.lineWidth = 1; ctx.strokeRect(qx + 0.5, qy + 0.5, 5, 5); }
      });
      const keys = Object.keys(sum);
      const join = ks => ks.map(k => GEM_SHORT[k] + '+' + sum[k] + (STATS[k].pct ? '%' : '')).join(' ');
      let txt = !gems.length ? '보석 칸 없음' : !keys.length ? '비어 있음' : join(keys);
      // 길면 글자를 조금 줄이고, 그래도 넘치면 핵심 수치(피해 · 치명 · 방어 · 체력)만 — 전부는 가방 창에서
      const fits = (t, sz) => { ctx.font = 'bold ' + sz + 'px ' + Gfx.FONT; return ctx.measureText(t).width <= 126; };
      let size = 10;
      if (!fits(txt, 10)) { size = 9; if (!fits(txt, 9)) txt = join(keys.filter(k => GEM_MAIN.includes(k))); if (!fits(txt, 9)) size = 8; }
      T_(ctx, txt, x + 100, yy, size, keys.length ? '#e8e0d0' : '#6a6068');
    });
    // 남는 두 줄: 끼고 있는 유니크 효과(잎사귀 방패는 다시 생기기까지 남은 초)
    const fx = SLOTS.map(s => prof.equip[s]).filter(it => it && it.uniq).map(it => {
      const u = UNIQUES[it.uniq];
      return u.fx + (it.uniq === 'leaf' && p && p.leafT > 0 ? ' ' + Math.ceil(p.leafT) + '초' : '');
    });
    T_(ctx, '★ 유니크', x, y + 24, 10, RARITY[3].color);
    if (!fx.length) { T_(ctx, '없음', x + 60, y + 24, 10, '#6a6068'); return; }
    // 한 줄(폭 160)에 들어가는 만큼 담고 나머지는 다음 줄. 둘째 줄도 넘치면 글자를 줄인다
    const W = 160;
    let size = 10, lines;
    for (; size >= 8; size--) {
      ctx.font = 'bold ' + size + 'px ' + Gfx.FONT;
      lines = [[], []];
      for (const f of fx) lines[ctx.measureText([...lines[0], f].join(' · ')).width <= W ? 0 : 1].push(f);
      if (ctx.measureText(lines[1].join(' · ')).width <= W) break;
    }
    lines.forEach((ln, i) => { if (ln.length) T_(ctx, ln.join(' · '), x + 60, y + 24 + i * 12, size, '#ffd36a'); });
  }

  function draw(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const p = World.player, prof = World.prof, C = p.cls, lv = World.level;
    // ── 아래 돌판 ──
    const g = ctx.createLinearGradient(0, PY, 0, 540);
    g.addColorStop(0, '#2a2026'); g.addColorStop(1, '#140e12');
    ctx.fillStyle = g; ctx.fillRect(0, PY, 960, 540 - PY);
    ctx.fillStyle = '#5a4436'; ctx.fillRect(0, PY, 960, 2);
    // 경험치: 판 맨 아래(글자와 안 겹치게, 2026-10-24 사용자)
    Gfx.bar(ctx, 140, PY + 79, 680, 5, prof.exp / expToNext(prof.lv), '#c8a040', '#2a2010');
    // 체력 구슬 · 특수기 구슬
    globe(ctx, 66, PY + 30, 50, p.hp / p.maxHp, ['#ff4a3a', '#7a0a0a'], '#2a0606', Math.ceil(Math.max(0, p.hp)) + '/' + p.maxHp);
    globe(ctx, 894, PY + 30, 50, p.sp / p.maxSp, ['#5a9aff', '#0a2a7a'], '#06102a', Math.floor(p.sp) + '/' + p.maxSp);
    T_(ctx, '체력', 66, PY - 26, 11, '#c8a8a0', 'center');
    T_(ctx, '기력', 894, PY - 26, 11, '#a8b8d8', 'center');
    // 물약 벨트
    const by = PY + 20;
    T_(ctx, '물약 ' + L('potion'), 142, by - 2, 10, '#c8b8a0');
    for (let i = 0; i < C.potion.max; i++) {
      const x = 140 + i * 38;
      box(ctx, x, by + 2, 34);
      if (i < prof.potions) Gfx.spr(ctx, 'flask_red', x + 17, by + 32, { scale: 1.8 });
    }
    // 가운데: 기술 = 속성석 칸 4개(2026-10-24 사용자: 기술 아이콘 칸은 없애고 속성석 칸이 기술 칸을 겸한다)
    // 위 = 누르는 키 + 기술 이름, 칸 = 낀 속성석(없으면 기술 모양을 흐리게), 아래 = 드는 기력(모자라면 빨강)
    const SKILL_KEYS = { basic: 'attack', charge: 'charge', wave: 'special', dash: 'dodge' };
    const costs = { basic: 0, charge: C.charge.cost, wave: C.special.cost, dash: dashCost(p) };
    STONE_SLOTS.forEach((slot, i) => {
      const x = 374 + i * 56, y = PY + 16, s = Elements.socket(prof, slot), col = s ? ELEMENTS[s.el].color : null;
      box(ctx, x, y, 44, col);
      if (s) Gfx.stoneIcon(ctx, s, x + 22, y + 22, 30);
      else if (slot === 'basic' && prof.equip.weapon) {
        const wb = Items.base(prof.equip.weapon);
        ctx.globalAlpha = 0.4; Gfx.spr(ctx, wb.icon, x + 22, y + 24, { scale: 1, rot: 0.75, center: true, tint: wb.tint, tintAlpha: Gfx.WEAPON_TINT }); ctx.globalAlpha = 1;
      } else if (slot !== 'basic') skillIcon(ctx, C.icons[slot], x + 22, y + 22, '#6a6072');
      T_(ctx, L(SKILL_KEYS[slot]) + ' ' + C.slotShort[slot], x + 22, PY + 12, 11, col || '#c8b8a0', 'center');
      const n = costs[slot];
      T_(ctx, '기력 ' + n, x + 22, PY + 73, 10, !n ? '#6a7a90' : p.sp >= n ? '#8ab8ff' : '#ff7a6a', 'center');
    });
    // 오른쪽: 레벨 · 골드(윗줄) + 보석 합계 4줄(무기 · 방어구 · 목걸이 · 반지, 2026-10-24 사용자)
    T_(ctx, 'Lv.' + prof.lv, 606, PY + 15, 14, '#f0e0b8');
    Gfx.spr(ctx, 'coin_anim_f0', 690, PY + 15, { scale: 1.4 });
    T_(ctx, String(prof.gold), 700, PY + 15, 13, '#ffd34d');
    gemSummary(ctx, prof, 606, PY + 31, p);
    T_(ctx, L('pause') + ' 메뉴 · ' + L('inv') + ' 가방', 142, PY + 73, 10, '#7a6e70');

    // ── 위: 대상 이름표(보스 → 가까운 고유 · 정예) ──
    const es = World.enemies();
    let tgt = es.find(e => e.rank === 'boss' && e.awake && !e.dying && e.state !== 'dead');
    if (!tgt) {
      let bd = 170;
      for (const e of es) {
        if (e.rank === 'normal' || !e.awake || e.dying || e.state === 'dead') continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd) { bd = d; tgt = e; }
      }
    }
    if (tgt) {
      T_(ctx, tgt.name, 480, 26, 17, NAME_COLOR[tgt.rank], 'center');
      if (tgt.affixes && tgt.affixes.length && tgt.rank === 'unique') T_(ctx, tgt.affixes.map(a => AFFIXES[a].name).join(' · '), 480, 44, 11, '#c8b8a0', 'center');
      Gfx.bar(ctx, 330, 50, 300, 8, tgt.hp / tgt.maxHp, '#c02a2a');
    }
    // ── 오른쪽 위: 자동 지도(가 본 곳) ──
    drawMap(ctx, lv, p);
    const c = World.comboInfo;
    if (c) { ctx.globalAlpha = Math.min(1, c.t / 0.5); T_(ctx, c.n + ' 콤보', 930, 170, 26, '#ffd36a', 'right'); ctx.globalAlpha = 1; }
    const m = World.msg;
    if (m) { ctx.globalAlpha = Math.min(1, m.t / 0.4); T_(ctx, m.s, 480, 130, 28, '#f0e0b8', 'center'); ctx.globalAlpha = 1; }
  }

  function drawMap(ctx, lv, p) {
    const s = Math.min(150 / lv.W, 120 / lv.H);
    const ox = 950 - lv.W * s, oy = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(ox - 4, oy - 4, lv.W * s + 8, lv.H * s + 8);
    ctx.fillStyle = 'rgba(170,150,130,0.55)';
    for (let y = 0; y < lv.H; y++) for (let x = 0; x < lv.W; x++) {
      const i = y * lv.W + x;
      if (lv.explored[i] && lv.tiles[i] === 1) ctx.fillRect(ox + x * s, oy + y * s, Math.ceil(s), Math.ceil(s));
    }
    const b = lv.boss;
    if (lv.explored[b.cy * lv.W + b.cx]) { ctx.strokeStyle = '#d83a3a'; ctx.lineWidth = 1; ctx.strokeRect(ox + b.x * s, oy + b.y * s, b.w * s, b.h * s); }
    for (const c of lv.chests) if (!c.open && lv.explored[Math.floor(c.y / T) * lv.W + Math.floor(c.x / T)]) { ctx.fillStyle = '#ffd34d'; ctx.fillRect(ox + c.x / T * s - 1.5, oy + c.y / T * s - 1.5, 3, 3); }
    if (lv.stairs) { ctx.fillStyle = '#7dd3ff'; ctx.fillRect(ox + lv.stairs.x / T * s - 2, oy + lv.stairs.y / T * s - 2, 4, 4); }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(ox + p.x / T * s - 2, oy + p.y / T * s - 2, 4, 4);
    T_(ctx, lv.def.name, 950, oy + lv.H * s + 18, 12, '#9a8e96', 'right');
  }

  return { draw };
})();
