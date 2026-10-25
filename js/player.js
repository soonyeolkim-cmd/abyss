// 플레이어(검사). 상태: idle · walk · act(공격/기술) · dodge(대시) · hurt · dead
// 버튼 5개: 기본 공격(3타) · 대시(→ 공격 = 대시 찌르기) · 회전베기(누르면 바로, 2026-10-24 사용자: 길게 누르는 차지는 게임 중 사실상 못 써서) · 특수기(섬광 검기) · 물약
// fv = 바라보는 방향(길이 1). 무기 종류 · 공격 속도에 따라 동작이 빨라지거나 느려진다.
function createPlayer(prof) {
  const C = clsOf(prof);  // 검사 · 마법사
  const stats = Items.playerStats(prof);
  return {
    cls: C, prof, stats, x: 0, y: 0, z: 0, kx: 0, ky: 0, fv: { x: 0, y: 1 },
    hp: stats.hp, maxHp: stats.hp, sp: stats.sp, maxSp: stats.sp, spDelay: 0, spWarnT: 0,
    state: 'idle', t: 0, act: null, walkT: 0,
    buffer: null, bufferT: 0,
    iframes: 0, dodgeCd: 0, dodgeV: { x: 0, y: 1 }, dashAtkT: 0,
    specialCd: 0, potionCd: 0, flash: 0, dead: false, deadT: 0,
    holdT: 0, charge: 0,
  };
}

// 장비를 바꾸면 능력치 다시 계산(체력 비율 유지)
function refreshStats(p) {
  const k = p.hp / p.maxHp;
  p.stats = Items.playerStats(p.prof);
  p.maxHp = p.stats.hp;
  p.hp = Math.max(1, Math.round(p.maxHp * k));
  p.maxSp = p.stats.sp;
  p.sp = Math.min(p.sp, p.maxSp);
}

// 대시에 드는 기력(신발 '대시 기력 -%' 만큼 줄어듦)
const dashCost = p => Math.round(p.cls.dodge.cost * (1 - (p.stats.dashCost || 0) / 100));

// 기력 쓰기: 모자라면 '기력 부족'을 띄우고 false
function spend(p, n) {
  if (p.sp < n) {
    if (p.spWarnT <= 0) { World.text(p.x, p.y, 40, '기력 부족', '#7fb8ff'); p.spWarnT = 0.8; }
    return false;
  }
  p.sp -= n;
  p.spDelay = p.cls.stamina.delay;
  return true;
}

// p = 누구의 입력인가: 파티 방장 쪽 손님 몸(remote)은 손님이 보낸 스틱 값, 내 몸은 키보드 · 패드 · 터치(창이 열려 있으면 없음)
function moveInput(p) {
  if (p && p.remote) return p.rmove || null;
  if (World.inputLock) return null;
  const m = Input.move();
  if (!m.x && !m.y) return null;
  const l = Math.hypot(m.x, m.y);
  const k = Math.min(1, l) / l;
  return { x: m.x * k, y: m.y * k };
}

// 입력은 화면 프레임마다 받아 둔다(경직 · 히트스톱 중에도 다음 동작이 씹히지 않게)
function bufferPlayerInput(p) {
  for (const a of ['attack', 'dodge', 'charge', 'special']) {
    if (a === 'attack' && Coop.canRevive()) continue;  // 파티: 쓰러진 친구 옆에서는 공격 버튼 = 살리기(누르고 있기)
    if (Input.wasPressed(a)) { p.buffer = a; p.bufferT = 0.2; }
  }
  if (Input.wasPressed('potion')) p.potionReq = 0.2;  // 물약은 동작과 따로: 공격 · 대시 · 경직 중에도 바로 마신다
}
// 동작 이름 → 기술(파티: 손님이 보낸 동작을 방장 쪽 손님 몸이 할 때)
function actDef(C, kind, idx) {
  if (kind === 'combo') return C.combo[idx] || C.combo[0];
  if (kind === 'dashAtk') return C.dashAttack;
  if (kind === 'charge') return C.charge.def;
  if (kind === 'special') return C.special;
  return null;
}

