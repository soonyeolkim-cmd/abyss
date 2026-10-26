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
  hpMul *= RUN.party || 1;  // 파티 던전: 체력 ×1.6
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
    // 끝없는 심연 몹: under = 땅속 촉수가 땅속에 있음(자는 동안에도), blinkCd = 순간이동 기다림, wardT = 보호막 사제의 보호막이 남은 시간
    under: !!d.burrow, upT: 0, underT: 0, blinkCd: d.blink ? 1 + Math.random() * 2 : 0, wardT: 0,
  };
}

function updateEnemy(e, dt, room, p) {
  const d = e.def;
  e.flash = Math.max(0, e.flash - dt);
  e.armorT = Math.max(0, e.armorT - dt);
  e.wardT = Math.max(0, (e.wardT || 0) - dt);
  if (d.part && e.state !== 'dead') { Raid.part(e, dt, room, p); return; }  // 레이드 부품(공허 수정 · 구슬) — js/raid.js
  Elements.tick(e, dt);  // 화상 · 독 · 감전 · 냉기
  if (d.rooted) { e.kx = 0; e.ky = 0; }  // 땅속 촉수는 안 밀림(속성 폭발 밀어내기도)
  if (d.burrow && !e.under && e.awake) e.upT += dt;  // 솟아 있는 시간(내리치는 동안도 센다)
  if (e.kx || e.ky) {
    mobMove(room, e, e.kx * dt, e.ky * dt);
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
        if (e.t <= 0) {
          e.state = 'recover'; e.t = atk.recovery;
          if (d.shield) World.text(e.x, e.y, e.h + 4, '틈!', '#5fe0d0');  // 방패병: 휘두른 뒤 방패가 내려감 — 앞에서도 맞는다
        }
      }
      break;
    case 'recover':
      e.t -= dt;
      if (e.t <= 0) { e.state = 'move'; e.atkCd = (0.6 + Math.random() * 0.9) * (d.cdMul || 1); }  // cdMul = 끝없는 심연 중간 보스(더 자주)
      break;
    // ── 보스 패턴 ──
    case 'slam':
      e.t -= dt;
      if (e.t <= 0) {
        World.shake(4);
        World.dust(e.x, e.y, 14);
        World.fx({ type: 'shock', x: e.x, y: e.y, r: d.slam.radius, t: 0, life: 0.3 });
        if (groundDist(p.x - e.x, p.y - e.y) <= d.slam.radius + BODY_R) hurtPlayer(p, e, d.slam.dmg * e.dmgMul, 200);
        e.state = 'recover'; e.t = 0.8 * (d.recMul || 1);
        if (d.raid) Raid.slammed(e);  // 레이드 1단계: 내려찍기 3번이면 지쳐 심장이 드러남
      }
      break;
    case 'chargeWind':
      e.t -= dt;
      if (e.t <= 0) { e.state = 'charge'; e.t = d.charge.time; e.hitDone = false; }
      break;
    case 'charge':
      e.t -= dt;
      e.hitWall = false;
      mobMove(room, e, e.chargeV.x * d.charge.speed * dt, e.chargeV.y * d.charge.speed * dt);  // 보스 방 끝에 닿으면 벽처럼 멈춤
      if (!e.hitDone && Math.hypot(p.x - e.x, p.y - e.y) < e.r + BODY_R + 4) {
        e.hitDone = true;
        hurtPlayer(p, d.raid ? Raid.chargeSrc(e) : e, d.charge.dmg * e.dmgMul, 220);  // 레이드 껍질 패턴: 짓밟혀 기절
      }
      if (e.hitWall && d.raid && Raid.pillar(e, room)) {
        // 레이드 1단계: 기둥에 박으면 기둥이 부서지며 심장이 드러남(Raid.pillar 가 상태를 바꿈)
      } else if (e.hitWall) {
        e.state = 'tired'; e.t = 1.1;  // 벽에 박으면 멍해진다 — 때릴 기회
        World.shake(4); World.dust(e.x, e.y, 10);
        World.text(e.x, e.y, e.h + 6, '쿵!', '#ffd36a');
      } else if (e.t <= 0) { e.state = 'recover'; e.t = 0.5 * (d.recMul || 1); }
      break;
    case 'fan':
      e.t -= dt;
      if (e.t <= 0) {
        const n = d.fan.count;
        for (let k = 0; k < n; k++) shootAt(e, p, { shot: d.fan.speed, dmg: d.fan.dmg, knock: 90, color: d.fan.color }, n, k);
        e.state = 'recover'; e.t = 0.7 * (d.recMul || 1);
      }
      break;
    // ── 끝없는 심연 몹 ──
    case 'blinkOut':  // 순간이동자: 흩어지며 사라짐 → 노리는 사람 등 뒤로
      e.t -= dt;
      if (e.t <= 0) { blinkTo(e, room, p); e.state = 'blinkIn'; e.t = d.blink.inn; }
      break;
    case 'blinkIn':   // 나타나는 중(아직 안 맞음) → 바로 찌르기 준비
      e.t -= dt;
      if (e.t <= 0) { faceTo(e, p); e.state = 'windup'; e.windupT = e.t = atk.windup * e.windupMul; }
      break;
    case 'rise':      // 땅속 촉수: 바닥 예고(burrow.r 타원) 뒤 솟으며 그 자리를 친다
      e.t -= dt;
      if (e.t <= 0) {
        World.shake(2); World.dust(e.x, e.y, 8);
        if (!p.dead && groundDist(p.x - e.x, p.y - e.y) <= d.burrow.r + BODY_R) hurtPlayer(p, e, atk.dmg * e.dmgMul * 0.8, 160);
        e.state = 'move'; e.upT = 0; e.atkCd = 0.45;
      }
      break;
    case 'sink':      // 다시 땅속으로
      e.t -= dt;
      if (e.t <= 0) { e.under = true; e.underT = 0; e.state = 'move'; World.dust(e.x, e.y, 4); }
      break;
    case 'move':
      if (!e.awake) { e.moving = false; wakeCheck(e, room, p); break; }
      if (d.raid) Raid.think(e, dt, room, p); else if (d.boss) bossThink(e, dt, room, p); else if (d.burrow) tentacleThink(e, dt, room, p); else aiMove(e, dt, room, p);
      break;
    case 'dead':
      e.t += dt;
      break;
    default:
      if (d.raid) Raid.state(e, dt, room, p);  // 레이드 보스만의 상태(심장 노출 · 단계 바뀜 · 구슬 · 사방 탄)
  }
}

