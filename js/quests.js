// 의뢰 게시판(2026-10-27 사용자: 일일 1 · 주간 2) — 마을 '의뢰 게시판'(벨록 분수 위 · 실베인 갱도 입구 아래)에 말 걸면 overlay 'quests'.
// 일일은 자정, 주간은 월요일 0시에 새로 뽑힌다(폰 시계). 수치 · 의뢰 목록 · 보상은 data.js QUEST.
// 진행은 on(일, 던전 레벨)로 센다: world.js reward(몹 · 정예 · 보스) · bossCleared(레이드 · 3층 수호자), ui.js 강화 시도 · 합치기.
// 다 하면 '의뢰 완료!' 알림 → 게시판에서 보상 받기. prof.quests = { day, daily: [의뢰], week, weekly: [의뢰, 의뢰] }
const Quests = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  const GATED = ['kill', 'elite', 'boss'];
  const pad = n => String(n).padStart(2, '0');
  const dayKey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const monday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d; };
  let sel = 0;

  // 못 하는 의뢰는 안 나온다(2026-10-27 사용자): 강화 한도(enchantMax)라 강화할 장비가 없으면 강화 시도 X, 심연(입장 레벨까지)이 안 열렸으면 레이드 · 3층 X,
  // 몹 · 정예 · 보스의 조건은 던전 입장 레벨(2026-10-27 사용자): 내 레벨의 10단위에서 한 단계 아래 이상(Lv.92 → 입장 Lv.80 이상 던전),
  // 단 지금 들어갈 수 있는 가장 높은 던전의 입장 레벨을 넘지 않게
  const abyssOk = prof => endlessOpen(prof) && prof.lv >= ENDLESS.entry;
  function topLv(prof) {
    let best = 0;
    for (const d of DUNGEONS) if (prof.lv >= d.lv && !(d.needs && !prof.cleared[d.needs])) best = Math.max(best, d.lv);
    return abyssOk(prof) ? Math.max(best, ENDLESS.entry) : best;
  }
  const gateLv = prof => Math.max(1, Math.min(Math.floor(prof.lv / 10) * 10 - QUEST.gate, topLv(prof)));
  const canEnchantAny = prof => [...SLOTS.map(s => prof.equip[s]), ...prof.bag].some(it => it && (it.ups || 0) < enchantMax(it));
  function possible(x, prof) {  // x = 목록의 의뢰 정의 또는 받은 의뢰
    if (x.abyss && !abyssOk(prof)) return false;
    if (x.ev === 'enchant' && !canEnchantAny(prof)) return false;
    if (GATED.includes(x.ev) && (!topLv(prof) || (x.minLv || 0) > topLv(prof))) return false;
    return true;
  }
  function make(def, prof) {
    const minLv = GATED.includes(def.ev) ? gateLv(prof) : 0;
    return { ev: def.ev, name: def.name, n: def.n, abyss: !!def.abyss, have: 0, minLv, entry: true, done: false, claimed: false };
  }
  // 받아 둔 의뢰가 그 뒤 못 하게 되면(예: 강화를 다 끝내 +10) 같은 칸에 할 수 있는 다른 의뢰로 바꿔 둔다
  function refit(list, pool, prof) {
    list.forEach((x, i) => {
      if (x.done || possible(x, prof)) return;
      const alt = pickN(pool.filter(d => possible(d, prof) && !list.some(y => y.ev === d.ev)), 1)[0];
      if (alt) list[i] = make(alt, prof);
    });
  }
  function pickN(list, k) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, k);
  }
  // 날이 · 주가 바뀌었으면 새로 뽑기
  function ensure(prof) {
    if (!prof) return null;
    const q = prof.quests || (prof.quests = {});
    const pool = list => list.filter(d => possible(d, prof));
    const day = dayKey(new Date()), week = dayKey(monday());
    if (q.day !== day || !q.daily) { q.day = day; q.daily = pickN(pool(QUEST.daily), 1).map(d => make(d, prof)); }
    if (q.week !== week || !q.weekly) { q.week = week; q.weekly = pickN(pool(QUEST.weekly), 2).map(d => make(d, prof)); }
    for (const x of [...q.daily, ...q.weekly]) if (!x.entry) { if (x.minLv) x.minLv = gateLv(prof); x.entry = true; }  // 예전 의뢰(내 레벨 − 10 · 던전 레벨)는 입장 레벨 조건으로 한 번 고침
    refit(q.daily, QUEST.daily, prof); refit(q.weekly, QUEST.weekly, prof);
    return q;
  }
  // 진행 세기: ev = 할 일, lv = 그 던전 입장 레벨(kill · elite · boss 만 봄)
  function on(ev, lv = 999, n = 1) {
    const q = ensure(Game.prof);
    if (!q) return;
    for (const x of [...q.daily, ...q.weekly]) {
      if (x.done || x.ev !== ev || lv < x.minLv) continue;
      x.have = Math.min(x.n, x.have + n);
      if (x.have >= x.n) { x.done = true; Sfx.chest(); Game.toast('의뢰 완료! ' + x.name + ' — 게시판에서 보상을 받아요'); }
    }
  }
  const pending = prof => { const q = ensure(prof); return q ? [...q.daily, ...q.weekly].filter(x => x.done && !x.claimed).length : 0; };

  function rewardOf(kind, prof) {
    const R = QUEST.reward[kind];
    return { gold: Math.round(QUEST.runGold * R.runs * GOLD_CURVE(prof.lv) * GOLD_MUL), scrolls: R.scrolls, stone: R.stone, essence: R.essence && endlessOpen(prof) ? R.essence : 0 };
  }
  const rewardText = r => [fmtNum(r.gold) + 'G', SCROLL_NAMES[0] + ' ' + r.scrolls + '장', ...(r.stone !== undefined ? [STONE_SIZES[r.stone].name + ' 속성석 1개'] : []), ...(r.essence ? ['심연 정수 ' + r.essence + '개'] : [])].join(' · ');
  function claim(prof, kind, x) {
    const r = rewardOf(kind, prof);
    prof.gold += r.gold;
    Items.addScroll(prof, { g: 'any', r: 0 }, r.scrolls);
    let st = null;
    if (r.stone !== undefined) { st = { el: EL_ORDER[Math.floor(Math.random() * EL_ORDER.length)], size: r.stone }; Elements.add(prof, st); }
    if (r.essence) addEssence(prof, r.essence);
    x.claimed = true;
    Sfx.unique();
    Game.toast('보상 받음: ' + fmtNum(r.gold) + 'G · 축복 주문서 ' + r.scrolls + '장' + (st ? ' · ' + stoneName(st) : '') + (r.essence ? ' · 정수 ' + r.essence : ''));
    Game.changed();
  }

  // ── 게시판 창 ──
  const rows = prof => { const q = ensure(prof); return [...q.daily.map(x => ['daily', x]), ...q.weekly.map(x => ['weekly', x])]; };
  function open(prof) { sel = 0; ensure(prof); }
  function update(o, prof) {
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
    const rs = rows(prof);
    sel = Math.min(sel, rs.length - 1);
    if (Input.nav('up')) sel = (sel + rs.length - 1) % rs.length;
    if (Input.nav('down')) sel = (sel + 1) % rs.length;
    if (!Input.wasPressed('ok')) return;
    const [kind, x] = rs[sel];
    if (x.claimed) Game.toast('이미 보상을 받았어요');
    else if (!x.done) { Sfx.deny(); Game.toast('아직 다 하지 못했어요 (' + x.have + ' / ' + x.n + ')'); }
    else claim(prof, kind, x);
  }
  const leftTxt = ms => { const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60); return d ? d + '일 ' + h + '시간' : h + '시간 ' + (m % 60) + '분'; };
  // 보상 받은 의뢰(2026-10-27 사용자: 흐리게): 칸 안을 어둡게 덮고 진행 막대 위에 비스듬한 붉은 '완료' 도장(덮개 위라 또렷)
  function claimedMark(ctx, y) {
    ctx.fillStyle = 'rgba(12,8,6,0.62)'; ctx.fillRect(142, y + 2, 676, 92);
    ctx.save();
    ctx.translate(660, y + 46); ctx.rotate(-0.21);
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#e0503c';
    ctx.lineWidth = 3; ctx.strokeRect(-50, -20, 100, 40);
    ctx.lineWidth = 1; ctx.strokeRect(-45, -15, 90, 30);
    T_(ctx, '완료', 0, 8, 20, '#e0503c', 'center');
    ctx.restore();
  }
  function draw(ctx, o, prof) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });
    Gfx.panel(ctx, 120, 30, 720, 460, { border: '#c8a070', bg: '#1d1610' });
    T_(ctx, '의뢰 게시판', 144, 70, 24, '#f0e0b8');
    T_(ctx, '일일은 자정 · 주간은 월요일에 새 의뢰', 816, 70, 12, '#9a8e96', 'right');
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const mon = monday(); mon.setDate(mon.getDate() + 7);
    const rs = rows(prof);
    let y = 96, lastKind = null;
    rs.forEach(([kind, x], i) => {
      if (kind !== lastKind) {
        lastKind = kind;
        T_(ctx, kind === 'daily' ? '일일 의뢰' : '주간 의뢰', 144, y + 20, 16, kind === 'daily' ? '#ffd36a' : '#c8a0ff');
        T_(ctx, '바뀌기까지 ' + leftTxt((kind === 'daily' ? mid : mon) - now), 816, y + 20, 12, '#8a7e88', 'right');
        y += 30;
      }
      const on = sel === i, r = rewardOf(kind, prof);
      UI.zone(140, y, 680, 96, { on: () => sel === i, pick: () => { sel = i; } });
      Gfx.panel(ctx, 140, y, 680, 96, { border: on ? '#ffd36a' : x.done && !x.claimed ? '#7dff8a' : '#4a3a2e', bg: '#140e0a' });
      // 의뢰 종이 그림(작게)
      ctx.fillStyle = '#f0e6d2'; ctx.fillRect(156, y + 14, 34, 42); ctx.fillStyle = '#c83838'; ctx.fillRect(171, y + 10, 4, 4);
      ctx.fillStyle = '#2a1630'; for (let k = 0; k < 4; k++) ctx.fillRect(161, y + 24 + k * 7, k === 3 ? 14 : 24, 2);
      T_(ctx, x.name + ' ' + x.n + (x.ev === 'kill' || x.ev === 'elite' ? '마리' : '번'), 206, y + 30, 17, on ? '#ffd36a' : '#f0e0b8');
      if (x.minLv) T_(ctx, '입장 Lv.' + x.minLv + ' 이상 던전에서', 206, y + 50, 11, '#8a7e88');
      // 진행 막대
      const bx = 520, bw = 280, k = x.have / x.n;
      ctx.fillStyle = '#2a2018'; ctx.fillRect(bx, y + 20, bw, 12);
      ctx.fillStyle = x.claimed ? '#7a8478' : x.done ? '#7dff8a' : '#c8a050'; ctx.fillRect(bx, y + 20, Math.round(bw * k), 12);
      T_(ctx, x.have + ' / ' + x.n, bx + bw, y + 50, 13, x.claimed ? '#a8a0a0' : x.done ? '#7dff8a' : '#e8e0d0', 'right');
      T_(ctx, x.claimed ? '✔ 받음' : x.done ? '보상 받기 ' + L('ok') : '진행 중', bx, y + 50, 13, x.claimed ? '#8a7e88' : x.done ? '#7dff8a' : '#c8b8a0');
      T_(ctx, '보상 ' + rewardText(r), 206, y + 80, 12, '#ffd34d');
      if (x.claimed) claimedMark(ctx, y);
      y += 104;
    });
    if (Input.touchMode()) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 500, 960, 40);
    T_(ctx, '고르기 ↑↓ · 보상 받기 ' + L('ok') + ' · 닫기 ' + L('back'), 480, 524, 13, '#8a7e88', 'center');
  }

  return { ensure, on, pending, open, update, draw };
})();