function updatePlayer(p, dt, room, gates) {
  const C = p.cls;
  p.specialCd = Math.max(0, p.specialCd - dt);
  p.spWarnT -= dt;
  p.spDelay -= dt;
  if (p.spDelay <= 0 && !p.dead) p.sp = Math.min(p.maxSp, p.sp + C.stamina.regen * (1 + p.stats.spRegen / 100) * dt);  // 기력 회복(갑옷 '기력 회복 속도'만큼 빠르게)
  p.dodgeCd = Math.max(0, p.dodgeCd - dt);
  p.dashAtkT = Math.max(0, p.dashAtkT - dt);
  p.potionCd = Math.max(0, p.potionCd - dt);
  p.leafT = Math.max(0, (p.leafT || 0) - dt);    // 유니크 잎사귀 방패 다시 생기기까지
  p.guardT = Math.max(0, (p.guardT || 0) - dt);  // 유니크 잔상 보호막 남은 시간
  if (p.echo) updateEcho(p, dt);
  p.slowT = Math.max(0, (p.slowT || 0) - dt);  // 냉기 강화 몹에게 맞으면 느려짐
  p.iframes = Math.max(0, p.iframes - dt);
  p.flash = Math.max(0, p.flash - dt);
  p.bufferT -= dt;
  if (p.bufferT <= 0) p.buffer = null;

  if (p.kx || p.ky) {
    Dungeon.move(room, p, p.kx * dt, p.ky * dt, BODY_R, false);
    const f = Math.exp(-8 * dt);
    p.kx *= f; p.ky *= f;
    if (Math.hypot(p.kx, p.ky) < 3) { p.kx = 0; p.ky = 0; }
  }
  if (p.dead) { p.deadT += dt; return; }
  if (p.potionReq > 0) { p.potionReq = drinkPotion(p) ? 0 : p.potionReq - dt; }


  switch (p.state) {
    case 'hurt':
      p.t -= dt;
      if (p.t <= 0) p.state = 'idle';
      break;
    case 'dodge':
      // 대시 중에 공격 = 대시 찌르기
      if (p.buffer === 'attack') { p.buffer = null; Elements.dashEnd(p); startAct(p, C.dashAttack, 'dashAtk', 0); break; }
      p.t -= dt;
      Dungeon.move(room, p, p.dodgeV.x * C.dodge.speed * dt, p.dodgeV.y * C.dodge.speed * dt, BODY_R, gates);
      Elements.dashMove(p, C.dodge.speed * dt);  // 대시 칸 속성석: 지나간 길
      if (p.t <= 0) { p.state = 'idle'; p.dashAtkT = C.dodge.attackWindow; Elements.dashEnd(p); }
      break;
    case 'act':
      updateAct(p, dt, room);
      break;
  }
  if (p.state === 'idle' || p.state === 'walk') freeControl(p, dt, room, gates);
}

function freeControl(p, dt, room, gates) {
  if (p.buffer && tryStart(p, p.buffer)) return;
  const m = moveInput(p);
  if (m) {
    const sp = p.cls.speed * (1 + p.stats.move / 100) * (p.charge > 0 ? p.cls.charge.move : 1) * (p.slowT > 0 ? 0.6 : 1);
    Dungeon.move(room, p, m.x * sp * dt, m.y * sp * dt, BODY_R, gates);
    p.fv = unit(m.x, m.y, p.fv);
    p.state = 'walk';
    p.walkT += dt;
  } else p.state = 'idle';
}

