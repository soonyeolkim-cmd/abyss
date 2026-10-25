// 몹 · 보스. 상태: move · windup(공격 준비) · attack · recover · hurt · stagger · frozen(빙결) · air(뜸) · down · getup · dead
// 보스 전용: slam(내려찍기 준비) · chargeWind → charge(돌진) · fan(탄 부채꼴 준비) · tired(벽에 부딪혀 멍함)
// 디아블로식: 처음엔 자고 있다가(awake=false) 시야 안에 들어오면 무리째 깨어난다. 멀면 칸 길찾기로 쫓아온다.
// mods: { elite, unique(이름), affixes, pack, spawn(땅에서 솟는 연출) }
function createEnemy(type, x, y, lv, mods = {}) {
  const d = ENEMIES[type];
  const aff = mods.affixes || [];
  const rank = d.boss ? 'boss' : mods.unique ? 'unique' : mods.elite ? 'elite' : 'normal';
  const S = ENEMY_SCALE;
  const ramp = ENEMY_RAMP(lv);  // 레벨이 높을수록 몹만 더 세다(초반은 완만)
  const DF = DIFFS[RUN.diff] || DIFFS[0];  // 난이도 배율
  // 초반(Lv.30 까지) 약하게: 체력 · 공격 · 몹 방어 모두 처음 만든 때 느낌에서 천천히 올라감
  let hpMul = S.hp * POWER(lv) * ramp * DF.hp * EARLY_EASE(lv), dmgMul = S.dmg * POWER(lv) * Math.pow(ramp, RAMP_DMG) * DF.dmg * EARLY_EASE_DMG(lv), cut = ENEMY_CUT(lv) * earlyT(lv);
  // 던전마다 세기 맞춤(data.js DUNGEONS ease): hp · dmg = 몹, bhp · bdmg = 보스(없으면 몹 것)
  if (RUN.ease) {
    const E = RUN.ease, boss = rank === 'boss';
    hpMul *= (boss && E.bhp) || E.hp || 1; dmgMul *= (boss && E.bdmg) || E.dmg || 1;
  }
  if (rank === 'elite') { hpMul *= ELITE.hp; dmgMul *= ELITE.dmg; cut *= ELITE.def; }
  if (rank === 'unique') { hpMul *= UNIQUE.hp; dmgMul *= UNIQUE.dmg; cut *= UNIQUE.def; }
  if (rank === 'boss') cut *= S.bossDef;
  if (aff.includes('tough')) hpMul *= 1.5;
  const f = FRAMES[(d.idle ? d.sprite + '_idle_anim' : d.sprite + '_anim') + '_f0'];
  const uScale = rank === 'unique' ? UNIQUE.scale : 1, scale = (d.scale || 1) * uScale;  // d.scale = 그림 배율(거인 보스 · 작은 몹, 2026-10-25)
  const name = rank === 'unique' ? mods.unique : rank === 'elite' ? aff.map(a => AFFIXES[a].name).join(' ') + ' ' + d.name : d.name;
  return {
    type, def: d, x, y, z: 0, vz: 0, kx: 0, ky: 0, fv: { x: 0, y: 1 },
    // lv = 던전 레벨(초반 한꺼번에 덤비는 수에 씀)
    lv, hp: Math.round(d.hp * hpMul), maxHp: Math.round(d.hp * hpMul), dmgMul, armorCut: Math.min(0.65, cut),
    rank, affixes: aff, name, pack: mods.pack || null, scale,
    speedMul: aff.includes('fast') ? 1.5 : 1, windupMul: aff.includes('fast') ? 0.7 : 1,
    poise: (d.poise || 0) + (aff.includes('tough') ? 2 : 0) + (rank === 'unique' ? 2 : 0),
    awake: !!mods.awake, state: 'move', t: 0, atkCd: 0.6 + Math.random() * 0.8, windupT: 0.5,
    juggle: 0, otgUsed: false, dying: false, hitDone: false, chain: 0, armorT: 0,
    flash: 0, role: 'wait', slot: 0, slotAng: 0, moving: false,
    walkT: Math.random() * 5, spawnT: mods.spawn ? (d.boss ? 1.2 : 0.7) : 0,
    r: (d.r || 6) * uScale, h: (f ? f[3] : 16) * scale,  // 몸 반지름은 정해 둔 값(r) 그대로, 키는 그림 배율만큼
    patCd: 2, summoned: 0, chargeV: null,
  };
}

