// 끝없는 심연 최종 보스 레이드 '심연의 파수꾼'(2026-10-26 사용자) — 규칙 · 수치는 data.js RAID_RULE.
// 3층 중간 보스를 깨고 계단에서 '최종 보스 도전' → 넓은 방 하나(level). 패턴 셋: 껍질 · 수정 보호막 · 되받아치기.
// 2026-10-26 사용자 '한 번 파훼에 1/3 씩 빠지지 말고 패턴마다 2~3번씩 섞어서': 패턴마다 R.repeat 번씩 섞은 순서(deal)대로 나오고,
//   심장이 한 번 드러날 때마다(exposed) 다음 패턴으로. 한 번 드러날 때 깎이는 체력 = 최대 체력 / 순서 길이(clamp — 다 깎으면 바로 다음 패턴).
// 약점(청록 심장)이 드러난 동안만 제대로 맞는다 — 어느 쪽 · 어떤 공격이든(혼자 · 어떤 직업이든 깰 수 있게).
// 공허 수정 · 공허 구슬은 몹처럼 다룬다(def.part — 파티 소식 · 맞히기를 그대로 씀, 경험치 · 전리품은 없음).
// 방장 · 혼자가 계산하고(think · state · part), 파티 손님은 몹 소식으로 따라 그린다(drawPart · drawBoss).
const Raid = (() => {
  const R = RAID_RULE, TEAL = '#5fe0d0', VOID = '#c06aff';
  const live = e => !e.dying && e.state !== 'dead';
  const parts = kind => World.enemies().filter(e => e.def.part === kind && live(e));
  const bossOf = () => World.enemies().find(e => e.def.raid && live(e));
  const MECHS = ['shell', 'crystal', 'orb'];
  const NAME = { shell: '껍질', crystal: '수정 보호막', orb: '공허 구슬' };
  const HINT = { shell: '껍질이 단단하다 — 날아드는 내려찍기를 대시로 ' + R.slams + '번 피하거나 기둥에 부딪히게 해 심장을 노려라', crystal: '수정 보호막 — 네 귀퉁이 공허 수정을 모두 부숴라', orb: '공허 구슬 — 쳐서 되돌려라!' };

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
    lv.pillars0 = lv.columns.map(c => c.slice());  // 껍질 패턴이 다시 나오면 무너진 기둥이 다시 솟는다(restorePillars)
    lv.crates = new Set();
    lv.decor = { skulls: [], banners: new Set() };
    lv.canvas = Dungeon.paint(lv);
    return lv;
  }
  const bossSpot = lv => ({ x: lv.boss.cx * T + 8, y: (lv.boss.y + 6) * T });

  // 보스 머리 위 큰 글(파티 손님에게도) + 내 화면 가운데 알림
  function say(e, s, col = TEAL) { World.text(e.x, e.y, e.h + 14, s, col, true); World.say(s, 2.6); }

  // ── 패턴 순서 ──
  // 패턴마다 R.repeat[0]~[1] 번, 같은 패턴이 바로 이어지지 않게 섞는다
  function deal() {
    const q = [];
    for (const m of MECHS) for (let n = R.repeat[0] + Math.floor(Math.random() * (R.repeat[1] - R.repeat[0] + 1)); n > 0; n--) q.push(m);
    for (let tries = 0; tries < 60; tries++) {
      for (let i = q.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
      if (q.every((m, i) => !i || q[i - 1] !== m)) break;
    }
    return q;
  }
  function begin(e) {
    e.queue = deal(); e.nBreak = e.queue.length; e.brk = 0; e.seen = {};
    next(e, true);
  }
  // 다음 패턴(처음이 아니면 잠깐 무적 + 포효). 순서를 다 쓰면 새로 섞는다(체력이 남았을 때)
  function next(e, first) {
    const prev = e.mech;
    if (!e.queue.length) e.queue = deal();
    if (e.queue[0] === prev) { const i = e.queue.findIndex(m => m !== prev); if (i > 0) e.queue.unshift(e.queue.splice(i, 1)[0]); }
    e.mech = e.queue.shift(); e.slams = 0; e.chunkDone = false;
    for (const o of parts('orb')) pop(o);
    for (const c of parts('crystal')) { c.dying = true; c.hp = 0; c.state = 'dead'; c.t = 0; }
    if (!first) {
      e.state = 'phaseShift'; e.t = e.windupT = R.shift; World.shake(6); World.dust(e.x, e.y, 16); Sfx.roar();
      // 포효 파동(2026-10-26 사용자): 방 전체로 퍼지는 고리 — 대시로 넘으면 안 맞음, 맞으면 최대 체력 wave.pct
      const W = R.wave;
      World.field({ wave: true, x: e.x, y: e.y, delay: W.delay, speed: W.speed, w: W.w, pct: W.pct, tick: 99, life: W.delay + W.maxR / W.speed });
      if (!e.waveSeen) { e.waveSeen = 1; World.text(e.x, e.y, e.h + 26, '파동 — 대시로 넘어라!', VOID, true); }
    }
    if (e.mech === 'shell') restorePillars(e);
    if (e.mech === 'crystal') { spawnCrystals(e); World.summon(e.def.summon, e, 3); }
    // 처음 나온 패턴만 공략 알림: 긴 설명은 화면 가운데(줄 나눔, hud.js), 보스 머리 위는 패턴 이름만(2026-10-29 사용자: 폰에서 설명이 길어 잘림)
    if (!e.seen[e.mech]) { e.seen[e.mech] = 1; World.text(e.x, e.y, e.h + 14, NAME[e.mech] + '!', TEAL, true); World.say(HINT[e.mech], 4.5); }
    else World.text(e.x, e.y, e.h + 14, NAME[e.mech] + '!', TEAL, true);
  }
  // 한 번 깎을 몫을 다 깎음(clamp) → 다음 패턴
  function chunkNext(e) {
    e.chunkDone = false; e.brk++;
    e.state = 'move'; e.atkCd = 0.8;
    next(e);
  }
  function restorePillars(e) {
    const lv = World.level;
    for (const c of lv.pillars0 || []) {
      if (lv.columns.some(o => o[0] === c[0] && o[1] === c[1])) continue;
      const x = c[0] * T + 8, y = c[1] * T + 12;
      if (World.enemies().concat([World.player]).some(o => o && Math.hypot(o.x - x, o.y - y) < 22)) continue;  // 누가 서 있으면 그 자리는 건너뜀
      lv.columns.push(c.slice());
      World.dust(x, y, 10);
    }
  }
  function spawnCrystals(e) {
    if (parts('crystal').length) return;
    const r = World.level.boss;
    for (const [x, y] of [[r.x + 3, r.y + 3], [r.x + r.w - 4, r.y + 3], [r.x + 3, r.y + r.h - 3], [r.x + r.w - 4, r.y + r.h - 3]]) World.spawn('void_crystal', x * T + 8, y * T + 8, { spawn: true });
    e.crystalAt = World.time + R.shift + R.crystalTime;  // 이때까지 다 못 부수면 남은 수정이 터진다(detonate)
    Sfx.spell();
  }
  // 수정 폭발(2026-10-26 사용자: 제한 시간 안에 못 부수면 남은 수정마다 최대 체력 crystalPct — 방어 · 대시 무적 무시, 모두에게)
  // 수정은 사라지고 심장은 안 드러난 채 다음 패턴(이번 몫은 못 깎음)
  function detonate(b) {
    const left = parts('crystal');
    if (!left.length) return;
    b.crystalAt = 0;
    for (const c of left) { World.fx({ type: 'shock', x: c.x, y: c.y, r: 18, t: 0, life: 0.4 }); pop(c); }
    for (const t of [World.player, ...World.remotes]) {
      if (!t || t.dead) continue;
      World.fx({ type: 'shock', x: t.x, y: t.y, r: 16, t: 0, life: 0.35 });  // 맞는 사람 발밑(판정 = 그 사람)
      World.sparks(t.x, t.y, 16, 14, VOID, true);
      hurtPlayer(t, { x: b.x, y: b.y, pct: R.crystalPct * left.length, unavoid: true }, 0, 140);
    }
    World.shake(8); Sfx.blast();
    say(b, '공허 수정 폭발! (남은 수정 ' + left.length + '개)', VOID);
    b.state = 'move'; b.atkCd = 1;
    next(b);
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
    e.moving = false; e.z = 0;  // 도약 중 다른 상태(빙결 등)로 끊겨도 땅으로
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (p.dead) return;
    if (!e.mech) begin(e);
    if (e.chunkDone) { chunkNext(e); return; }  // 껍질 위로 조금씩 깎다 몫을 다 채운 경우도
    if (e.mech === 'crystal' && !parts('crystal').length) { expose(e, R.crystalExpose, '보호막이 꺼졌다 —'); return; }  // 패턴이 바뀌는 사이에 수정을 다 부숴도
    faceTo(e, p);
    e.atkCd -= dt;
    const pd = Math.hypot(p.x - e.x, p.y - e.y);
    if (e.atkCd <= 0) { attack(e, lv, p, pd); return; }
    if (pd > 46) { const step = d.speed * dt; Dungeon.move(lv, e, e.fv.x * step, e.fv.y * step, e.r); e.moving = true; e.walkT += dt; }
  }
  function attack(e, lv, p, pd) {
    const d = e.def, r = Math.random(), near = pd < 64;
    const slam = () => { e.state = 'slam'; e.t = e.windupT = d.slam.windup; };
    const leap = () => { e.state = 'leapWind'; e.t = e.windupT = R.leap.wind; e.lx = p.x; e.ly = p.y; };
    const rage = 0.65 + 0.35 * e.hp / e.maxHp;  // 체력이 줄수록 공격 사이가 짧아짐(예전 단계가 오르던 맛)
    if (e.mech === 'shell') {  // 도약 내려찍기(대시로 R.slams 번 피하면 지침) · 휘두르기 · 멀면 돌진(기둥에 부딪히게)
      if (near) { if (r < 0.7) leap(); else { e.state = 'windup'; e.t = e.windupT = d.atk.windup; } }
      else if (r < 0.6) { e.state = 'chargeWind'; e.t = e.windupT = d.charge.windup; e.chargeV = unit(p.x - e.x, p.y - e.y, e.fv); }
      else leap();
      e.atkCd = (1.0 + Math.random() * 0.7) * rage;
    } else if (e.mech === 'crystal') {  // 공허 장판 · 탄 부채꼴 · 가까우면 내려찍기
      if (r < 0.4) puddles(e, p);
      else if (near) slam();
      else { e.state = 'fan'; e.t = e.windupT = d.fan.windup; }
      e.atkCd = (1.3 + Math.random() * 0.7) * rage;
    } else {  // 공허 구슬(하나씩) · 사방 탄 · 가까우면 내려찍기
      if (!parts('orb').length && r < 0.7) { e.state = 'orbWind'; e.t = e.windupT = 0.8; }
      else if (near && r < 0.85) slam();
      else { e.state = 'ringWind'; e.t = e.windupT = 0.6; }
      e.atkCd = (1.5 + Math.random() * 0.7) * rage;
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
      case 'exposed':  // 드러난 시간이 끝나거나 이번 몫을 다 깎으면 다음 패턴
        e.t -= dt;
        if (e.chunkDone) chunkNext(e);
        else if (e.t <= 0) { e.state = 'move'; e.atkCd = 0.8; next(e); }
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
      case 'leapWind':  // 예고가 노리는 사람 발밑을 따라다님 → 끝나면 그 자리로 날아오름
        e.t -= dt; e.kx = 0; e.ky = 0;
        e.lx = p.x; e.ly = p.y;
        if (e.t <= 0) {
          const lv = World.level;
          for (let k = 1; k >= 0 && !Dungeon.walkable(lv, e.lx, e.ly, e.r); k -= 0.1) { e.lx = e.x + (p.x - e.x) * k; e.ly = e.y + (p.y - e.y) * k; }  // 기둥 · 벽에 걸리면 내 쪽으로 물려 앉음
          e.sx = e.x; e.sy = e.y; e.state = 'leap'; e.t = R.leap.air; e.leapDash = false;
          World.dust(e.x, e.y, 10); Sfx.dash();
        }
        break;
      case 'leap': {  // 날아오는 중: 대시를 쓰면 기록 → 내려앉을 때 안 맞았으면 '피함'
        e.t -= dt; e.kx = 0; e.ky = 0;
        if (p.state === 'dodge') e.leapDash = true;
        const k = Math.min(1, 1 - e.t / R.leap.air);
        e.x = e.sx + (e.lx - e.sx) * k; e.y = e.sy + (e.ly - e.sy) * k; e.z = Math.sin(Math.PI * k) * R.leap.h;
        if (e.t <= 0) land(e, p);
        break;
      }
    }
  }
  function land(e, p) {
    const d = e.def;
    e.x = e.lx; e.y = e.ly; e.z = 0;
    World.shake(6); World.dust(e.x, e.y, 16); Sfx.stone();
    World.fx({ type: 'shock', x: e.x, y: e.y, r: d.slam.radius, t: 0, life: 0.3 });
    const hit = groundDist(p.x - e.x, p.y - e.y) <= d.slam.radius + BODY_R && hurtPlayer(p, e, d.slam.dmg * e.dmgMul, 200) !== 'miss';
    e.state = 'recover'; e.t = 0.8;
    if (e.mech !== 'shell' || hit || !e.leapDash) return;  // 대시로 피한 것만 센다(멀리 있거나 맞으면 안 셈)
    World.text(p.x, p.y, 40, '피함!', '#ffd36a');
    if (++e.slams >= R.slams) expose(e, R.slamExpose, '지쳤다 —');
  }
  // 껍질 패턴 지침(2026-10-26 사용자): 제자리 내려찍기를 맞든 안 맞든 세던 것 → 피한 것만 → 멀리 있으면 그냥 차서
  //   내 자리로 날아드는 도약 내려찍기(leapWind · leap · land)를 대시로 피한 것만 센다. 셈은 보스 머리 위 '피함 N/slams'(labels)
  // 돌진에 맞은 사람(enemy.js charge): 껍질 패턴이면 짓밟혀 R.stun 초 기절(2026-10-26 사용자 — 기둥으로 유도하라는 벌)
  const chargeSrc = e => (e.mech === 'shell' ? Object.assign(Object.create(e), { stun: R.stun }) : e);
  function pillar(e, lv) {
    if (e.mech !== 'shell') return false;
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
    if (e.def.part === 'crystal') {  // 가만히 — 다 부수면 보스 보호막이 꺼진다(partDied), 제한 시간이 지나면 남은 수정이 터진다
      const b = bossOf();
      if (b && b.crystalAt && World.time >= b.crystalAt && b.state !== 'phaseShift') detonate(b);
      return;
    }
    const b = (e.boss && live(e.boss) && e.boss) || bossOf();
    if (!b || (e.life -= dt) <= 0) { pop(e); return; }
    if (e.state === 'back') {  // 되돌아가는 구슬: 보스 심장 쪽으로 휘어 감
      const sp = Math.hypot(e.vx, e.vy), u = unit(b.x - e.x, b.y - e.y, { x: 0, y: -1 });
      e.vx = u.x * sp; e.vy = u.y * sp;
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r + 2) { bossHit(b, e); return; }
    } else {  // 못 쳐내고 맞으면 최대 체력 orbPct + 공허 표식(받는 피해 ×markMul, markT 초) — 대시 무적이면 지나감
      for (const t of [World.player, ...World.remotes]) {
        if (!t || t.dead || Math.hypot(t.x - e.x, t.y - e.y) >= e.r + BODY_R + 2) continue;
        if (hurtPlayer(t, { x: e.x, y: e.y, pct: R.orbPct, mark: R.markT }, 0, 200) !== 'miss') { pop(e); return; }
      }
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
    if (b && b.mech === 'crystal' && !parts('crystal').length && b.state !== 'phaseShift') expose(b, R.crystalExpose, '보호막이 꺼졌다 —');
  }

  // ── 피해(combat.js hitEnemy · elements.js damage) ──
  // [배율, 알림 글] — 단계 바뀌는 중 · 보호막 = 0, 심장 = exposedMul, 그 밖 = 껍질
  function cut(e) {
    if (e.state === 'phaseShift' || e.spawnT > 0) return [0, '무적'];
    if (e.state === 'exposed') return [R.exposedMul, ''];
    if (e.mech === 'crystal' && parts('crystal').length) return [0, '보호막'];
    return [R.shellCut, '팅!'];
  }
  // 한 번에 몫(최대 체력 / 순서 길이)보다 더 깎이지 않게: 문턱에서 멈추고 chunkDone → 다음 패턴. 마지막 몫은 끝까지
  function clamp(e) {
    if (!e.nBreak || e.chunkDone) { if (e.chunkDone) e.hp = Math.max(e.hp, e.chunkThr); return; }
    const thr = e.brk + 1 >= e.nBreak ? 0 : e.maxHp * (1 - (e.brk + 1) / e.nBreak);
    if (thr && e.hp <= thr) { e.hp = thr; e.chunkThr = thr; e.chunkDone = true; }
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
        // 터지기 5초 전부터 붉게 맥동(남은 초 숫자는 labels — 어둠 위 2배 글)
        const left = crystalLeft(e);
        if (left > 0 && left <= 5) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 14); ctx.fillStyle = '#ff3a6a'; ctx.beginPath(); ctx.ellipse(x, y - 6, 9, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
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
  // 수정이 터지기까지 남은 초(방장 = 보스 crystalAt, 파티 손님은 수정을 처음 본 때부터 셈)
  function crystalLeft(c) {
    if (c.seenAt === undefined) c.seenAt = World.time;
    const b = bossOf(), at = (b && b.crystalAt) || c.seenAt + R.shift + R.crystalTime;
    return at - World.time;
  }
  // 바닥(world.js draw, 장판과 같은 층): 도약 내려찍기가 내려앉을 자리 — 노리는 사람 발밑, 판정 = 이 타원. 보스가 화면 밖이어도 그림
  function ground(ctx) {
    const b = bossOf();
    if (!b || (b.state !== 'leapWind' && b.state !== 'leap')) return;
    const R = b.def.slam.radius, k = b.state === 'leap' ? 1 : 1 - b.t / b.windupT;
    ctx.save();
    ctx.fillStyle = 'rgba(255,40,30,' + (0.12 + 0.2 * k) + ')';
    ctx.strokeStyle = 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')';
    ctx.beginPath(); ctx.ellipse(b.lx, b.ly, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(b.lx, b.ly, R * k, R * GROUND_Y * k, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // 어둠 위(world.js draw, 2배 글): 수정 머리 위 남은 초 — 5초 아래면 붉게 깜빡. 방 귀퉁이 어둠 속에서도 보이게
  // 껍질 패턴: 보스 머리 위 내려찍기 피한 횟수
  function labels(ctx) {
    const blink = Math.floor(performance.now() / 160) % 2;
    ctx.font = 'bold 8px ' + Gfx.FONT; ctx.textAlign = 'center';
    const b = bossOf();
    if (b && b.mech === 'shell' && b.state !== 'exposed' && b.state !== 'phaseShift' && !(b.spawnT > 0)) {
      const s = '피함 ' + (b.slams || 0) + '/' + R.slams, y = b.y - (b.z || 0) - b.h - 6;
      ctx.fillStyle = '#000'; ctx.fillText(s, b.x + 0.5, y + 0.5);
      ctx.fillStyle = '#ffd36a'; ctx.fillText(s, b.x, y);
    }
    for (const c of parts('crystal')) {
      const left = crystalLeft(c);
      if (left <= 0 || left > R.crystalTime || c.spawnT > 0) continue;
      const s = String(Math.ceil(left)), hot = left <= 5;
      ctx.fillStyle = '#000'; ctx.fillText(s, c.x + 0.5, c.y - 25.5);
      ctx.fillStyle = hot ? (blink ? '#ffffff' : '#ff5a7a') : TEAL; ctx.fillText(s, c.x, c.y - 26);
    }
    ctx.textAlign = 'left';
  }
  // 화면 밖 수정: 가장자리 화살표(world.js edgeArrow) — 가운데 작은 수정 그림 · 옆에 남은 초(5초 아래 붉게)
  function arrows(ctx, edgeArrow) {
    for (const c of parts('crystal')) {
      if (c.spawnT > 0) continue;
      const left = crystalLeft(c), hot = left <= 5;
      edgeArrow(ctx, c.x, c.y - 8, hot ? '#ff5a7a' : TEAL, (ax, ay) => Gfx.spr(ctx, 'void_crystal_anim_f0', ax, ay + 8, { scale: 1.5 }),
        left > 0 && left <= R.crystalTime ? '수정 ' + Math.ceil(left) + '초' : '수정');
    }
  }
  // HUD: 보스 막대 옆 남은 시간만(2026-10-26 사용자: 체력창 설명 지움 — 단계 금 · 단계 이름 · 할 일 없앰)
  function hud(ctx, b) {
    const left = Math.max(0, R.time - World.raidTime);
    Gfx.text(ctx, '남은 시간 ' + Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'), 640, 58, 13, left < 30 ? '#ff6a5a' : '#f0e0b8');
  }

  // 파티: 방장 → 손님(world.js snapshot rd) — 손님 화면에도 도약 예고 · '피함 N/slams'
  function snap() { const b = bossOf(); return b ? [b.id, Math.round(b.lx || 0), Math.round(b.ly || 0), b.slams || 0, b.mech || ''] : undefined; }
  function unsnap(a) {
    const b = World.enemies().find(e => e.id === a[0]);
    if (b) { b.lx = a[1]; b.ly = a[2]; b.slams = a[3]; b.mech = a[4]; }
  }

  return { level, bossSpot, think, state, chargeSrc, ground, snap, unsnap, pillar, part, reflect, partDied, cut, clamp, drawBoss, drawPart, labels, arrows, hud };
})();
