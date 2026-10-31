// 성기사(2026-10-31 사용자 — 메모/paladin-plan.md): 막고 → 신성력을 모으고 → 심판한다. 수치는 data.js CLASSES.paladin · PALADIN · WEAPON_KINDS mace · warhammer.
// 신성력 p.holy(0 ~ PALADIN.holyMax): 막기 · 3타 · 반격 · 보복 폭발로 쌓고, 특수(Z) 심판 · 천벌이 모두 쓴다.
// 파티(방장이 싸움을 계산): 손님 몸(rp)의 막기 · 갑옷 판정은 방장 coop.js remoteHurt 에서 guard · armorHit → 결과를 hurt 소식(bl · ar)에 실어 보냄.
//   손님의 신성력은 손님 기기에 있다 — 방장이 rp 몫으로 쌓을 때는 holy 소식, 막기 몫은 hurt 소식의 bl 로. 치유는 쓴 사람 기기가 pheal 을 모두에게(방장이 다른 손님에게 전함).
//   오라는 피해를 계산하는 기기(각자 자기 몸)가 둘레 성기사 파티원 위치(Coop.runMates)를 보고 정한다.
const Paladin = (() => {
  const GOLD = '#ffd86a', LIGHT = '#fff3c4';
  const isPal = p => p && p.cls && p.cls.id === 'paladin';
  const live = e => !e.dying && e.state !== 'dead';
  const pingOf = pid => { const m = typeof Net !== 'undefined' && Net.members ? Net.members().find(x => x.pid === pid) : null; return (m && m.ping) || 0; };

  // ── 신성력 ──
  // 방장 쪽 손님 몸이면 손님 기기로 보낸다(손님 기기 것이 진짜). 손님 기기에서 자기 몸이 쌓는 것은 방장 소식(holy · hurt bl)으로만
  function gain(p, n, viaHost) {
    if (!isPal(p) || !n) return;
    if (p.remote) { p.holy = Math.min(PALADIN.holyMax, (p.holy || 0) + n); Net.sendTo(p.pid, { t: 'holy', n }); return; }
    if (World.mirror && p === World.player && !viaHost) return;
    const was = p.holy || 0;
    p.holy = Math.min(PALADIN.holyMax, was + n);
    if (p.holy > was) { World.sparks(p.x, p.y, 20, 4 + 2 * (p.holy - was), GOLD); if (p.holy === PALADIN.holyMax && was < PALADIN.holyMax) World.text(p.x, p.y, 44, '신성력 가득!', GOLD); }
  }
  if (typeof Net !== 'undefined') Net.on('holy', m => { if (World.mirror && Game.scene === 'run') gain(World.player, m.n, true); });

  // ── 막기(메이스 스킬 칸) ── 결과 'perfect' · 'block' · null. src = 몹(src.def) 또는 탄({ x, y })
  // 손님 기기의 내 몸은 방장이 정해 보낸 src.bl(2 = 완벽 · 1 = 막기)만 따른다(몹 휘청 · 속성석은 방장 쪽에서 이미 함)
  function guard(p, src) {
    if (!isPal(p) || !src) return null;
    const self = World.mirror && p === World.player;
    let res = null, B = null;
    const a = p.state === 'act' && p.act, d = a && a.def;
    if (self) { res = src.bl === 2 ? 'perfect' : src.bl === 1 ? 'block' : null; B = d && d.block; }
    else {
      if (!d || !d.block || a.time > a.s + a.a || src.x === undefined) return null;
      const dx = src.x - p.x, dy = src.y - p.y;
      if (dx * p.fv.x + dy * p.fv.y <= 0) return null;  // 앞쪽 반원만(옆 · 뒤는 못 막음)
      B = d.block;
      const slack = p.remote ? Math.min(0.15, pingOf(p.pid) / 1000) : 0;  // 파티 손님: 누른 소식이 늦게 오는 만큼 완벽한 막기 시간을 늘려 줌
      res = a.time <= B.perfect + slack ? 'perfect' : 'block';
      if (src.def && live(src)) World.as(p, () => {
        if (res === 'perfect' && !src.def.boss && !src.def.part && !src.def.rooted) {  // 몹 휘청(준비하던 공격도 끊김)
          const u = unit(dx, dy, p.fv);
          src.state = 'hurt'; src.t = B.stagger; src.chain = 0; src.kx = u.x * 140; src.ky = u.y * 140;
          World.text(src.x, src.y, (src.h || 16) + 12, '휘청!', LIGHT);
        }
        Elements.onHit(src, { name: '막기', slot: 'charge', fin: res === 'perfect' }, p);  // 스킬 칸 속성석: 막을 때 때린 몹에게
      });
      if (res === 'perfect') World.as(p, () => Elements.chargeBurst(p, 30));  // 완벽한 막기: 둘레 스킬 칸 속성 폭발(검사 회전베기 자리 — 보통부터 부과 능력도)
    }
    if (!res) return null;
    const sx = p.x + p.fv.x * 9, sy = p.y + p.fv.y * 6;
    if (res === 'perfect') {
      World.text(p.x, p.y, 40, '완벽한 막기!', GOLD, true);
      World.sparks(sx, sy, 12, 14, LIGHT, true);
      World.fx({ type: 'pulse', x: sx, y: sy + 4, r: 14, t: 0, life: 0.25, col: GOLD });
      World.hitstop(0.06); World.shake(2);
      p.state = 'idle'; p.act = null; p.iframes = Math.max(p.iframes, 0.25);
      if (B) p.counterT = B.counterT;  // 곧바로 X = 반격 베기
      if (!p.remote) gain(p, 2, self);  // 방장 쪽 손님 몸: 손님 기기가 hurt 소식의 bl 로 더함(두 번 안 더하게)
    } else {
      World.sparks(sx, sy, 12, 6, GOLD);
      if (!p.remote) gain(p, 1, self);
    }
    Sfx.block(res === 'perfect');
    if (!p.remote && p === World.player) Input.rumble(res === 'perfect' ? 0.5 : 0.25, 60);
    return res;
  }

  // ── 신성 갑옷(성망치 스킬 칸) ── t 초 동안 안 밀리고 피해 × (1 - cut), 받은 피해를 모았다가 끝날 때 보복 폭발
  function armorStart(p, A) {
    p.armorT = A.t; p.armorA = A; p.armorStore = 0;
    World.text(p.x, p.y, 40, '신성 갑옷', GOLD);
    World.fx({ type: 'pulse', x: p.x, y: p.y + 4, r: 16, t: 0, life: 0.3, col: GOLD });
    Sfx.spell();
  }
  const armored = p => p.armorT > 0;
  // 갑옷 중에 맞음: 피해를 모음(dmg = 실제로 깎인 체력 · 방장 쪽 손님 몸은 방어 계산 전 값 × (1 - cut))
  function armorHit(p, dmg) { if (p.armorT > 0) p.armorStore = (p.armorStore || 0) + dmg; }
  function armorBurst(p) {
    const A = p.armorA, B = A.burst, store = p.armorStore || 0;
    p.armorT = 0; p.armorStore = 0;
    if (World.mirror && p === World.player) return;  // 손님 기기: 폭발 계산 · 그림은 방장 쪽 내 몸이
    World.fx({ type: 'nova', x: p.x, y: p.y, r: B.r, col: GOLD, el: '', tier: 2, ss: 0, bare: true, seed: Math.random() * 1000, t: 0, life: 0.45 });
    World.fx({ type: 'shock', x: p.x, y: p.y, r: B.r, t: 0, life: 0.35 });
    World.text(p.x, p.y, 44, store > 0 ? '보복!' : '신성 폭발', GOLD, true);
    World.shake(3); Sfx.blast();
    Elements.chargeBurst(p, B.r);  // 스킬 칸 속성 폭발(반지름 = 보복 폭발)
    const def = { name: '보복 폭발', slot: 'charge', fin: true, mult: B.base + store * B.store / Math.max(1, p.stats.atk), knock: 170, stun: 0.6, heavy: true };
    for (const e of World.enemies()) if (live(e) && groundDist(e.x - p.x, e.y - p.y) <= B.r + e.r) hitEnemy(e, def, p);
    gain(p, 1 + (store >= p.maxHp * B.more ? 1 : 0));
  }

  // ── 심판(메이스 특수) · 천벌(성망치 특수) ── n = 쓴 신성력. n = PALADIN.holyMax 면 치유도
  function judge(p, d, n) {
    if (!n) return;
    const J = d.judge;
    // 자리: 앞쪽(뒤 빼고) range 안 · 벽에 안 막힌 가장 가까운 적, 없으면 내 앞 first
    let tgt = null, bd = J.range;
    for (const e of World.enemies()) {
      if (!live(e) || e.spawnT > 0) continue;
      const dx = e.x - p.x, dy = e.y - p.y, dd = Math.hypot(dx, dy);
      if (dd > bd || dx * p.fv.x + dy * p.fv.y < -4 || !Dungeon.los(World.level, p.x, p.y - 4, e.x, e.y - 4)) continue;
      bd = dd; tgt = e;
    }
    const x = tgt ? tgt.x : p.x + p.fv.x * J.first, y = tgt ? tgt.y : p.y + p.fv.y * J.first * GROUND_Y;
    p.beams = p.beams || [];
    for (let i = 0; i < n; i++) p.beams.push({ t: J.delay * i, x, y, r: J.r, def: d, tgt });
    if (n >= PALADIN.holyMax) heal(p, d.heal);
  }
  function beam(p, b) {
    if (b.tgt && live(b.tgt)) { b.x = b.tgt.x; b.y = b.tgt.y; }  // 노린 적이 밀려났으면 따라감
    World.fx({ type: 'holybeam', x: b.x, y: b.y, r: b.r, t: 0, life: 0.45, col: GOLD });
    World.dust(b.x, b.y, 4);
    Sfx.zap();
    if (World.mirror && p === World.player) return;
    const def = { id: 'judge', name: '심판', slot: 'wave', mult: b.def.mult, knock: b.def.knock, stun: b.def.stun, heavy: true };
    for (const e of World.enemies()) if (live(e) && groundDist(e.x - b.x, e.y - b.y) <= b.r + e.r) hitEnemy(e, def, p);
  }
  function smite(p, d, n) {
    if (!n) return;
    const S = d.smite, R = S.r0 + S.rN * n;
    World.fx({ type: 'nova', x: p.x, y: p.y, r: R, col: GOLD, el: '', tier: Math.min(3, n), ss: 0, bare: n < 3, seed: Math.random() * 1000, t: 0, life: 0.5 });
    World.fx({ type: 'shock', x: p.x, y: p.y, r: R, t: 0, life: 0.35 });
    World.shake(2 + n); Sfx.blast();
    if (n >= PALADIN.holyMax) heal(p, d.heal);
    if (World.mirror && p === World.player) return;
    const def = { id: 'smite', name: '천벌', slot: 'wave', mult: d.mult + S.perN * (n - 1), knock: d.knock, stun: d.stun, heavy: true };
    for (const e of World.enemies()) if (live(e) && groundDist(e.x - p.x, e.y - p.y) <= R + e.r) hitEnemy(e, def, p);
  }

  // ── 치유 ── 쓴 사람 기기: 나 + 파티원에게 pheal(받은 기기가 자기 몸이 r 안이면 회복). 방장 쪽 손님 몸은 손님 기기가 하므로 안 함
  function healSelf(q, pct) {
    if (q.dead) return;
    const h = Math.min(q.maxHp - q.hp, Math.round(q.maxHp * pct));
    if (h <= 0) return;
    q.hp += h;
    World.number(q.x, q.y, 30, h, '#7dff8a');
    World.sparks(q.x, q.y, 16, 8, '#bfffb0');
  }
  function heal(p, H) {
    if (!H || p.remote || p !== World.player) return;
    healSelf(p, H.pct);
    World.fx({ type: 'pulse', x: p.x, y: p.y + 4, r: H.r, t: 0, life: 0.5, col: '#bfffb0' });  // 치유가 닿는 둘레
    World.text(p.x, p.y, 52, '성스러운 치유', '#bfffb0');
    if (World.partySeed && typeof Net !== 'undefined' && Net.linked) Net.send({ t: 'pheal', x: Math.round(p.x), y: Math.round(p.y), r: H.r, pct: H.pct, fl: World.floorNo });
  }
  if (typeof Net !== 'undefined') Net.on('pheal', (m, from) => {
    if (Net.role === 'host') Net.send(Object.assign({}, m), from);  // 다른 손님에게도
    if (Game.scene !== 'run' || !World.partySeed || (m.fl || 0) !== World.floorNo) return;
    const q = World.player;
    if (Math.hypot(q.x - m.x, q.y - m.y) <= m.r) healSelf(q, m.pct);
  });

  // ── 오라 ── 피해를 계산하는 기기의 내 몸 p: 나(성기사) 또는 둘레 r 안에 살아 있는 성기사 파티원이 있으면 × (1 - cut)
  function auraMul(p) {
    const A = PALADIN.aura;
    if (isPal(p)) return 1 - A.cut;
    if (typeof Coop === 'undefined' || !World.partySeed) return 1;
    for (const b of Coop.runMates()) if (b.cls && b.cls.id === 'paladin' && !b.dead && Math.hypot(b.x - p.x, b.y - p.y) <= A.r) return 1 - A.cut;
    return 1;
  }

  // ── 매 틀(updatePlayer) ── 반격 시간 · 갑옷 · 차례로 떨어지는 빛기둥
  function update(p, dt) {
    if (!isPal(p)) return;
    p.counterT = Math.max(0, (p.counterT || 0) - dt);
    if (p.armorT > 0) {
      p.armorT -= dt;
      if (Math.random() < dt * 10) World.sparks(p.x, p.y, 10 + Math.random() * 12, 1, GOLD);
      if (p.armorT <= 0 || p.dead) armorBurst(p);
    }
    if (p.beams && p.beams.length) {
      for (const b of p.beams) if ((b.t -= dt) <= 0 && !b.done) { b.done = true; beam(p, b); }
      p.beams = p.beams.filter(b => !b.done);
    }
  }

  // ── 그림 ── 발밑 오라(아래) · 방패 · 갑옷 빛(위). 친구 몸(파티)도 같은 함수 — act 만 보고 막는 모습
  function drawUnder(ctx, p, time) {
    if (!isPal(p) || p.dead) return;
    const R = PALADIN.aura.r;
    ctx.save();
    ctx.globalAlpha = 0.07; ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.22; ctx.strokeStyle = GOLD; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -time * 6;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    if (p.armorT > 0) {  // 신성 갑옷: 몸 둘레 금빛 막
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(time * 14);
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(p.x, p.y - 10, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  // 방패: 메이스를 들면 늘 몸 옆에 작게, 막는 동안은 앞에 크게(처음 완벽한 막기 시간에는 더 밝게)
  function drawShield(ctx, x, y, w, h, glow) {
    ctx.save();
    if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = glow; ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(x, y, w + 3, h + 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    ctx.fillStyle = '#1a1418'; ctx.beginPath(); ctx.ellipse(x, y, w + 1, h + 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8a840'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a5aa0'; ctx.beginPath(); ctx.ellipse(x, y, w - 1, h - 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4e8b0'; ctx.fillRect(Math.round(x) - 1, Math.round(y - h + 2), 2, Math.round(h * 2 - 4)); ctx.fillRect(Math.round(x - w + 2), Math.round(y) - 2, Math.round(w * 2 - 4), 2);  // 십자
    ctx.restore();
  }
  function drawOver(ctx, p, time, flip) {
    if (!isPal(p) || p.dead) return;
    const w = p.prof && p.prof.equip && p.prof.equip.weapon, wk = w ? WEAPON_KINDS[Items.base(w).kind] || {} : {};
    const a = p.state === 'act' && p.act, d = a && a.def;
    if (d && d.block && a.time <= a.s + a.a) {
      const perfect = a.time <= d.block.perfect;
      drawShield(ctx, p.x + p.fv.x * 8, p.y - 10 + p.fv.y * 4, 6, 8, perfect ? 0.5 + 0.2 * Math.sin(time * 40) : 0.15);
    } else if (wk.shield) drawShield(ctx, p.x + (flip ? 4 : -4), p.y - 8, 3, 4, 0);
  }

  return { gain, guard, armorStart, armored, armorHit, judge, smite, heal, auraMul, update, drawUnder, drawOver, isPal };
})();