function updateEnemy(e, dt, room, p) {
  const d = e.def;
  e.flash = Math.max(0, e.flash - dt);
  e.armorT = Math.max(0, e.armorT - dt);
  Elements.tick(e, dt);  // 화상 · 독 · 감전 · 냉기
  if (e.kx || e.ky) {
    Dungeon.move(room, e, e.kx * dt, e.ky * dt, e.r);
    const f = Math.exp(-(e.state === 'air' ? 1.5 : 7) * dt);
    e.kx *= f; e.ky *= f;
    if (Math.hypot(e.kx, e.ky) < 2) { e.kx = 0; e.ky = 0; }
  }
  const atk = d.atk;
  switch (e.state) {
    case 'air':
      e.z += e.vz * dt;
      e.vz -= GRAVITY * (1 + 0.3 * e.juggle) * dt;
      if (e.z <= 0 && e.vz < 0) {
        e.z = 0; e.vz = 0;
        World.dust(e.x, e.y, 5);
        if (e.dying) { e.state = 'dead'; e.t = 0; }
        else { e.state = 'down'; e.t = 0.7; }
      }
      break;
    case 'down':
      e.t -= dt;
      if (e.t <= 0) { e.state = 'getup'; e.t = 0.3; }
      break;
    case 'getup':
      e.t -= dt;
      if (e.t <= 0) { e.state = 'move'; e.juggle = 0; e.otgUsed = false; e.atkCd = Math.max(e.atkCd, 0.4); }
      break;
    case 'hurt': case 'stagger': case 'tired': case 'frozen':
      e.t -= dt;
      if (e.t <= 0) e.state = 'move';
      break;
    case 'windup':
      e.t -= dt;
      if (e.t <= 0) {
        if (d.ranged) {
          shootAt(e, p, atk, 1, 0);
          e.state = 'recover'; e.t = atk.recovery;
        } else {
          e.state = 'attack'; e.t = atk.active; e.hitDone = false;
          e.kx = e.fv.x * atk.lunge; e.ky = e.fv.y * atk.lunge;
          World.fx({ type: 'swipe', x: e.x, y: e.y, fv: e.fv, r: atk.reach[1], t: 0, life: 0.15, enemy: true });
        }
      }
      break;
    case 'attack':
      if (!e.hitDone && inHitbox(e, e.fv, atk, p, BODY_R)) {
        e.hitDone = true;
        if (hurtPlayer(p, e, atk.dmg * e.dmgMul, atk.knock) === 'hit' && (e.affixes.includes('frost') || d.chillHit)) {
          p.slowT = 2;  // 냉기 강화: 맞으면 느려진다
          World.text(p.x, p.y, 40, '느려짐', '#9fe0ff');
        }
      }
      if (e.state === 'attack') {  // 맞는 동안 다른 상태(빙결 등)로 바뀌었으면 건너뛴다
        e.t -= dt;
        if (e.t <= 0) { e.state = 'recover'; e.t = atk.recovery; }
      }
      break;
    case 'recover':
      e.t -= dt;
      if (e.t <= 0) { e.state = 'move'; e.atkCd = 0.6 + Math.random() * 0.9; }
      break;
    // ── 보스 패턴 ──
    case 'slam':
      e.t -= dt;
      if (e.t <= 0) {
        World.shake(4);
        World.dust(e.x, e.y, 14);
        World.fx({ type: 'shock', x: e.x, y: e.y, r: d.slam.radius, t: 0, life: 0.3 });
        if (Math.hypot(p.x - e.x, p.y - e.y) <= d.slam.radius + BODY_R) hurtPlayer(p, e, d.slam.dmg * e.dmgMul, 200);
        e.state = 'recover'; e.t = 0.8;
      }
      break;
    case 'chargeWind':
      e.t -= dt;
      if (e.t <= 0) { e.state = 'charge'; e.t = d.charge.time; e.hitDone = false; }
      break;
    case 'charge':
      e.t -= dt;
      e.hitWall = false;
      Dungeon.move(room, e, e.chargeV.x * d.charge.speed * dt, e.chargeV.y * d.charge.speed * dt, e.r);
      if (!e.hitDone && Math.hypot(p.x - e.x, p.y - e.y) < e.r + BODY_R + 4) {
        e.hitDone = true;
        hurtPlayer(p, e, d.charge.dmg * e.dmgMul, 220);
      }
      if (e.hitWall) {
        e.state = 'tired'; e.t = 1.1;  // 벽에 박으면 멍해진다 — 때릴 기회
        World.shake(4); World.dust(e.x, e.y, 10);
        World.text(e.x, e.y, e.h + 6, '쿵!', '#ffd36a');
      } else if (e.t <= 0) { e.state = 'recover'; e.t = 0.5; }
      break;
    case 'fan':
      e.t -= dt;
      if (e.t <= 0) {
        const n = d.fan.count;
        for (let k = 0; k < n; k++) shootAt(e, p, { shot: d.fan.speed, dmg: d.fan.dmg, knock: 90, color: d.fan.color }, n, k);
        e.state = 'recover'; e.t = 0.7;
      }
      break;
    case 'move':
      if (!e.awake) { e.moving = false; wakeCheck(e, room, p); break; }
      if (d.boss) bossThink(e, dt, room, p); else aiMove(e, dt, room, p);
      break;
    case 'dead':
      e.t += dt;
      break;
  }
}

