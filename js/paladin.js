// 성기사(2026-10-31 사용자 — 메모/paladin-plan.md): 때려서 신성력을 모으고 → 큰 빛 기술로 터뜨린다(공격형 성전사, 같은 날 '너무 파티용' → 개편).
// 수치는 data.js CLASSES.paladin · PALADIN · WEAPON_KINDS mace · warhammer.
// 신성력 p.holy(0 ~ PALADIN.holyMax): 3타 · 신성 돌진 · 신성 강타가 맞으면, 축성을 놓으면 쌓이고, 특수(Z) 심판 · 축복받은 망치가 모두 쓴다(쓴 만큼 내 체력 회복).
// 파티(방장이 싸움을 계산): 손님의 신성력은 손님 기기에 있다 — 방장이 손님 몸(rp) 몫으로 쌓을 때는 holy 소식. 회복은 체력을 가진 기기(각자 자기 몸)에서만.
const Paladin = (() => {
  const GOLD = '#ffd86a', LIGHT = '#fff3c4', HEAL = '#7dff8a';
  const isPal = p => p && p.cls && p.cls.id === 'paladin';
  const live = e => !e.dying && e.state !== 'dead';
  const own = p => !p.remote;  // 체력 · 신성력을 가진 기기의 내 몸(방장 쪽 손님 몸은 아님)

  // ── 신성력 ──
  // 방장 쪽 손님 몸이면 손님 기기로 보낸다(손님 기기 것이 진짜). 손님 기기에서 자기 몸이 쌓는 것은 방장 소식(holy)으로만
  function gain(p, n, viaHost) {
    if (!isPal(p) || !n) return;
    if (p.remote) { p.holy = Math.min(PALADIN.holyMax, (p.holy || 0) + n); Net.sendTo(p.pid, { t: 'holy', n }); return; }
    if (World.mirror && p === World.player && !viaHost) return;
    const was = p.holy || 0;
    p.holy = Math.min(PALADIN.holyMax, was + n);
    if (p.holy > was) {
      World.sparks(p.x, p.y, 20, 4 + 2 * (p.holy - was), GOLD);
      if (p.holy === PALADIN.holyMax) { World.text(p.x, p.y, 44, '신성력 가득!', GOLD); if (p === World.player) Sfx.holy(); }
    }
  }
  if (typeof Net !== 'undefined') Net.on('holy', m => { if (World.mirror && Game.scene === 'run') gain(World.player, m.n, true); });
  // 특수(Z)를 쓸 때(player.js startAct): 신성력을 모두 비우고 하나에 최대 체력 healPer 씩 회복
  function spend(p) {
    const n = p.holy || 0;
    p.holy = 0;
    if (!n || !own(p) || p.dead) return;
    const h = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * PALADIN.healPer * n));
    if (h <= 0) return;
    p.hp += h;
    World.number(p.x, p.y, 30, h, HEAL);
    World.sparks(p.x, p.y, 16, 4 + 2 * n, '#bfffb0');
  }
  // 빛기둥 · 망치 수: 쓴 신성력, 가득이면 PALADIN.full 더
  const countOf = n => n + (n >= PALADIN.holyMax ? PALADIN.full : 0);

  // ── 신성 돌진(메이스 스킬 칸) 끝 ── 멈춘 자리에서 빛 폭발(바닥 타원 r = nova 그림), 스킬 칸 속성석 폭발도 같은 반지름. 돌진에 맞은 적의 속성석 효과는 이미 났으므로 폭발은 noEl
  function rushEnd(p, d) {
    const E = d.end;
    World.fx({ type: 'nova', x: p.x, y: p.y, r: E.r, col: GOLD, el: '', tier: 1, ss: 0, bare: true, seed: Math.random() * 1000, t: 0, life: 0.4 });
    World.fx({ type: 'shock', x: p.x, y: p.y, r: E.r, t: 0, life: 0.3 });
    World.shake(3); Sfx.blast();
    Elements.chargeBurst(p, E.r);
    const def = { name: '빛 폭발', slot: 'charge', fin: true, mult: E.mult, knock: 140, stun: 0.45, heavy: true, outward: true, noEl: true };
    let landed = false;
    for (const e of World.enemies()) if (live(e) && groundDist(e.x - p.x, e.y - p.y) <= E.r + e.r && hitEnemy(e, def, p)) landed = true;
    if (landed) World.hitstop(0.06);
  }

  // ── 축성(성망치 스킬 칸) ── 발밑 성역(world.js 장판 f.holy — fieldUpdate · drawField). 하나만(World.holyField)
  function consecrate(p, d) {
    const S = d.sanctum;
    World.field({ holy: true, x: p.x, y: p.y, r: S.r, t: 0, life: S.t, S, p, ht: S.tick, seed: Math.random() * 1000, pid: p.remote ? p.pid : Net.myId });  // pid = 깐 사람(손님 기기가 방장 소식으로 받아 자기 것을 알아봄)
    World.fx({ type: 'pulse', x: p.x, y: p.y, r: S.r, t: 0, life: 0.35, col: GOLD });
    World.text(p.x, p.y, 40, '축성', GOLD);
    World.shake(2); Sfx.holy();
    Elements.chargeBurst(p, S.r);  // 스킬 칸 속성석: 놓을 때 성역만큼 둘레 폭발
    gain(p, S.holy);
  }
  // 내 성역이 깔려 있나(손님 기기: 방장 소식으로 받은 장판 중 내 pid)
  const mine = (f, p) => f.p === p || (World.mirror && p === World.player && f.pid && f.pid === Net.myId);
  const sanctumUp = p => World.holyFields().some(f => mine(f, p));
  // 손님 기기의 내 몸: 장판 계산은 방장이 하므로, 내 성역 안에 서 있으면 여기서 tick 마다 회복(체력은 내 기기 것)
  function mirrorHeal(p, dt) {
    const S = CLASSES.paladin.consecrate.sanctum;
    if ((p.sanctHT = (p.sanctHT || S.tick) - dt) > 0) return;
    p.sanctHT += S.tick;
    if (p.dead || !World.holyFields().some(f => mine(f, p) && groundDist(p.x - f.x, p.y - f.y) <= f.r)) return;
    const h = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * S.heal * S.tick));
    if (h > 0) { p.hp += h; World.number(p.x, p.y, 30, h, HEAL); }
  }
  // 성역 한 틀: 안의 적은 느려짐(방장) · tick 초마다 피해(경직 없음) · 내가 안에 있으면 회복(체력을 가진 기기)
  function fieldUpdate(f, dt) {
    const S = f.S, p = f.p, inside = o => groundDist(o.x - f.x, o.y - f.y) <= f.r + (o.r || 0);
    if (!World.mirror) for (const e of World.enemies()) if (live(e) && inside(e)) { e.slowUntil = World.time + 0.1; e.slowK = S.slow; }
    f.ht -= dt;
    if (f.ht > 0) return;
    f.ht += S.tick;
    if (!World.mirror) for (const e of World.enemies()) if (live(e) && inside(e)) tickDamage(e, S.mult, p, f);
    if (own(p) && p === World.player && !p.dead && groundDist(p.x - f.x, p.y - f.y) <= f.r) {
      const h = Math.min(p.maxHp - p.hp, Math.round(p.maxHp * S.heal * S.tick));
      if (h > 0) { p.hp += h; World.number(p.x, p.y, 30, h, HEAL); }
    }
  }
  // 성역 피해: hitEnemy 처럼 세지만 경직 · 밀림 · 연타 버팀 없이(출혈처럼) — 몹 방어 · 감전 등 받는 피해는 그대로
  function tickDamage(e, mult, p, at) {
    if (e.spawnT > 0 || untouchable(e) || e.def.part === 'orb') return;
    if (e.ri !== undefined && World.roomOf(at) !== e.ri) return;
    if (!e.awake) World.wake(e);
    const st = p.stats, wk = WEAPON_KINDS[st.kind] || WEAPON_KINDS.none;
    const rc = e.def.raid ? Raid.cut(e)[0] : 1;
    const d = Math.round(st.atk * mult * wk.dmg * (1 + (st.dmg || 0) / 100) * Elements.vuln(e) * (1 - (e.armorCut || 0)) * (e.wardT > 0 ? WARD.cut : 1) * rc * (0.9 + Math.random() * 0.2));
    if (d <= 0) return;
    e.hp -= d; e.flash = 0.06;
    if (e.def.raid) Raid.clamp(e);
    if (e.def.dummy) Practice.add(d, 'charge');
    World.number(e.x + (Math.random() - 0.5) * 6, e.y, e.h + 2, d, GOLD);
    if (e.hp <= 0) {
      e.dying = true;
      if (e.def.boss || e.def.rooted) { e.state = 'dead'; e.t = 0; } else { e.state = 'air'; e.vz = Math.max(e.vz || 0, 100); }
      World.onKill(e);
    }
  }

  // ── 심판(메이스 특수) ── n = 쓴 신성력. 앞쪽 range 안 가장 가까운 적 자리에 빛기둥이 차례로
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
    for (let i = 0, c = countOf(n); i < c; i++) p.beams.push({ t: J.delay * i, x, y, r: J.r, def: d, tgt });
  }
  function beam(p, b) {
    if (b.tgt && live(b.tgt)) { b.x = b.tgt.x; b.y = b.tgt.y; }  // 노린 적이 밀려났으면 따라감
    World.fx({ type: 'holybeam', x: b.x, y: b.y, r: b.r, t: 0, life: 0.45, col: GOLD });
    World.dust(b.x, b.y, 4);
    Sfx.zap();
    const def = { id: 'judge', name: '심판', slot: 'wave', mult: b.def.mult, knock: b.def.knock, stun: b.def.stun, heavy: true };
    for (const e of World.enemies()) if (live(e) && groundDist(e.x - b.x, e.y - b.y) <= b.r + e.r) hitEnemy(e, def, p);
  }

  // ── 축복받은 망치(성망치 특수) ── 망치 n 개가 나를 가운데 두고 나선으로 돌며 퍼진다(life 초 동안 반지름 r0 → r1). 몸을 따라 움직임
  function hammers(p, d, n) {
    if (!n) return;
    const c = countOf(n), a0 = Math.random() * Math.PI * 2;
    p.hamCasts = p.hamCasts || [];
    p.hamCasts.push({ t: 0, def: d, list: Array.from({ length: c }, (_, i) => ({ a0: a0 + i * Math.PI * 2 / c, hit: new Map(), x: p.x, y: p.y, trail: [] })) });
    World.fx({ type: 'pulse', x: p.x, y: p.y, r: d.spiral.r0 + 6, t: 0, life: 0.3, col: GOLD });
    World.text(p.x, p.y, 44, c > 1 ? '축복받은 망치 ×' + c : '축복받은 망치', GOLD);
    Sfx.spell();
  }
  function updateHammers(p, dt) {
    for (const c of p.hamCasts) {
      const D = c.def, Q = D.spiral;
      c.t += dt;
      const k = Math.min(1, c.t / Q.life), rad = Q.r0 + (Q.r1 - Q.r0) * k;
      for (const h of c.list) {
        const an = h.a0 + c.t * Q.spin * Math.PI * 2;
        h.trail.unshift([h.x, h.y]); if (h.trail.length > 4) h.trail.pop();
        h.x = p.x + Math.cos(an) * rad; h.y = p.y + Math.sin(an) * rad * GROUND_Y; h.an = an;
        for (const e of World.enemies()) {
          if (!live(e) || groundDist(e.x - h.x, e.y - h.y) > Q.hr + e.r || c.t - (h.hit.get(e) ?? -9) < Q.again) continue;
          // 속성석 효과는 망치마다 한 적에 한 번(한 망치가 같은 적을 몇 번씩 맞혀서)
          if (hitEnemy(e, { id: 'hammers', name: D.name, slot: 'wave', mult: D.mult, knock: D.knock, stun: D.stun, outward: true, noEl: h.hit.has(e) }, p)) h.hit.set(e, c.t);
        }
      }
    }
    p.hamCasts = p.hamCasts.filter(c => c.t < c.def.spiral.life);
  }

  // ── 매 틀(updatePlayer) ── 차례로 떨어지는 빛기둥 · 도는 망치
  function update(p, dt) {
    if (!isPal(p)) return;
    if (p.beams && p.beams.length) {
      for (const b of p.beams) if ((b.t -= dt) <= 0 && !b.done) { b.done = true; beam(p, b); }
      p.beams = p.beams.filter(b => !b.done);
    }
    if (p.hamCasts && p.hamCasts.length) updateHammers(p, dt);
    if (World.mirror && p === World.player) mirrorHeal(p, dt);
  }

  // ── 그림 ──
  // 발밑: 신성력이 가득이면 금빛이 은은히
  function drawUnder(ctx, p, time) {
    if (!isPal(p) || p.dead || (p.holy || 0) < PALADIN.holyMax) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(time * 8); ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 12, 12 * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // 방패: 메이스를 들면 늘 몸 옆에 작게, 신성 돌진 중에는 앞에 크게 빛나며
  function drawShield(ctx, x, y, w, h, glow) {
    ctx.save();
    if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = glow; ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(x, y, w + 3, h + 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    ctx.fillStyle = '#1a1418'; ctx.beginPath(); ctx.ellipse(x, y, w + 1, h + 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8a840'; ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a5aa0'; ctx.beginPath(); ctx.ellipse(x, y, w - 1, h - 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4e8b0'; ctx.fillRect(Math.round(x) - 1, Math.round(y - h + 2), 2, Math.round(h * 2 - 4)); ctx.fillRect(Math.round(x - w + 2), Math.round(y) - 2, Math.round(w * 2 - 4), 2);  // 십자
    ctx.restore();
  }
  // 빛 망치 하나: 바닥 빛 타원(판정 hr 그대로) + 지나간 자리 잔빛 + 위에 도는 금빛 망치
  function drawHammer(ctx, h, hr, time) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    h.trail.forEach(([x, y], i) => { ctx.globalAlpha = 0.18 * (1 - i / 4); ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(x, y, hr * 0.7, hr * 0.7 * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 0.35; ctx.fillStyle = GOLD; ctx.beginPath(); ctx.ellipse(h.x, h.y, hr, hr * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.fillStyle = LIGHT; ctx.beginPath(); ctx.ellipse(h.x, h.y - 7, 5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(Math.round(h.x), Math.round(h.y - 7)); ctx.rotate(time * 14 + h.a0);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-1, -1, 2, 6);    // 자루
    ctx.fillStyle = '#1a1418'; ctx.fillRect(-4, -4, 8, 5);    // 머리 테
    ctx.fillStyle = GOLD; ctx.fillRect(-3, -3, 6, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -3, 2, 1);
    ctx.restore();
  }
  function drawOver(ctx, p, time, flip) {
    if (!isPal(p) || p.dead) return;
    const w = p.prof && p.prof.equip && p.prof.equip.weapon, wk = w ? WEAPON_KINDS[Items.base(w).kind] || {} : {};
    const a = p.state === 'act' && p.act, d = a && a.def;
    if (d && d.rush && a.time <= a.s + a.a) drawShield(ctx, p.x + p.fv.x * 8, p.y - 10 + p.fv.y * 4, 6, 8, 0.45 + 0.2 * Math.sin(time * 40));
    else if (wk.shield) drawShield(ctx, p.x + (flip ? 4 : -4), p.y - 8, 3, 4, 0);
    if (p.hamCasts) for (const c of p.hamCasts) for (const h of c.list) drawHammer(ctx, h, c.def.spiral.hr, time);
  }
  // 성역(world.js 장판 · art.js field): 바닥 금빛 타원(판정 f.r 그대로) · 안쪽을 도는 빛 고리 · 가운데 십자 · 솟는 빛 알갱이(모두 f.r 안)
  function drawField(ctx, f, time) {
    const fade = Math.min(1, (f.life - f.t) / 0.4, f.t / 0.15), P = Math.PI * 2;
    ctx.save();
    ctx.translate(f.x, f.y); ctx.scale(1, GROUND_Y);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, f.r);
    g.addColorStop(0, 'rgba(255,230,150,0.55)'); g.addColorStop(0.7, 'rgba(255,216,106,0.35)'); g.addColorStop(1, 'rgba(255,216,106,0)');
    ctx.globalAlpha = 0.6 * fade; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, f.r, 0, P); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const a = time * 1.2 + i * P / 4; ctx.globalAlpha = 0.55 * fade; ctx.beginPath(); ctx.arc(0, 0, f.r * 0.88, a, a + 0.9); ctx.stroke(); }
    ctx.globalAlpha = (0.35 + 0.15 * Math.sin(time * 5)) * fade; ctx.fillStyle = LIGHT;
    const cr = f.r * 0.35; ctx.fillRect(-2, -cr, 4, cr * 2); ctx.fillRect(-cr * 0.75, -3, cr * 1.5, 4);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = LIGHT;
    for (let i = 0; i < 10; i++) {  // 솟는 빛 알갱이: 자리는 f.r 안, 올라가며 사라짐
      const u = (time * 0.6 + i * 0.37 + f.seed) % 1, a = i * 2.4 + f.seed, rr = f.r * (0.2 + 0.7 * ((i * 0.61) % 1));
      ctx.globalAlpha = 0.7 * (1 - u) * fade;
      ctx.fillRect(Math.round(f.x + Math.cos(a) * rr), Math.round(f.y + Math.sin(a) * rr * GROUND_Y - u * 16), 1, 2);
    }
    ctx.restore();
  }

  return { gain, spend, rushEnd, consecrate, fieldUpdate, sanctumUp, judge, hammers, update, drawUnder, drawOver, drawField, isPal };
})();