// 탄 쏘기: n 발을 부채꼴(60도)로 퍼뜨린다
function shootAt(e, p, atk, n, k) {
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  const a = n > 1 ? base + (k / (n - 1) - 0.5) * (Math.PI / 3) : base;
  World.shoot({ x: e.x, y: e.y - e.h * 0.5, vx: Math.cos(a) * atk.shot, vy: Math.sin(a) * atk.shot,
    dmg: atk.dmg * e.dmgMul, knock: atk.knock, color: atk.color, life: 3, r: 3, chill: !!(e.def.chillHit || e.affixes.includes('frost')),
    disarmT: e.disarmT || 0, disarmCut: e.disarmCut || 0 });  // 무장해제된 몹이 쏜 탄도 약하게
}

function faceTo(e, p) { e.fv = unit(p.x - e.x, p.y - e.y, e.fv); }
// 천천히 돌기(방패병: 등 뒤로 돌아 들어갈 틈) — 한 번에 max 라디안까지
function turnTo(e, p, max) {
  const cur = Math.atan2(e.fv.y, e.fv.x);
  let da = Math.atan2(p.y - e.y, p.x - e.x) - cur;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const a = cur + Math.max(-max, Math.min(max, da));
  e.fv = { x: Math.cos(a), y: Math.sin(a) };
}

