// 우체통(2026-11-01 사용자 '유저에게 메시지 · 아이템 보내는 용도'): 운영자 → 모든 플레이어 우편.
// 서버가 없어서 우편은 아래 MAIL 목록에 적고 깃허브에 올리면 보내진다. 저장(캐릭터)마다 우편 하나를 한 번씩 받는다 —
// prof.mail = { read: { id: 1 }, got: { id: 1 } }. 마을 우체통(town.js 'mail', 벨록 · 실베인) → overlay 'mail'.
//
// 우편 = { id, date, title, body, until?, gifts? }
//   id    : 바꾸지 않는 이름(받은 기록 열쇠) — 같은 id 를 다시 쓰면 이미 받은 사람은 못 받음
//   date  : 'YYYY-MM-DD' 보낸 날(목록은 새것부터)
//   body  : 본문(줄바꿈 \n)
//   until : 'YYYY-MM-DD' 이 날까지만 보임(없으면 늘). 지난 우편은 받지 않았으면 사라짐
//   gifts : { gold, essence, cores, pearls, potions, scrolls(축복받은 강화 주문서 장 수), scrolls2(강화 주문서 장 수), inherit(계승 주문서 장 수),
//             stones: [{ el, size, n }](el = fire · frost · thunder · poison · might · guard, size 0 조각 ~ 6 태초),
//             items: [{ ilvl, slot, kind?, rarity }](slot = weapon · helmet · armor · gloves · boots · amulet · ring, rarity 0 일반 · 1 매직 · 2 레어 —
//                     장비 기본 능력치는 늘 같음(규칙). 무기는 kind 를 빼면 받는 캐릭터 직업 무기(우편은 모든 직업이 받으니 보통 뺌)) }
const MAIL = [
  { id: 'mailbox-open', date: '2026-11-01', title: '우체통이 생겼어요',
    body: '벨록 광장과 실베인 갱도 앞에 우체통을 세웠어요.\n앞으로 공지와 선물은 이 우체통으로 보내 드릴게요.\n선물이 든 우편은 받기를 눌러야 들어와요.' },
];

