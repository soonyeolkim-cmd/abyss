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
  if (kind === 'riposte') return C.riposte || null;   // 암살자 반격
  if (kind === 'stab') return C.stab || null;         // 암살자 백스탭
  return null;
}

// ── 암살자: 그림자 숨기(2026-10-25) ── p.hidden = { t } — 몹이 나를 놓친다(world.js 목표 고르기)
function startHide(p) {
  p.hidden = { t: 0 };
  World.text(p.x, p.y, 34, '그림자 숨기', '#b9a0ff');
  World.sparks(p.x, p.y, 10, 10, '#6a4aa0');
  Sfx.dash();
}
function endHide(p, why) {
  if (!p.hidden) return;
  p.hidden = null;
  if (why) World.text(p.x, p.y, 34, why, '#b9a0ff');
}
function updateHide(p, dt) {
  const h = p.hidden, H = p.cls.charge.hide;
  h.t += dt;
  p.sp = Math.max(0, p.sp - H.drain * dt); p.spDelay = p.cls.stamina.delay;
  if (h.t >= H.max || p.sp <= 0) endHide(p, '모습이 드러났다');
}
// 백스탭: blink px 안(벽 너머 제외) 가장 가까운 적의 등 뒤(그 적이 보는 쪽 반대)로 순간이동. 등 뒤가 벽이면 옆으로 돌려 본다. 옮겼으면 그 적
function blinkBehind(p, range) {
  const lv = World.level;
  let tgt = null, bd = range;
  for (const e of World.enemies()) {
    if (e.dying || e.state === 'dead' || e.spawnT > 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd && Dungeon.los(lv, p.x, p.y - 4, e.x, e.y - 4)) { bd = d; tgt = e; }
  }
  if (!tgt) return null;
  const back = tgt.r + 9, base = Math.atan2(-(tgt.fv ? tgt.fv.y : 0), -(tgt.fv ? tgt.fv.x : 1));
  for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
    const x = tgt.x + Math.cos(base + da) * back, y = tgt.y + Math.sin(base + da) * back;
    if (!Dungeon.walkable(lv, x, y, BODY_R)) continue;
    World.sparks(p.x, p.y - 8, 12, 12, '#6a4aa0');
    World.fx({ type: 'shadowpath', pts: [[p.x, p.y], [x, y]], w: 6, t: 0, life: 0.25, col: '#b9a0ff' });
    p.x = x; p.y = y;
    p.fv = unit(tgt.x - x, tgt.y - y, p.fv);
    World.sparks(x, y - 8, 12, 14, '#b9a0ff', true);
    return tgt;
  }
  return null;
}
// 받아치기 성공(combat.js hurtPlayer 가 부름): src = 공격한 몹(탄이면 탄 · 손님 기기면 그 자리) → 그 적을 향해 베고 지나간다
function parryHit(p, src) {
  const C = p.cls, R = C.riposte, wk = WEAPON_KINDS[p.stats.kind] || {};
  let tgt = null, bd = 1e9;
  for (const e of World.enemies()) {
    if (e.dying || e.state === 'dead') continue;
    const d = Math.hypot(e.x - src.x, e.y - src.y) + (e === src ? -999 : 0);  // 때린 몹이 먼저, 탄이면 탄이 온 쪽 가까운 몹
    if (d < bd && Math.hypot(e.x - p.x, e.y - p.y) < R.max + 20) { bd = d; tgt = e; }
  }
  if (tgt) p.fv = unit(tgt.x - p.x, tgt.y - p.y, p.fv);
  const len = tgt ? Math.max(R.min, Math.min(R.max, Math.hypot(tgt.x - p.x, tgt.y - p.y) + tgt.r + R.past)) : R.min;
  p.parried = true;
  p.specialCd = 0;  // 성공하면 쿨타임이 바로 풀려 연속 반격
  const def = wk.riposte ? Object.assign({}, R, { mult: R.mult * (1 + wk.riposte) }) : R;  // 싸이: 반격 피해 +20%
  startAct(p, def, 'riposte', 0, { len });
  p.iframes = p.act.s + p.act.a + R.safe;
  World.text(p.x, p.y, 40, '받아치기!', '#7fe0ff', true);
  World.sparks(p.x, p.y, 14, 18, '#ffffff', true);
  World.hitstop(0.08); World.shake(4);
  Sfx.forgeTap(4); Sfx.dash();
  if (!p.remote) Input.rumble(0.7, 160);
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
  p.gapT = Math.max(0, (p.gapT || 0) - dt);  // 암살자 받아치기 실패 빈틈
  if (p.hidden && !p.dead && !p.remote) updateHide(p, dt);  // 방장 쪽 손님 몸은 손님이 보낸 숨기 상태만(길 · 기력은 손님 기기에서)
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
    const sp = p.cls.speed * (1 + p.stats.move / 100) * (p.charge > 0 ? p.cls.charge.move : 1) * (p.slowT > 0 ? 0.6 : 1) * (p.hidden ? p.cls.charge.hide.move : 1);
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
    if (p.dashAtkT > 0) { p.dashAtkT = 0; endHide(p); startAct(p, C.dashAttack, 'dashAtk', 0); }  // 대시 끝난 직후도 대시 찌르기
    else if (p.hidden && C.stab) { endHide(p); const t = blinkBehind(p, C.stab.blink); startAct(p, C.stab, 'stab', 0, { aimed: !!t }); }  // 암살자: 숨은 중 X = 백스탭
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
  if (b === 'charge' && C.charge.hide) {  // 암살자: 숨기 → 다시 누르면 그림자 베기(직선 돌진)
    if (p.hidden) { endHide(p); startAct(p, C.charge.def, 'charge', 0); if (!p.remote) Input.rumble(0.5, 90); return true; }
    if (!spend(p, C.charge.cost)) return false;
    startHide(p);
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
    endHide(p);
    p.parried = false;
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

// o = { len: 반격 거리, aimed: 이미 방향을 정함(백스탭) } — len 은 파티 손님이면 방장 쪽 몸에도 같이 보낸다
function startAct(p, def, kind, idx, o = {}) {
  const wk = WEAPON_KINDS[p.stats.kind];
  const sp = wk.speed * (1 + p.stats.aspd / 100);
  // 무기에 맞춘 판정
  const hd = Object.assign({}, def);
  if (def.reach) hd.reach = [def.reach[0], def.reach[1] + wk.reach];
  if (def.arc) hd.arc = Math.min(170, def.arc * wk.arc);
  if (def.radius) hd.radius = def.radius + wk.reach * 0.5;
  if (kind !== 'dashAtk' && kind !== 'riposte' && !o.aimed && !def.guard) aimAt(p, def.circle ? def.circle.range : def.orb ? def.orb.range * 0.7 : def.wave ? def.wave.range * 0.6 : def.sweep ? def.dash : def.radius || hd.reach[1]);  // 대시 찌르기는 대시한 방향 그대로 · 검기는 멀리까지
  p.state = 'act';
  p.act = {
    def, hd, kind, idx, time: 0, hit: new Set(), wave: -1, fxDone: false, x0: p.x, y0: p.y,
    push: !!moveInput(p),  // 방향키를 누른 채 공격하면 그쪽으로 내딛는다(중립이면 제자리)
    s: def.startup / sp, a: def.active / sp, r: def.recovery / sp,
    len: o.len,
  };
  if (def.guard) p.act.a = def.parry + (wk.parry || 0);  // 받아치기 자세: 무기에 따라 길게(싸이 +0.1초), 공격 속도와 상관없이
  if (def.iframes) p.iframes = p.act.s + p.act.a + 0.05;
  if (def.orb) Sfx.cast();  // 마력탄: 마법 소리(2026-10-25)
  else if (def.heavy || def.spin) Sfx.heavySwing(); else Sfx.swing();
  // 파티 손님: 방장 쪽 내 몸도 같은 동작을(맞히기 · 속성석 효과는 거기서)
  if (World.mirror && p === World.player) Coop.sendAct({ k: kind, i: idx, x: p.x, y: p.y, fx: p.fv.x, fy: p.fv.y, push: p.act.push ? 1 : 0,
    len: o.len });
}

function updateAct(p, dt, room) {
  const C = p.cls, a = p.act, d = a.def;
  a.time += dt;
  const tA = a.s, tB = a.s + a.a, tEnd = tB + a.r;
  if (a.time < tB) {
    let v = 0;
    if (d.dash) { if (a.time >= tA) v = (a.len || d.dash) / a.a; }  // 반격은 그 적까지 거리(a.len)
    // 기본 공격 내딛기(lunge): 방향키를 누르고 있을 때만(2026-10-24 사용자: 중립이면 제자리, 누르면 그쪽으로 전진)
    else if (d.lunge && a.push) v = d.lunge / tB;
    if (v) Dungeon.move(room, p, p.fv.x * v * dt, p.fv.y * v * dt, BODY_R, false);
  }
  if (!a.fxDone && a.time >= tA) {
    a.fxDone = true;
    if (d.dash) World.fx({ type: 'streak', x0: a.x0, y0: a.y0, follow: p, t: 0, life: 0.25 });
    // 그림자 베기: 출발점에서 몸을 따라 늘어나는 넓은 그림자 빛 띠(차지 칸 속성석 색)
    if (d.sweep) World.fx({ type: 'shadowpath', pts: [[a.x0, a.y0]], follow: p, w: d.width * 1.6, t: 0, life: a.a + 0.45, col: Elements.color(p.prof, 'charge', null) || '#d8c8ff' });
    if (d.spin) World.fx({ type: 'ring', follow: p, r: a.hd.radius, t: 0, life: 0.3, col: Elements.color(p.prof, d.slot || 'none') });
    if (a.kind === 'charge' && !d.circle && !d.sweep) Elements.chargeBurst(p);  // 회전베기 칸 속성석: 둘레 폭발(마법진은 터질 때 그 자리에서)
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
    // 그림자 베기: 출발점 → 지금 자리 직선에서 width + 몸 반지름 안의 적 모두(지나가며 벤다)
    if (d.sweep) for (const e of World.enemies()) {
      if (a.hit.has(e) || e.dying || e.state === 'dead') continue;
      const dx = p.x - a.x0, dy = p.y - a.y0, L2 = dx * dx + dy * dy || 1, k = Math.max(0, Math.min(1, ((e.x - a.x0) * dx + (e.y - a.y0) * dy) / L2));
      if (Math.hypot(e.x - (a.x0 + dx * k), e.y - (a.y0 + dy * k)) <= d.width + e.r && hitEnemy(e, d, p)) { a.hit.add(e); landed = true; }
    }
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
  // 그림자 베기 도착: 차지 칸 속성석 폭발은 도착한 자리에서
  if (d.sweep && !a.endDone && a.time >= tB) {
    a.endDone = true;
    World.shake(3);
    Elements.chargeBurst(p);
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
  if (a.time >= tEnd) {
    // 받아치기를 못 하고 자세가 끝남: 빈틈(gap.t 초 안에 처음 맞는 피해 +gap.mult)
    if (d.guard && !p.parried && d.gap) { p.gapT = d.gap.t; World.text(p.x, p.y, 34, '빈틈!', '#ff7a6a'); }
    p.state = 'idle'; p.act = null;
  }
}