// ── 끝없는 심연 몹 도우미 ──
// 지금 안 맞는 때: 땅속 · 솟는 중 · 들어가는 중(촉수), 사라지는 뒷부분 · 나타나는 중(순간이동자)
function untouchable(e) {
  return !!e.under || e.state === 'rise' || e.state === 'sink' || e.state === 'blinkIn' || (e.state === 'blinkOut' && e.t < e.def.blink.out * 0.5);
}
// 방패병: 방패가 올라가 있고(움직임 · 준비 · 휘두름) 친 사람이 앞(SHIELD.front)에 있으면 막는다. 마법진은 위에서 떨어져 넘는다
const SHIELD_UP = ['move', 'windup', 'attack'];
function shieldBlocks(e, p, def) {
  if (!e.def.shield || def.circle || !SHIELD_UP.includes(e.state)) return false;
  const tp = unit(p.x - e.x, p.y - e.y, e.fv);
  return e.fv.x * tp.x + e.fv.y * tp.y > SHIELD.front;
}
// 순간이동자: 노리는 사람 등 뒤(안 되면 옆 · 앞) 빈 자리로
function blinkTo(e, lv, p) {
  const f = p.fv || { x: 1, y: 0 };
  for (const [vx, vy] of [[-f.x, -f.y], [f.y, -f.x], [-f.y, f.x], [f.x, f.y]]) {
    const x = p.x + vx * 20, y = p.y + vy * 14;
    if (Dungeon.walkable(lv, x, y, e.r) && (!lv.roomMaps || Dungeon.roomIdx(lv, x, y) === e.ri)) { e.x = x; e.y = y; break; }
  }
  e.kx = 0; e.ky = 0;
  World.dust(e.x, e.y, 6);
}
// 땅속 촉수: 땅속에서 노리는 사람 쪽으로 파고들다 가까우면(또는 chase 초 지나면) 솟음 → up 초 동안 서서 내리치기 → 다시 땅속
function tentacleThink(e, dt, lv, p) {
  const d = e.def, B = d.burrow;
  e.moving = false;
  if (e.spawnT > 0) { e.spawnT -= dt; return; }
  if (p.dead) return;
  e.atkCd -= dt;
  const pd = Math.hypot(p.x - e.x, p.y - e.y);
  if (e.under) {
    if (pd > MOB_LEASH) return;  // 멀면 땅속에서 가만히
    e.underT += dt;
    if ((pd < 14 && e.underT > 0.8) || e.underT > B.chase) { e.under = false; e.state = 'rise'; e.t = e.windupT = B.rise; return; }  // 들어가자마자 다시 솟지는 않게
    const dir = Dungeon.los(lv, e.x, e.y - 4, p.x, p.y - 4) ? unit(p.x - e.x, p.y - e.y, e.fv) : World.flowDir(e);
    if (dir) { Dungeon.move(lv, e, dir.x * d.speed * dt, dir.y * d.speed * dt, e.r); e.moving = true; e.walkT += dt; }
    return;
  }
  faceTo(e, p);
  if (e.upT > B.up) { e.state = 'sink'; e.t = B.sink; return; }
  if (e.atkCd <= 0 && pd <= d.atk.reach[1] + 6) { e.state = 'windup'; e.windupT = e.t = d.atk.windup * e.windupMul; e.atkCd = 1.2; }
}

// 자는 몹: 플레이어가 가까이 오고 시야가 트이면 무리째 깨어난다(보스는 보스방에 들어와야)
function wakeCheck(e, lv, p) {
  if (e.def.boss || p.dead) return;
  const pd = Math.hypot(p.x - e.x, p.y - e.y);
  if (pd < WAKE_R && Dungeon.los(lv, e.x, e.y - 4, p.x, p.y - 4)) World.wake(e);
}