const Mail = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  let sel = 0;

  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const box = prof => prof.mail || (prof.mail = { read: {}, got: {} });
  // 보이는 우편: 기한이 지나지 않았거나 이미 받은 것, 새것부터
  const list = prof => { const b = box(prof), t = today(); return MAIL.filter(m => !m.until || m.until >= t || b.got[m.id]).slice().sort((a, b2) => (a.date < b2.date ? 1 : a.date > b2.date ? -1 : 0)); };
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
    if (g.potions) out.push('물약 ' + g.potions + '개');
    if (g.scrolls) out.push(SCROLL_NAMES[0] + ' ' + g.scrolls + '장');
    if (g.scrolls2) out.push(SCROLL_NAMES[1] + ' ' + g.scrolls2 + '장');
    if (g.inherit) out.push('계승 주문서 ' + g.inherit + '장');
    for (const s of g.stones || []) out.push(stoneName(s) + ' ' + (s.n || 1) + '개');
    for (const it of g.items || []) out.push(RARITY[it.rarity || 0].name + ' ' + (it.slot === 'weapon' ? (it.kind && (GEAR_FORMS.weapon.find(f => f.kind === it.kind) || {}).noun) || '무기' : SLOT_NAMES[it.slot]) + ' (Lv.' + it.ilvl + ')');
    return out;
  }

  // 받기: 장비 칸이 모자라면 못 받음 → 모두 넣고 받은 표시
  function claim(prof, m) {
    const b = box(prof), g = m.gifts;
    if (!hasGift(m)) return;
    if (b.got[m.id]) { Game.toast('이미 받은 선물이에요'); return; }
    const items = g.items || [], free = prof.bag.filter(x => !x).length;
    if (items.length > free) { Sfx.deny(); Game.toast('가방이 ' + (items.length - free) + '칸 모자라요 — 비우고 다시 받아 주세요'); return; }
    // 장비를 먼저 만든다 — 우편 적기가 틀려 못 만들면 아무것도 안 주고 멈춤(반만 받고 다시 받는 일 없게)
    let made;
    try { made = items.map(it => Items.make(it.ilvl, { slot: it.slot, kind: it.kind, rarity: it.rarity || 0 })); } catch (e) { console.error(e); Sfx.deny(); Game.toast('이 우편의 장비 정보가 잘못됐어요 — 운영자에게 알려 주세요'); return; }
    if (g.gold) prof.gold += g.gold;
    if (g.essence) addEssence(prof, g.essence);
    if (g.cores) prof.cores = (prof.cores || 0) + g.cores;
    if (g.pearls) prof.pearls = (prof.pearls || 0) + g.pearls;
    let lost = 0;
    if (g.potions) { const max = clsOf(prof).potion.max, add = Math.min(g.potions, Math.max(0, max - prof.potions)); prof.potions += add; lost = g.potions - add; }
    if (g.scrolls) Items.addScroll(prof, { g: 'any', r: 0 }, g.scrolls);
    if (g.scrolls2) Items.addScroll(prof, { g: 'any', r: 1 }, g.scrolls2);
    if (g.inherit) Items.addScroll(prof, { g: 'inherit', r: 0 }, g.inherit);
    for (const s of g.stones || []) Elements.add(prof, { el: s.el, size: s.size }, s.n || 1);
    for (const it of made) prof.bag[prof.bag.indexOf(null)] = it;
    b.got[m.id] = 1; b.read[m.id] = 1;
    Sfx.unique();
    Game.toast('선물을 받았어요: ' + giftLines(g).join(' · ') + (lost ? ' (물약 ' + lost + '개는 가득 차서 못 받음)' : ''));
    Game.changed();
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
    const top = Math.max(0, Math.min(sel - 6, ms.length - 7));  // 일곱 통이 넘으면 고른 우편이 보이게 밀어 올림
    ms.slice(top, top + 7).forEach((m, j) => {
      const i = top + j, y = 90 + j * 54, on = sel === i, gift = hasGift(m) && !b.got[m.id], read = b.read[m.id];
      UI.zone(60, y, 330, 48, { on: () => sel === i, pick: () => { sel = i; markRead(prof); } });
      Gfx.panel(ctx, 60, y, 330, 48, { border: on ? '#ffd36a' : gift ? '#7dff8a' : '#4a3a2e', bg: '#140e0a' });
      envelope(ctx, 74, y + 15, !!read, gift);
      T_(ctx, m.title, 114, y + 22, 14, on ? '#ffd36a' : read ? '#c8b8a0' : '#f0e0b8');
      T_(ctx, m.date + (hasGift(m) ? (b.got[m.id] ? ' · 선물 받음' : ' · 선물 있음') : ''), 114, y + 40, 11, gift ? '#7dff8a' : '#8a7e88');
    });
    // ── 오른쪽: 고른 우편 ──
    const m = ms[sel];
    Gfx.panel(ctx, 408, 90, 492, 384, { border: '#4a3a2e', bg: '#140e0a' });
    T_(ctx, m.title, 428, 122, 18, '#f0e0b8');
    T_(ctx, '운영자 · ' + m.date + (m.until ? ' · ' + m.until + '까지' : ''), 428, 142, 11, '#8a7e88');
    wrap(ctx, m.body || '', 452, 13).slice(0, 12).forEach((l, i) => T_(ctx, l, 428, 172 + i * 20, 13, '#e8dcc8'));
    if (hasGift(m)) {
      const got = b.got[m.id], gl = giftLines(m.gifts);
      ctx.fillStyle = 'rgba(255,211,77,0.06)'; ctx.fillRect(420, 340, 468, 76);
      T_(ctx, '선물', 428, 358, 13, '#ffd34d');
      wrap(ctx, gl.join(' · '), 404, 12).slice(0, 3).forEach((l, i) => T_(ctx, l, 470, 358 + i * 18, 12, got ? '#8a7e88' : '#ffe8a0'));
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
    T_(ctx, '고르기 ↑↓ · 선물 받기 ' + L('ok') + ' · 닫기 ' + L('back'), 480, 524, 13, '#8a7e88', 'center');
  }

  return { count, open, update, draw };
})();