function tryStart(p, b) {
  const C = p.cls;
  p.buffer = null;
  if (b === 'attack') {
    if (p.dashAtkT > 0) { p.dashAtkT = 0; startAct(p, C.dashAttack, 'dashAtk', 0); }  // 대시 끝난 직후도 대시 찌르기
    else startAct(p, C.combo[0], 'combo', 0);
    return true;
  }
  if (b === 'dodge') {
    // 쿨타임 없음(2026-10-24 사용자: 기력이 있으니까) — 대시가 끝나면 기력만 있으면 바로 또
    if (p.dodgeCd > 0 || !spend(p, dashCost(p))) return false;
    const m = moveInput(p);
    startDodge(p, m ? unit(m.x, m.y, p.fv) : { x: p.fv.x, y: p.fv.y });
    return true;
  }
  if (b === 'charge') {  // 회전베기 · 마법진: 누르면 바로(기력 cost)
    // 마법진은 한 번에 하나만(2026-10-24 사용자) — 깔린 것이 터지기 전에는 못 깐다(기력도 안 씀)
    if (C.charge.def.circle && World.magicActive()) { if (p.spWarnT <= 0) { World.text(p.x, p.y, 40, '마법진이 이미 있어요', '#c9b8ff'); p.spWarnT = 0.6; } return false; }
    if (!spend(p, C.charge.cost)) return false;
    startAct(p, C.charge.def, 'charge', 0);
    if (!p.remote) Input.rumble(0.35, 60);
    return true;
  }
  if (b === 'special') {
    if (p.specialCd > 0 || !spend(p, C.special.cost)) return false;
    p.specialCd = C.special.cd;
    startAct(p, C.special, 'special', 0);
    return true;
  }
  return false;
}

// 대시 시작(dir 쪽으로). 파티 방장 쪽 손님 몸도 손님이 보낸 방향으로 이걸 부른다
function startDodge(p, dir) {
  const C = p.cls;
  p.dodgeV = dir;
  p.fv = p.dodgeV;
  p.state = 'dodge'; p.act = null;
  p.t = C.dodge.time;
  p.iframes = C.dodge.iframes;
  p.dodgeCd = C.dodge.time;  // 지금 대시가 끝날 때까지만 막는다
  p.guardT = C.dodge.time + UNIQUE_FX.dashguardT;
  p.charge = 0;
  Elements.dashStart(p);  // 대시 칸 속성석
  Sfx.dash();
  if (World.mirror && p === World.player) Coop.sendAct({ k: 'dodge', x: p.x, y: p.y, fx: dir.x, fy: dir.y });  // 파티 손님: 방장 쪽 내 몸도 대시
}

function updateEcho(p, dt) {
  const ec = p.echo;
  ec.t += dt;
  if (ec.t < 0.12 * (ec.n + 1)) return;
  ec.n++;
  for (const e of ec.targets) {
    if (e.dying || e.state === 'dead') continue;
    if (hitEnemy(e, ec.def, p)) World.sparks(e.x, e.y - e.h * 0.5, 6, 8, '#ffe8a0');
  }
  if (ec.n >= UNIQUE_FX.echoHits) p.echo = null;
}

function drinkPotion(p) {
  const prof = p.prof, C = p.cls;
  if (prof.potions <= 0 || p.potionCd > 0 || p.hp >= p.maxHp) return false;
  prof.potions--;
  p.potionCd = C.potion.cd;
  const heal = Math.min(Math.round(p.maxHp * C.potion.heal), p.maxHp - p.hp);
  p.hp += heal;
  Sfx.potion();
  World.text(p.x, p.y, 34, '+' + heal, '#7dff8a');
  return true;
}

// 자동 조준(2026-10-24 사용자: 자동 전진은 빼고 조준은 넣기): 공격을 시작할 때 가까운 몹 쪽으로 몸을 돌린다.
// 방향을 안 누르면 둘레(사거리 + AIM_EXTRA) 안 가장 가까운 몹, 누르고 있으면 그 방향 ±75° 안에서 가장 가까운 몹
const AIM_EXTRA = 40;
function aimAt(p, reach) {
  const m = moveInput(p);
  const want = m ? unit(m.x, m.y, p.fv) : p.fv;
  let best = null, bestD = 1e9;
  for (const e of World.enemies()) {
    if (e.dying || e.state === 'dead' || e.spawnT > 0) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
    if (d > reach + AIM_EXTRA || d < 0.001) continue;
    if (m && (dx * want.x + dy * want.y) / d < Math.cos(75 * Math.PI / 180)) continue;
    if (d < bestD) { bestD = d; best = { x: dx / d, y: dy / d }; }
  }
  p.fv = best || want;
}