// 탄 쏘기: n 발을 부채꼴(60도)로 퍼뜨린다
function shootAt(e, p, atk, n, k) {
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  const a = n > 1 ? base + (k / (n - 1) - 0.5) * (Math.PI / 3) : base;
  World.shoot({ x: e.x, y: e.y - e.h * 0.5, vx: Math.cos(a) * atk.shot, vy: Math.sin(a) * atk.shot,
    dmg: atk.dmg * e.dmgMul, knock: atk.knock, color: atk.color, life: 3, r: 3, chill: !!(e.def.chillHit || e.affixes.includes('frost')) });
}

function faceTo(e, p) { e.fv = unit(p.x - e.x, p.y - e.y, e.fv); }

// 자는 몹: 플레이어가 가까이 오고 시야가 트이면 무리째 깨어난다(보스는 보스방에 들어와야)
function wakeCheck(e, lv, p) {
  if (e.def.boss || p.dead) return;
  const pd = Math.hypot(p.x - e.x, p.y - e.y);
  if (pd < WAKE_R && Dungeon.los(lv, e.x, e.y - 4, p.x, p.y - 4)) World.wake(e);
}

// 시야가 막혔거나 멀면 칸 길찾기(플레이어 쪽으로 거리가 줄어드는 칸)를 따라간다
function chase(e, dt, lv, p) {
  const dir = World.flowDir(e);
  if (!dir) return false;
  const step = e.def.speed * e.speedMul * dt;
  Dungeon.move(lv, e, dir.x * step, dir.y * step, e.r);
  e.fv = dir;
  e.moving = true;
  e.walkT += dt;
  return true;
}

// 가까운 두 마리(front)는 플레이어 양쪽을 잡고 덤비고, 나머지(wait)는 거리를 두고 둘러싼다. 원거리는 거리를 유지하며 쏜다.
function aiMove(e, dt, room, p) {
  const d = e.def;
  e.moving = false;
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  e.atkCd -= dt;
  if (p.dead) return;
  const pd = Math.hypot(p.x - e.x, p.y - e.y);
  const see = pd < 150 && Dungeon.los(room, e.x, e.y - 4, p.x, p.y - 4);
  if (!see || pd > 110) { if (chase(e, dt, room, p)) return; }
  let wx, wy;
  if (d.ranged) {
    const away = unit(e.x - p.x, e.y - p.y, { x: 1, y: 0 });
    const want = pd < d.range - 20 ? d.range + 10 : pd > d.range + 30 ? d.range : pd;
    wx = p.x + away.x * want; wy = p.y + away.y * want;
  } else {
    const R = e.role === 'front' ? d.range : 60 + e.slot * 10;
    wx = p.x + Math.cos(e.slotAng) * R; wy = p.y + Math.sin(e.slotAng) * R;
  }
  const dx = wx - e.x, dy = wy - e.y, dist = Math.hypot(dx, dy);
  if (dist > 3) {
    const step = Math.min(dist, d.speed * e.speedMul * dt);
    Dungeon.move(room, e, dx / dist * step, dy / dist * step, e.r);
    e.moving = true;
    e.walkT += dt;
  }
  faceTo(e, p);
  const can = e.atkCd <= 0 && World.attackers() < maxAttackers(e.lv || 1) + (d.ranged ? 1 : 0);
  if (can && see && (d.ranged ? pd < d.range + 40 : e.role === 'front' && pd <= d.atk.reach[1] + 6)) {
    e.state = 'windup'; e.windupT = e.t = d.atk.windup * e.windupMul;
  }
}

