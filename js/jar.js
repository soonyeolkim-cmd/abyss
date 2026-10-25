// 장비 항아리(2026-10-25 사용자: 99 이후 콘텐츠의 도박을 지금 — 내 레벨대 장비 뽑기). 도박꾼 단지 → '항아리 깨기', overlay 'jar'.
// 2026-10-25 사용자: 상인 엘린 → 도박꾼 NPC 로 옮김 · 값 절반 · 부위를 골라 뽑기 · 창은 물약 · 속성석 사기 창과 같은 꼴.
// 왼쪽 = 부위 일곱 줄(무기 · 투구 · 갑옷 · 장갑 · 신발 · 목걸이 · 반지, 값 · 착용 레벨), 오른쪽 = 항아리 무대(흔들림 → 깨짐 → 나온 장비).
// 등급은 data.js JAR 표대로(유니크 3% · 레어 10% · 매직 35% · 일반 52%). 유니크도 고른 부위 것.
// 장비는 깨는 순간 가방에 들어가고 저장된다(연출 중에 닫아도 잃지 않음). 가방이 가득 차면 못 산다.
const Jar = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  const SHAKE = 1.2, POP = 0.5;  // 흔들림 · 깨지는 연출 시간(초)
  let st = 'ready', t = 0, item = null, shards = [], last = performance.now(), sel = 0;

  // 항아리 도트(32x32, 칸마다 계산): 갈색 질그릇 몸 · 목 · 테두리 · 금빛 띠 · 위를 덮은 보라 천과 끈
  let jarCanvas = null;
  function jarArt() {
    if (jarCanvas) return jarCanvas;
    const N = 32, P = { o: '#1a0e08', b: '#a0522d', s: '#6e3418', h: '#d08a4a', r: '#c07040', g: '#e8c040', G: '#a07a20', c: '#7a3ab0', C: '#b070e0', k: '#3a1a5a' };
    const at = (x, y) => {
      const px = x + 0.5, py = y + 0.5;
      if (py >= 2 && py < 6 && Math.abs(px - 16) < 7.5 - (py - 2) * 0.4) return py < 3.5 ? 'C' : 'c';        // 덮은 천
      if (py >= 6 && py < 7.2 && Math.abs(px - 16) < 6.5) return 'k';                                            // 묶은 끈
      if (py >= 7.2 && py < 9 && Math.abs(px - 16) < 7) return py < 8 ? 'h' : 'r';                                // 테두리
      if (py >= 9 && py < 12 && Math.abs(px - 16) < 4.6) return px < 14 ? 'h' : px > 18 ? 's' : 'b';              // 목
      const e = ((px - 16) / 11.5) ** 2 + ((py - 20.5) / 9.5) ** 2;                                              // 몸통
      if (e <= 1 && py >= 11) {
        if (py >= 18 && py < 19.6) return Math.round(px) % 3 === 0 ? 'G' : 'g';                                   // 금빛 띠(점무늬)
        const light = (px - 11) ** 2 + (py - 15) ** 2 < 12;
        return light ? 'h' : px > 21 || py > 27 ? 's' : 'b';
      }
      return null;
    };
    const c = document.createElement('canvas'); c.width = c.height = N + 2;
    const g = c.getContext('2d'), A = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? null : at(x, y));
    for (let y = -1; y <= N; y++) for (let x = -1; x <= N; x++) {
      const v = A(x, y);
      if (v) { g.fillStyle = P[v]; g.fillRect(x + 1, y + 1, 1, 1); continue; }
      let edge = false;
      for (let j = -1; j <= 1 && !edge; j++) for (let i = -1; i <= 1; i++) if (A(x + i, y + j)) { edge = true; break; }
      if (edge) { g.fillStyle = P.o; g.fillRect(x + 1, y + 1, 1, 1); }
    }
    return (jarCanvas = c);
  }

  const price = prof => JAR.price(prof.lv);
  const slot = () => SLOTS[sel];
  function open() { st = 'ready'; t = 0; item = null; shards = []; last = performance.now(); }

  // 사서 깨기: 골드 · 가방 확인 → 고른 부위 장비를 만들어 가방에 → 흔들림 시작
  function buy(prof) {
    const p = price(prof);
    if (prof.gold < p) { Sfx.deny(); Game.toast('골드가 모자라요 (' + p + 'G)'); return; }
    const bagSlot = prof.bag.indexOf(null);
    if (bagSlot < 0) { Sfx.deny(); Game.toast('가방이 가득 찼어요 — 장비를 팔거나 정리해 주세요'); return; }
    prof.gold -= p;
    // 등급 = data.js JAR 표(유니크 · 레어 · 매직, 나머지 일반)
    const il = Math.max(1, prof.lv), s = slot(), uniqs = Object.keys(UNIQUES).filter(u => UNIQUES[u].slot === s), r = Math.random();
    item = uniqs.length && r < JAR.uniq
      ? Items.make(il, { slot: s, rarity: 3, uniq: uniqs[Math.floor(Math.random() * uniqs.length)] })
      : Items.make(il, { slot: s, rarity: r < JAR.uniq + JAR.rare ? 2 : r < JAR.uniq + JAR.rare + JAR.magic ? 1 : 0 });
    prof.bag[bagSlot] = item;
    Game.changed();
    st = 'shake'; t = 0; shards = [];
    Sfx.forgeStart();
  }

  function update(o, prof) {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now; t += dt;
    if (st === 'shake') {
      if (Math.floor((t - dt) / 0.2) !== Math.floor(t / 0.2)) Sfx.forgeTap(Math.floor(t / 0.2));
      if (t >= SHAKE) {  // 깨짐: 조각이 튀고 등급 소리
        st = 'pop'; t = 0;
        for (let i = 0; i < 26; i++) { const a = Math.random() * Math.PI * 2, s = 100 + Math.random() * 220; shards.push({ x: 0, y: 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 110, s: 3 + Math.floor(Math.random() * 4) }); }
        Sfx.blast();
        if (item.uniq) Sfx.unique(); else Sfx.drop(item.rarity);
        Coop.brag({ kind: 'jar', item });  // 파티면 머리 위 말풍선 · 친구에게도(유니크 = 대박, 레어 = 쏠쏠, 매직 · 일반 = 꽝)
      }
      return;
    }
    if (st === 'pop') { for (const s of shards) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 600 * dt; } if (t >= POP) { st = 'result'; t = 0; } return; }
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
    // 부위 고르기(결과를 보다가 다른 부위로 가면 새 항아리)
    const n = SLOTS.length, before = sel;
    if (Input.nav('up')) sel = (sel + n - 1) % n;
    if (Input.nav('down')) sel = (sel + 1) % n;
    if (sel !== before && st === 'result') { st = 'ready'; item = null; }
    if (Input.wasPressed('ok')) buy(prof);
  }

  // 부위 줄 아이콘: 내 레벨 단계 재질의 기본 장비 그림(무기는 내 직업 첫 무기)
  const previewOf = (prof, s) => ({ base: s + (s === 'weapon' ? '_' + clsOf(prof).weapons[0] : '') + '_' + tierOf(bandLvl(Math.max(1, prof.lv))) });

  const CX = 712, JY = 236;  // 오른쪽 무대 가운데 · 항아리 바닥 높이
  function draw(ctx, o, prof) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.96)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });
    ctx.imageSmoothingEnabled = false;
    const busy = st === 'shake' || st === 'pop', p = price(prof), req = reqLevel(bandLvl(Math.max(1, prof.lv)));
    // ── 왼쪽: 부위 고르기(상인 사기 창과 같은 꼴) ──
    Gfx.panel(ctx, 24, 24, 440, 470, { border: '#ffd36a' });
    T_(ctx, '항아리 고르기', 44, 62, 22, '#f0e0b8');
    T_(ctx, '골드 ' + prof.gold + 'G', 444, 62, 16, '#ffd34d', 'right');
    SLOTS.forEach((s, i) => {
      const y = 78 + i * 44, on = sel === i;
      if (!busy) UI.zone(40, y, 408, 40, { on: () => sel === i, pick: () => { if (sel !== i && st === 'result') { st = 'ready'; item = null; } sel = i; } });
      Gfx.panel(ctx, 40, y, 408, 40, { border: on ? '#ffd36a' : '#3a2e36', bg: '#1d151b' });
      Gfx.icon(ctx, previewOf(prof, s), 64, y + 20, 26);
      T_(ctx, SLOT_NAMES[s] + ' 항아리', 88, y + 27, 15, on ? '#ffd36a' : '#f0e0b8');
      T_(ctx, p + 'G · 착용 Lv.' + req, 436, y + 27, 12, prof.gold >= p ? '#9a8e96' : '#ff7a6a', 'right');
    });
    const pc = v => Math.round(v * 100) + '%';
    T_(ctx, '일반 ' + pc(1 - JAR.uniq - JAR.rare - JAR.magic) + ' · 매직 ' + pc(JAR.magic) + ' · 레어 ' + pc(JAR.rare) + ' · 유니크 ' + pc(JAR.uniq), 44, 404, 13, '#c8b8a0');
    const cur = prof.equip[slot()];
    T_(ctx, '지금 낀 ' + SLOT_NAMES[slot()] + ': ' + (cur ? Items.nameOf(cur) + (cur.ups ? ' +' + cur.ups : '') : '없음'), 44, 428, 12, cur ? RARITY[cur.rarity].color : '#6a6068');
    T_(ctx, '깨 보기 전엔 몰라요! 고른 부위의 내 레벨대 장비가 하나 들어 있어요', 44, 476, 12, '#9a8e96');

    // ── 오른쪽: 항아리 무대 ──
    Gfx.panel(ctx, 488, 24, 448, 470, { border: '#e8c040', bg: '#1a120c' });
    T_(ctx, SLOT_NAMES[slot()] + ' 항아리', CX, 62, 20, '#ffd36a', 'center');
    const time = performance.now() / 1000, rarCol = item ? RARITY[item.rarity].color : '#ffd36a';
    if (st === 'ready' || st === 'shake') {
      // 항아리(흔들림: 점점 세게 · 빨라지며, 금이 간다)
      const k = st === 'shake' ? t / SHAKE : 0, wob = st === 'shake' ? Math.sin(t * (18 + k * 30)) * (2 + k * 9) : Math.sin(time * 2) * 1;
      ctx.save(); ctx.translate(CX, JY + 50); ctx.rotate(wob * 0.012); ctx.drawImage(jarArt(), -85, -170, 170, 170);
      if (k > 0.25) {  // 금
        ctx.strokeStyle = '#1a0e08'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-25, -100); ctx.lineTo(-10, -75); ctx.lineTo(-20, -50); if (k > 0.55) { ctx.lineTo(3, -28); ctx.lineTo(-5, -8); } ctx.stroke();
        if (k > 0.7) { ctx.beginPath(); ctx.moveTo(33, -92); ctx.lineTo(18, -67); ctx.lineTo(28, -43); ctx.stroke(); }
      }
      if (k > 0.6) {  // 틈으로 새는 빛(나올 등급 색)
        ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(0, -66, 4, 0, -66, 100);
        gl.addColorStop(0, hexA(rarCol, (k - 0.6) * 1.6)); gl.addColorStop(1, hexA(rarCol, 0));
        ctx.fillStyle = gl; ctx.fillRect(-120, -190, 240, 220);
      }
      ctx.restore();
    }
    if (st === 'pop' || st === 'result') {
      // 깨진 자리: 등급 색 빛(레어 이상은 빛기둥) · 날아가는 조각
      const k = st === 'pop' ? t / POP : 1;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cy = JY - 50, gl = ctx.createRadialGradient(CX, cy, 6, CX, cy, 130 + (1 - k) * 50);
      gl.addColorStop(0, hexA(rarCol, 0.75)); gl.addColorStop(1, hexA(rarCol, 0));
      ctx.fillStyle = gl; ctx.fillRect(CX - 210, cy - 190, 420, 380);
      if (item.uniq || item.rarity >= 2) { ctx.fillStyle = hexA(rarCol, 0.18 + 0.08 * Math.sin(time * 5)); ctx.fillRect(CX - 26, 76, 52, cy - 46); }
      ctx.restore();
      ctx.fillStyle = '#a0522d';
      for (const s of shards) if (st === 'pop') ctx.fillRect(Math.round(CX + s.x), Math.round(JY - 50 + s.y), s.s, s.s);
      // 나온 장비: 커지며 나타남 + 천천히 떠오름
      const sc = st === 'pop' ? 0.4 + 0.6 * k : 1, bob = Math.sin(time * 2.5) * 4;
      Gfx.icon(ctx, item, CX, JY - 60 + bob, Math.round(96 * sc));
    }
    if (st === 'result') {
      const lines = Items.describe(item, prof);  // 이름 · 등급 · 능력치 · 낀 것과 비교
      T_(ctx, Items.nameOf(item), CX, JY + 34, 20, rarCol, 'center');
      T_(ctx, (item.uniq ? '유니크' : RARITY[item.rarity].name) + ' · ' + SLOT_NAMES[item.slot] + ' · 착용 Lv.' + Items.req(item), CX, JY + 56, 13, '#c8b8a0', 'center');
      lines.slice(2, 7).forEach((l, i) => T_(ctx, l.t, CX, JY + 80 + i * 18, 13, l.c || '#e8dcc8', 'center'));
    } else if (st === 'ready') {
      T_(ctx, '값 ' + p + 'G', CX, JY + 84, 22, prof.gold >= p ? '#ffd34d' : '#ff7a6a', 'center');
      T_(ctx, '착용 Lv.' + req + ' ' + SLOT_NAMES[slot()] + ' · 가방 빈칸 ' + prof.bag.filter(b => !b).length, CX, JY + 108, 13, '#9a8e96', 'center');
    }
    // 깨기 버튼(흔들리고 깨지는 동안은 없음)
    if (!busy) {
      const by = 432, bw = 300, bx = CX - bw / 2;
      UI.zone(bx, by, bw, 40, { key: 'ok', now: true });
      Gfx.panel(ctx, bx, by, bw, 38, { border: '#e8c040', bg: '#1d151b' });
      T_(ctx, (st === 'result' ? '한 번 더 ' : '항아리 깨기 ') + p + 'G ' + L('ok'), CX, by + 25, 15, '#ffd36a', 'center');
    }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 496, 960, 44);
    T_(ctx, '부위 고르기 ↑↓ · 항아리 깨기 ' + L('ok') + ' · 닫기 ' + L('back'), 480, 522, 13, '#8a7e88', 'center');
  }
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + Math.max(0, Math.min(1, a)) + ')'; };

  return { open, update, draw, jarArt };
})();