// 시야가 막혔거나 멀면 칸 길찾기(플레이어 쪽으로 거리가 줄어드는 칸)를 따라간다
// 보스는 자기 방(lv.boss) 밖으로 못 나간다(2026-10-26 사용자: 보스가 너무 멀리 나와 있음) — 방 끝은 벽처럼(돌진이면 멍해짐)
const inBossRoom = (lv, x, y) => !lv.boss || Dungeon.roomAt(lv, x, y) === lv.boss;
function mobMove(lv, e, dx, dy) {
  if (!e.def.boss) { Dungeon.move(lv, e, dx, dy, e.r); return; }
  const x = e.x, y = e.y;
  Dungeon.move(lv, e, dx, dy, e.r);
  if (!inBossRoom(lv, e.x, e.y)) { e.x = x; e.y = y; e.hitWall = true; }
}
function chase(e, dt, lv, p) {
  const dir = World.flowDir(e);
  if (!dir) return false;
  const step = e.def.speed * e.speedMul * dt;
  mobMove(lv, e, dir.x * step, dir.y * step);
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
  // 순간이동자: 보이고 조금 떨어져 있으면 사라졌다가 등 뒤로 — 한꺼번에 덤비는 수(maxAttackers) 안에서만(둘러싸고 기다리는 몹까지 다 날아오지 않게)
  if (d.blink && (e.blinkCd -= dt) <= 0 && see && pd > 36 && e.role === 'front' && World.attackers() < maxAttackers(e.lv || 1)) {
    e.state = 'blinkOut'; e.t = d.blink.out; e.blinkCd = d.blink.cd[0] + Math.random() * (d.blink.cd[1] - d.blink.cd[0]);
    return;
  }
  // 멀리 있는 몹은 깨어 있어도 제자리(2026-10-26 사용자: 내가 가까이 가기 전엔 안 움직이게 — 멀리서 함정을 밟고 다니지 않게)
  if (pd > MOB_LEASH) return;
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
  if (d.turn) turnTo(e, p, d.turn * dt); else faceTo(e, p);
  const facing = !d.turn || e.fv.x * (p.x - e.x) + e.fv.y * (p.y - e.y) > 0.8 * pd;  // 천천히 도는 몹은 마주 봐야 휘두른다
  const can = e.atkCd <= 0 && facing && World.attackers() < maxAttackers(e.lv || 1) + (d.ranged ? 1 : 0);
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
    e.atkCd = (1.2 + Math.random() * 0.8) * (d.cdMul || 1);
    return;
  }
  if (pd > 26) {
    if (!Dungeon.los(room, e.x, e.y - 4, p.x, p.y - 4) && chase(e, dt, room, p)) return;
    const step = d.speed * dt;
    mobMove(room, e, e.fv.x * step, e.fv.y * step);
    e.moving = true;
    e.walkT += dt;
  }
}

// 매 프레임 역할 나누기: 가까운 순 두 마리가 front, 두 번째가 같은 쪽이면 반대편으로 돈다
function assignRoles(list, p) {
  const live = list.filter(e => e.awake && !e.dying && e.state !== 'dead' && !e.def.ranged && !e.def.boss && !e.def.burrow && Math.hypot(e.x - p.x, e.y - p.y) < 140);  // 땅속 촉수는 제자리라 자리를 안 차지
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

function separateEnemies(list, room, ps) {
  // 화면 근처에서 깨어 있는 몹끼리만(멀리서 자는 몹은 계산하지 않는다). ps = 사람들(파티면 나 + 손님 몸들, 그 둘레 모두)
  const by = (e, q) => q && Math.abs(e.x - q.x) < 320 && Math.abs(e.y - q.y) < 220;
  const live = list.filter(e => e.awake && e.state !== 'dead' && e.state !== 'air' && e.state !== 'down' && !e.dying && !e.def.part && ps.some(q => by(e, q)));  // 레이드 부품은 안 밀림
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