function startAct(p, def, kind, idx) {
  const wk = WEAPON_KINDS[p.stats.kind];
  const sp = wk.speed * (1 + p.stats.aspd / 100);
  // 무기에 맞춘 판정
  const hd = Object.assign({}, def);
  if (def.reach) hd.reach = [def.reach[0], def.reach[1] + wk.reach];
  if (def.arc) hd.arc = Math.min(170, def.arc * wk.arc);
  if (def.radius) hd.radius = def.radius + wk.reach * 0.5;
  if (kind !== 'dashAtk') aimAt(p, def.circle ? def.circle.range : def.orb ? def.orb.range * 0.7 : def.wave ? def.wave.range * 0.6 : def.radius || hd.reach[1]);  // 대시 찌르기는 대시한 방향 그대로 · 검기는 멀리까지
  p.state = 'act';
  p.act = {
    def, hd, kind, idx, time: 0, hit: new Set(), wave: -1, fxDone: false, x0: p.x, y0: p.y,
    push: !!moveInput(p),  // 방향키를 누른 채 공격하면 그쪽으로 내딛는다(중립이면 제자리)
    s: def.startup / sp, a: def.active / sp, r: def.recovery / sp,
  };
  if (def.iframes) p.iframes = p.act.s + p.act.a + 0.05;
  if (def.heavy || def.spin) Sfx.heavySwing(); else Sfx.swing();
  // 파티 손님: 방장 쪽 내 몸도 같은 동작을(맞히기 · 속성석 효과는 거기서)
  if (World.mirror && p === World.player) Coop.sendAct({ k: kind, i: idx, x: p.x, y: p.y, fx: p.fv.x, fy: p.fv.y, push: p.act.push ? 1 : 0 });
}

