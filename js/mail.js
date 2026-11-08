// 우체통(2026-11-01 사용자 '유저에게 메시지 · 아이템 보내는 용도'): 운영자 → 모든 플레이어 우편.
// 서버가 없어서 우편은 아래 MAIL 목록에 적고 깃허브에 올리면 보내진다. 저장(캐릭터)마다 우편 하나를 한 번씩 받는다 —
// prof.mail = { read: { id: 1 }, got: { id: 1 } }. 마을 우체통(town.js 'mail', 벨록 · 실베인) → overlay 'mail'.
//
// 우편 = { id, date, title, body, until?, gifts? }
//   id    : 바꾸지 않는 이름(받은 기록 열쇠) — 같은 id 를 다시 쓰면 이미 받은 사람은 못 받음
//   date  : 'YYYY-MM-DD' 보낸 날(목록은 새것부터)
//   body  : 본문(줄바꿈 \n)
//   until : 'YYYY-MM-DD' 이 날까지만 보임(더 일찍 끝낼 때만). 우편은 모두 보낸 날부터 KEEP_DAYS(30)일 뒤 저절로 사라짐 — 안 받은 선물도 함께
//           (2026-11-01 사용자 '30일 안 받으면 자동 삭제')
//   gifts : { gold, essence, cores, pearls, seeds, potions, scrolls(축복받은 강화 주문서 장 수), scrolls2(강화 주문서 장 수), inherit(계승 주문서 장 수),
//             stones: [{ el, size, n }](el = fire · frost · thunder · poison · might · guard, size 0 조각 ~ 6 태초),
//             items: [{ ilvl, slot, kind?, rarity }](slot = weapon · helmet · armor · gloves · boots · amulet · ring, rarity 0 일반 · 1 매직 · 2 레어 —
//                     장비 기본 능력치는 늘 같음(규칙). 무기는 kind 를 빼면 받는 캐릭터 직업 무기(우편은 모든 직업이 받으니 보통 뺌)) }
const MAIL = [
  { id: 'mailbox-open', date: '2026-11-01', title: '우체통이 생겼어요',
    body: '벨록 광장과 실베인 갱도 앞에 우체통을 세웠어요.\n앞으로 공지와 선물은 이 우체통으로 보내 드릴게요.\n선물이 든 우편은 받기를 눌러야 들어와요.' },
  { id: 'gift-legend-gems-1', date: '2026-11-01', title: '전설 보석 선물',
    body: '우체통이 생긴 기념으로 전설 공격 보석과 전설 방어 보석을 5개씩 보내 드려요.\n장비 보석 칸에 끼우거나 유니크 제작 · 업그레이드 재료로 써 보세요.',
    gifts: { stones: [{ el: 'might', size: 5, n: 5 }, { el: 'guard', size: 5, n: 5 }] } },
];

