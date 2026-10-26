// 끝없는 심연 최종 보스 레이드 '심연의 파수꾼'(2026-10-26 사용자) — 규칙 · 수치는 data.js RAID_RULE.
// 3층 중간 보스를 깨고 계단에서 '최종 보스 도전' → 넓은 방 하나(level). 체력 66 · 33% 에서 단계가 바뀐다(begin):
//   ① 껍질 ② 수정 보호막 ③ 되받아치기. 약점(청록 심장)이 드러난(exposed) 동안만 제대로 맞는다 — 어느 쪽 · 어떤 공격이든(혼자 · 어떤 직업이든 깰 수 있게).
// 공허 수정 · 공허 구슬은 몹처럼 다룬다(def.part — 파티 소식 · 맞히기를 그대로 씀, 경험치 · 전리품은 없음).
// 방장 · 혼자가 계산하고(think · state · part), 파티 손님은 몹 소식으로 따라 그린다(drawPart · drawBoss).
const Raid = (() => {
  const R = RAID_RULE, TEAL = '#5fe0d0', VOID = '#c06aff';
  const live = e => !e.dying && e.state !== 'dead';
  const parts = kind => World.enemies().filter(e => e.def.part === kind && live(e));
  const bossOf = () => World.enemies().find(e => e.def.raid && live(e));
  const phaseOf = e => (e.hp > e.maxHp * 0.66 ? 1 : e.hp > e.maxHp * 0.33 ? 2 : 3);
  const PHASE = ['', '1단계 · 껍질', '2단계 · 수정 보호막', '3단계 · 되받아치기'];

  // ── 방: 넓은 방 하나 + 기둥 넷(1단계: 돌진을 기둥에 부딪히게 하면 기둥이 깨지며 심장이 드러남) ──
  function level(def) {
    const RW = 40, RH = 24, G = 4, W = RW + G * 2, H = RH + G * 2;
    const tiles = new Uint8Array(W * H);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : tiles[y * W + x]);
    const r = { x: G, y: G, w: RW, h: RH, cx: G + (RW >> 1), cy: G + (RH >> 1), boss: true, main: true, branch: false, order: 0, gx: 0, gy: 0, doors: [] };
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y * W + x] = 1;
    const lv = { def, W, H, tiles, rooms: [r], at, drops: [], chests: [], columns: [], stairs: null, roomMaps: true, cleared: new Set([0]), visited: new Set([0]) };
    lv.boss = r; lv.start = { cx: r.cx, cy: r.y + r.h - 3 };  // 아래 가운데로 들어와 위의 파수꾼을 마주 본다
    lv.explored = new Uint8Array(W * H);
    for (const [dx, dy] of [[-11, -5], [11, -5], [-11, 5], [11, 5]]) lv.columns.push([r.cx + dx, r.cy + dy]);
    lv.crates = new Set();
    lv.decor = { skulls: [], banners: new Set() };
    lv.canvas = Dungeon.paint(lv);
    return lv;
  }
  const bossSpot = lv => ({ x: lv.boss.cx * T + 8, y: (lv.boss.y + 6) * T });

  // 보스 머리 위 큰 글(파티 손님에게도) + 내 화면 가운데 알림
  function say(e, s, col = TEAL) { World.text(e.x, e.y, e.h + 14, s, col, true); World.say(s, 2.6); }

  // ── 단계 ──
  function begin(e, ph) {
    const first = !e.phase;
    e.phase = ph; e.slams = 0;
    if (first) { say(e, '껍질이 단단하다 — 내려찍기 뒤 · 기둥에 부딪힐 때 심장을 노려라'); return; }
    e.state = 'phaseShift'; e.t = 1.6; e.windupT = 1.6;
    World.shake(6); World.dust(e.x, e.y, 16); Sfx.roar();
    for (const o of parts('orb')) pop(o);
    if (ph === 2) { spawnCrystals(e); World.summon(e.def.summon, e, 3); say(e, '수정 보호막 — 네 귀퉁이 공허 수정을 모두 부숴라'); }
    if (ph === 3) { for (const c of parts('crystal')) { c.dying = true; c.hp = 0; c.state = 'dead'; c.t = 0; } say(e, '공허 구슬 — 쳐서 되돌려라!'); }
  }
  function spawnCrystals(e) {
    if (parts('crystal').length) return;
    const r = World.level.boss;
    for (const [x, y] of [[r.x + 3, r.y + 3], [r.x + r.w - 4, r.y + 3], [r.x + 3, r.y + r.h - 3], [r.x + r.w - 4, r.y + r.h - 3]]) World.spawn('void_crystal', x * T + 8, y * T + 8, { spawn: true });
    Sfx.spell();
  }
  function expose(b, sec, why) {
    b.state = 'exposed'; b.t = sec; b.windupT = sec; b.slams = 0; b.kx = 0; b.ky = 0;
    World.shake(4); World.sparks(b.x, b.y, b.h * 0.55, 18, TEAL, true);
    World.text(b.x, b.y, b.h + 6, (why ? why + ' ' : '') + '심장이 드러났다!', TEAL, true);
    Sfx.chest();
  }

  // ── 보스 생각(움직임 상태일 때) ──
  function think(e, dt, lv, p) {
    const d = e.def;
    e.moving = false;
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (p.dead) return;
    if (!e.phase) begin(e, 1);
    const ph = phaseOf(e);
    if (ph !== e.phase) { begin(e, ph); return; }
    faceTo(e, p);
    if (e.phase === 2 && !parts('crystal').length && (e.crystalT -= dt) <= 0) spawnCrystals(e);
    e.atkCd -= dt;
    const pd = Math.hypot(p.x - e.x, p.y - e.y);
    if (e.atkCd <= 0) { attack(e, lv, p, pd); return; }
    if (pd > 46) { const step = d.speed * dt; Dungeon.move(lv, e, e.fv.x * step, e.fv.y * step, e.r); e.moving = true; e.walkT += dt; }
  }
  function attack(e, lv, p, pd) {
    const d = e.def, r = Math.random(), near = pd < 64;
    const slam = () => { e.state = 'slam'; e.t = e.windupT = d.slam.windup; };
    if (e.phase === 1) {  // 내려찍기(R.slams 번이면 지침) · 휘두르기 · 멀면 돌진(기둥에 부딪히게)
      if (near) { if (r < 0.7) slam(); else { e.state = 'windup'; e.t = e.windupT = d.atk.windup; } }
      else if (r < 0.75) { e.state = 'chargeWind'; e.t = e.windupT = d.charge.windup; e.chargeV = unit(p.x - e.x, p.y - e.y, e.fv); }
      else slam();
      e.atkCd = 1.0 + Math.random() * 0.7;
    } else if (e.phase === 2) {  // 공허 장판 · 탄 부채꼴 · 가까우면 내려찍기
      if (r < 0.4) puddles(e, p);
      else if (near) slam();
      else { e.state = 'fan'; e.t = e.windupT = d.fan.windup; }
      e.atkCd = 1.3 + Math.random() * 0.7;
    } else {  // 공허 구슬(하나씩) · 사방 탄 · 가까우면 내려찍기
      if (!parts('orb').length && r < 0.7) { e.state = 'orbWind'; e.t = e.windupT = 0.8; }
      else if (near && r < 0.85) slam();
      else { e.state = 'ringWind'; e.t = e.windupT = 0.6; }
      e.atkCd = 1.5 + Math.random() * 0.7;
    }
  }
  // 공허 장판: 노리는 사람 발밑 + 둘레 둘에 예고(바닥 타원 = 판정) 뒤 터짐
  function puddles(e, p) {
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2, dd = k ? 26 + Math.random() * 14 : 0;
      World.field({ blast: true, voidBlast: true, x: p.x + Math.cos(a) * dd, y: p.y + Math.sin(a) * dd * 0.6, r: 24, el: '', tick: 99, delay: 1.0 + k * 0.15, life: 1.4 + k * 0.15, dmg: e.def.slam.dmg * e.dmgMul * 0.8 });
    }
    e.state = 'recover'; e.t = 0.6;
    Sfx.spell();
  }
  function ring(e) {
    const n = 16, sp = e.def.fan.speed, off = Math.random() * Math.PI;
    for (let k = 0; k < n; k++) {
      const a = off + k / n * Math.PI * 2;
      World.shoot({ x: e.x, y: e.y - e.h * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: e.def.fan.dmg * e.dmgMul, knock: 90, color: VOID, life: 3, r: 3 });
    }
  }
  function throwOrb(e, p) {
    const o = World.spawn('void_orb', e.x + e.fv.x * 10, e.y + 2, {});
    const u = unit(p.x - o.x, p.y - o.y, e.fv);
    o.vx = u.x * R.orbSpeed; o.vy = u.y * R.orbSpeed; o.life = 8; o.rally = 0; o.h = 14; o.boss = e; o.state = 'move';
    Sfx.blast();
  }

  // 보스의 레이드 상태(enemy.js updateEnemy 가 모르는 상태)
  function state(e, dt, lv, p) {
    switch (e.state) {
      case 'exposed':
        e.t -= dt;
        if (e.t <= 0) { e.state = 'move'; e.atkCd = 0.8; if (e.phase === 2) e.crystalT = R.crystalBack; }
        break;
      case 'phaseShift':
        e.t -= dt;
        if (e.t <= 0) { e.state = 'move'; e.atkCd = 1; }
        break;
      case 'orbWind':
        e.t -= dt;
        if (e.t <= 0) { throwOrb(e, p); e.state = 'recover'; e.t = 0.7; }
        break;
      case 'ringWind':
        e.t -= dt;
        if (e.t <= 0) { ring(e); Sfx.blast(); e.state = 'recover'; e.t = 0.7; }
        break;
    }
  }
  // enemy.js 고리: 내려찍기가 끝남(1단계: slams 번이면 지침) · 돌진이 벽에 박힘(기둥이면 부서짐)
  function slammed(e) {
    if (e.phase !== 1) return;
    if (++e.slams >= R.slams) expose(e, R.slamExpose, '지쳤다 —');
  }
  function pillar(e, lv) {
    if (e.phase !== 1) return false;
    const i = lv.columns.findIndex(c => Math.hypot(c[0] * T + 8 - e.x, c[1] * T + 12 - e.y) < e.r + 18);
    if (i < 0) return false;
    const c = lv.columns.splice(i, 1)[0];
    World.dust(c[0] * T + 8, c[1] * T + 12, 16); World.shake(6);
    World.text(c[0] * T + 8, c[1] * T + 12, 30, '기둥이 무너졌다!', '#ffd36a', true);
    expose(e, R.pillarExpose);
    return true;
  }

  // ── 부품(수정 · 구슬) ──
  function part(e, dt, lv, p) {
    e.walkT += dt;
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (e.def.part === 'crystal') return;  // 가만히 — 다 부수면 보스 보호막이 꺼진다(partDied)
    const b = (e.boss && live(e.boss) && e.boss) || bossOf();
    if (!b || (e.life -= dt) <= 0) { pop(e); return; }
    if (e.state === 'back') {  // 되돌아가는 구슬: 보스 심장 쪽으로 휘어 감
      const sp = Math.hypot(e.vx, e.vy), u = unit(b.x - e.x, b.y - e.y, { x: 0, y: -1 });
      e.vx = u.x * sp; e.vy = u.y * sp;
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r + 2) { bossHit(b, e); return; }
    } else if (p && !p.dead && Math.hypot(p.x - e.x, p.y - e.y) < e.r + BODY_R + 2) {
      if (hurtPlayer(p, e, b.def.atk.dmg * b.dmgMul * R.orbDmg, 200) !== 'miss') { pop(e); return; }  // 대시 무적이면 지나감
    }
    e.x += e.vx * dt; e.y += e.vy * dt;
    if (!Dungeon.walkable(lv, e.x, e.y, 2)) pop(e);
  }
  // 플레이어 공격이 구슬에 맞음(combat.js hitEnemy) — 어떤 공격이든 보스 쪽으로 되돌린다
  function reflect(o) {
    if (o.state !== 'move') return false;
    const b = (o.boss && live(o.boss) && o.boss) || bossOf();
    if (!b) return false;
    const sp = Math.hypot(o.vx, o.vy) * R.orbBack, u = unit(b.x - o.x, b.y - o.y, { x: 0, y: -1 });
    o.vx = u.x * sp; o.vy = u.y * sp; o.state = 'back'; o.life = 8; o.flash = 0.12;
    World.sparks(o.x, o.y, 14, 12, TEAL, true); World.impact(o.x, o.y, 14, 12);
    World.text(o.x, o.y, 26, '되받아침!', TEAL);
    World.hitstop(0.06); Sfx.hit(true);
    return true;
  }
  function bossHit(b, o) {
    if (b.state === 'phaseShift') { pop(o); return; }
    if (o.rally < R.rallyMax && Math.random() < R.rallyChance) {  // 보스가 다시 쳐 냄 — 점점 빨라짐
      const t = b.tgt || World.player, sp = Math.hypot(o.vx, o.vy) * R.orbBack, u = unit(t.x - o.x, t.y - o.y, { x: 0, y: 1 });
      o.vx = u.x * sp; o.vy = u.y * sp; o.state = 'move'; o.rally++; o.life = 8;
      faceTo(b, t);
      World.text(b.x, b.y, b.h + 8, '되받아쳤다! (' + o.rally + ')', VOID);
      World.sparks(o.x, o.y, 14, 10, VOID, true); Sfx.hit(false);
      return;
    }
    pop(o);
    expose(b, R.orbExpose, '휘청 —');
  }
  function pop(o) {
    if (!live(o)) return;
    World.sparks(o.x, o.y, 14, 12, o.state === 'back' ? TEAL : VOID, true);
    o.dying = true; o.hp = 0; o.state = 'dead'; o.t = 0.9;  // 곧 사라짐(world.js 가 1.2초 넘은 쓰러진 몹을 지움)
  }
  // 부품이 쓰러짐(world.js onKill — 경험치 · 전리품 없이)
  function partDied(e) {
    if (e.def.part !== 'crystal') return;
    World.sparks(e.x, e.y, 10, 16, TEAL, true); Sfx.stone();
    const b = bossOf();
    if (b && b.phase === 2 && !parts('crystal').length && b.state !== 'phaseShift') expose(b, R.crystalExpose, '보호막이 꺼졌다 —');
  }

  // ── 피해(combat.js hitEnemy · elements.js damage) ──
  // [배율, 알림 글] — 단계 바뀌는 중 · 보호막 = 0, 심장 = exposedMul, 그 밖 = 껍질
  function cut(e) {
    if (e.state === 'phaseShift' || e.spawnT > 0) return [0, '무적'];
    if (e.state === 'exposed') return [R.exposedMul, ''];
    if (e.phase === 2 && parts('crystal').length) return [0, '보호막'];
    return [R.shellCut, '팅!'];
  }
  // 한 번에 단계를 건너뛰지 않게: 다음 단계 문턱(66 · 33%)에서 멈춘다 → 다음 생각에서 단계가 바뀜
  function clamp(e) {
    const thr = e.phase === 1 ? 0.66 : e.phase === 2 ? 0.33 : 0;
    if (thr && e.hp < e.maxHp * thr) e.hp = e.maxHp * thr;
  }

  // ── 그리기 ──
  // 보스 몸 위: 심장 빛(드러났을 때) · 2단계 수정 보호막 막
  function drawBoss(ctx, e, x, y, time) {
    if (e.state === 'dead') return;
    if (e.state === 'exposed') {
      const hx = x, hy = y - e.h * 0.43, r = 9 + Math.sin(time * 10) * 2, g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
      g.addColorStop(0, 'rgba(95,224,208,0.8)'); g.addColorStop(1, 'rgba(95,224,208,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(hx - r, hy - r, r * 2, r * 2); ctx.restore();
    }
    if (parts('crystal').length) {
      const k = 0.5 + 0.5 * Math.sin(time * 4);
      ctx.save();
      ctx.strokeStyle = 'rgba(95,224,208,' + (0.45 + 0.3 * k) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y - e.h / 2), e.r + 12, e.h / 2 + 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(95,224,208,' + (0.06 + 0.05 * k) + ')'; ctx.fill();
      ctx.restore();
    }
  }
  function drawPart(ctx, e, time) {
    const x = Math.round(e.x), y = Math.round(e.y);
    if (e.def.part === 'crystal') {
      const b = bossOf();
      if (b && live(e)) {  // 보호막 줄: 수정 → 보스(점선이 보스 쪽으로 흐름)
        ctx.save();
        ctx.strokeStyle = 'rgba(95,224,208,' + (0.3 + 0.2 * Math.sin(time * 5 + x)) + ')'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]); ctx.lineDashOffset = -time * 14;
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(b.x, b.y - b.h / 2); ctx.stroke();
        ctx.restore();
      }
      const o = { flash: e.flash > 0 ? '#ffffff' : false, alpha: e.state === 'dead' ? Math.max(0, 1 - e.t / 0.6) : e.spawnT > 0 ? 1 - Math.min(1, e.spawnT / 0.7) : 1 };
      Gfx.spr(ctx, 'void_crystal_anim_f0', x, y + (e.state === 'dead' ? Math.round(e.t * 8) : 0), o);
      if (live(e)) {  // 위로 피어오르는 청록 빛
        ctx.fillStyle = TEAL;
        for (let i = 0; i < 2; i++) { const k = (time * 0.8 + i * 0.5 + x * 0.01) % 1; ctx.globalAlpha = 1 - k; ctx.fillRect(x - 2 + i * 4, Math.round(y - 14 - k * 10), 1, 1); }
        ctx.globalAlpha = 1;
      }
      return true;
    }
    // 공허 구슬: 떠 있는 보랏빛 공(되돌아가는 중 = 청록), 바닥엔 그림자
    if (e.state === 'dead') return true;
    const back = e.state === 'back', col = back ? TEAL : VOID, cy = y - 14, k = 0.5 + 0.5 * Math.sin(time * 18);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, e.r + 6);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5 + 0.2 * k; ctx.fillStyle = g; ctx.fillRect(x - e.r - 6, cy - e.r - 6, (e.r + 6) * 2, (e.r + 6) * 2);
    ctx.restore();
    ctx.fillStyle = '#120a14'; ctx.beginPath(); ctx.arc(x, cy, e.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = back ? '#2a8a88' : '#4a2a5a'; ctx.beginPath(); ctx.arc(x, cy, e.r - 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, cy, 3 + k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, cy - 4, 2, 1);
    return true;
  }
  // HUD: 보스 막대 위 단계 금(66 · 33%) · 아래 단계 이름 · 남은 시간 · 지금 할 일
  function hud(ctx, b) {
    for (const k of [0.66, 0.33]) { ctx.fillStyle = '#f0e0b8'; ctx.fillRect(Math.round(330 + 300 * k), 48, 2, 12); }
    const ph = b.phase || phaseOf(b), left = Math.max(0, R.time - World.raidTime);
    const tip = b.state === 'exposed' ? '심장이 드러났다 — 지금!' : b.state === 'phaseShift' ? '단계가 바뀐다' : ph === 1 ? '내려찍기 ' + R.slams + '번 뒤 · 기둥 돌진에 틈'
      : ph === 2 ? (parts('crystal').length ? '공허 수정 ' + parts('crystal').length + '개 남음' : '수정이 다시 생긴다') : '구슬을 쳐서 되돌려라';
    Gfx.text(ctx, PHASE[ph] + ' — ' + tip, 480, 76, 13, b.state === 'exposed' && Math.floor(performance.now() / 150) % 2 ? '#ffffff' : TEAL, 'center');
    Gfx.text(ctx, '남은 시간 ' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'), 640, 58, 13, left < 30 ? '#ff6a5a' : '#f0e0b8');
  }

  return { level, bossSpot, think, state, slammed, pillar, part, reflect, partDied, cut, clamp, drawBoss, drawPart, hud, PHASE };
})();