function updateAct(p, dt, room) {
  const C = p.cls, a = p.act, d = a.def;
  a.time += dt;
  const tA = a.s, tB = a.s + a.a, tEnd = tB + a.r;
  if (a.time < tB) {
    let v = 0;
    if (d.dash) { if (a.time >= tA) v = d.dash / a.a; }
    // 기본 공격 내딛기(lunge): 방향키를 누르고 있을 때만(2026-10-24 사용자: 중립이면 제자리, 누르면 그쪽으로 전진)
    else if (d.lunge && a.push) v = d.lunge / tB;
    if (v) Dungeon.move(room, p, p.fv.x * v * dt, p.fv.y * v * dt, BODY_R, false);
  }
  if (!a.fxDone && a.time >= tA) {
    a.fxDone = true;
    if (d.dash) World.fx({ type: 'streak', x0: a.x0, y0: a.y0, follow: p, t: 0, life: 0.25 });
    if (d.spin) World.fx({ type: 'ring', follow: p, r: a.hd.radius, t: 0, life: 0.3, col: Elements.color(p.prof, d.slot || 'none') });
    if (a.kind === 'charge' && !d.circle) Elements.chargeBurst(p);  // 회전베기 칸 속성석: 둘레 폭발(마법진은 터질 때 그 자리에서)
    if (d.pulse) World.fx({ type: 'pulse', x: p.x, y: p.y, r: a.hd.radius, t: 0, life: 0.3, col: Elements.color(p.prof, 'dash') });
    // 마력탄: 가볍게 따라가는 빛 구슬, 처음 닿은 적에서 터진다(마력탄 칸 속성석 색)
    if (d.orb) {
      const st = Elements.socket(p.prof, 'wave');
      World.playerShot({ x: p.x + p.fv.x * 8, y: p.y + p.fv.y * 8, vx: p.fv.x * d.orb.speed, vy: p.fv.y * d.orb.speed, left: d.orb.range, r: d.orb.r,
        ball: true, orb: true, once: true, homing: true, def: d, hit: new Set(), stone: st, col: st ? ELEMENTS[st.el].color : '#b39cff',
        onEnd: s => { World.sparks(s.x, s.y - 8, 8, 10, s.col); Elements.waveEnd(s, p); } });
    }
    // 마법진: 겨눈 적 발밑(사거리 안) · 없으면 앞에 깔고, 잠시 뒤 터진다(world.js updateFields)
    if (d.circle) {
      const c = d.circle, tgt = World.enemies().filter(e => !e.dying && e.state !== 'dead' && !(e.spawnT > 0) && Math.hypot(e.x - p.x, e.y - p.y) <= c.range)
        .sort((u, v) => Math.hypot(u.x - p.x, u.y - p.y) - Math.hypot(v.x - p.x, v.y - p.y))
        .find(e => ((e.x - p.x) * p.fv.x + (e.y - p.y) * p.fv.y) >= 0);
      const st = Elements.socket(p.prof, 'charge');
      World.field({ magic: true, x: tgt ? tgt.x : p.x + p.fv.x * c.ahead, y: tgt ? tgt.y : p.y + p.fv.y * c.ahead, r: c.r, delay: c.delay, life: c.delay + 0.4,
        def: d, p, col: st ? ELEMENTS[st.el].color : '#b39cff' });
    }
    if (d.slot === 'basic') Elements.basicSwing(p, d);   // 기본 칸 속성석(보통부터): 화염구 · 얼음 파편 · 독 분사
    // 검기: 앞으로 날아가며 꿰뚫는다. 가까이서 칼에 맞은 몹은 검기에 또 맞지 않게 같은 목록을 쓴다
    if (d.wave) World.playerShot({ x: p.x + p.fv.x * 8, y: p.y + p.fv.y * 8, vx: p.fv.x * d.wave.speed, vy: p.fv.y * d.wave.speed,
      left: d.wave.range, r: d.wave.r, def: d, hit: a.hit, stone: Elements.socket(p.prof, 'wave'), col: Elements.color(p.prof, 'wave') });
  }
  if (a.time >= tA && a.time < tB) {
    if (d.hits) {
      const w = Math.floor((a.time - tA) / (a.a / d.hits));
      if (w !== a.wave) { a.wave = w; a.hit.clear(); }
    }
    let landed = false;
    for (const e of World.enemies()) {
      if (!a.hd.reach && !a.hd.radius) break;  // 마력탄 · 마법진: 몸 판정 없음
      if (a.hit.has(e) || !inHitbox(p, p.fv, a.hd, e, e.r)) continue;
      if (hitEnemy(e, d, p)) { a.hit.add(e); landed = true; }
    }
    // 유니크 잔상 일격: 3타째가 맞으면 잔상이 같은 적을 더 친다
    if (landed && d.fin && p.stats.fx.echo && !p.echo) p.echo = { t: 0, n: 0, targets: [...a.hit], def: Object.assign({}, d, { mult: d.mult * UNIQUE_FX.echoMult, knock: 30, stun: 0.2, heavy: false }) };
    if (landed) {
      World.hitstop(d.heavy ? 0.08 : 0.045);
      if (d.heavy) World.shake(2);
    }
  }
  // 후딜에서 다음 콤보 · 특수기 · 대시로 끊을 수 있다
  if (a.time >= tB) {
    const b = p.buffer;
    if (b === 'attack' && a.kind === 'combo' && a.idx < C.combo.length - 1) {
      p.buffer = null;
      startAct(p, C.combo[a.idx + 1], 'combo', a.idx + 1);
      return;
    }
    if (b && b !== 'attack' && tryStart(p, b)) return;
  }
  if (a.time >= tEnd) { p.state = 'idle'; p.act = null; }
}
