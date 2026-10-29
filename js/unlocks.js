// 콘텐츠 해금(2026-10-29 사용자 "해금되는 순간 새로운 게 생겼다는 걸 알게"): 조건을 채우는 순간 화면에 큰 알림 + 효과음,
// 그 콘텐츠 NPC 머리 위 NEW(처음 말 걸 때까지). 같은 때 열린 것은 한 알림에 모아 보인다(진엔딩 = 만렙 · 끝없는 심연 · 원소 각인).
// prof.unlocks[id] = 1 열림(알림 냄) · prof.unlockNew[id] = 1 NEW 아직. 예전 캐릭터는 처음 켤 때 이미 채운 것을 한 번에 알린다.
const UNLOCKS = [
  { id: 'cap', name: '만렙 Lv.' + LV_MAX_ABYSS, where: '심연의 문 영웅을 깨서 레벨 한도가 열렸어요', ok: p => endlessOpen(p) },
  { id: 'endless', name: '끝없는 심연 · 레이드', where: '실베인 던전 입구 — 입장 Lv.' + ENDLESS.entry, npc: 'gate', town: 'silvane', ok: p => endlessOpen(p) },
  { id: 'imprint', name: '원소 각인', where: '세공사 미라', npc: 'jewel', ok: p => endlessOpen(p) },
  { id: 'craft', name: 'Lv.100 유니크 제작', where: '실베인 심연 장인 고른', npc: 'artisan', town: 'silvane', ok: p => p.lv >= 100 },
  { id: 'enchant', name: '강화 한도 확장', where: '대장장이 브론 — Lv.110 장비부터 +11', npc: 'smith',
    ok: p => [...SLOTS.map(s => p.equip[s]), ...p.bag].some(it => it && enchantMax(it) > ENCHANT_MAX) },
];

const Unlocks = (() => {
  const SHOW = 3.5, PER = 1.2, FADE = 0.6;  // 알림 보이는 시간 = SHOW + 줄마다 PER
  let queue = [], cur = null, t = 0, checkT = 0;

  function check(prof) {
    const u = prof.unlocks || (prof.unlocks = {});
    const fresh = UNLOCKS.filter(d => !u[d.id] && d.ok(prof));
    if (!fresh.length) return;
    const nw = prof.unlockNew || (prof.unlockNew = {});
    for (const d of fresh) { u[d.id] = 1; if (d.npc) nw[d.id] = 1; }
    queue.push({ prof, list: fresh });
    Save.write(prof);
  }
  // 창(대화 · 메뉴)이 열려 있으면 기다렸다가 닫히면 띄운다 — 진엔딩 대사가 끝난 뒤에 나오게
  function update(dt, prof, scene, overlays) {
    if ((checkT -= dt) <= 0) { checkT = 0.5; if (prof && (scene === 'town' || scene === 'run' || scene === 'result')) check(prof); }
    if (overlays.length) return;
    if (cur && (t += dt) > dur(cur)) cur = null;
    while (!cur && queue.length) {
      const q = queue.shift();
      if (q.prof === prof) { cur = q; t = 0; Sfx.unlock(); }  // 그 사이 캐릭터를 바꿨으면 버림
    }
  }
  const dur = q => SHOW + PER * q.list.length;

  function draw(ctx, scene, overlays) {
    if (!cur || overlays.length) return;
    // 던전에서는 작게 맨 위(가운데 = 내 캐릭터 · '레벨 업!' 글(130)을 가리지 않게), 마을 · 결과는 화면 가운데 크게
    const run = scene === 'run', n = cur.list.length, w = 540, x = 480 - w / 2;
    const top = run ? 54 : 74, gap = run ? 40 : 50, h = top + n * gap - (run ? 4 : 0);
    const y = run ? 12 : Math.round(250 - h / 2);
    const a = Math.min(1, t / 0.25, (dur(cur) - t) / FADE), glow = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = Math.max(0, a);
    Gfx.panel(ctx, x, y, w, h, { border: glow > 0.5 ? '#ffe08a' : '#c8a040' });
    Gfx.text(ctx, '✦ 새 콘텐츠 해금! ✦', 480, y + (run ? 28 : 36), run ? 19 : 24, '#ffd36a', 'center');
    cur.list.forEach((d, i) => {
      const ly = y + top + i * gap;
      Gfx.text(ctx, d.name, 480, ly, run ? 16 : 18, '#f0e0b8', 'center');
      Gfx.text(ctx, d.where, 480, ly + 20, 12, '#c8b8a0', 'center');
    });
    ctx.globalAlpha = 1;
  }

  // 마을 이름표 NEW: 그 NPC 에게 처음 말 걸 때까지(town 이 있으면 그 마을에서만)
  const pending = (prof, id, where) => UNLOCKS.filter(d => d.npc === id && (!d.town || d.town === where) && prof.unlockNew && prof.unlockNew[d.id]);
  const isNew = (prof, id, where) => pending(prof, id, where).length > 0;
  function seen(prof, id, where) {
    const ds = pending(prof, id, where);
    if (!ds.length) return;
    for (const d of ds) delete prof.unlockNew[d.id];
    Save.write(prof);
  }

  return { check, update, draw, isNew, seen, get showing() { return cur; } };
})();
