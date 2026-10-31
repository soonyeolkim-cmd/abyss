// 소환사 소환수(2026-10-31 사용자 — 메모/summoner-plan.md). 수치는 data.js SUMMON · 무기 종류(WEAPON_KINDS bell · pact 의 pet).
// 솜뿔이(소환 방울 — 작고 빠른 군단) · 꼬마 악마(계약서 — 크고 센 한두 마리, 내리치기 범위). 그림은 tools/summon-sketch.js 시안 그대로(사용자 "맘에 든다").
// 주인 능력치를 그대로 쓴다: 한 방 = hitEnemy(적, 소환수 공격, 주인 대신 서는 몸) — 공격력 · 치명타 · 공격 보석 · 도감 · 스킬 칸 속성석(slot 'charge') 그대로.
// 몹은 가까이 붙은 소환수도 노린다(world.js 목표 고르기) — 맞으면 combat.js hurtPlayer 가 여기 hurt 로 넘긴다. 1차는 혼자 플레이만(파티 손님 계산 없음).
const Summon = (() => {
  let pets = [], uid = 0;
  const live = e => !e.dying && e.state !== 'dead';
  const cfg = q => SUMMON[q.kind];
  const kindOf = p => wkOf(p).pet || 'puff';
  // 소환수가 칠 수 있는 적: 살아 있고 · 땅 위 · 나타난 뒤 · 레이드 공허 구슬은 빼고(되받아치기가 너무 쉬워짐) · 깨어 있거나 표식 · 허수아비
  const valid = e => e && live(e) && !untouchable(e) && !(e.spawnT > 0) && e.def.part !== 'orb' && (e.awake || e.petMark > 0 || e.def.dummy);

  function reset() { pets = []; }
  const count = () => pets.length;
  const list = () => pets;

  // 소환수 한 방: 주인 몸을 바탕으로 자리 · 보는 쪽만 소환수 것(밀어내기 방향 · 기습 · 등 뒤 판정이 소환수 기준)
  const proxy = (q, p) => Object.assign(Object.create(p), { x: q.x, y: q.y, fv: q.fv });
  function hit(q, p, e, def) {
    const was = e.dying;
    if (!hitEnemy(e, def, proxy(q, p))) return false;
    if (!was && e.dying) { p.sp = Math.min(p.maxSp, p.sp + SUMMON.killSp); }  // 패시브: 소환수가 쓰러뜨리면 기력
    return true;
  }

  // ── 부르기(스킬 칸) ──
  function spawn(p) {
    const kind = kindOf(p), C = SUMMON[kind], lv = World.level;
    for (const q of pets) if (q.kind !== kind) vanish(q, p);  // 무기를 바꿨으면 다른 소환수는 돌아간다
    pets = pets.filter(q => !q.gone);
    while (pets.length >= C.max) { vanish(pets[0], p); pets.shift(); }  // 넘치면 가장 오래된 것부터
    // 내 앞 → 옆 → 제자리 순으로 걸을 수 있는 자리
    let x = p.x, y = p.y;
    for (const [a, d] of [[0, 16], [0.8, 14], [-0.8, 14], [Math.PI, 12], [0, 0]]) {
      const ang = Math.atan2(p.fv.y, p.fv.x) + a, tx = p.x + Math.cos(ang) * d, ty = p.y + Math.sin(ang) * d * 0.8;
      if (Dungeon.walkable(lv, tx, ty, C.r)) { x = tx; y = ty; break; }
    }
    const hp = Math.round(p.maxHp * C.hp);
    const q = { pet: true, id: ++uid, kind, x, y, z: 0, fv: { x: p.fv.x, y: p.fv.y }, r: C.r, h: C.h, hp, maxHp: hp, life: C.life, state: 'idle', t: 0,
      atkCd: 0.35, tgt: null, thinkT: 0, kx: 0, ky: 0, flash: 0, dead: false, walkT: Math.random() * 3, appear: 0.35, slot: pets.length };
    pets.push(q);
    const st = Elements.socket(p.prof, 'charge'), col = st ? ELEMENTS[st.el].color : '#b9a0ff';
    World.fx({ type: 'pulse', x, y, r: C.r + 10, t: 0, life: 0.35, col });  // 소환 고리(소환수 둘레만 — 판정 없음)
    World.sparks(x, y, 6, 10, col, true);
    Sfx.spell();
    return q;
  }
  // 돌아감(유지 시간 끝 · 넘침 · 무기 바꿈) · 쓰러짐. 스킬 칸 불꽃석(보통부터): 그 자리에서 불꽃 폭발
  function vanish(q, p, died) {
    if (q.gone) return;
    q.gone = true; q.dead = true;
    World.dust(q.x, q.y, died ? 8 : 5);
    World.sparks(q.x, q.y, q.h * 0.5, died ? 10 : 6, died ? '#ff8ab8' : '#d6b4f6');
    if (p) Elements.petEnd(q, p);
  }

  // ── 몹에게 맞음(combat.js hurtPlayer 에서) ── 방어 = 주인 방어력 × def, % 피해(레이드 벌)는 소환수 최대 체력 기준
  function hurt(q, src, dmgRaw, knock) {
    const p = World.player;
    if (q.gone || q.appear > 0) return 'miss';
    let dmg;
    if (src && src.pct) dmg = q.maxHp * src.pct;
    else {
      const K = 50 * POWER(p.prof.lv);
      dmg = dmgRaw * K / (K + p.stats.def * cfg(q).def);
    }
    dmg = Math.max(1, Math.round(dmg));
    q.hp -= dmg; q.flash = 0.12;
    if (src) { const u = unit(q.x - src.x, q.y - src.y, { x: -q.fv.x, y: -q.fv.y }); q.kx = u.x * (knock || 60) * 0.6; q.ky = u.y * (knock || 60) * 0.6; }
    World.number(q.x, q.y, q.h + 2, dmg, '#ff9aa8');
    if (q.hp <= 0) { World.text(q.x, q.y, q.h + 10, cfg(q).name + ' 쓰러짐', '#ff8ab8'); vanish(q, p, true); }
    return 'hit';
  }

  // ── 고르기 · 움직이기 ──
  // 주인 둘레 sight 안 · 벽에 안 막힌 적 가운데 표식 적(가까운 것)부터, 없으면 이 소환수에서 가장 가까운 적
  function pick(q, p, lv) {
    const C = cfg(q);
    let best = null, bd = Infinity, marked = false;
    for (const e of World.enemies()) {
      if (!valid(e) || Math.hypot(e.x - p.x, e.y - p.y) > C.sight) continue;
      if (lv.roomMaps && e.ri !== undefined && e.ri !== World.roomOf(q)) continue;
      if (!Dungeon.los(lv, q.x, q.y - 4, e.x, e.y - 4)) continue;
      const m = e.petMark > 0, d = Math.hypot(e.x - q.x, e.y - q.y);
      if ((m && !marked) || (m === marked && d < bd)) { best = e; bd = d; marked = m; }
    }
    return best;
  }
  function step(q, lv, tx, ty, sp, dt) {
    const u = unit(tx - q.x, ty - q.y, q.fv);
    q.fv = u;
    Dungeon.move(lv, q, u.x * sp * dt, u.y * sp * dt, q.r);
    q.walkT += dt; q.moving = true;
  }
  // 주인 뒤쪽 반원에 줄지어 따라다닌다(몇 번째인지 slot 으로 자리)
  function follow(q, p, lv, dt, i, n) {
    const back = Math.atan2(-p.fv.y, -p.fv.x), a = back + (n > 1 ? (i / (n - 1) - 0.5) * 2.2 : 0);
    const tx = p.x + Math.cos(a) * 18, ty = p.y + Math.sin(a) * 12;
    const d = Math.hypot(tx - q.x, ty - q.y);
    if (d > 6) step(q, lv, tx, ty, cfg(q).speed * (d > 60 ? 1.5 : 1), dt);
    else { q.moving = false; q.fv = unit(p.fv.x, p.fv.y, q.fv); }
  }
  // 준비가 끝나면 친다: 솜뿔이 = 노린 적 하나(박치기) · 꼬마 악마 = 앞 바닥 내리치기(반지름 aoe — 충격 그림 = 판정)
  function strike(q, p, lv) {
    const C = cfg(q), A = C.atk;
    q.state = 'idle'; q.atkCd = A.cd * (0.9 + Math.random() * 0.2);
    if (A.aoe) {
      const x = q.x + q.fv.x * (q.r + 4), y = q.y + q.fv.y * (q.r + 4);
      World.fx({ type: 'shock', x, y, r: A.aoe, t: 0, life: 0.3 });
      World.dust(x, y, 6);
      const def = { name: '악마 내리치기', slot: 'charge', pet: true, fin: true, mult: A.mult, knock: 120, stun: 0.45, heavy: true };  // fin = 큰 한 방(속성 효과 1.5배 · 냉기 · 독 2)
      for (const e of World.enemies()) if (valid(e) && groundDist(e.x - x, e.y - y) <= A.aoe + e.r) hit(q, p, e, def);
      Sfx.heavySwing();
    } else {
      const e = q.tgt;
      if (!valid(e) || Math.hypot(e.x - q.x, e.y - q.y) > A.reach + e.r + q.r + 6) return;
      q.kx = q.fv.x * 60; q.ky = q.fv.y * 60;  // 통 튀어 박치기
      hit(q, p, e, { name: '솜뿔이 박치기', slot: 'charge', pet: true, mult: A.mult, knock: 50, stun: 0.25 });
      Sfx.swing();
    }
  }

  // ── 돌격 명령(특수 칸): 모든 소환수가 표식 적(없으면 저마다 가까운 적)에게 돌진해 한 방(배율 rush) — 소환수는 남는다 ──
  function command(p) {
    const lv = World.level;
    let any = false;
    for (const q of pets) {
      if (q.gone) continue;
      const e = pick(q, p, lv);
      if (!e) continue;
      q.state = 'rush'; q.t = 0.7; q.tgt = e; any = true;
      World.fx({ type: 'streak', x0: q.x, y0: q.y, follow: q, t: 0, life: 0.3 });
    }
    if (any) Sfx.dash();
    return any;
  }
  function rushStep(q, p, lv, dt) {
    const e = q.tgt, C = cfg(q);
    q.t -= dt;
    if (!valid(e) || q.t <= 0) { q.state = 'idle'; return; }
    if (Math.hypot(e.x - q.x, e.y - q.y) <= e.r + q.r + 6) {
      q.state = 'idle'; q.atkCd = 0.4;
      World.sparks(e.x, e.y, e.h * 0.5, 10, '#ffd36a', true);
      hit(q, p, e, { id: 'command', name: '돌격', slot: 'wave', pet: true, mult: C.rush, knock: 160, stun: 0.5, heavy: true });
      return;
    }
    step(q, lv, e.x, e.y, 260, dt);
  }

  // 혼령 걸음(대시)이 끝나면 소환수가 내 곁으로(반짝이며 옮겨 옴)
  function regroup(p) {
    const lv = World.level, n = pets.length;
    pets.forEach((q, i) => {
      if (q.gone) return;
      const a = Math.atan2(-p.fv.y, -p.fv.x) + (n > 1 ? (i / (n - 1) - 0.5) * 2.2 : 0), x = p.x + Math.cos(a) * 16, y = p.y + Math.sin(a) * 11;
      World.sparks(q.x, q.y, 6, 5, '#d6b4f6');
      if (Dungeon.walkable(lv, x, y, q.r)) { q.x = x; q.y = y; } else { q.x = p.x; q.y = p.y; }
      q.state = 'idle'; q.tgt = null; q.kx = q.ky = 0;
      World.sparks(q.x, q.y, 6, 5, '#d6b4f6');
    });
  }
  // 영혼 흡수(대시 → 공격): 맞힌 수 × soul 초만큼 유지 시간이 는다(최대 SUMMON.soulMax)
  function extend(sec) {
    if (!sec) return;
    for (const q of pets) if (!q.gone) q.life = Math.min(SUMMON.soulMax, q.life + sec);
  }

  function update(dt, lv, p) {
    if (World.mirror) return;
    for (const e of World.enemies()) if (e.petMark > 0) e.petMark -= dt;  // 기본 공격 표식
    if (!pets.length) return;
    const n = pets.length;
    pets.forEach((q, i) => {
      if (q.gone) return;
      q.life -= dt; q.flash = Math.max(0, q.flash - dt); q.appear = Math.max(0, q.appear - dt); q.moving = false;
      if (q.life <= 0 || p.dead) { vanish(q, p); return; }
      if (q.kx || q.ky) {
        Dungeon.move(lv, q, q.kx * dt, q.ky * dt, q.r);
        const f = Math.exp(-9 * dt); q.kx *= f; q.ky *= f;
        if (Math.hypot(q.kx, q.ky) < 2) { q.kx = 0; q.ky = 0; }
      }
      // 너무 멀어지거나 다른 방(레이드 · 방 하나 맵)이면 주인 곁으로
      if (Math.hypot(q.x - p.x, q.y - p.y) > SUMMON.leash || (lv.roomMaps && World.roomOf(q) !== World.roomOf(p))) {
        q.x = p.x; q.y = p.y; q.state = 'idle'; q.tgt = null;
        World.sparks(q.x, q.y, 6, 5, '#d6b4f6');
        return;
      }
      if (q.appear > 0) return;
      if (q.state === 'rush') { rushStep(q, p, lv, dt); return; }
      if (q.state === 'wind') { q.t -= dt; if (q.t <= 0) strike(q, p, lv); return; }
      const C = cfg(q);
      q.thinkT -= dt; q.atkCd -= dt;
      if (q.thinkT <= 0 || !valid(q.tgt)) { q.tgt = pick(q, p, lv); q.thinkT = 0.25; }
      const e = q.tgt;
      if (e) {
        const gap = Math.hypot(e.x - q.x, e.y - q.y) - e.r - q.r;
        if (gap > C.atk.reach) step(q, lv, e.x, e.y, C.speed, dt);
        else {
          q.fv = unit(e.x - q.x, e.y - q.y, q.fv);
          if (q.atkCd <= 0) { q.state = 'wind'; q.t = C.atk.wind; }
        }
      } else follow(q, p, lv, dt, i, n);
    });
    pets = pets.filter(q => !q.gone);
    // 소환수끼리 겹치지 않게 살짝 밀기
    for (let i = 0; i < pets.length; i++) for (let j = i + 1; j < pets.length; j++) {
      const a = pets[i], b = pets[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
      if (d < min && d > 0.001) { const k = (min - d) * 0.3; Dungeon.move(lv, a, -dx / d * k, -dy / d * k, a.r); Dungeon.move(lv, b, dx / d * k, dy / d * k, b.r); }
    }
  }

  // ── 그림(시안 tools/summon-sketch.js 그대로) ──
  const PAL = { o: '#140a18', k: '#2e1a3e', p: '#553070', P: '#7a4aa0', B: '#a982d0', v: '#3a1f4a', V: '#7a3a8a', c: '#f0e2b8', C: '#b8a074', w: '#f6f2ff', y: '#ffcc33',
    r: '#2a0a14', f: '#ffffff', h: '#ff8ab8', t: '#ff5a8a', L: '#d6b4f6', l: '#ad84e6', n: '#8a62c8', e: '#3a1a50', g: '#ffe0a0' };
  function grid(W, H) {
    const a = Array.from({ length: H }, () => Array(W).fill('.'));
    return {
      put(r, c, s) { for (let i = 0; i < s.length; i++) if (s[i] !== ' ' && s[i] !== '.' && a[r] && c + i >= 0 && c + i < W) a[r][c + i] = s[i]; },
      mirror(r, c, s) { this.put(r, c, s); this.put(r, W - c - s.length, [...s].reverse().join('')); },
      rows: () => a.map(x => x.join('')),
    };
  }
  // 꼬마 악마(22 x 19): 둥근 머리 · 굽은 뿔 · 큰 눈 · 송곳니 웃음 · 박쥐 날개(위 / 아래) · 하트 끝 꼬리
  function devil(wingUp) {
    const G = grid(22, 19);
    const up = ['oo....', 'ovoo..', 'oVvvoo', 'oVVVvo', '.oVVvo', '..ooo.'];
    const dn = ['......', '..ooo.', '.oVVvo', 'oVVVvo', 'oVvvoo', 'ovoo..', 'oo....'];
    (wingUp ? up : dn).forEach((s, i) => G.mirror((wingUp ? 9 : 10) + i, 0, s));
    G.mirror(0, 5, 'oo'); G.mirror(1, 4, 'ocCo'); G.mirror(2, 4, 'ocCCo'); G.mirror(3, 5, 'oCCo');
    G.put(3, 9, 'oooo');
    G.put(4, 5, 'oPPPPPPPPPPo'); G.put(5, 4, 'oPpppppppppPPo'); G.put(6, 4, 'oPpwwppppwwpPo'); G.put(7, 4, 'oPpwyppppywpPo');
    G.put(8, 4, 'oPhppprrppphPo'); G.put(9, 4, 'oPpppfrrfpppPo'); G.put(10, 5, 'oPPppppppPPo');
    G.put(11, 6, 'oPpBBBBpPo'); G.put(12, 6, 'opPBBBBPpo'); G.put(13, 6, 'oppBBBBppo'); G.put(14, 7, 'oppppppo');
    G.put(15, 7, 'oko..oko'); G.put(16, 7, 'ooo..ooo');
    G.put(15, 14, 'kk'); G.put(16, 15, 'kk'); G.put(16, 17, 'tot'); G.put(17, 17, 'ttt'); G.put(18, 18, 't');
    return G.rows();
  }
  // 솜뿔이(12 x 13): 둥근 솜뭉치 · 작은 뿔 둘 · 큰 까만 눈 · 볼 · 짧은 발 — 통통 튀는 두 장
  function puff(squash) {
    const G = grid(12, 13), y0 = squash ? 3 : 2;
    G.mirror(y0 - 2, 4, 'g'); G.mirror(y0 - 1, 3, 'og');
    G.put(y0, 2, 'oooooooo'); G.put(y0 + 1, 1, 'oLLLLLLLLo'); G.put(y0 + 2, 0, 'oLLllllllLLo'); G.put(y0 + 3, 0, 'oLlwwllwwlLo');
    G.put(y0 + 4, 0, 'oLlwellewlLo'); G.put(y0 + 5, 0, 'olhllrrllhlo'); G.put(y0 + 6, 0, 'onllllllllno');
    if (squash) { G.put(y0 + 7, 1, 'onnnnnnnno'); G.put(y0 + 8, 1, 'oko....oko'); G.put(y0 + 9, 1, 'ooo....ooo'); }
    else { G.put(y0 + 7, 1, 'onllllllno'); G.put(y0 + 8, 2, 'onnnnnno'); G.put(y0 + 9, 2, 'ok....ko'); G.put(y0 + 10, 2, 'oo....oo'); }
    return G.rows();
  }
  const MAPS = { puff: [puff(false), puff(true)], imp: [devil(true), devil(false)] };
  // 글자 지도 → 작은 캔버스. tint = 스킬 칸 속성석 색을 반쯤 덧칠(테두리 · 눈은 또렷하게) · white = 맞았을 때 번쩍
  const cache = {};
  function bake(kind, f, tint, white) {
    const key = kind + f + (tint || '') + (white ? 'W' : '');
    if (cache[key]) return cache[key];
    const map = MAPS[kind][f], c = document.createElement('canvas');
    c.width = map[0].length; c.height = map.length;
    const g = c.getContext('2d');
    map.forEach((row, y) => [...row].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = white && ch !== 'o' ? '#ffffff' : PAL[ch]; g.fillRect(x, y, 1, 1); } }));
    if (tint && !white) {
      g.globalCompositeOperation = 'source-atop'; g.globalAlpha = kind === 'imp' ? 0.4 : 0.45; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      map.forEach((row, y) => [...row].forEach((ch, x) => { if ('owfyer'.includes(ch)) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
    }
    return (cache[key] = c);
  }
  // world.js 그리기 목록에 넣는다(아래 y 순으로 몹 · 나와 섞여 그려짐)
  function drawList(ctx, list, time, p, inView) {
    const st = Elements.socket(p.prof, 'charge'), tint = st ? ELEMENTS[st.el].color : null;
    for (const q of pets) {
      if (q.gone || !inView(q.x, q.y)) continue;
      list.push({ y: q.y, draw: () => {
        const imp = q.kind === 'imp', fly = imp ? 5 + Math.sin(time * 4 + q.id) * 1.5 : 0;  // 꼬마 악마는 떠 있다
        Art.shadow(ctx, q.x, q.y, q.r + 1, fly, q.appear > 0 ? 0.5 : 1);
        const f = imp ? Math.floor(time * 6 + q.id) % 2 : (q.moving || q.state === 'wind' ? Math.floor(q.walkT * 8) % 2 : Math.floor(time * 2 + q.id) % 2);
        const img = bake(q.kind, f, tint, q.flash > 0), k = q.appear > 0 ? 1 - q.appear / 0.35 : 1;
        ctx.save();
        if (q.life < 3 && Math.floor(time * 8) % 2) ctx.globalAlpha = 0.45;  // 곧 돌아감: 깜빡
        ctx.translate(Math.round(q.x), Math.round(q.y - fly));
        if (q.fv.x < -0.1) ctx.scale(-1, 1);
        ctx.scale(k, k);
        ctx.drawImage(img, -Math.floor(img.width / 2), -img.height);
        ctx.restore();
        if (q.hp < q.maxHp) {  // 다쳤으면 발밑 작은 체력 막대
          const w = imp ? 14 : 10;
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(Math.round(q.x - w / 2) - 1, Math.round(q.y + 2), w + 2, 3);
          ctx.fillStyle = '#ff8ab8'; ctx.fillRect(Math.round(q.x - w / 2), Math.round(q.y + 3), Math.max(1, Math.round(w * q.hp / q.maxHp)), 1);
        }
      } });
    }
  }
  // 표식 적: 발밑 분홍 고리 + 머리 위 작은 분홍 표(시안 그대로)
  function drawMarks(ctx, time) {
    for (const e of World.enemies()) {
      if (!(e.petMark > 0) || !live(e)) continue;
      const a = e.petMark < 1 && Math.floor(time * 8) % 2 ? 0.4 : 1;
      ctx.save(); ctx.globalAlpha = a;
      ctx.strokeStyle = '#ff5a8a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(Math.round(e.x), Math.round(e.y), e.r + 3, (e.r + 3) * GROUND_Y, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ff5a8a';
      const hy = Math.round(e.y - (e.z || 0) - e.h - 6);
      ctx.fillRect(Math.round(e.x) - 1, hy, 3, 3); ctx.fillRect(Math.round(e.x), hy + 4, 1, 2);
      ctx.restore();
    }
  }

  return { reset, count, list, spawn, hurt, command, regroup, extend, update, drawList, drawMarks };
})();
