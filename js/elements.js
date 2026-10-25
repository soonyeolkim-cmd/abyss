// 속성석 효과와 상태이상(봉인의 숲 속성과 같은 결): 불 = 화상, 얼음 = 냉기 → 빙결(보스는 균열), 번개 = 감전 + 연쇄, 독 = 중첩.
// 칸(기본 공격 · 차지 · 검기)마다 끼운 속성석이 그 기술에 붙는다. 세기 k = 돌 크기의 power.
const Elements = (() => {
  const key = s => s.el + ':' + s.size;
  // 끼운 돌(무기가 없으면 잠듦)
  const socket = (prof, slot) => (prof.equip.weapon ? prof.sockets[slot] : null);
  const power = s => STONE_SIZES[s.size].power;
  const color = (prof, slot, fallback = '#ffffff') => { const s = socket(prof, slot); return s ? ELEMENTS[s.el].color : fallback; };
  const live = e => !e.dying && e.state !== 'dead' && e.spawnT <= 0;

  // ── 크기별로 열리는 능력(EL_ABIL) ──
  // 그 속성으로 끼운 돌 중 가장 큰 크기(-1 = 없음). 패시브는 어느 칸에 끼워도 된다
  function best(prof, el) {
    if (!prof || !prof.equip.weapon) return -1;
    let m = -1;
    for (const k of STONE_SLOTS) { const s = prof.sockets[k]; if (s && s.el === el && s.size > m) m = s.size; }
    return m;
  }
  const has = (prof, el, tier) => best(prof, el) >= EL_UNLOCK[tier];
  // ── 세트 효과(공명 · 듀오): 칸 4개 모두 보통 이상, 세기 = 가장 낮은 돌 ──
  function setBonus(prof) {
    if (!prof || !prof.equip.weapon) return null;
    const ss = STONE_SLOTS.map(k => prof.sockets[k]);
    if (ss.some(s => !s || s.size < SET_MIN)) return null;
    const n = {};
    for (const s of ss) n[s.el] = (n[s.el] || 0) + 1;
    const els = Object.keys(n).sort(), sc = STONE_SIZES[Math.min(...ss.map(s => s.size))].power / STONE_SIZES[SET_MIN].power;
    if (els.length === 1) return { res: els[0], name: SET_RES[els[0]].name, desc: SET_RES[els[0]].desc(sc), sc };
    if (els.length === 2 && n[els[0]] === 2) { const key = els.join('+'), d = SET_DUO[key]; return { duo: key, name: d.name, desc: d.desc(sc), sc }; }
    return null;
  }
  const P = () => World.actor || World.player;  // 지금 친 사람(파티: 방장 쪽 손님 몸일 수도)
  const setOf = () => { const p = P(); return p ? setBonus(p.prof) : null; };
  const isRes = el => { const b = setOf(); return b && b.res === el ? b.sc : 0; };
  const isDuo = key => { const b = setOf(); return b && b.duo === key ? b.sc : 0; };
  const pk = (prof, el) => STONE_SIZES[Math.max(0, best(prof, el))].power;  // 패시브 세기 = 가장 큰 돌
  const slotOpen = s => s.size >= EL_UNLOCK.slot;
  // 잠깐 뒤에 하기(뇌운 · 연쇄 폭발)
  let later = [];
  const after = (t, fn) => later.push({ t, fn });
  let thorT = 0;
  function step(dt) {
    if (World.mirror) return;  // 파티 손님: 속성석 효과는 방장 쪽 내 몸이 낸다(그림은 방장이 보내 줌)
    const th = isRes('thunder');  // 뇌신
    if (th) {
      thorT += dt;
      if (thorT >= 3) {
        thorT = 0;
        const p = P(), list = World.enemies().filter(e => live(e) && e.shockT > 0).slice(0, 4);
        for (const e of list) { World.fx({ type: 'strike', x: e.x, y: e.y, t: 0, life: 0.25 }); damage(e, p.stats.atk * 0.5 * th, 'thunder'); }
        if (list.length) Sfx.zap();
      }
    }
    for (const e of World.enemies()) if (e.duoCd > 0) e.duoCd -= dt;
    for (const l of later) { l.t -= dt; if (l.t <= 0 && !l.done) { l.done = true; l.fn(); } }
    later = later.filter(l => !l.done);
  }
  const reset = () => { later = []; };
  // 둘레 폭발: 원 안의 몹에게 피해 + 덧붙임
  function explode(x, y, r, dmg, el, extra) {
    World.fx({ type: 'burst', x, y, r, col: ELEMENTS[el].color, t: 0, life: 0.3 });
    for (const e of World.enemies()) {
      if (!live(e) || Math.hypot(e.x - x, (e.y - y) * 1.3) > r + e.r) continue;
      if (dmg > 0) damage(e, dmg, el);
      if (extra) extra(e);
    }
  }

  // ── 상태이상 걸기 ──
  function burn(e, p, k) {
    const ember = has(p.prof, 'fire', 'p2');  // 불씨
    const inferno = isRes('fire');  // 업화
    const dps = p.stats.atk * 0.3 * k * (ember ? 1.3 : 1) * (1 + 0.5 * inferno);
    e.burn = { t: ember ? 5 : 3, dps: Math.max(e.burn ? e.burn.dps : 0, dps), tick: e.burn ? e.burn.tick : 0.5 };
    duoReact(e);
  }
  // 듀오 반응: 두 상태가 함께 걸린 순간(몹마다 쿨타임 1초)
  function duoReact(e) {
    const p = P();
    if (!p || e.dying || (e.duoCd || 0) > 0) return;
    const b = setOf();
    if (!b || !b.duo) return;
    const atk = p.stats.atk, sc = b.sc;
    if (b.duo === 'fire+frost' && e.burn && (e.chill > 0 || e.state === 'frozen')) {  // 증기 폭발
      e.duoCd = 1; e.burn = null; e.chill = 0;
      World.text(e.x, e.y, e.h + 8, '증기 폭발!', '#e8f4ff'); Sfx.blast(); World.shake(2);
      explode(e.x, e.y, 34, atk * 1.2 * sc, 'frost');
    } else if (b.duo === 'fire+thunder' && e.burn && e.shockT > 0) {  // 과부하
      e.duoCd = 1;
      World.text(e.x, e.y, e.h + 8, '과부하!', ELEMENTS.thunder.color); Sfx.zap();
      explode(e.x, e.y, 30, atk * 0.8 * sc, 'thunder', o => { const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1; o.kx = (o.kx || 0) + dx / d * 220; o.ky = (o.ky || 0) + dy / d * 220; });
    } else if (b.duo === 'fire+poison' && e.burn && e.poison && e.poison.n >= 2) {  // 독연
      e.duoCd = 1.5;
      World.text(e.x, e.y, e.h + 8, '독연!', ELEMENTS.poison.color);
      damage(e, e.poison.n * e.poison.per * 2 * sc, 'poison');
      World.field({ x: e.x, y: e.y, r: 26, el: 'poison', life: 2.5, k: sc, p });
    }
  }
  function chill(e, n, k) {
    if (isRes('frost')) n += 1;  // 절대영도: 냉기 1 더
    if (isDuo('frost+poison') && e.poison) n *= 2;  // 서리독: 독 걸린 적에게 냉기 2배
    e.chill = (e.chill || 0) + n;
    duoReact(e);
    e.chillT = 3;
    if (e.chill < FREEZE_AT || e.dying) return;
    e.chill = 0;
    if (e.def.boss) {
      e.crackT = 3; // 보스는 얼지 않고 균열: 받는 피해 증가 + 잠깐 멈칫
      if (e.state === 'move') { e.state = 'stagger'; e.t = 0.4; }
      World.text(e.x, e.y, e.h + 6, '얼음 균열!', '#bfefff');
    } else {
      e.state = 'frozen'; e.t = (1 + 0.25 * k) * (1 + 0.5 * isRes('frost')); e.kx = e.ky = 0;  // 절대영도: 빙결 시간 늘어남
      // 서리독: 빙결되면 쌓인 독이 한 번에 터진다
      const fp = isDuo('frost+poison');
      if (fp && e.poison && e.poison.n > 0) { World.text(e.x, e.y, e.h + 14, '서리독!', ELEMENTS.poison.color); damage(e, e.poison.n * e.poison.per * 3 * fp, 'poison'); e.poison.n = Math.ceil(e.poison.n / 2); }
      Sfx.frost();
      World.text(e.x, e.y, e.h + 6, '빙결!', '#bfefff');
    }
  }
  function shock(e, k) { e.shockT = isDuo('poison+thunder') ? 4 : 3; e.shockK = Math.max(e.shockK || 1, k); duoReact(e); }  // 신경독: 감전 1초 더
  function poison(e, n, p, k, noPop) {
    const venom = has(p.prof, 'poison', 'p2');  // 맹독
    const max = POISON_MAX + (venom ? 6 : 0) + (isRes('poison') ? 6 : 0);  // 역병: 최대 중첩 +6
    if (isDuo('poison+thunder') && e.shockT > 0) n *= 2;  // 신경독: 감전된 적에게 독 2배
    const per = p.stats.atk * 0.05 * k * (venom ? 1.25 : 1);
    duoReact(e);
    e.poison = { n: Math.min(max, (e.poison ? e.poison.n : 0) + n), t: 4, per: Math.max(e.poison ? e.poison.per : 0, per), tick: e.poison ? e.poison.tick : 0.5 };
    // 독 폭발: 가득 차면 터져 둘레에 피해 · 독을 퍼뜨리고 절반 남는다
    if (!noPop && e.poison.n >= max && has(p.prof, 'poison', 'p1')) {
      const pkk = pk(p.prof, 'poison');
      e.poison.n = Math.floor(max / 2);
      World.text(e.x, e.y, e.h + 6, '독 폭발!', ELEMENTS.poison.color);
      explode(e.x, e.y, 32, p.stats.atk * 0.6 * pkk, 'poison', o => { if (o !== e) poison(o, 3, p, pkk, true); });
    }
  }
  // 번개가 가까운 적에게 차례로 튄다
  function chain(from, p, count, dmg, k) {
    if (isRes('thunder')) count += 2;  // 뇌신: 연쇄 번개 2번 더
    let cur = from;
    const hit = new Set([from]);
    for (let i = 0; i < count; i++) {
      let best = null, bd = 72;
      for (const e of World.enemies()) {
        if (hit.has(e) || !live(e)) continue;
        const d = Math.hypot(e.x - cur.x, e.y - cur.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      if (i === 0) Sfx.zap();
      World.fx({ type: 'bolt', x0: cur.x, y0: cur.y - cur.h * 0.5, x1: best.x, y1: best.y - best.h * 0.5, t: 0, life: 0.2 });
      hit.add(best);
      damage(best, dmg, 'thunder');
      shock(best, k);
      cur = best;
    }
  }

  // 받는 피해 배수(감전 · 균열 · 빙결)
  function vuln(e) {
    let m = 1;
    if (e.shockT > 0) m *= 1 + SHOCK_VULN + 0.05 * Math.round((e.shockK || 1) - 1) + (P() && has(P().prof, 'thunder', 'p2') ? 0.15 : 0);  // 고전압
    if (e.crackT > 0) m *= 1 + CRACK_VULN;
    if (e.cutT > 0) m *= 1 + WAVE_CUT.vuln;  // 검기 베인 상처
    const scd = isDuo('frost+thunder');  // 초전도: 냉기 · 빙결 + 감전
    if (scd && e.shockT > 0 && (e.chill > 0 || e.state === 'frozen' || e.crackT > 0)) m *= 1 + 0.25 * scd;
    const az = isRes('frost');  // 절대영도: 빙결된 적
    if (az && e.state === 'frozen') m *= 1 + 0.2 * az;
    if (e.state === 'frozen') m *= 1 + FROZEN_VULN;
    return m;
  }

  // 속성 피해(상태이상 · 폭발 · 번개): 숫자를 띄우고, 쓰러지면 처치
  function damage(e, amount, el) {
    if (e.dying || e.state === 'dead' || World.mirror) return;  // 파티 손님: 피해는 방장 쪽에서
    const d = Math.max(1, Math.round(amount * vuln(e)));
    e.hp -= d;
    World.number(e.x + (Math.random() - 0.5) * 6, e.y, e.h + 2, d, ELEMENTS[el].color);
    if (e.hp <= 0) {
      e.dying = true;
      if (e.def.boss) { e.state = 'dead'; e.t = 0; }
      else { e.state = 'air'; e.vz = Math.max(e.vz || 0, 100); }
      World.onKill(e);
    }
  }

  // 칸 기술이 맞았을 때(hitEnemy 에서 부른다). fin = 마무리 · 회전베기는 더 세게
  function onHit(e, def, p) {
    if (World.mirror) return;  // 파티 손님: 속성석 효과는 방장 쪽 내 몸이 낸다(그림은 방장이 보내 줌)
    if (e.dying) return;
    passiveHit(e, p);
    if (!def.slot || e.dying) return;
    const s = socket(p.prof, def.slot);
    if (!s) return;
    const k = power(s), big = !!def.fin || def.slot === 'dash', wave = def.slot === 'wave', open = slotOpen(s);
    const sw = wave && def.id === 'wave' ? 2 : 1;  // 검사 검기는 속성 효과 약 2배(2026-10-25, 마법사 마력탄은 그대로)
    const swd = sw > 1 ? 3 : 1;  // 검사 검기 속성 피해는 3배(2배에서 50% 더, 2026-10-25 사용자)
    switch (s.el) {
      case 'fire':
        burn(e, p, k * (big ? 1.5 : 1));
        if (wave && open) explode(e.x, e.y, 24, p.stats.atk * 0.4 * swd * k, 'fire', o => burn(o, p, k));  // 작열 검기
        break;
      case 'frost': chill(e, wave ? 1 + sw : big ? 2 : 1, k); break;
      case 'thunder':
        shock(e, k);
        // 연쇄 번개 베기(보통부터): 모든 기본 공격에서 튄다. 그 전에는 마무리 · 검기만
        if ((big && def.slot === 'basic') || wave) chain(e, p, 1 + Math.floor(s.size / 2), p.stats.atk * (wave ? 0.5 * swd : 0.4) * k, k);
        else if (def.slot === 'basic' && open) chain(e, p, 1, p.stats.atk * 0.3 * k, k);
        if (wave && open) { World.fx({ type: 'strike', x: e.x, y: e.y, t: 0, life: 0.25 }); damage(e, p.stats.atk * 0.6 * swd * k, 'thunder'); }  // 벼락 검기
        break;
      case 'poison': poison(e, wave ? (open ? 3 : 2) + (sw > 1 ? 2 : 0) : big ? 2 : 1, p, k); break;  // 독침 검기 = 3중첩(검사 검기는 5)
    }
  }
  // 속성 패시브(완전한부터): 어떤 공격이 맞아도
  function passiveHit(e, p) {
    // 파쇄: 얼어붙은 적을 때리면 얼음이 깨진다
    if (e.state === 'frozen' && has(p.prof, 'frost', 'p1')) {
      const k = pk(p.prof, 'frost');
      e.state = 'stagger'; e.t = 0.3;
      World.text(e.x, e.y, e.h + 6, '파쇄!', '#bfefff');
      Sfx.frost();
      damage(e, p.stats.atk * 1.2 * k, 'frost');
      explode(e.x, e.y, 30, 0, 'frost', o => { if (o !== e) chill(o, 2, k); });
    }
    // 날벼락: 10% 확률로 하늘에서 벼락
    if (!e.dying && has(p.prof, 'thunder', 'p1') && Math.random() < 0.1) {
      const k = pk(p.prof, 'thunder');
      World.fx({ type: 'strike', x: e.x, y: e.y, t: 0, life: 0.25 });
      Sfx.zap();
      damage(e, p.stats.atk * 1.0 * k, 'thunder');
      shock(e, k);
    }
  }
  // 기본 공격을 휘두를 때(보통부터): 화염구 · 얼음 파편 · 독 분사
  function basicSwing(p, d) {
    if (World.mirror) return;  // 파티 손님: 속성석 효과는 방장 쪽 내 몸이 낸다(그림은 방장이 보내 줌)
    const s = socket(p.prof, 'basic');
    if (!s || !slotOpen(s)) return;
    const k = power(s), col = ELEMENTS[s.el].color, a0 = Math.atan2(p.fv.y, p.fv.x);
    const shot = (a, o) => World.playerShot(Object.assign({ x: p.x + Math.cos(a) * 8, y: p.y + Math.sin(a) * 8, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed,
      ball: true, col, hit: new Set(), def: { name: o.name, mult: o.mult, knock: 40, stun: 0.15 } }, o));
    if (s.el === 'fire') {
      const n = d.fin ? 3 : 1;
      for (let i = 0; i < n; i++) shot(a0 + (i - (n - 1) / 2) * 0.28, { name: '화염구', speed: 190, left: 110, r: 5, mult: 0.35 * k, once: true,
        onEnd: sh => explode(sh.x, sh.y, 22, p.stats.atk * 0.3 * k, 'fire', e => burn(e, p, k)) });
    } else if (s.el === 'frost') {
      for (const da of [-0.22, 0.22]) shot(a0 + da, { name: '얼음 파편', speed: 230, left: 85, r: 4, mult: 0.2 * k, onHitE: e => chill(e, 1, k) });
    } else if (s.el === 'poison') {
      World.fx({ type: 'burst', x: p.x + p.fv.x * 22, y: p.y + p.fv.y * 22, r: 18, col, t: 0, life: 0.25 });
      for (const e of World.enemies()) {
        if (!live(e)) continue;
        const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
        if (dist > 46 + e.r || (dist > 8 && (dx * p.fv.x + dy * p.fv.y) / dist < 0.75)) continue;
        poison(e, d.fin ? 3 : 1, p, k);
        damage(e, p.stats.atk * 0.12 * k, 'poison');
      }
    }
  }
  // 몹이 쓰러질 때(World.onKill): 연쇄 폭발
  function onDeath(e) {
    const p = P();
    if (!p || World.mirror) return;
    const plague = isRes('poison');  // 역병: 독 걸린 적이 쓰러지면 둘레로 독이 옮는다
    if (plague && e.poison) { const x = e.x, y = e.y; after(0.1, () => explode(x, y, 34, 0, 'poison', o => poison(o, Math.round(4 * plague), p, plague, true))); }
    if (!e.burn || !(has(p.prof, 'fire', 'p1') || isRes('fire'))) return;  // 업화: 연쇄 폭발이 없어도 늘 터진다
    const k = pk(p.prof, 'fire'), x = e.x, y = e.y;
    after(0.15, () => { Sfx.blast(); explode(x, y, 30, p.stats.atk * 0.8 * k, 'fire', o => burn(o, p, k)); });
  }

  // 회전베기를 휘두를 때(차지 칸): 둘레에 속성 폭발
  function chargeBurst(p) {
    if (World.mirror) return;  // 파티 손님: 속성석 효과는 방장 쪽 내 몸이 낸다(그림은 방장이 보내 줌)
    const s = socket(p.prof, 'charge');
    if (!s) return;
    const k = power(s), atk = p.stats.atk, R = 40 + s.size * 4, col = ELEMENTS[s.el].color;
    const near = World.enemies().filter(e => live(e) && Math.hypot(e.x - p.x, e.y - p.y) <= R + e.r);
    if (slotOpen(s)) chargeExtra(p, s, k, R, near);
    switch (s.el) {
      case 'fire':
        Sfx.fire();
        World.fx({ type: 'burst', x: p.x, y: p.y, r: R, col, t: 0, life: 0.35 });
        World.shake(3);
        for (const e of near) { damage(e, atk * 0.8 * k, 'fire'); burn(e, p, k); }
        break;
      case 'frost':
        Sfx.frost();
        World.fx({ type: 'burst', x: p.x, y: p.y, r: R, col, t: 0, life: 0.4 });
        for (const e of near) { damage(e, atk * 0.4 * k, 'frost'); chill(e, 3, k); }
        break;
      case 'thunder': {
        const far = World.enemies().filter(e => live(e) && Math.hypot(e.x - p.x, e.y - p.y) <= R + 30)
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 2 + s.size);
        for (const e of far) {
          World.fx({ type: 'strike', x: e.x, y: e.y, t: 0, life: 0.25 });
          damage(e, atk * 0.7 * k, 'thunder');
          shock(e, k);
        }
        if (far.length) { World.shake(2); Sfx.zap(); }
        break;
      }
      case 'poison':
        World.field({ x: p.x, y: p.y, r: R * 0.8, el: 'poison', life: 3, k, p });
        break;
    }
  }

  // ── 대시 칸: 지나간 길(불길 · 얼음 · 독), 끝(벼락 · 부과 능력) ──
  function dashStart(p) { p.dashStone = socket(p.prof, 'dash'); p.dashTrail = 0; p.dashHit = new Set(); }
  function dashMove(p, step) {
    if (World.mirror) return;  // 파티 손님: 속성석 효과는 방장 쪽 내 몸이 낸다(그림은 방장이 보내 줌)
    const s = p.dashStone;
    if (!s) return;
    const k = power(s);
    p.dashTrail += step;
    if (s.el !== 'thunder' && p.dashTrail >= 14) { p.dashTrail = 0; World.field({ x: p.x, y: p.y, r: 10, el: s.el, life: 1.5 + 0.25 * s.size, k, p }); }
    // 번개 질주(보통부터): 스친 적 모두
    if (s.el === 'thunder' && slotOpen(s)) for (const e of World.enemies()) {
      if (!live(e) || p.dashHit.has(e) || Math.hypot(e.x - p.x, e.y - p.y) > 20 + e.r) continue;
      p.dashHit.add(e);
      World.fx({ type: 'bolt', x0: p.x, y0: p.y - 8, x1: e.x, y1: e.y - e.h * 0.5, t: 0, life: 0.15 });
      damage(e, p.stats.atk * 0.4 * k, 'thunder'); shock(e, k);
    }
  }
  function dashEnd(p) {
    if (World.mirror) return;  // 파티 손님: 속성석 효과는 방장 쪽 내 몸이 낸다(그림은 방장이 보내 줌)
    const s = p.dashStone;
    p.dashStone = null;
    if (!s) return;
    const k = power(s), atk = p.stats.atk;
    if (s.el === 'thunder') {  // 벼락 발자국: 끝난 자리 가까운 적에게 벼락
      let best = null, bd = 64;
      for (const e of World.enemies()) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (live(e) && d < bd) { bd = d; best = e; } }
      if (best) { World.fx({ type: 'strike', x: best.x, y: best.y, t: 0, life: 0.25 }); Sfx.zap(); damage(best, atk * 0.6 * k, 'thunder'); shock(best, k); }
    }
    if (!slotOpen(s)) return;
    if (s.el === 'fire') { Sfx.fire(); explode(p.x, p.y, 26, atk * 0.6 * k, 'fire', e => burn(e, p, k)); }
    if (s.el === 'frost') { Sfx.frost(); explode(p.x, p.y, 26, atk * 0.3 * k, 'frost', e => chill(e, 2, k)); }
    if (s.el === 'poison') World.field({ x: p.x, y: p.y, r: 30, el: 'poison', life: 3, k, p });
  }

  // 회전베기 부과 능력(보통부터): 불길 고리 · 얼음 장판 · 뇌운 · 독 터뜨리기
  function chargeExtra(p, s, k, R, near) {
    const atk = p.stats.atk;
    if (s.el === 'fire') World.field({ x: p.x, y: p.y, r: R * 0.8, el: 'fire', life: 2.5, k, p });
    if (s.el === 'frost') World.field({ x: p.x, y: p.y, r: R * 0.8, el: 'frost', life: 3, k, p });
    if (s.el === 'thunder') after(1, () => {
      const far = World.enemies().filter(e => live(e) && Math.hypot(e.x - p.x, e.y - p.y) <= R + 30)
        .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 2 + s.size);
      for (const e of far) { World.fx({ type: 'strike', x: e.x, y: e.y, t: 0, life: 0.25 }); damage(e, atk * 0.5 * k, 'thunder'); shock(e, k); }
      if (far.length) Sfx.zap();
    });
    if (s.el === 'poison') {
      let popped = 0;
      for (const e of near) {
        if (!e.poison || e.poison.n < 2) continue;
        damage(e, e.poison.n * atk * 0.08 * k, 'poison');
        e.poison.n = Math.ceil(e.poison.n / 2);
        popped++;
      }
      if (popped) World.fx({ type: 'burst', x: p.x, y: p.y, r: R, col: ELEMENTS.poison.color, t: 0, life: 0.35 });
    }
  }

  // 검기 칸: 날아가는 동안 꼬리(불길 · 독 · 얼음 길), 끝에서 얼음 파편
  function waveTrail(shot, p) {
    if (World.mirror) return;  // 파티 손님: 속성석 효과는 방장 쪽 내 몸이 낸다(그림은 방장이 보내 줌)
    if (!shot.stone) return;
    const k = power(shot.stone);
    if (shot.stone.el === 'fire') World.field({ x: shot.x, y: shot.y, r: 10, el: 'fire', life: 2, k, p });
    if (shot.stone.el === 'poison') World.field({ x: shot.x, y: shot.y, r: 11, el: 'poison', life: 2.5, k, p });
    if (shot.stone.el === 'frost' && slotOpen(shot.stone)) World.field({ x: shot.x, y: shot.y, r: 11, el: 'frost', life: 2, k, p });  // 얼음 길
  }
  function waveEnd(shot, p) {
    if (World.mirror) return;  // 파티 손님: 속성석 효과는 방장 쪽 내 몸이 낸다(그림은 방장이 보내 줌)
    if (!shot.stone || shot.stone.el !== 'frost') return;
    const k = power(shot.stone), frostOrb = shot.orb && slotOpen(shot.stone), R = frostOrb ? 40 : 28;  // 마법사 서리 구슬(보통부터): 넓게 + 냉기
    World.fx({ type: 'burst', x: shot.x, y: shot.y, r: R, col: ELEMENTS.frost.color, t: 0, life: 0.3 });
    for (const e of World.enemies()) {
      if (!live(e) || Math.hypot(e.x - shot.x, e.y - shot.y) > R + e.r) continue;
      damage(e, p.stats.atk * (shot.orb ? 0.4 : 1.2) * k, 'frost');  // 검사 검기 끝 얼음 파편은 2배(2026-10-25)
      if (frostOrb) chill(e, 2, k);
      chill(e, 1, k);
    }
  }

  // 장판: 0.5초마다 안에 있는 몹에게
  function fieldTick(f) {
    if (World.mirror) return;  // 파티 손님: 속성석 효과는 방장 쪽 내 몸이 낸다(그림은 방장이 보내 줌)
    for (const e of World.enemies()) {
      if (!live(e) || Math.hypot(e.x - f.x, (e.y - f.y) * 1.6) > f.r + e.r) continue;
      if (f.el === 'fire') burn(e, f.p, f.k);
      if (f.el === 'poison') { poison(e, 1, f.p, f.k); damage(e, f.p.stats.atk * 0.08 * f.k, 'poison'); }
      if (f.el === 'frost') chill(e, 1, f.k);  // 얼음 장판 · 얼음 길
    }
  }

  // 상태이상 시간 흐름(몹 업데이트 앞에서)
  function tick(e, dt) {
    if (e.cutT > 0) e.cutT -= dt;
    if (e.burn) {
      e.burn.t -= dt; e.burn.tick -= dt;
      if (e.burn.tick <= 0) { e.burn.tick += 0.5; damage(e, e.burn.dps * 0.5, 'fire'); }
      if (Math.random() < dt * 12) World.ember(e, ELEMENTS.fire.color);
      if (e.burn.t <= 0) e.burn = null;
    }
    if (e.poison) {
      e.poison.t -= dt; e.poison.tick -= dt;
      if (e.poison.tick <= 0) { e.poison.tick += 0.5; damage(e, e.poison.n * e.poison.per, 'poison'); }
      if (Math.random() < dt * 6) World.ember(e, ELEMENTS.poison.color);
      if (e.poison.t <= 0) e.poison = null;
    }
    if (e.shockT > 0) { e.shockT -= dt; if (Math.random() < dt * 8) World.ember(e, ELEMENTS.thunder.color); }
    if (e.crackT > 0) e.crackT -= dt;
    if (e.chillT > 0) { e.chillT -= dt; if (e.chillT <= 0) e.chill = 0; }
  }

  // ── 설명(메뉴) ──
  function describe(s, slot, prof) {
    const mage = clsOf(prof).id === 'mage';
    const k = power(s), pc = v => Math.round(v * 100) + '%';
    const T = {
      fire: {
        basic: ['맞히면 화상 3초: 초당 공격력의 ' + pc(0.3 * k), '마무리(찌르기)는 1.5배'],
        charge: ['회전베기 때 불꽃 폭발: 공격력의 ' + pc(0.8 * k), '맞은 적은 화상'],
        wave: ['검기가 지나간 자리에 불길(2초)', '불길에 닿으면 화상'],
        dash: ['대시한 길에 불길(밟은 적 화상)', '대시 찌르기에 화상 1.5배'],
      },
      frost: {
        basic: ['맞히면 냉기 1 (마무리 2)', '냉기 ' + FREEZE_AT + ' = 빙결 ' + (1 + 0.25 * k).toFixed(1) + '초 · 보스는 균열(피해 +25%)'],
        charge: ['회전베기 때 냉기 폭발: 공격력의 ' + pc(0.4 * k), '냉기 3 — 거의 바로 빙결'],
        wave: ['맞히면 냉기 3', '끝에서 얼음 파편 폭발(공격력의 ' + pc(1.2 * k) + ')'],
        dash: ['대시한 길이 얼어붙음(냉기)', '대시 찌르기에 냉기 2'],
      },
      thunder: {
        basic: ['맞히면 감전 3초: 받는 피해 +' + Math.round((SHOCK_VULN + 0.05 * Math.round(k - 1)) * 100) + '%', '마무리 때 번개가 ' + (1 + Math.floor(s.size / 2)) + '번 튐(공격력의 ' + pc(0.4 * k) + ')'],
        charge: ['회전베기 때 가까운 적 ' + (2 + s.size) + '마리에 낙뢰', '공격력의 ' + pc(0.7 * k) + ' + 감전'],
        wave: ['맞힌 적에서 번개가 ' + (1 + Math.floor(s.size / 2)) + '번 튐', '공격력의 ' + pc((mage ? 0.5 : 1.5) * k) + ' + 감전'],
        dash: ['대시가 끝나면 가까운 적에게 벼락(공격력의 ' + pc(0.6 * k) + ')', '대시 찌르기에 감전'],
      },
      poison: {
        basic: ['맞히면 독 1 (마무리 2), 최대 ' + POISON_MAX + '중첩', '0.5초마다 중첩당 공격력의 ' + pc(0.05 * k)],
        charge: ['회전베기 때 독안개(3초)', '안에 있으면 독이 계속 쌓임'],
        wave: ['지나간 자리에 독 꼬리(2.5초)', '맞히면 독 4'],
        dash: ['대시한 길에 독 웅덩이', '대시 찌르기에 독 2'],
      },
    };
    // 마법사: 마력탄은 꼬리를 남기지 않는 구슬이라 설명을 따로, 나머지는 기술 이름만 바꾼다
    if (mage) {
      T.fire.wave = ['맞히면 화상 3초: 초당 공격력의 ' + pc(0.3 * k), '구슬이라 지나간 자리에 불길은 없어요'];
      T.frost.wave = ['맞히면 냉기 2', '터질 때 얼음 파편 폭발(공격력의 ' + pc(0.4 * k) + ')'];
      T.poison.wave = ['맞히면 독 2', '0.5초마다 중첩당 공격력의 ' + pc(0.05 * k)];
    }
    const word = t => (mage ? t.split('대시 찌르기').join('마력 파동').split('회전베기').join('마법진').split('찌르기').join('내려치기').split('검기').join('마력탄') : t);
    const [an] = elAbil(s.el, slot, prof);
    return [...T[s.el][slot].map(word), slotOpen(s) ? '✦ ' + an + ' (열림)' : '· ' + an + ' — 보통 크기부터 열려요'];
  }
  // 지금 열린 속성 패시브 이름들
  function passives(prof) {
    const out = [];
    for (const el of EL_ORDER) for (const t of ['p1', 'p2']) if (has(prof, el, t)) out.push(EL_ABIL[el][t][0]);
    return out;
  }

  // 주머니 목록: [{ el, size, n }]
  // order = GEM_ORDER 이면 보석 주머니
  function stacks(prof, order = EL_ORDER) {
    const out = [];
    for (const el of order) for (let size = 0; size < STONE_SIZES.length; size++) {  // 속성별로 작은 돌부터
      const n = prof.stones[el + ':' + size] || 0;
      if (n > 0) out.push({ el, size, n });
    }
    return out;
  }
  function add(prof, s, n = 1) { prof.stones[key(s)] = (prof.stones[key(s)] || 0) + n; }
  function take(prof, s) {
    const k = key(s);
    if (!(prof.stones[k] > 0)) return false;
    prof.stones[k]--;
    if (!prof.stones[k]) delete prof.stones[k];
    return true;
  }

  return { setBonus, socket, power, color, onHit, basicSwing, dashStart, dashMove, dashEnd, onDeath, step, reset, has, passives, best, chargeBurst, waveTrail, waveEnd, fieldTick, tick, vuln, describe, stacks, add, take, key };
})();