const Mail = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  let sel = 0;

  const KEEP_DAYS = 30;  // 보낸 날부터 이만큼 지나면 사라짐
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => ymd(new Date());
  const dayOf = s => { const [y, mo, d] = s.split('-').map(Number); return new Date(y, mo - 1, d); };
  // 사라지는 날(이 날까지 보임): 보낸 날 + KEEP_DAYS, until 이 더 이르면 until
  const expOf = m => { const d = dayOf(m.date); d.setDate(d.getDate() + KEEP_DAYS); const e = ymd(d); return m.until && m.until < e ? m.until : e; };
  const daysLeft = m => Math.round((dayOf(expOf(m)) - dayOf(today())) / 864e5);
  const box = prof => prof.mail || (prof.mail = { read: {}, got: {} });
  // 보이는 우편: 사라지는 날이 지나지 않은 것(받았든 안 받았든), 새것부터 — 같은 날 우편은 목록 아래(나중에 적은 것)가 위로
  const list = prof => { const t = today(); return MAIL.filter(m => expOf(m) >= t).sort((a, b2) => (a.date < b2.date ? 1 : a.date > b2.date ? -1 : MAIL.indexOf(b2) - MAIL.indexOf(a))); };
  const hasGift = m => !!(m.gifts && Object.keys(m.gifts).length);
  const waiting = (prof, m) => { const b = box(prof); return !b.read[m.id] || (hasGift(m) && !b.got[m.id]); };
  // 새 우편 · 안 받은 선물 수(마을 이름표 · 들어올 때 알림)
  const count = prof => list(prof).filter(m => waiting(prof, m)).length;

  // 선물 글 줄
  function giftLines(g) {
    const out = [];
    if (g.gold) out.push(fmtNum(g.gold) + 'G');
    if (g.essence) out.push('심연 정수 ' + g.essence + '개');
    if (g.cores) out.push('심연의 핵 ' + g.cores + '개');
    if (g.pearls) out.push('심해 진주 ' + g.pearls + '개');
    if (g.seeds) out.push('심연의 씨앗 ' + g.seeds + '개');
    if (g.potions) out.push('물약 ' + g.potions + '개');
    if (g.scrolls) out.push(SCROLL_NAMES[0] + ' ' + g.scrolls + '장');
    if (g.scrolls2) out.push(SCROLL_NAMES[1] + ' ' + g.scrolls2 + '장');
    if (g.inherit) out.push('계승 주문서 ' + g.inherit + '장');
    for (const s of g.stones || []) out.push(stoneName(s) + ' ' + (s.n || 1) + '개');
    for (const it of g.items || []) out.push(RARITY[it.rarity || 0].name + ' ' + (it.slot === 'weapon' ? (it.kind && (GEAR_FORMS.weapon.find(f => f.kind === it.kind) || {}).noun) || '무기' : SLOT_NAMES[it.slot]) + ' (Lv.' + it.ilvl + ')');
    return out;
  }

  // 선물 칸: { draw(ctx, cx, cy), n(오른쪽 아래 글 — 없으면 안 씀), col(테두리) }
  const short = n => (n >= 10000 ? +(n / 10000).toFixed(n % 10000 ? 1 : 0) + '만' : String(n));
  const preview = {};  // 장비 미리 보기(우편 · 칸마다 한 번만 만듦)
  function pearl(ctx, x, y) {
    ctx.fillStyle = '#2a4274'; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 7);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, PEARL_COLOR); g.addColorStop(1, '#6a9ad8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }
  function giftTiles(m) {
    const g = m.gifts, out = [];
    if (g.gold) out.push({ draw: (c, x, y) => Gfx.spr(c, 'coin_anim_f0', x, y + 7, { scale: 1.9 }), n: short(g.gold) + 'G' });
    if (g.essence) out.push({ draw: (c, x, y) => Gfx.essenceIcon(c, x, y, 20), n: g.essence });
    if (g.cores) out.push({ draw: (c, x, y) => Gfx.coreIcon(c, x, y, 20), n: g.cores });
    if (g.pearls) out.push({ draw: pearl, n: g.pearls });
    if (g.seeds) out.push({ draw: (ctx, x, y) => Gfx.seedIcon(ctx, x, y, 14), n: g.seeds });
    if (g.potions) out.push({ draw: (c, x, y) => Gfx.spr(c, 'flask_big_red', x, y + 10, { scale: 1.4 }), n: g.potions });
    if (g.scrolls) out.push({ draw: (c, x, y) => Gfx.scrollIcon(c, { g: 'any', r: 0 }, x, y, 20), n: g.scrolls });
    if (g.scrolls2) out.push({ draw: (c, x, y) => Gfx.scrollIcon(c, { g: 'any', r: 1 }, x, y, 20), n: g.scrolls2 });
    if (g.inherit) out.push({ draw: (c, x, y) => Gfx.scrollIcon(c, { g: 'inherit', r: 0 }, x, y, 20), n: g.inherit });
    for (const s of g.stones || []) out.push({ draw: (c, x, y) => Gfx.stoneIcon(c, { el: s.el, size: s.size }, x, y, 22), n: s.n || 1, col: ELEMENTS[s.el].color });
    (g.items || []).forEach((it, i) => {
      const k = m.id + ':' + i;
      try { preview[k] = preview[k] || Items.make(it.ilvl, { slot: it.slot, kind: it.kind, rarity: it.rarity || 0 }); } catch (e) { return; }
      out.push({ draw: (c, x, y) => Gfx.icon(c, preview[k], x, y, 26), col: RARITY[it.rarity || 0].color });
    });
    return out;
  }
  function tile(ctx, x, y, t, got) {
    const S = 40;
    Gfx.panel(ctx, x, y, S, S, { border: t.col || '#6a5a40', bg: '#140e0a' });
    t.draw(ctx, x + S / 2 - 2, y + S / 2 - 3);  // 살짝 왼쪽 위로(오른쪽 아래는 개수 자리)
    if (t.n !== undefined) {  // 개수: 어두운 바탕 위 흰 글자(속성석 그림의 크기 숫자와 안 겹치게)
      const s = String(t.n);
      ctx.font = 'bold 11px ' + Gfx.FONT;
      const w = Math.ceil(ctx.measureText(s).width) + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(x + S - 2 - w, y + S - 14, w, 12);
      T_(ctx, s, x + S - 4, y + S - 4, 11, '#ffffff', 'right');
    }
    if (got) { ctx.fillStyle = 'rgba(12,8,6,0.55)'; ctx.fillRect(x + 1, y + 1, S - 2, S - 2); }
  }

  // 선물 넣기(알림 없이): 장비 칸이 모자라면 못 받음 → 모두 넣고 받은 표시. 결과 { ok, lost, why }
  function grant(prof, m) {
    const b = box(prof), g = m.gifts;
    const items = g.items || [], free = prof.bag.filter(x => !x).length;
    if (items.length > free) return { ok: false, why: '가방이 ' + (items.length - free) + '칸 모자라요 — 비우고 다시 받아 주세요' };
    // 장비를 먼저 만든다 — 우편 적기가 틀려 못 만들면 아무것도 안 주고 멈춤(반만 받고 다시 받는 일 없게)
    let made;
    try { made = items.map(it => Items.make(it.ilvl, { slot: it.slot, kind: it.kind, rarity: it.rarity || 0 })); } catch (e) { console.error(e); return { ok: false, why: '「' + m.title + '」 우편의 장비 정보가 잘못됐어요 — 운영자에게 알려 주세요' }; }
    if (g.gold) prof.gold += g.gold;
    if (g.essence) addEssence(prof, g.essence);
    if (g.cores) prof.cores = (prof.cores || 0) + g.cores;
    if (g.pearls) prof.pearls = (prof.pearls || 0) + g.pearls;
    if (g.seeds) prof.seeds = (prof.seeds || 0) + g.seeds;
    let lost = 0;
    if (g.potions) { const max = clsOf(prof).potion.max, add = Math.min(g.potions, Math.max(0, max - prof.potions)); prof.potions += add; lost = g.potions - add; }
    if (g.scrolls) Items.addScroll(prof, { g: 'any', r: 0 }, g.scrolls);
    if (g.scrolls2) Items.addScroll(prof, { g: 'any', r: 1 }, g.scrolls2);
    if (g.inherit) Items.addScroll(prof, { g: 'inherit', r: 0 }, g.inherit);
    for (const s of g.stones || []) Elements.add(prof, { el: s.el, size: s.size }, s.n || 1);
    for (const it of made) prof.bag[prof.bag.indexOf(null)] = it;
    b.got[m.id] = 1; b.read[m.id] = 1;
    return { ok: true, lost };
  }
  function claim(prof, m) {
    if (!hasGift(m)) return;
    if (box(prof).got[m.id]) { Game.toast('이미 받은 선물이에요'); return; }
    const r = grant(prof, m);
    if (!r.ok) { Sfx.deny(); Game.toast(r.why); return; }
    Sfx.unique();
    Game.toast('선물 ' + giftLines(m.gifts).length + '가지를 받았어요' + (r.lost ? ' (물약 ' + r.lost + '개는 가득 차서 못 받음)' : ''));  // 다 늘어놓으면 화면 밖으로 넘침 — 무엇인지는 창의 선물 칸에
    Game.changed();
  }
  // 모두 받기(2026-11-01 사용자): 안 받은 선물을 새것부터 차례로 — 가방이 모자라는 우편은 건너뛰고(그대로 남음) 나머지는 받음
  const pending = prof => list(prof).filter(m => hasGift(m) && !box(prof).got[m.id]);
  function claimAll(prof) {
    const ms = pending(prof);
    if (!ms.length) { Game.toast('받을 선물이 없어요'); return; }
    let n = 0, lost = 0, why = '';
    let skip = 0;
    for (const m of ms) { const r = grant(prof, m); if (!r.ok) { why = why || r.why; skip++; continue; } n++; lost += r.lost; }
    if (skip) why = skip + '통은 못 받음 — ' + why;
    for (const m of list(prof)) box(prof).read[m.id] = 1;
    if (n) { Sfx.unique(); Game.changed(); } else Sfx.deny();
    Game.toast((n ? '우편 ' + n + '통의 선물을 받았어요' : '선물을 받지 못했어요') + (why ? ' · ' + why : '') + (lost ? ' (물약 ' + lost + '개는 가득 차서 못 받음)' : ''));
  }

  function open(prof) { sel = 0; markRead(prof); }
  function markRead(prof) { const m = list(prof)[sel]; if (m && !box(prof).read[m.id]) { box(prof).read[m.id] = 1; Save.write(prof); } }
  function update(o, prof) {
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { Game.closeOverlay(); return; }
    const ms = list(prof);
    if (!ms.length) return;
    sel = Math.min(sel, ms.length - 1);
    if (Input.nav('up')) { sel = (sel + ms.length - 1) % ms.length; markRead(prof); }
    if (Input.nav('down')) { sel = (sel + 1) % ms.length; markRead(prof); }
    if (Input.wasPressed('ok')) { const m = ms[sel]; if (hasGift(m)) claim(prof, m); }
    if (Input.wasPressed('special')) claimAll(prof);
  }

  // 줄 나누기(띄어쓰기 단위, 한 낱말이 너무 길면 글자 단위)
  function wrap(ctx, s, w, size) {
    ctx.font = 'bold ' + size + 'px ' + Gfx.FONT;
    const out = [];
    for (const para of s.split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (ctx.measureText(t).width <= w) { line = t; continue; }
        if (line) out.push(line);
        line = '';
        for (const ch of word) { if (ctx.measureText(line + ch).width > w) { out.push(line); line = ''; } line += ch; }
      }
      out.push(line);
    }
    return out;
  }
  // 봉투 그림(닫힘 = 새 우편 · 열림 = 읽음)
  function envelope(ctx, x, y, open, gift) {
    ctx.fillStyle = open ? '#8a7e70' : '#f0e6d2'; ctx.fillRect(x, y, 26, 18);
    ctx.strokeStyle = '#2a1630'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, 25, 17);
    ctx.beginPath(); ctx.moveTo(x + 1, y + (open ? 9 : 1)); ctx.lineTo(x + 13, y + (open ? 1 : 10)); ctx.lineTo(x + 25, y + (open ? 9 : 1)); ctx.stroke();
    if (!open) { ctx.fillStyle = '#c83838'; ctx.fillRect(x + 11, y + 8, 5, 4); }
    if (gift) { ctx.fillStyle = '#ffd34d'; ctx.fillRect(x + 19, y - 4, 9, 7); ctx.fillStyle = '#c83838'; ctx.fillRect(x + 22, y - 4, 2, 7); ctx.fillRect(x + 19, y - 1, 9, 1); }
  }

  function draw(ctx, o, prof) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });
    Gfx.panel(ctx, 40, 30, 880, 460, { border: '#c8a070', bg: '#1d1610' });
    T_(ctx, '우체통', 64, 70, 24, '#f0e0b8');
    const ms = list(prof), n = count(prof), b = box(prof);
    T_(ctx, n ? '새 우편 · 안 받은 선물 ' + n + '통' : '새 우편이 없어요', 896, 70, 12, n ? '#7dff8a' : '#9a8e96', 'right');
    if (!ms.length) { T_(ctx, '우편이 없어요', 480, 270, 16, '#9a8e96', 'center'); return hint(ctx); }
    sel = Math.min(sel, ms.length - 1);
    // ── 왼쪽: 우편 목록 ──
    const top = Math.max(0, Math.min(sel - 5, ms.length - 6));  // 여섯 통이 넘으면 고른 우편이 보이게 밀어 올림
    ms.slice(top, top + 6).forEach((m, j) => {
      const i = top + j, y = 90 + j * 54, on = sel === i, gift = hasGift(m) && !b.got[m.id], read = b.read[m.id];
      UI.zone(60, y, 330, 48, { on: () => sel === i, pick: () => { sel = i; markRead(prof); } });
      Gfx.panel(ctx, 60, y, 330, 48, { border: on ? '#ffd36a' : gift ? '#7dff8a' : '#4a3a2e', bg: '#140e0a' });
      envelope(ctx, 74, y + 15, !!read, gift);
      T_(ctx, m.title, 114, y + 22, 14, on ? '#ffd36a' : read ? '#c8b8a0' : '#f0e0b8');
      T_(ctx, m.date + (hasGift(m) ? (b.got[m.id] ? ' · 선물 받음' : ' · 선물 있음') : ''), 114, y + 40, 11, gift ? '#7dff8a' : '#8a7e88');
      const dl = daysLeft(m);
      T_(ctx, dl <= 0 ? '오늘까지' : dl + '일 남음', 378, y + 40, 11, dl <= 3 ? '#ff8a7a' : '#8a7e88', 'right');
    });
    // 모두 받기 버튼(왼쪽 아래)
    const pn = pending(prof).length, ax = 60, ay = 424, aw = 330;
    UI.zone(ax, ay, aw, 38, { key: 'special', now: true });
    Gfx.panel(ctx, ax, ay, aw, 36, { border: pn ? '#7dff8a' : '#5a4650', bg: '#1d151b' });
    T_(ctx, pn ? '모두 받기 (' + pn + '통) ' + L('special') : '받을 선물이 없어요', ax + aw / 2, ay + 24, 14, pn ? '#7dff8a' : '#8a7e88', 'center');
    // ── 오른쪽: 고른 우편 ──
    const m = ms[sel];
    Gfx.panel(ctx, 408, 90, 492, 384, { border: '#4a3a2e', bg: '#140e0a' });
    T_(ctx, m.title, 428, 122, 18, '#f0e0b8');
    T_(ctx, '운영자 · ' + m.date + ' · ' + expOf(m) + '까지 보관(받지 않으면 사라져요)', 428, 142, 11, '#8a7e88');
    wrap(ctx, m.body || '', 452, 13).slice(0, 12).forEach((l, i) => T_(ctx, l, 428, 172 + i * 20, 13, '#e8dcc8'));
    if (hasGift(m)) {
      const got = b.got[m.id], gl = giftLines(m.gifts);
      ctx.fillStyle = 'rgba(255,211,77,0.06)'; ctx.fillRect(420, 322, 468, 96);
      T_(ctx, '선물', 428, 340, 13, '#ffd34d');
      // 선물 칸(2026-11-01 사용자 '아이콘이랑 개수 보이게'): 그림 + 오른쪽 아래 개수, 아래 줄에 이름
      const ts = giftTiles(m);  // 한 줄 9칸, 넘치면 둘째 줄(그땐 이름 줄 없음)
      ts.slice(0, 18).forEach((t, i) => tile(ctx, 470 + (i % 9) * 46, 326 + Math.floor(i / 9) * 44, t, got));
      if (ts.length <= 9) { const names = wrap(ctx, gl.join(' · '), 404, 11); T_(ctx, names[0] + (names.length > 1 ? ' …' : ''), 470, 386, 11, got ? '#8a7e88' : '#c8b890'); }
      const bx = 504, by = 424, bw = 300;
      UI.zone(bx, by, bw, 38, { key: 'ok', now: true });
      Gfx.panel(ctx, bx, by, bw, 36, { border: got ? '#5a4650' : '#7dff8a', bg: '#1d151b' });
      T_(ctx, got ? '✔ 받았어요' : '선물 받기 ' + L('ok'), bx + bw / 2, by + 24, 15, got ? '#8a7e88' : '#7dff8a', 'center');
    }
    hint(ctx);
  }
  function hint(ctx) {
    if (Input.touchMode()) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 500, 960, 40);
    T_(ctx, '고르기 ↑↓ · 선물 받기 ' + L('ok') + ' · 모두 받기 ' + L('special') + ' · 닫기 ' + L('back'), 480, 524, 13, '#8a7e88', 'center');
  }

  return { count, open, update, draw };
})();
