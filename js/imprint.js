// 원소 각인(2026-10-26 사용자: 속성석 소진처): 세공사 미라 '원소 각인'(끝없는 심연이 열린 뒤), overlay 'imprint'. 수치는 data.js IMPRINT.
// 전설 화염석 · 빙결석 · 뇌전석 · 맹독석 하나씩 + 골드 → ★ +1(최대 ★10). ★마다 낀 속성석 세기 +4%(어떤 속성을 끼든 같이 — elements.js power).
// 이정표 ★5 = 세트 효과 수치 ×1.2 · ★10 + 칸 4개 모두 전설 이상 = 전설 돌도 태초 오로라 그림.
const Imprint = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  let glowT = 0, last = performance.now();
  const pct = n => Math.round(IMPRINT.step * n * 100);
  const need = prof => {
    const n = Elements.stars(prof) + 1;
    return [...EL_ORDER.map(el => ({ el, have: prof.stones[el + ':' + IMPRINT.size] || 0, need: 1 })), { gold: true, have: prof.gold, need: IMPRINT.gold(n) }];
  };

  function open() { glowT = 0; last = performance.now(); }
  function tryImprint(prof) {
    const n = Elements.stars(prof);
    if (n >= IMPRINT.max) { Sfx.deny(); Game.toast('원소 각인은 ★' + IMPRINT.max + '이 끝이에요'); return; }
    const short = need(prof).filter(m => m.have < m.need);
    if (short.length) { Sfx.deny(); Game.toast('재료가 모자라요: ' + short.map(m => m.gold ? '골드' : STONE_SIZES[IMPRINT.size].name + ' ' + ELEMENTS[m.el].stone).join(' · ')); return; }
    Game.overlay({ type: 'confirm', text: '원소 각인 ★' + (n + 1) + '로 올릴까요?', defaultYes: true,
      sub: '전설 화염석 · 빙결석 · 뇌전석 · 맹독석 하나씩 + ' + IMPRINT.gold(n + 1) + 'G 를 써요', yes: () => imprint(prof) });
  }
  function imprint(prof) {
    const n = Elements.stars(prof) + 1;
    for (const el of EL_ORDER) Elements.take(prof, { el, size: IMPRINT.size });
    prof.gold -= IMPRINT.gold(n);
    prof.imprint = n;
    glowT = 1.8;
    Game.changed();
    Sfx.forgeStart(); Sfx.levelUp();
    Game.toast('원소 각인 ★' + n + ' — 속성석 세기 +' + pct(n) + '%' + (n === IMPRINT.setAt ? ' · 세트 효과 ×' + IMPRINT.setMul : n === IMPRINT.max ? ' · 전설 돌도 태초 빛' : ''));
  }

  function update(o, prof) {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
    last = now; glowT = Math.max(0, glowT - dt);
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
    if (Input.wasPressed('ok')) tryImprint(prof);
  }

  const X = 190, Y = 70, W = 580, H = 400, CX = X + W / 2;
  function draw(ctx, o, prof) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });
    ctx.imageSmoothingEnabled = false;
    const n = Elements.stars(prof), max = n >= IMPRINT.max, time = performance.now() / 1000;
    Gfx.panel(ctx, X, Y, W, H, { border: '#7dd3ff', bg: '#10141e' });
    T_(ctx, '원소 각인', CX, Y + 40, 22, '#cfeaff', 'center');
    // 별 10개(채운 것 = 금빛, 방금 올린 별은 반짝)
    for (let i = 0; i < IMPRINT.max; i++) {
      const sx = CX - (IMPRINT.max - 1) * 15 + i * 30, on = i < n, fresh = glowT > 0 && i === n - 1;
      T_(ctx, '★', sx, Y + 76, fresh ? 24 + Math.sin(time * 20) * 3 : 22, on ? (fresh ? '#ffffff' : '#ffd36a') : '#3a3e4a', 'center');
    }
    T_(ctx, '속성석 세기 +' + pct(n) + '%' + (max ? '' : '  →  +' + pct(n + 1) + '%'), CX, Y + 108, 16, '#f0e0b8', 'center');
    T_(ctx, '어떤 속성을 끼든 칸 능력 · 폭발 · 상태이상 · 패시브 피해가 모두 커져요 (범위는 그대로)', CX, Y + 130, 12, '#9aa8b8', 'center');
    // 이정표
    const mile = [[IMPRINT.setAt, '세트 효과 수치 ×' + IMPRINT.setMul], [IMPRINT.max, '칸 4개 모두 전설 이상이면 전설 돌도 태초 빛(오로라)']];
    mile.forEach(([at, txt], i) => {
      const got = n >= at;
      T_(ctx, (got ? '✔ ' : '') + '★' + at + ' — ' + txt, CX, Y + 158 + i * 20, 13, got ? '#7dff8a' : '#8a96a8', 'center');
    });
    // 재료(다음 ★)
    if (!max) {
      T_(ctx, '★' + (n + 1) + ' 재료', X + 30, Y + 220, 14, '#cfeaff');
      need(prof).forEach((m, i) => {
        const bx = X + 30 + i * 106, by = Y + 232, ok = m.have >= m.need;
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(bx, by, 98, 76);
        ctx.strokeStyle = ok ? '#4a6a5a' : '#6a3a3a'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, 97, 75);
        if (m.gold) { T_(ctx, 'G', bx + 49, by + 34, 24, '#ffd34d', 'center'); T_(ctx, fmtNum(m.need), bx + 49, by + 66, 12, ok ? '#7dff8a' : '#ff7a6a', 'center'); }
        else {
          Gfx.stoneIcon(ctx, { el: m.el, size: IMPRINT.size }, bx + 49, by + 28, 34);
          T_(ctx, ELEMENTS[m.el].stone, bx + 49, by + 56, 11, ELEMENTS[m.el].color, 'center');
          T_(ctx, m.have + ' / 1', bx + 49, by + 71, 11, ok ? '#7dff8a' : '#ff7a6a', 'center');
        }
      });
      T_(ctx, '전설(6단계)만 받아요 · 태초는 칸에 끼는 돌이라 안 받아요', CX, Y + 330, 11, '#8a96a8', 'center');
    } else T_(ctx, '원소 각인을 끝까지 올렸어요!', CX, Y + 260, 18, '#ffd36a', 'center');
    // 각인 버튼
    const ok = !max && need(prof).every(m => m.have >= m.need), by = Y + H - 54, bw = 280, bx = CX - bw / 2;
    UI.zone(bx, by, bw, 40, { key: 'ok', now: true });
    Gfx.panel(ctx, bx, by, bw, 38, { border: ok ? '#7dd3ff' : '#4a4e5a', bg: '#141a24' });
    T_(ctx, (max ? '최대 단계' : ok ? '각인하기 ' : '재료가 모자라요 ') + (max ? '' : L('ok')), CX, by + 25, 15, ok ? '#cfeaff' : '#7a8290', 'center');
    if (Input.touchMode()) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 496, 960, 44);
    T_(ctx, '각인 ' + L('ok') + ' · 닫기 ' + L('back'), 480, 522, 13, '#8a7e88', 'center');
  }

  return { open, update, draw };
})();