// 보스: 가까우면 휘두르기 · 내려찍기, 멀면 돌진 · 탄, 체력이 줄면 졸개 부르기
function bossThink(e, dt, room, p) {
  const d = e.def;
  e.moving = false;
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  if (p.dead) return;
  e.atkCd -= dt;
  const pd = Math.hypot(p.x - e.x, p.y - e.y);
  faceTo(e, p);
  const k = e.hp / e.maxHp;
  if (d.summon && ((e.summoned === 0 && k < 0.66) || (e.summoned === 1 && k < 0.33))) {
    e.summoned++;
    World.text(e.x, e.y, e.h + 8, '크아아!', '#ff6a5a');
    World.shake(3);
    World.summon(d.summon, e, 3);
    e.state = 'recover'; e.t = 0.8;
    return;
  }
  if (e.atkCd <= 0) {
    const r = Math.random();
    if (pd < 44) {
      if (r < 0.5) { e.state = 'slam'; e.t = d.slam.windup; e.windupT = e.t; }
      else { e.state = 'windup'; e.windupT = e.t = d.atk.windup; }
    } else if (d.fan && r < 0.45) { e.state = 'fan'; e.t = d.fan.windup; e.windupT = e.t; }
    else { e.state = 'chargeWind'; e.t = d.charge.windup; e.windupT = e.t; e.chargeV = { x: e.fv.x, y: e.fv.y }; }
    e.atkCd = 1.2 + Math.random() * 0.8;
    return;
  }
  if (pd > 26) {
    if (!Dungeon.los(room, e.x, e.y - 4, p.x, p.y - 4) && chase(e, dt, room, p)) return;
    const step = d.speed * dt;
    Dungeon.move(room, e, e.fv.x * step, e.fv.y * step, e.r);
    e.moving = true;
    e.walkT += dt;
  }
}

// 매 프레임 역할 나누기: 가까운 순 두 마리가 front, 두 번째가 같은 쪽이면 반대편으로 돈다
function assignRoles(list, p) {
  const live = list.filter(e => e.awake && !e.dying && e.state !== 'dead' && !e.def.ranged && !e.def.boss && Math.hypot(e.x - p.x, e.y - p.y) < 140);
  live.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
  let fronts = 0, slot = 0, firstAng = null;
  for (const e of live) {
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    if (fronts < maxAttackers(e.lv || 1)) {
      let a = e.role === 'front' ? e.slotAng : ang;
      if (firstAng !== null && Math.abs(Math.atan2(Math.sin(a - firstAng), Math.cos(a - firstAng))) < Math.PI / 2) a = firstAng + Math.PI;
      if (firstAng === null) firstAng = a;
      e.role = 'front'; e.slotAng = a; fronts++;
    } else { e.role = 'wait'; e.slot = slot++; e.slotAng = ang; }
  }
}

function separateEnemies(list, room, p) {
  // 화면 근처에서 깨어 있는 몹끼리만(멀리서 자는 몹은 계산하지 않는다)
  const live = list.filter(e => e.awake && e.state !== 'dead' && e.state !== 'air' && e.state !== 'down' && !e.dying && Math.abs(e.x - p.x) < 320 && Math.abs(e.y - p.y) < 220);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), min = a.r + b.r + 2;
    if (dist < min && dist > 0.001) {
      const push = (min - dist) * 0.25;
      Dungeon.move(room, a, -dx / dist * push, -dy / dist * push, a.r);
      Dungeon.move(room, b, dx / dist * push, dy / dist * push, b.r);
    }
  }
}
