// 파티 창(마을 메뉴 → 파티, overlay 'coop' — 2026-10-25 사용자: '함께하기' → '파티'): 방 만들기 · 방 들어가기(4자리 방 코드) · 방 안(두 캐릭터 · 연결 속도).
// 창을 닫아도 방은 그대로 열려 있다(마을 왼쪽 아래 패널에 방 코드 · 친구 표시). 이어지면 마을에서 서로 걷는 모습이 보인다(아래 tick). 던전 같이 들어가기는 2단계.
// 방 코드 넣기: ↑↓ 숫자 바꾸기 · ←→ 자리 옮기기 · 키보드 숫자키 바로 · Backspace 지우기 · 폰은 숫자판을 손가락으로.
const Coop = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  let sel = 0, entering = false, digits = [0, 0, 0, 0], cur = 0, time = 0;

  function open() { sel = 0; entering = false; }

  // 키보드 숫자키(1 은 물약 키라 Input 이 아니라 여기서 직접 받는다)
  window.addEventListener('keydown', e => {
    if (!entering || !isTop()) return;
    const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (m) { e.preventDefault(); typeDigit(+m[1]); }
  });
  const isTop = () => { const o = Game.overlays[Game.overlays.length - 1]; return o && o.type === 'coop'; };
  function typeDigit(d) { digits[cur] = d; cur = Math.min(3, cur + 1); Sfx.pickup(); }
  function erase() { if (cur > 0 && digits[cur] === 0) cur--; digits[cur] = 0; }
  const codeStr = () => digits.join('');
  function tryJoin() {
    const c = codeStr();
    if (c < '1000') { Game.toast('방 코드 4자리를 넣어 주세요'); return; }
    entering = false; sel = 0;
    Net.join(c);
  }

  // 지금 보이는 버튼(위에서 아래로)
  function buttons() {
    const st = Net.state;
    if (st === 'hosting') return [{ label: '닫기 (방은 그대로)', go: close }, { label: '방 닫기', go: () => { Net.leave(); Game.toast('방을 닫았어요'); } }];
    if (st === 'joining') return [{ label: '그만두기', go: () => Net.leave() }];
    if (st === 'ready') return [{ label: '닫기', go: close }, { label: Net.role === 'host' ? '방 닫기' : '방 나가기', go: () => { Net.leave(); Game.toast(Net.role === 'host' ? '방을 닫았어요' : '방을 나왔어요'); } }];
    return [
      { label: '방 만들기', go: () => Net.host() },
      { label: '방 들어가기', go: () => { entering = true; digits = [0, 0, 0, 0]; cur = 0; } },
      { label: '닫기', go: close },
    ];
  }
  function close() { Game.closeOverlay(); }

  function update(o) {
    if (entering) {
      if (Input.wasPressed('pause')) { entering = false; return; }
      if (Input.wasPressed('back')) { if (digits.some(d => d) || cur) erase(); else entering = false; return; }
      if (Input.nav('left')) cur = Math.max(0, cur - 1);
      if (Input.nav('right')) cur = Math.min(3, cur + 1);
      if (Input.nav('up')) digits[cur] = (digits[cur] + 1) % 10;
      if (Input.nav('down')) digits[cur] = (digits[cur] + 9) % 10;
      if (Input.wasPressed('ok')) tryJoin();
      return;
    }
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { close(); return; }
    const bs = buttons();
    sel = Math.min(sel, bs.length - 1);
    if (Input.nav('up')) sel = (sel + bs.length - 1) % bs.length;
    if (Input.nav('down')) sel = (sel + 1) % bs.length;
    if (Input.wasPressed('ok')) { const b = bs[sel]; sel = 0; b.go(); }
  }

  const X = 210, Y = 70, W = 540, H = 400;
  function draw(ctx, o, prof) {
    time += 1 / 60;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });  // 창 밖을 눌러도 뒤가 눌리지 않게
    Gfx.panel(ctx, X, Y, W, H, { border: '#b48cff' });
    T_(ctx, '파티', 480, Y + 40, 24, '#e0d0ff', 'center');
    T_(ctx, '온라인 협동 · 방 코드로 2명', 480, Y + 62, 12, '#9a8eaa', 'center');
    if (entering) { drawEntry(ctx); return; }
    const st = Net.state;
    if (!Net.available()) T_(ctx, '파티 기능을 불러오지 못했어요 — 인터넷을 켜고 새로고침해 주세요', 480, Y + 110, 13, '#ff8a6a', 'center');
    if (st === 'hosting') {
      T_(ctx, '방 코드', 480, Y + 108, 14, '#9a8eaa', 'center');
      if (Net.opened) T_(ctx, Net.code.split('').join(' '), 480, Y + 160, 52, '#ffd36a', 'center');
      else T_(ctx, '방을 여는 중' + dots(), 480, Y + 150, 20, '#c8b8a0', 'center');
      T_(ctx, '친구가 마을 메뉴 → 파티 → 방 들어가기에서 이 숫자를 넣으면 돼요', 480, Y + 200, 12, '#c8b8a0', 'center');
      if (Net.opened) T_(ctx, '친구를 기다리는 중' + dots(), 480, Y + 228, 15, '#b48cff', 'center');
    } else if (st === 'joining') {
      T_(ctx, '방 ' + Net.code + ' 에 들어가는 중' + dots(), 480, Y + 160, 20, '#c8b8a0', 'center');
    } else if (st === 'ready') {
      drawRoom(ctx, prof);
    } else {
      T_(ctx, '파티를 맺으면 마을에서 서로 보여요. 던전 같이 들어가기는 곧 생겨요.', 480, Y + 112, 14, '#c8b8a0', 'center');
      T_(ctx, '한 사람이 방을 만들고, 다른 사람이 방 코드를 넣어 들어가요.', 480, Y + 134, 13, '#9a8e96', 'center');
      if (st === 'error' && Net.err) T_(ctx, Net.err, 480, Y + 170, 13, '#ff8a6a', 'center');
    }
    drawButtons(ctx, buttons());
    UI_hint(ctx, '고르기 ' + L('ok') + ' · 닫기 ' + L('back'));
  }

  // 방 안: 나 · 친구 아바타, 연결 속도
  function drawRoom(ctx, prof) {
    const m = Net.mate, host = Net.role === 'host';
    T_(ctx, '방 ' + Net.code, 480, Y + 92, 13, '#9a8eaa', 'center');
    const col = (x, who, p, tag) => {
      Art.avatar(ctx, p, x - 6, Y + 182, 4, time);
      T_(ctx, clsOf(p).name + ' Lv.' + p.lv, x, Y + 208, 17, '#f0e0b8', 'center');
      T_(ctx, who + ' · ' + tag, x, Y + 226, 12, '#b48cff', 'center');
    };
    col(370, '나', prof, host ? '방장' : '손님');
    col(590, '친구', { cls: m.cls, lv: m.lv, equip: { weapon: m.weapon } }, host ? '손님' : '방장');
    const pg = Net.ping, q = !pg ? ['재는 중', '#9a8e96'] : pg < 90 ? ['좋음', '#7dff8a'] : pg < 200 ? ['보통', '#ffd36a'] : ['느림', '#ff8a6a'];
    T_(ctx, '연결 ' + q[0] + (pg ? ' · ' + pg + 'ms' : ''), 480, Y + 252, 13, q[1], 'center');
    T_(ctx, '마을에서 서로 보여요 · 던전 같이 들어가기는 다음 단계에서 만들어요', 480, Y + 272, 12, '#8a7e88', 'center');
  }

  function drawButtons(ctx, bs) {
    const top = Y + H - 26 - bs.length * 36;
    bs.forEach((b, i) => {
      const y = top + i * 36, on = i === sel;
      UI.zone(X + 120, y - 24, W - 240, 34, { pick: () => { sel = i; }, now: true });
      if (on) { ctx.fillStyle = 'rgba(180,140,255,0.14)'; ctx.fillRect(X + 120, y - 22, W - 240, 30); }
      T_(ctx, (on ? '▶ ' : '') + b.label, 480, y, 17, on ? '#ffd36a' : '#e8e0d0', 'center');
    });
  }

  // 방 코드 넣기: 네 칸 + 폰 숫자판
  function drawEntry(ctx) {
    T_(ctx, '방 코드 넣기', 480, Y + 96, 15, '#c8b8a0', 'center');
    for (let i = 0; i < 4; i++) {
      const bx = 480 - 118 + i * 62, on = i === cur;
      UI.zone(bx - 4, Y + 108, 58, 64, { pick: () => { cur = i; }, key: null, now: true });
      Gfx.panel(ctx, bx, Y + 112, 50, 56, { border: on ? '#ffd36a' : '#5a4650', bg: '#1d151b' });
      T_(ctx, String(digits[i]), bx + 25, Y + 152, 30, on ? '#ffd36a' : '#e8e0d0', 'center');
      if (on) { T_(ctx, '▲', bx + 25, Y + 106, 10, '#8a7e88', 'center'); T_(ctx, '▼', bx + 25, Y + 182, 10, '#8a7e88', 'center'); }
    }
    // 숫자판 1~9 · 0 + 지우기 · 들어가기(폰은 손가락으로, 마우스 클릭도 됨)
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '지우기', '0', '들어가기'];
    keys.forEach((k, i) => {
      const bx = 480 - 135 + (i % 3) * 92, by = Y + 196 + Math.floor(i / 3) * 44, w = 86;
      const go = k === '지우기' ? () => erase() : k === '들어가기' ? () => tryJoin() : () => typeDigit(+k);
      UI.zone(bx, by, w, 38, { pick: go, key: null, now: true });
      Gfx.panel(ctx, bx, by, w, 38, { border: k === '들어가기' ? '#4a8a50' : '#5a4650', bg: '#1d151b' });
      T_(ctx, k, bx + w / 2, by + 25, k.length > 1 ? 13 : 17, k === '들어가기' ? '#7dff8a' : '#e8e0d0', 'center');
    });
    UI_hint(ctx, '숫자 ↑↓ · 자리 ←→ · 숫자키 · 들어가기 ' + L('ok') + ' · 지우기/뒤로 ' + L('back'));
  }

  // ── 서로 보이기(2026-10-25 사용자: 연결되면 마을에서부터 서로 보이게 · 파티 던전 안에서도) ──
  // 서로 지금 장면 · 위치 · 바라보는 쪽 · 몸 상태를 보낸다(바뀌면 1초에 20번까지, 안 바뀌어도 1초마다 한 번). 던전이면 r = 파티 씨앗.
  // 받은 위치로 부드럽게 따라가는 '친구 몸'을 만들어 town.js · world.js 가 내 캐릭터와 함께 그린다. 마을 일(말 걸기 · 상점)은 각자.
  // 던전 안 같이 싸우기(3단계)는 아래 '같이 싸우기' — 방장이 몹을 계산하고 손님은 따라 그린다(world.js 위 설명).
  const WHERE = { town: '마을', run: '던전', select: '던전 고르는 중', result: '결과 화면', title: '캐릭터 선택' };
  const BODY_STATES = { walk: 1, idle: 1, dodge: 1, hurt: 1, dead: 1, act: 1 };
  let mateNow = null, body = null, bodyKey = '', sendT = 0, keepT = 0, lastSent = '';
  Net.on('pos', m => { mateNow = m; if (World.remote && m.s === 'run' && m.r === World.partySeed) remotePos(m); });
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;

  // 지금 내 몸(마을 · 파티 던전) — 없으면 null
  function myBody() {
    if (Game.scene === 'town') return Town.player;
    if (Game.scene === 'run' && World.partySeed) return World.player;
    return null;
  }
  // 친구 몸을 보여 줄까: 둘 다 마을이거나, 같은 파티 던전
  const together = () => mateNow && ((mateNow.s === 'town' && Game.scene === 'town') || (mateNow.s === 'run' && Game.scene === 'run' && World.partySeed && mateNow.r === World.partySeed));

  // 매 화면(game.js frame): 내 위치 보내기 · 친구 몸 따라가기 · 초대 기다림 시간
  function tick(dt) {
    partyWatch(dt);
    if (!Net.linked) { mateNow = null; body = null; lastSent = ''; if (invite) inviteEnd(); return; }
    if (invite && (invite.t -= dt) <= 0) { inviteEnd(); askSolo('친구가 대답이 없어요'); }
    sendT -= dt; keepT -= dt;
    if (sendT <= 0) {
      sendT = 1 / 20;
      const s = Game.scene, tp = myBody();
      const m = tp ? { t: 'pos', s, x: r1(tp.x), y: r1(tp.y), fx: r1(tp.fv.x), fy: r1(tp.fv.y), st: BODY_STATES[tp.state] ? tp.state : 'idle' } : { t: 'pos', s };
      if (tp && s === 'run') {
        m.r = World.partySeed;
        const mv = moveInput(tp);  // 방장 쪽 내 몸이 다음 소식까지 같은 쪽으로 걷게
        if (mv) { m.mx = r2(mv.x); m.my = r2(mv.y); }
        if (tp.iframes > 0) m.ifr = 1;
        if (tp.state === 'act' && tp.act) { const a = tp.act; m.a = [a.kind, a.idx, r2(a.time), r2(a.s), r2(a.a), r2(a.r)]; }  // 친구 화면에 휘두르는 모습
      }
      if (s === 'select') {  // 방장 던전 고르기: 커서 · 난이도 · 깬 던전(손님 화면에 같은 고르기 창)
        const pr = Game.prof;
        Object.assign(m, { sel: UI.select.sel, diff: UI.select.diff, cl: Object.keys(pr.cleared || {}), cd: pr.clearedDiff || {} });
      }
      const key = JSON.stringify(m);
      if (key !== lastSent || keepT <= 0) { Net.send(m); lastSent = key; keepT = 1; }
      // 파티 방장: 손님 둘레 몹 · 탄 · 장판 + 그동안 생긴 효과
      if (World.remote && s === 'run') { const sn = World.snapshot(); sn.ev = evQ; evQ = []; Net.send(sn); }
    }
    viewTick();
    if (!together() || mateNow.x === undefined) { body = null; return; }
    const mt = Net.mate, k = mt.cls + ':' + (mt.weapon ? mt.weapon.uid + ':' + mt.weapon.base : '');
    if (!body || k !== bodyKey) {  // 처음 · 직업 · 무기가 바뀌면 다시
      bodyKey = k;
      body = { cls: clsOf(mt), prof: { cls: mt.cls, equip: { weapon: mt.weapon } }, stats: { fx: {} },
        x: mateNow.x, y: mateNow.y, fv: { x: 0, y: 1 }, state: 'idle', walkT: 0, flash: 0, charge: 0, act: null };
    }
    const d = Math.hypot(mateNow.x - body.x, mateNow.y - body.y);
    if (d > 80) { body.x = mateNow.x; body.y = mateNow.y; }  // 너무 멀면 바로(새로 들어옴 등)
    else { const f = 1 - Math.exp(-dt * (mateNow.st === 'dodge' ? 20 : 12)); body.x += (mateNow.x - body.x) * f; body.y += (mateNow.y - body.y) * f; }
    if (mateNow.fx || mateNow.fy) body.fv = { x: mateNow.fx, y: mateNow.fy };
    body.state = mateNow.st || 'idle';
    if (body.state === 'idle' && d > 2) body.state = 'walk';  // 따라가는 중에는 걷는 모습
    body.dodgeV = body.fv; body.dead = body.state === 'dead';
    if (body.state === 'walk') body.walkT += dt;
    // 휘두르는 중: 받은 동작 · 시간에서 이어서(다음 소식까지 시간만 흐름)
    const a = mateNow.a, def = a && actDef(body.cls, a[0], a[1]);
    if (body.state === 'act' && def) {
      if (!body.act || body.act.key !== a.join()) body.act = { key: a.join(), def, kind: a[0], idx: a[1], time: a[2], s: a[3], a: a[4], r: a[5] };
      else body.act.time += dt;
    } else { body.act = null; if (body.state === 'act') body.state = 'idle'; }
  }

  // ── 같이 싸우기(3단계, 2026-10-25 사용자) ──
  // 손님 → 방장: 동작(act) · 위치(pos의 x · y · 스틱 · 무적) · 장비(kit). 방장 → 손님: 몹 소식(snap, 1초 20번) · 맞음(hurt) · 처치(kill).
  let evQ = [], snapQ = [], mateKit = null, apartT = 0;
  const myKit = () => { const pr = Game.prof; return { cls: pr.cls || 'swordsman', lv: pr.lv, equip: pr.equip, sockets: pr.sockets }; };
  const kitProf = k => ({ cls: k.cls, lv: k.lv, equip: k.equip, sockets: k.sockets, potions: 0, stones: {}, scrolls: {} });
  // 방장: 손님 장비로 만든 손님 몸(world.js start)
  function remotePlayer() {
    const m = Net.mate, k = mateKit || { cls: m.cls, lv: m.lv, equip: { weapon: m.weapon }, sockets: {} };
    const q = createPlayer(kitProf(k));
    q.remote = true;
    return q;
  }
  // 방장: 손님 위치 소식을 손님 몸에(방장 쪽에서도 스틱 값으로 걷게 해 두고, 소식이 오면 그 자리로)
  function remotePos(m) {
    const q = World.remote;
    q.x = m.x; q.y = m.y;
    if (q.state !== 'act' && (m.fx || m.fy)) q.fv = { x: m.fx, y: m.fy };
    q.rmove = m.mx !== undefined ? { x: m.mx, y: m.my } : null;
    q.ifr = !!m.ifr;
    const wasDead = q.dead;
    q.dead = m.st === 'dead';  // 손님 쓰러짐(몹은 안 노림, 누운 모습)
    if (q.dead) { q.state = 'dead'; q.act = null; } else if (wasDead) q.state = 'idle';
  }
  // 손님: 내 동작을 방장 쪽 내 몸에
  function sendAct(a) { Net.send(Object.assign({ t: 'act' }, a)); }
  Net.on('act', m => {
    const q = World.remote;
    if (!q || Game.scene !== 'run') return;
    q.x = m.x; q.y = m.y;
    World.as(q, () => {
      if (m.k === 'dodge') { startDodge(q, { x: m.fx, y: m.fy }); return; }
      const def = actDef(q.cls, m.k, m.i);
      if (!def) return;
      if (q.state === 'dodge') Elements.dashEnd(q);
      startAct(q, def, m.k, m.i);
      q.fv = { x: m.fx, y: m.fy };
      q.act.push = !!m.push;
    });
  });
  // 방장: 손님 몸이 맞음 → 손님 기기에서 무적 · 방어 · 피해(대시 중이면 빗나감)
  function remoteHurt(q, src, dmgRaw, knock) {
    if (q.dead || q.ifr) return 'miss';
    const enemy = !!src.def, slow = enemy ? !!((src.affixes && src.affixes.includes('frost')) || src.def.chillHit) : !!src.chill;
    Net.send({ t: 'hurt', d: Math.round(dmgRaw * 10) / 10, k: knock, x: r1(src.x), y: r1(src.y), slow: slow ? 1 : 0, cz: enemy && (src.chill > 0 || src.state === 'frozen') ? 1 : 0 });
    return 'hit';
  }
  Net.on('hurt', m => {
    if (!World.mirror || Game.scene !== 'run') return;
    const p = World.player;
    const r = hurtPlayer(p, { x: m.x, y: m.y, chill: m.cz, state: m.cz ? 'frozen' : '' }, m.d, m.k);
    if (r === 'hit' && m.slow) p.slowT = 2;
  });
  // 방장: 몹 처치 → 손님도 자기 경험치 · 전리품
  function hostKill(e) { Net.send({ t: 'kill', id: e.id }); }
  Net.on('kill', m => { if (World.mirror && Game.scene === 'run') World.remoteKill(m.id); });
  // 방장: 효과 알림 모으기(snap 에 실어 보냄)
  function queue(ev) { if (evQ.length < 400) evQ.push(ev); }
  // 손님: 몹 소식은 모아 두었다가 다음 계산 때 적용(world.js update)
  Net.on('snap', m => { if (World.mirror && Game.scene === 'run') { snapQ.push(m); if (snapQ.length > 6) snapQ.shift(); } });
  function applySnaps() { const q = snapQ; snapQ = []; for (const m of q) World.applySnap(m); }
  // 장비가 바뀜(던전 안 가방) → 방장 쪽 내 몸도
  function kitChanged() { if (World.mirror && Game.scene === 'run') Net.send({ t: 'kit', kit: myKit() }); }
  Net.on('kit', m => { mateKit = m.kit; const q = World.remote; if (q) { q.prof = kitProf(m.kit); refreshStats(q); } });
  // ── 쓰러짐 · 살리기 · 같이 나가기(4단계, 2026-10-25 사용자) ──
  // 파티 던전에서 체력이 0 이 되면(유니크 두 번째 기회가 없을 때) 친구가 살아 있으면 쓰러져 기다린다(world.js playerDown).
  // 쓰러진 친구 옆(REVIVE_R)에서 공격 버튼을 REVIVE_HOLD 초 누르고 있으면 revive → 그쪽 기기에서 체력 절반으로 일어남. 둘 다 쓰러지면 실패.
  // 방장이 계단을 오르면 leave → 손님도 같이 결과 화면(쓰러져 있었어도). 손님은 혼자 먼저 나갈 수 있다.
  const inParty = () => !!(Game.scene === 'run' && (World.remote || World.mirror));
  // 같은 파티 던전의 친구가 살아 있나(쓰러졌거나 나갔으면 false)
  function mateUp() {
    if (World.remote) return !World.remote.dead;
    if (World.mirror) return !!(Net.linked && mateNow && mateNow.s === 'run' && mateNow.r === World.partySeed && mateNow.st !== 'dead');
    return false;
  }
  const downedMate = () => { if (!inParty()) return null; const m = World.remote || runMate(); return m && m.dead ? m : null; };
  function canRevive() { const m = downedMate(), p = World.player; return !!(m && !p.dead && Math.hypot(m.x - p.x, m.y - p.y) < REVIVE_R); }
  let reviveK = 0, reviveCd = 0;
  function reviveTick(dt) {
    reviveCd -= dt;
    if (canRevive() && Input.isDown('attack') && !World.inputLock) {
      reviveK += dt;
      if (reviveK >= REVIVE_HOLD && reviveCd <= 0) { Net.send({ t: 'revive' }); reviveK = 0; reviveCd = 1.5; Sfx.potion(); }
    } else reviveK = Math.max(0, reviveK - dt * 2);
  }
  Net.on('revive', () => { if (Game.scene === 'run' && World.player.downed) World.revive(); });
  // 던전 그림용: 쓰러진 친구 · 살리는 정도(0~1) · 옆에 있나
  const reviveInfo = () => { const m = downedMate(); return m ? { m, k: Math.min(1, reviveK / REVIVE_HOLD), near: canRevive() } : null; };
  function leaveTogether() { Net.send({ t: 'leave' }); }
  Net.on('leave', () => {
    if (!World.mirror || Game.scene !== 'run') return;
    Game.toast('방장과 같이 마을로 돌아가요');
    Sfx.stairs();
    World.finishParty('clear');
  });

  // 한쪽이 던전을 나가거나 끊김: 방장 = 손님 몸을 빼고 혼자, 손님 = 몹을 내 기기에서 이어서(3초 기다림 — 같이 들어갈 때 조금 어긋나도 되게)
  function partyWatch(dt) {
    const inRun = Game.scene === 'run' && World.partySeed;
    if (!inRun || !(World.remote || World.mirror)) { apartT = 0; return; }
    const same = Net.linked && mateNow && mateNow.s === 'run' && mateNow.r === World.partySeed;
    apartT = same ? 0 : apartT + dt;
    if (apartT < 3) return;
    apartT = 0;
    if (World.remote) { World.dropRemote(); Game.toast('친구가 던전을 나갔어요'); }
    else { World.takeover(); Game.toast('방장이 던전을 나가서 혼자 계속해요'); }
  }
  // 마을 · 던전에 그릴 친구 몸(없으면 null) · 친구가 지금 어디 있나(마을이 아니면 패널에 표시)
  const townMate = () => (Game.scene === 'town' ? body : null);
  const runMate = () => (Game.scene === 'run' ? body : null);
  const mateWhere = () => (mateNow && mateNow.s !== 'town' ? WHERE[mateNow.s] || '' : '');

  // ── 파티로 던전 들어가기(2026-10-25 사용자) ──
  // 방장이 던전 고르기에서 들어가기 → 손님 레벨이 모자라면 방장에게 알림(혼자 갈지 물음) · 손님이 마을에 없어도 알림.
  // 아니면 손님에게 "같이 들어갈까요?" → 예 = 둘 다 같은 씨앗으로 입장, 아니요 · 30초 대답 없음 = 방장에게 혼자 갈지 물음.
  // 손님은 파티 중에 던전 입구로 혼자 못 간다(방장이 고름). 방장은 기다리는 동안 취소할 수 있다.
  const INVITE_WAIT = 30;
  let invite = null;  // 방장: { def, diff, seed, t }
  const diffName = diff => (diff ? ' · ' + DIFFS[diff].name : '');
  function askSolo(text, sub) {
    const iv = lastInvite;
    if (!iv || Game.scene !== 'select') { Game.toast(text); return; }
    Game.overlay({ type: 'confirm', text, sub: sub || '혼자 들어갈까요?', defaultYes: false, yes: () => Game.startRun(iv.def, iv.diff) });
  }
  let lastInvite = null;
  // 방장: 던전 고르기에서 들어가기를 눌렀을 때(ui.js select). true = 파티가 맡음(바로 들어가지 않음)
  function hostEnter(def, diff) {
    if (!Net.linked || Net.role !== 'host') return false;
    const m = Net.mate;
    lastInvite = { def, diff };
    if (m.lv < def.lv) { askSolo('친구(' + clsOf(m).name + ' Lv.' + m.lv + ')는 레벨이 모자라 같이 못 들어가요', '입장 Lv.' + def.lv + ' — 혼자 들어갈까요?'); return true; }
    if (!mateNow || mateNow.s !== 'town') { askSolo('친구가 마을에 없어요' + (mateWhere() ? ' (' + mateWhere() + ')' : ''), '혼자 들어갈까요?'); return true; }
    invite = { def, diff, seed: 1 + Math.floor(Math.random() * 2e9), t: INVITE_WAIT };
    Net.send({ t: 'invite', id: def.id, diff, seed: invite.seed });
    Game.overlay({ type: 'coopwait' });
    return true;
  }
  function inviteEnd() {
    invite = null;
    const top = Game.overlays[Game.overlays.length - 1];
    if (top && top.type === 'coopwait') Game.closeOverlay();
  }
  // 방장이 기다리는 창: 취소만 된다
  function waitUpdate() {
    if (Input.wasPressed('back') || Input.wasPressed('pause') || Input.wasPressed('ok')) { Net.send({ t: 'inviteCancel' }); inviteEnd(); Game.toast('같이 들어가기를 취소했어요'); }
  }
  function waitDraw(ctx) {
    time += 1 / 60;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });
    Gfx.panel(ctx, 230, 180, 500, 180, { border: '#b48cff' });
    if (!invite) return;
    T_(ctx, invite.def.name + diffName(invite.diff), 480, 222, 19, '#f0e0b8', 'center');
    T_(ctx, '친구에게 같이 들어갈지 묻는 중' + dots(), 480, 254, 15, '#b48cff', 'center');
    T_(ctx, Math.ceil(invite.t) + '초', 480, 278, 12, '#8a7e88', 'center');
    UI.zone(400, 300, 160, 40, { key: 'back', now: true });
    Gfx.panel(ctx, 410, 304, 140, 34, { border: '#5a4650', bg: '#1d151b' });
    T_(ctx, '취소 ' + L('back'), 480, 327, 14, '#e8e0d0', 'center');
  }
  // 손님: 초대를 받음
  Net.on('invite', m => {
    const def = DUNGEONS.find(d => d.id === m.id);
    if (!def || Game.scene !== 'town') { Net.send({ t: 'inviteNo', why: 'busy' }); return; }
    const prof = Game.prof;
    if (prof.lv < def.lv) { Net.send({ t: 'inviteNo', why: 'lv' }); return; }
    Sfx.wake();
    Game.overlay({ type: 'confirm', invite: m.seed, defaultYes: true,
      text: '방장이 ' + def.name + diffName(m.diff) + '에 들어가요',
      sub: '같이 들어갈까요? (입장 Lv.' + def.lv + ')',
      yes: () => { Net.send({ t: 'inviteYes', seed: m.seed, kit: myKit() }); Game.startRun(def, m.diff, m.seed); },  // kit = 방장 쪽 내 몸 장비
      no: () => Net.send({ t: 'inviteNo', why: 'no' }) });
  });
  // 손님: 방장이 취소함 → 묻는 창을 닫는다
  Net.on('inviteCancel', () => {
    const os = Game.overlays, i = os.findIndex(o => o.invite);
    if (i < 0) return;
    if (i === os.length - 1) Game.closeOverlay(); else os.splice(i, 1);
    Game.toast('방장이 같이 들어가기를 취소했어요');
  });
  // 방장: 대답
  Net.on('inviteYes', m => {
    if (!invite || m.seed !== invite.seed) return;
    mateKit = m.kit || null;
    const iv = invite;
    inviteEnd();
    Game.startRun(iv.def, iv.diff, iv.seed);
  });
  Net.on('inviteNo', m => {
    if (!invite) return;
    inviteEnd();
    askSolo(m.why === 'lv' ? '친구는 레벨이 모자라 같이 못 들어가요' : m.why === 'busy' ? '친구가 지금 마을에 없어요' : '친구가 안 들어간대요');
  });
  // ── 손님: 방장의 던전 고르기를 같이 본다(2026-10-25 사용자: 던파 파티 던전 입장처럼) ──
  // 방장이 고르기 화면에 들어가면 손님(마을, 다른 창이 없을 때)에게 같은 창이 열리고 커서 · 난이도가 따라 움직인다. 손님은 보기만(닫기는 됨).
  // 잠김 표시 = 실제 규칙: 앞 던전 · 난이도는 방장 것, 입장 레벨은 내 것. 방장이 들어가기를 누르면 그 위에 "같이 들어갈까요?"
  let viewClosed = false;
  const viewOpen = () => Game.overlays.some(o => o.type === 'coopview');
  function viewTick() {
    if (Net.role !== 'guest') return;
    const on = mateNow && mateNow.s === 'select';
    if (!on) {
      viewClosed = false;
      const i = Game.overlays.findIndex(o => o.type === 'coopview');
      if (i >= 0) { if (i === Game.overlays.length - 1) Game.closeOverlay(); else Game.overlays.splice(i, 1); }
      return;
    }
    if (!viewClosed && !viewOpen() && Game.scene === 'town' && !Game.overlays.length) Game.overlay({ type: 'coopview' });
  }
  function viewUpdate() {
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { viewClosed = true; Game.closeOverlay(); }
  }
  function viewDraw(ctx, prof, t) {
    if (!mateNow || mateNow.sel === undefined) return;
    const S = UI.select, keep = [S.sel, S.diff, S.top];
    S.sel = mateNow.sel; S.diff = mateNow.diff;
    const cl = {};
    for (const id of mateNow.cl || []) cl[id] = true;
    S.draw(ctx, Object.assign({}, prof, { cleared: cl, clearedDiff: mateNow.cd || {} }), t);
    [S.sel, S.diff, S.top] = keep;
    UI.zone(0, 0, 960, 540, { key: null });  // 보기만: 눌러도 아무 일 없게
    const m = Net.mate;
    Gfx.panel(ctx, 250, 6, 460, 30, { border: '#b48cff' });
    T_(ctx, '방장(' + clsOf(m).name + ' Lv.' + m.lv + ')이 던전을 고르는 중' + dots(), 480, 27, 14, '#e0d0ff', 'center');
    ctx.fillStyle = '#05030a'; ctx.fillRect(0, 524, 960, 16);
    T_(ctx, '방장이 들어가면 같이 갈지 물어요 · 닫기 ' + L('back'), 480, 535, 11, '#8a7e88', 'center');
    time += 1 / 60;
  }

  // 손님: 던전 입구(파티 중에는 방장이 고른다)
  function guestBlocked() {
    if (!Net.linked || Net.role !== 'guest') return false;
    Game.toast('파티 중에는 방장이 던전을 골라요 — 혼자 가려면 파티를 나가세요');
    return true;
  }

  const dots = () => '.'.repeat(1 + Math.floor(time * 2) % 3);
  function UI_hint(ctx, s) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 496, 960, 44);
    T_(ctx, s, 480, 522, 13, '#8a7e88', 'center');
  }

  return { open, update, draw, tick, townMate, runMate, mateWhere, hostEnter, guestBlocked, waitUpdate, waitDraw, viewUpdate, viewDraw,
    remotePlayer, remoteHurt, sendAct, hostKill, queue, applySnaps, kitChanged,
    inParty, mateUp, canRevive, reviveTick, reviveInfo, leaveTogether };
})();
