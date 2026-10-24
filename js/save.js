// 캐릭터 기록(레벨 · 골드 · 장비 · 가방 · 깬 던전). 브라우저 localStorage 에 저장한다.
// 저장이 막힌 환경(사생활 보호 창 등)에서는 저장 없이 그냥 진행된다.
const Save = (() => {
  const KEY = 'farming-game-save-v1';
  // 캐릭터 칸 3개(2026-10-24 사용자: 캐릭터 선택 화면). 0번 칸은 예전 저장 자리 그대로
  const SLOTS_N = 3;
  let cur = 0;
  const keyOf = n => (n ? KEY + '-s' + n : KEY);

  function fresh(cls = 'swordsman') {
    const p = { cls, lv: 1, exp: 0, gold: 30, potions: 3, equip: {}, bag: new Array(BAG_SIZE).fill(null), cleared: {} };
    for (const s of SLOTS) p.equip[s] = null;
    p.equip.weapon = Items.make(1, { slot: 'weapon', kind: CLASSES[cls].weapons[0], rarity: 0 });
    p.equip.armor = Items.make(1, { slot: 'armor', rarity: 0 });
    upgrade(p);
    return p;
  }

  // 예전 저장에 없던 칸 채우기(속성석: 처음엔 속성마다 조각 1개씩 — 써 보라고)
  function upgrade(p) {
    if (!p.stones) { p.stones = {}; for (const el of EL_ORDER) p.stones[el + ':0'] = 1; }
    if (!p.sockets) p.sockets = { basic: null, charge: null, wave: null };
    if (!('dash' in p.sockets)) p.sockets.dash = null;  // 대시 칸(2026-10-24)
    // 크기 단계 7개로(2026-10-24): 예전 가장 큰 돌(8번째)은 지금 가장 큰 크기로
    const top = STONE_SIZES.length - 1, clampS = s => { if (s && s.size > top) s.size = top; };
    for (const k of Object.keys(p.stones)) {
      const [el, sz] = k.split(':');
      if (+sz > top) { p.stones[el + ':' + top] = (p.stones[el + ':' + top] || 0) + p.stones[k]; delete p.stones[k]; }
    }
    for (const k in p.sockets) clampS(p.sockets[k]);
    // 창고 컬렉션 { 'weapon_heavy:3': 아이템 } — 칸 이름 규칙이 바뀌어도 아이템에서 다시 계산(예전 'echo:3' → 무기 경량 · 중량)
    const oldVault = p.vault || {};
    p.vault = {};
    for (const k in oldVault) { const it = oldVault[k]; if (!it) continue; const nk = vaultKey(it); if (!p.vault[nk]) p.vault[nk] = it; else { const e = p.bag.indexOf(null); if (e >= 0) p.bag[e] = it; } }
    if (!p.scrolls) p.scrolls = {};  // 주문서 주머니 { 'weapon:0': 개수 }
    if (p.scrolls['restore:0']) { p.scrolls['inherit:0'] = (p.scrolls['inherit:0'] || 0) + p.scrolls['restore:0']; delete p.scrolls['restore:0']; }  // 복구 → 계승(2026-10-24)
    // 예전 무기 · 방어구 · 장신구 주문서는 하나뿐인 강화 주문서로 합친다(성공률 단계 r 은 그대로, 2026-10-24)
    for (const g of ['weapon', 'armor', 'acc']) for (let r = 0; r < 3; r++) {
      const k = g + ':' + r;
      if (p.scrolls[k]) { p.scrolls['any:' + r] = (p.scrolls['any:' + r] || 0) + p.scrolls[k]; delete p.scrolls[k]; }
    }
    // 예전 10% 주문서(any:2)는 없앰 → 강화 주문서(3%)로 바꿔 준다(2026-10-24 사용자)
    if (p.scrolls['any:2']) { p.scrolls['any:1'] = (p.scrolls['any:1'] || 0) + p.scrolls['any:2']; delete p.scrolls['any:2']; }
    // 방어구 강화 1.5배(2026-10-24): 이미 바른 방어구 강화 방어력도 한 번만 1.5배로
    const armorEnch = !p.armorEnch15;
    p.armorEnch15 = true;
    // 장신구 강화 체력 → 공격력(2026-10-24): 오르는 양 비율(체력 5 · 12 → 공격력 1 · 3)로 한 번만 바꾼다
    const accEnch = !p.accEnchAtk;
    p.accEnchAtk = true;
    // 반지 기본 체력(2026-10-24): 예전 반지에는 체력이 없었다 → 한 번만 붙여 준다(새 반지와 같은 식)
    const ringHp = !p.ringHp;
    p.ringHp = true;
    // 장비 단순화(2026-10-24): 예전 아이템의 랜덤 옵션은 지우고 등급만큼 보석 칸을 단다
    for (const it of [...Object.values(p.equip), ...p.bag, ...Object.values(p.vault)]) {
      if (it && !it.gems) { it.affixes = []; it.gems = new Array(RARITY[it.rarity].sockets).fill(null); }
      Items.migrate(it);  // 부위 옵션 · 이름 규칙 · 강화 한도(2026-10-24)
      Items.rescale(it, p.lv);
      Items.refix(it);  // 신발 대시 기력 감소(2026-10-24)  // 던전 10레벨 간격 · 세기 곡선(2026-10-24): 장비 레벨 · 능력치 다시 계산
      if (it && it.gems) it.gems.forEach(clampS);
      // 보석 부위 묶기(2026-10-24): 공격 = 무기 · 장신구, 방어 = 방어구 — 맞지 않는 곳에 낀 보석은 주머니로
      if (it && it.gems) it.gems.forEach((g, i) => { if (g && GEMS[g.el] && !gemFits(g, it.slot)) { p.stones[g.el + ':' + g.size] = (p.stones[g.el + ':' + g.size] || 0) + 1; it.gems[i] = null; } });
      // 보석 칸 하나로(2026-10-24): 낀 보석을 앞으로 모으고, 넘치는 칸의 보석은 주머니로
      if (it && it.gems && it.gems.length > RARITY[it.rarity].sockets) {
        it.gems.sort((a, b) => (b ? 1 : 0) - (a ? 1 : 0));
        for (const g of it.gems.splice(RARITY[it.rarity].sockets)) if (g) p.stones[g.el + ':' + g.size] = (p.stones[g.el + ':' + g.size] || 0) + 1;
      }
      if (it && !it.uniq) it.name = itemName(Items.base(it), it.rarity);  // 이름 규칙이 바뀌어도(검 · 망치 등) 따라가게
      if (armorEnch && it && it.ench && it.ench.def && SCROLL_GROUPS.armor.slots.includes(it.slot)) it.ench.def = Math.round(it.ench.def * 1.5);
      if (accEnch && it && it.ench && it.ench.hp && SCROLL_GROUPS.acc.slots.includes(it.slot)) { it.ench.atk = (it.ench.atk || 0) + Math.max(it.ups || 1, Math.round(it.ench.hp * 0.25)); delete it.ench.hp; }
      if (ringHp && it && it.slot === 'ring' && !it.stats.hp) it.stats.hp = Math.max(1, Math.round(12 * POWER(it.ilvl) * (0.85 + Math.random() * 0.3) * RARITY[it.rarity].mult));
      Items.normalize(it);  // 같은 착용 레벨 · 등급 = 같은 능력치(2026-10-24)
      if (it) Items.removeHidden(p, it);  // 감정사 · 숨은 힘 없앰(2026-10-24): 미확인 표시 · 숨은 힘을 지운다
    }
    return p;
  }

  function load(n = cur) {
    try {
      const raw = localStorage.getItem(keyOf(n));
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p || !p.equip || !Array.isArray(p.bag)) return null;
      while (p.bag.length < BAG_SIZE) p.bag.push(null);
      let max = 0;
      for (const it of [...Object.values(p.equip), ...p.bag, ...Object.values(p.vault || {})]) if (it && it.uid > max) max = it.uid;
      Items.setNextUid(max + 1);
      return upgrade(p);
    } catch (e) { return null; }
  }

  function write(p) {
    try { localStorage.setItem(keyOf(cur), JSON.stringify(p)); } catch (e) { /* 저장 못 하는 환경 */ }
  }

  function wipe(n = cur) {
    try { localStorage.removeItem(keyOf(n)); } catch (e) { /* 무시 */ }
  }

  // 코드로 이어하기: 저장을 글자 코드로(FG1: + base64). 한글이 있어서 UTF-8 로 바꿔 담는다
  function exportCode(n = cur) {
    try {
      const raw = localStorage.getItem(keyOf(n));
      return raw ? 'FG1:' + btoa(unescape(encodeURIComponent(raw))) : null;
    } catch (e) { return null; }
  }
  // 코드를 칸 n 에 넣는다 → true / 안 되는 까닭(글)
  function importCode(n, code) {
    try {
      code = String(code || '').replace(/\s+/g, '');
      if (!code.startsWith('FG1:')) return '심연으로 코드가 아니에요 (FG1: 로 시작해야 해요)';
      const raw = decodeURIComponent(escape(atob(code.slice(4))));
      const p = JSON.parse(raw);
      if (!p || !p.equip || !Array.isArray(p.bag) || typeof p.lv !== 'number') return '코드가 망가졌어요 — 처음부터 끝까지 다 복사했는지 봐 주세요';
      localStorage.setItem(keyOf(n), raw);
      return true;
    } catch (e) { return '코드가 망가졌어요 — 처음부터 끝까지 다 복사했는지 봐 주세요'; }
  }

  return { SLOTS_N, fresh, load, write, wipe, exportCode, importCode, setSlot(n) { cur = n; }, get slot() { return cur; } };
})();
