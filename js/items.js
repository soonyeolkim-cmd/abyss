// 아이템 만들기 · 능력치 합치기 · 설명 줄 만들기.
const Items = (() => {
  let nextUid = 1;
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const byId = {};
  for (const b of BASES) byId[b.id] = b;
  const base = item => byId[item.base];

  // rare = 노랑 이상 확률 배율(난이도). 파랑 몫의 폭은 그대로
  function rollRarity(boost, rare = 1) {
    const r = Math.random(), y = Math.min(0.9, (0.06 + boost * 0.3) * rare);
    if (r < y) return 2;
    if (r < y + 0.26 + boost * 0.2) return 1;
    return 0;
  }

  // ilvl = 장비 단계. o: { slot, kind(무기 light · heavy), rarity, boost(0~1, 보스 · 상자일수록 좋은 등급), uniq }
  // 기본 아이템 = 그 단계 착용 레벨의 재질(GEAR_TIERS) · 부위(무기는 경량 · 중량 중 하나)
  function make(ilvl, o = {}) {
    ilvl = bandLvl(ilvl);  // 2026-10-24 사용자: 능력치는 착용 레벨과 등급으로만(같은 단계 안 차이 · 무작위 폭 없음)
    const tier = tierOf(ilvl), slot = o.slot || pick(SLOTS);
    // 무기 종류: 정하지 않으면 지금 캐릭터 직업의 무기(검사 검 · 망치, 마법사 롯드 · 스태프)
    const kinds = o.kind ? [o.kind] : slot === 'weapon' ? clsOf(o.cls ? { cls: o.cls } : (typeof Game !== 'undefined' && Game.prof)).weapons : null;
    const b = pick(BASES.filter(x => x.slot === slot && x.tier === tier && (!kinds || kinds.includes(x.kind))));
    const rarity = o.rarity !== undefined ? o.rarity : rollRarity(o.boost || 0, o.rare || 1);
    const stats = {};
    for (const k in b.curve) stats[k] = Math.max(1, Math.round(b.curve[k](ilvl) * RARITY[rarity].mult));  // 등급이 높을수록 조금 세다
    applyFixed(stats, b.slot, rarity);
    const name = o.uniq ? uniqueName(o.uniq, b.kind, b.tier) : itemName(b, rarity);  // 유니크는 레벨 단계마다 고유 이름
    const it = {
      v: 8, uid: nextUid++, base: b.id, slot: b.slot, ilvl, rarity, name, stats, affixes: [],
      gems: new Array(RARITY[rarity].sockets).fill(null),  // 보석 칸(빈 칸 = null)
      value: Math.round(10 * POWER(ilvl) * (1 + rarity * 1.5)),
      ups: 0, ench: {},  // 주문서: 강화 단계(+N, 최대 ENCHANT_MAX) · 올라간 능력치
      uniq: o.uniq || null,        // 유니크 특수 효과(UNIQUES 키)
    };
    return it;
  }
  // 등급 고정 옵션(갑옷 기력 · 신발 대시 · 목걸이 공격 속도 · 반지 이동 속도와 치명타) — 단계로 안 커진다
  function applyFixed(stats, slot, rarity) {
    const f = RARITY_FIXED[slot] || {};
    for (const k in f) { if (f[k][rarity]) stats[k] = f[k][rarity]; else delete stats[k]; }
  }
  // 예전 저장 장비 옮기기(한 번에): 기본 아이템을 이름 규칙 것(같은 부위 · 경량/중량 · 단계 재질)으로 바꾸고,
  // 부위에 없는 능력치는 빼고 없는 것은 공식으로 채우고, 등급 고정 옵션 · 강화(+10 한도) · 이름을 맞춘다. 유니크 목걸이(두 번째 기회)는 끝없는 숨결로
  function migrate(it) {
    if (!it || it.v >= 6) return;
    if (!byId[it.base]) {
      const kind = it.slot === 'weapon' ? (OLD_HEAVY.includes(it.base) ? 'heavy' : 'light') : null;
      it.base = it.slot + (kind ? '_' + kind : '') + '_' + tierOf(it.ilvl);
    }
    const b = byId[it.base];
    for (const k of Object.keys(it.stats)) if (!(k in b.curve)) delete it.stats[k];
    for (const k in b.curve) if (!(k in it.stats)) it.stats[k] = Math.max(1, Math.round(b.curve[k](it.ilvl) * RARITY[it.rarity].mult));
    applyFixed(it.stats, it.slot, it.rarity);
    delete it.up; delete it.fails;
    it.ups = Math.min(ENCHANT_MAX, it.ups || 0);
    if (it.uniq === 'second') it.uniq = 'breath';
    it.name = it.uniq ? uniqueName(it.uniq, b.kind, b.tier) : itemName(b, it.rarity);
    it.v = 6;
  }
  function rescale(it, plv) {
    if (!it || it.v >= 7) return;
    const lvl = Math.max(1, Math.min(plv, Math.round(5 * (it.ilvl - 1))));
    const kind = byId[it.base] && byId[it.base].kind;
    it.ilvl = lvl;
    it.base = it.slot + (kind ? '_' + kind : '') + '_' + tierOf(lvl);
    const b = byId[it.base];
    const before = Object.assign({}, it.stats);
    for (const k in b.curve) it.stats[k] = Math.max(1, Math.round(b.curve[k](lvl) * RARITY[it.rarity].mult));
    // 강화로 오른 수치도 그 능력치가 바뀐 비율만큼(예전 +N 이 차지하던 몫을 그대로)
    for (const k in it.ench || {}) it.ench[k] = Math.max(1, Math.round(it.ench[k] * (before[k] ? it.stats[k] / before[k] : POWER(lvl))));
    it.value = Math.round(10 * POWER(lvl) * (1 + it.rarity * 1.5));
    it.name = it.uniq ? uniqueName(it.uniq, b.kind, b.tier) : itemName(b, it.rarity);
    it.v = 7;
  }
  // 능력치 맞추기(2026-10-24): 예전 장비도 착용 레벨 · 등급이 같으면 기본 능력치가 같게(강화 · 보석 · 등급 고정 옵션은 그대로)
  function normalize(it) {
    if (!it) return;
    const b = byId[it.base];
    if (!b) return;
    it.ilvl = bandLvl(it.ilvl);
    for (const k in b.curve) it.stats[k] = Math.max(1, Math.round(b.curve[k](it.ilvl) * RARITY[it.rarity].mult));
    it.value = Math.round(10 * POWER(it.ilvl) * (1 + it.rarity * 1.5));
  }
  // v8: 신발 대시 횟수 · 쿨타임 → 대시 기력 감소(등급 고정 옵션 다시)
  function refix(it) {
    if (!it || it.v >= 8) return;
    delete it.stats.dashCd; delete it.stats.dashN;
    applyFixed(it.stats, it.slot, it.rarity);
    it.v = 8;
  }
  // 유니크: 칸을 무작위로 골라 그 단계의 기본 아이템에 고정 이름 · 효과를 붙인다
  function makeUnique(ilvl) {
    const u = pick(Object.keys(UNIQUES));
    return make(ilvl, { slot: UNIQUES[u].slot, rarity: 3, uniq: u });
  }

  // 아이템 하나의 능력치 합(기본 + 낀 보석)
  function total(item) {
    const s = Object.assign({}, item.stats);
    for (const a of item.affixes || []) s[a.k] = (s[a.k] || 0) + a.v;  // 예전 저장의 랜덤 옵션
    for (const k in item.ench || {}) s[k] = (s[k] || 0) + item.ench[k];  // 주문서로 오른 만큼
    // 보석: 방어력 · 체력은 장비 레벨 곡선을 곱한다(%능력치 · 기력은 그대로)
    for (const g of item.gems || []) if (g) { const gs = gemStats(g); for (const k in gs) s[k] = (s[k] || 0) + (k === 'def' || k === 'hp' ? Math.round(gs[k] * POWER(item.ilvl)) : gs[k]); }
    return s;
  }

  // 레벨 + 장비 → 플레이어 능력치
  function playerStats(prof) {
    const C = clsOf(prof);
    // 캐릭터 기본 능력치도 레벨 곡선(공격력 4 · 체력 100 × POWER)
    const s = { atk: Math.round(C.baseAtk * POWER(prof.lv)), def: 0, hp: Math.round(C.baseHp * POWER(prof.lv)),
      crit: 5, critDmg: 50, aspd: 0, move: 0, gold: 0, life: 0, stamina: 0, spRegen: 0, dmg: 0, dashCost: 0 };
    for (const slot of SLOTS) {
      const it = prof.equip[slot];
      if (!it) continue;
      const t = total(it);
      for (const k in t) s[k] = (s[k] || 0) + t[k];
    }
    s.aspd = Math.min(STATS.aspd.cap, s.aspd);
    s.move = Math.min(STATS.move.cap, s.move);
    s.sp = C.stamina.base + s.stamina;  // 최대 기력
    s.fx = {};  // 낀 유니크 효과
    for (const slot of SLOTS) { const it = prof.equip[slot]; if (it && it.uniq) s.fx[it.uniq] = true; }
    if (s.fx.breath) s.spRegen += UNIQUE_FX.breath;  // 유니크 목걸이 끝없는 숨결
    const w = prof.equip.weapon;
    s.kind = w ? byId[w.base].kind : 'none';
    return s;
  }

  // 보이는 이름: 강화 단계 + 이름
  const nameOf = item => (item.ups ? '+' + item.ups + ' ' : '') + item.name;
  const gemShort = g => g ? '◆' + (g.size ? STONE_SIZES[g.size].name + ' ' + GEMS[g.el].name : GEMS[g.el].name + ' 조각') : '◇빈 칸';

  // 설명 줄: [{ t: 글, c: 색 }] — 가방 설명 칸에 7줄까지 들어가게 짧게
  // 착용 레벨: 0 = 없음
  const req = item => reqLevel(item.ilvl);
  const classOk = (prof, item) => item.slot !== 'weapon' || clsOf(prof).weapons.includes(base(item).kind);  // 직업 무기만
  const canWear = (prof, item) => prof.lv >= req(item) && classOk(prof, item);

  function describe(item, prof) {
    const b = base(item);
    const lines = [{ t: nameOf(item), c: RARITY[item.rarity].color, big: true }];
    let sub = RARITY[item.rarity].name + ' ' + (item.uniq ? b.name : SLOT_NAMES[item.slot]);
    if (b.slot === 'weapon') sub += ' · ' + WEAPON_KINDS[b.kind].name;
    const r = req(item), low = prof && prof.lv < r;
    lines.push({ t: sub + ' · ' + (r ? '착용 Lv.' + r : '착용 레벨 없음') + ' · 판매 ' + item.value + 'G', c: low ? '#ff6a5a' : '#9a8e96' });
    const ench = item.ench || {};
    // 능력치는 한 줄로(유니크 효과 줄까지 7줄에 들어가게)
    // 단계 능력치 한 줄 + 등급 고정 옵션 한 줄(길어서 비교 칸을 넘지 않게)
    const fixed = RARITY_FIXED[item.slot] || {};
    const parts = Object.keys(item.stats).filter(k => !(k in fixed)).map(k => STATS[k].fmt(item.stats[k] + (ench[k] || 0)) + (ench[k] ? '(강화 +' + ench[k] + ')' : ''));
    for (const k in ench) if (!(k in item.stats)) parts.push(STATS[k].fmt(ench[k]) + '(강화)');
    if (parts.length) lines.push({ t: parts.join(' · '), c: '#f0e8dc' });
    const fparts = Object.keys(item.stats).filter(k => k in fixed).map(k => STATS[k].fmt(item.stats[k]));
    if (fparts.length) lines.push({ t: fparts.join(' · '), c: '#c8dcff' });
    if (item.uniq) { const u = UNIQUES[item.uniq]; lines.push({ t: '★ ' + u.fx + ' — ' + u.desc, c: RARITY[3].color }); }
    for (const a of item.affixes || []) lines.push({ t: STATS[a.k].fmt(a.v), c: '#8ab8ff' });
    if (item.gems && item.gems.length) lines.push({ t: '보석  ' + item.gems.map(gemShort).join('  '), c: '#c8b8a0' });
    if (prof && clsOf(prof).atkName) lines.forEach(l => { l.t = l.t.split('공격력').join(clsOf(prof).atkName); });  // 마법사: 주문력
    if (prof && !classOk(prof, item)) lines.push({ t: clsOf(prof).name + '는 낄 수 없는 무기예요', c: '#ff6a5a' });
    return lines;
  }

  // 대장장이: 주문서 바르기 → 'ok' | 'fail' | 안 되는 까닭(글)
  function canEnchant(item, s) {
    if (s.g === 'inherit') return '계승 주문서는 강화 옮기기에 써요 (' + Input.label('special') + ')';
    return (item.ups || 0) < ENCHANT_MAX ? null : '+' + ENCHANT_MAX + '이 끝이에요';
  }
  function enchant(item, s) {
    const why = canEnchant(item, s);
    if (why) return why;
    if (!item.ench) item.ench = {};
    if (Math.random() * 100 < enchantRate(s, item.ups)) {  // 지금 단계 성공률
      const g = SCROLL_GROUPS[scrollGroupOf(item.slot)];  // 바른 부위에 따라 오르는 능력치
      item.ench[g.stat] = (item.ench[g.stat] || 0) + enchGain(item.slot, item.ilvl);  // 장비 레벨 곡선만큼(주문서 종류와 상관없이 같은 양)
      item.ups = (item.ups || 0) + 1;
      return 'ok';
    }
    return 'fail';  // 주문서만 사라진다
  }

  // 강화 옮기기: 안 되는 까닭(글) 또는 null
  function canTransfer(from, to) {
    if (!from.ups) return '옮길 강화가 없어요';
    if (to === from) return '같은 장비예요';
    if (to.slot !== from.slot) return '같은 부위끼리만 옮길 수 있어요';
    if ((to.ups || 0) + from.ups > ENCHANT_MAX) return '합치면 +' + ENCHANT_MAX + '을 넘어요 (지금 +' + (to.ups || 0) + ')';
    return null;
  }
  function transfer(from, to) {
    const why = canTransfer(from, to);
    if (why) return why;
    to.ench = to.ench || {};
    // 새 장비 레벨에 맞춰 늘리거나 줄인다(같은 +N 이면 같은 비율)
    for (const k in from.ench || {}) to.ench[k] = (to.ench[k] || 0) + Math.round(from.ench[k] * POWER(to.ilvl) / POWER(from.ilvl));
    to.ups = (to.ups || 0) + from.ups;  // 새 장비에 강화가 있으면 더해진다(+10 까지)
    from.ench = {}; from.ups = 0;      // 옛 장비는 강화가 빠진다
    return null;
  }

  // 숨은 힘 없앰(2026-10-24 사용자: 레어가 유니크보다 좋아져서). 예전 저장의 숨은 힘을 되돌린다 — 늘어난 보석 칸은 빼고(낀 보석은 주머니로),
  // 올라간 단계 능력치는 나눠 되돌린다. 돌려준 보석 수
  function removeHidden(prof, item) {
    delete item.unid;
    const h = item.hidden;
    if (!h) return 0;
    delete item.hidden;
    if (h.socket) { const g = item.gems.pop(); if (g) { Elements.add(prof, g); return 1; } return 0; }
    for (const k in base(item).curve) if (item.stats[k]) item.stats[k] = Math.max(1, Math.round(item.stats[k] / (1 + h.pct / 100)));
    return 0;
  }

  // 주문서 주머니
  const addScroll = (prof, s, n = 1) => { const k = scrollKey(s); prof.scrolls[k] = (prof.scrolls[k] || 0) + n; };
  function takeScroll(prof, s) { const k = scrollKey(s); if (!(prof.scrolls[k] > 0)) return false; if (!--prof.scrolls[k]) delete prof.scrolls[k]; return true; }
  function scrollStacks(prof) {
    const out = [];
    for (const g of SCROLL_ORDER) for (let r = 0; r < (g === 'inherit' ? 1 : SCROLL_NAMES.length); r++) {
      const n = prof.scrolls[g + ':' + r] || 0;
      if (n > 0) out.push({ g, r, n });
    }
    return out;
  }

  // 낀 것과 비교: 바뀌는 능력치 [{ k, d }]
  function compare(item, equipped) {
    const a = total(item), b = equipped ? total(equipped) : {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out = [];
    for (const k of keys) {
      const d = (a[k] || 0) - (b[k] || 0);
      if (d) out.push({ k, d });
    }
    return out;
  }

  // 일괄 착용 · 일괄 판매용 점수: 능력치를 한 줄로 합친 값(무기는 무기 종류의 피해 배율까지)
  const EMPTY_SOCKET = 6;  // 빈 보석 칸 하나의 값(가장 작은 보석쯤) — 같은 착용 레벨이면 칸 많은 장비가 이기게
  const SCORE_W = { atk: 3, def: 2, hp: 0.25, crit: 1.5, critDmg: 0.3, dmg: 1.5, stamina: 0.3, spRegen: 0.3, aspd: 1, move: 0.5, gold: 0.1, life: 1, dashCost: 0.5 };
  function score(item) {
    if (!item) return -1;
    const t = total(item);
    let v = 0;
    const ref = POWER(typeof Game !== 'undefined' && Game.prof ? Game.prof.lv : item.ilvl);
    for (const k in t) v += (SCORE_W[k] || 0) * t[k] / (k === 'atk' || k === 'def' || k === 'hp' ? ref : 1);
    for (const g of item.gems || []) if (!g) v += EMPTY_SOCKET;
    if (item.uniq) v += 20;  // 유니크 특수 효과 값
    if (item.slot === 'weapon') { const wk = WEAPON_KINDS[byId[item.base].kind]; v += (t.atk || 0) * 3 * (wk.dmg * wk.speed - 1); }  // 초당 피해 기준
    return v;
  }
  // a 가 b 보다 나은가: 능력치 점수(색 배율 · 보석 · 빈 칸 · 유니크 효과 포함)로만. 착용 레벨은 낄 수 있는지만 본다(2026-10-24 사용자)
  const better = (a, b) => !b ? !!a : !!a && score(a) > score(b);
  // 칸마다 낀 것 + 가방에서 가장 나은 것을 낀다. 바뀐 칸 수를 돌려준다
  function equipBest(prof) {
    let n = 0;
    for (const slot of SLOTS) {
      let best = -1;
      prof.bag.forEach((it, i) => { if (it && it.slot === slot && canWear(prof, it) && better(it, best < 0 ? prof.equip[slot] : prof.bag[best])) best = i; });
      if (best < 0) continue;
      const it = prof.bag[best];
      prof.bag[best] = prof.equip[slot];
      prof.equip[slot] = it;
      n++;
    }
    return n;
  }
  // 일괄 판매 · 자동 판매 대상: 낀 것보다 낫지 않은 장비
  // 레벨이 모자라 아직 못 끼는 장비는 남긴다(레벨이 오르면 낄 장비)
  // 노랑(레어) 이상 · 강화된 장비는 절대 안 판다(2026-10-24 사용자) — 흰 · 파랑 중 낀 것보다 못한 것만
  const isJunk = (prof, it) => it.rarity < 2 && !it.ups && canWear(prof, it) && !better(it, prof.equip[it.slot]);
  const junk = prof => prof.bag.map((it, i) => i).filter(i => prof.bag[i] && isJunk(prof, prof.bag[i]));
  function sellAll(prof, idxs) {
    let gold = 0, gems = 0;
    for (const i of idxs) {
      const it = prof.bag[i];
      gold += it.value;
      for (const g of it.gems || []) if (g) { Elements.add(prof, g); gems++; }
      prof.bag[i] = null;
    }
    prof.gold += gold;
    return { gold, gems };
  }

  function setNextUid(n) { nextUid = Math.max(nextUid, n); }

  return { classOk, normalize, migrate, rescale, refix, make, makeUnique, total, playerStats, describe, compare, base, setNextUid, score, better, req, canWear, equipBest, isJunk, junk, sellAll, nameOf, canEnchant, enchant, canTransfer, transfer, removeHidden, addScroll, takeScroll, scrollStacks };
})();
