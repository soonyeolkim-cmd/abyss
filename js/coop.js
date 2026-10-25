// 파티(마을 메뉴 → 파티, overlay 'coop' — 2026-10-25 사용자: '함께하기' → '파티', 최대 4명): 방 만들기(내 방 코드 고정) · 방 들어가기 · 방 안(파티원 · 연결 속도).
// 창을 닫아도 방은 그대로 열려 있다(마을 왼쪽 아래 패널에 파티원). 이어지면 마을 · 파티 던전에서 서로 걷는 모습이 보인다(아래 tick).
// 손님끼리는 직접 잇지 않는다 — 손님이 보낸 위치 · 말풍선 · 살리기는 방장이 다른 손님에게 전한다(relay).
// 방 코드 넣기: ↑↓ 숫자 바꾸기 · ←→ 자리 옮기기 · 키보드 숫자키 바로 · Backspace 지우기 · 폰은 숫자판을 손가락으로(지난번 넣은 코드가 미리 들어 있음).
const Coop = (() => {
  const T_ = Gfx.text;
  const L = a => Input.label(a);
  const COLORS = ['#ffd36a', '#c9a8ff', '#7dd3ff', '#8aff9a'];  // 파티 순서(방장 0 · 손님 1~3)별 이름표 · 화살표 · 지도 점 색
  const colorOf = pid => COLORS[Net.slotOf(pid) % COLORS.length];
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
  function startEntry() {
    entering = true; cur = 0;
    const last = Net.lastJoin;  // 지난번에 들어간 방 코드를 미리(같은 친구 방에 또 들어가기 쉽게)
    digits = /^\d{4}$/.test(last) ? last.split('').map(Number) : [0, 0, 0, 0];
  }

  // 지금 보이는 버튼(위에서 아래로)
  function buttons() {
    const st = Net.state, host = Net.role === 'host';
    if (st === 'hosting') return [{ label: '닫기 (방은 그대로)', go: close }, { label: '방 닫기', go: () => { Net.leave(); Game.toast('방을 닫았어요'); } }];
    if (st === 'joining') return [{ label: '그만두기', go: () => Net.leave() }];
    if (st === 'ready') return [{ label: '닫기', go: close }, { label: host ? '방 닫기' : '방 나가기', go: () => { Net.leave(); Game.toast(host ? '방을 닫았어요' : '방을 나왔어요'); } }];
    return [
      { label: '방 만들기 (내 방 ' + Net.code + ')', go: () => Net.host() },
      { label: '방 들어가기', go: startEntry },
      { label: '내 방 코드 바꾸기', go: () => Game.overlay({ type: 'confirm', text: '내 방 코드를 새 번호로 바꿀까요?', sub: '지금 코드 ' + Net.code + ' — 친구에게 새 코드를 다시 알려 줘야 해요', yes: () => Game.toast('새 방 코드: ' + Net.newCode()) }) },
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

  const X = 190, Y = 60, W = 580, H = 420;
  function draw(ctx, o, prof) {
    time += 1 / 60;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });  // 창 밖을 눌러도 뒤가 눌리지 않게
    Gfx.panel(ctx, X, Y, W, H, { border: '#b48cff' });
    T_(ctx, '파티', 480, Y + 40, 24, '#e0d0ff', 'center');
    T_(ctx, '온라인 협동 · 방 코드로 최대 ' + Net.MAX + '명', 480, Y + 62, 12, '#9a8eaa', 'center');
    if (entering) { drawEntry(ctx); return; }
    const st = Net.state;
    if (!Net.available()) T_(ctx, '파티 기능을 불러오지 못했어요 — 인터넷을 켜고 새로고침해 주세요', 480, Y + 110, 13, '#ff8a6a', 'center');
    if (st === 'hosting') {
      T_(ctx, '내 방 코드', 480, Y + 108, 14, '#9a8eaa', 'center');
      if (Net.opened) T_(ctx, Net.code.split('').join(' '), 480, Y + 160, 52, '#ffd36a', 'center');
      else T_(ctx, '방을 여는 중' + dots(), 480, Y + 150, 20, '#c8b8a0', 'center');
      T_(ctx, '친구가 마을 메뉴 → 파티 → 방 들어가기에서 이 숫자를 넣으면 돼요 (코드는 늘 같아요)', 480, Y + 200, 12, '#c8b8a0', 'center');
      if (Net.opened) T_(ctx, '친구를 기다리는 중' + dots(), 480, Y + 228, 15, '#b48cff', 'center');
    } else if (st === 'joining') {
      T_(ctx, '방 ' + Net.code + ' 에 들어가는 중' + dots(), 480, Y + 160, 20, '#c8b8a0', 'center');
    } else if (st === 'ready') {
      drawRoom(ctx, prof);
    } else {
      T_(ctx, '파티를 맺으면 마을에서 서로 보이고, 방장이 고른 던전에 같이 들어가요.', 480, Y + 112, 14, '#c8b8a0', 'center');
      T_(ctx, '한 사람이 방을 만들고, 다른 사람(최대 ' + (Net.MAX - 1) + '명)이 방 코드를 넣어 들어가요.', 480, Y + 134, 13, '#9a8e96', 'center');
      if (st === 'error' && Net.err) T_(ctx, Net.err, 480, Y + 170, 13, '#ff8a6a', 'center');
    }
    drawButtons(ctx, buttons());
    UI_hint(ctx, '고르기 ' + L('ok') + ' · 닫기 ' + L('back'));
  }

  // 방 안: 나 + 파티원 아바타(최대 4), 각자 연결 속도
  function drawRoom(ctx, prof) {
    const host = Net.role === 'host', ms = Net.members();
    T_(ctx, '방 ' + Net.code + ' · ' + Net.count() + '/' + Net.MAX + '명', 480, Y + 90, 13, '#9a8eaa', 'center');
    const all = [{ me: true, p: prof, tag: host ? '방장' : '손님', col: colorOf(Net.myId) }, ...ms.map(m => ({ p: { cls: m.cls, lv: m.lv, equip: { weapon: m.weapon } }, tag: m.host ? '방장' : '손님', ping: m.ping, col: colorOf(m.pid), m }))];
    const gap = 132, x0 = 480 - (all.length - 1) * gap / 2;
    all.forEach((a, i) => {
      const x = x0 + i * gap;
      Art.avatar(ctx, a.p, x - 6, Y + 182, 3.6, time);
      T_(ctx, clsOf(a.p).name + ' Lv.' + a.p.lv, x, Y + 206, 15, '#f0e0b8', 'center');
      T_(ctx, (a.me ? '나 · ' : '') + a.tag, x, Y + 224, 12, a.col, 'center');
      if (!a.me && (host || a.m.host)) {  // 연결 속도: 방장은 손님마다, 손님은 방장과
        const pg = a.ping, q = !pg ? ['재는 중', '#9a8e96'] : pg < 90 ? ['좋음', '#7dff8a'] : pg < 200 ? ['보통', '#ffd36a'] : ['느림', '#ff8a6a'];
        T_(ctx, q[0] + (pg ? ' ' + pg + 'ms' : ''), x, Y + 240, 11, q[1], 'center');
      }
    });
    T_(ctx, host ? '던전 입구에서 고르면 파티원 모두에게 같이 갈지 물어요' : '방장이 던전을 고르면 같이 갈지 물어요', 480, Y + 268, 12, '#8a7e88', 'center');
  }

  function drawButtons(ctx, bs) {
    const top = Y + H - 26 - bs.length * 34;
    bs.forEach((b, i) => {
      const y = top + i * 34, on = i === sel;
      UI.zone(X + 110, y - 23, W - 220, 32, { pick: () => { sel = i; }, now: true });
      if (on) { ctx.fillStyle = 'rgba(180,140,255,0.14)'; ctx.fillRect(X + 110, y - 21, W - 220, 28); }
      T_(ctx, (on ? '▶ ' : '') + b.label, 480, y, 16, on ? '#ffd36a' : '#e8e0d0', 'center');
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

  // ── 서로 보이기(마을 · 파티 던전) ──
  // 각자 지금 장면 · 위치 · 바라보는 쪽 · 몸 상태를 보낸다(바뀌면 1초에 20번까지, 안 바뀌어도 1초마다). 던전이면 r = 파티 씨앗.
  // 방장은 받은 손님 위치를 다른 손님에게 전한다. 받은 위치로 부드럽게 따라가는 '친구 몸'을 town.js · world.js 가 그린다.
  // 던전 안 같이 싸우기 = 방장이 몹을 계산하고 손님은 따라 그린다(world.js 위 설명).
  const WHERE = { town: '마을', run: '던전', select: '던전 고르는 중', result: '결과 화면', title: '캐릭터 선택' };
  const BODY_STATES = { walk: 1, idle: 1, dodge: 1, hurt: 1, dead: 1, act: 1 };
  const mates = new Map();  // 피어 이름 → { now: 마지막 위치 소식, body: 그릴 몸, key }
  const mateOf = pid => { let m = mates.get(pid); if (!m) mates.set(pid, m = { now: null, body: null, key: '' }); return m; };
  let sendT = 0, keepT = 0, lastSent = '';
  const relay = (m, from) => { if (Net.role === 'host') Net.send(Object.assign({}, m, { from }), from); };  // 방장: 손님이 보낸 것을 다른 손님에게
  Net.on('pos', (m, from) => {
    mateOf(from).now = m;
    relay(m, from);
    const q = World.remotes.find(q => q.pid === from);
    if (q && m.s === 'run' && m.r === World.partySeed && (m.fl || 0) === World.floorNo) remotePos(q, m);
  });
  const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;

  // 지금 내 몸(마을 · 파티 던전) — 없으면 null
  function myBody() {
    if (Game.scene === 'town') return Town.player;
    if (Game.scene === 'run' && World.partySeed) return World.player;
    return null;
  }
  // 이 친구 몸을 보여 줄까: 둘 다 마을이거나, 같은 파티 던전
  const together = now => now && now.x !== undefined && ((now.s === 'town' && Game.scene === 'town' && (now.w || 'belloc') === Town.where) ||(now.s === 'run' && Game.scene === 'run' && World.partySeed && now.r === World.partySeed));

  // 매 화면(game.js frame): 내 위치 보내기 · 친구 몸 따라가기 · 초대 기다림 · 몹 소식
  function tick(dt) {
    partyWatch(dt);
    bubbleTick(dt);
    if (!Net.linked) { mates.clear(); lastSent = ''; if (invite) inviteEnd(); closeGoWait(); return; }
    const ms = Net.members(), ids = new Set(ms.map(m => m.pid));
    for (const pid of [...mates.keys()]) if (!ids.has(pid)) mates.delete(pid);  // 나간 친구
    if (invite && (invite.t -= dt) <= 0) { for (const [pid, s] of invite.st) if (s === 'wait') invite.st.set(pid, 'no'); checkInvite(); }
    sendT -= dt; keepT -= dt;
    if (sendT <= 0) {
      sendT = 1 / 20;
      const s = Game.scene, tp = myBody();
      const m = tp ? { t: 'pos', s, x: r1(tp.x), y: r1(tp.y), fx: r1(tp.fv.x), fy: r1(tp.fv.y), st: BODY_STATES[tp.state] ? tp.state : 'idle' } : { t: 'pos', s };
      if (s === 'town') m.w = Town.where;  // 어느 마을(벨록 · 실베인) — 같은 마을일 때만 서로 보임
      if (tp && s === 'run') {
        m.r = World.partySeed; m.fl = World.floorNo;
        const mv = moveInput(tp);  // 방장 쪽 내 몸이 다음 소식까지 같은 쪽으로 걷게
        if (mv) { m.mx = r2(mv.x); m.my = r2(mv.y); }
        if (tp.iframes > 0) m.ifr = 1;
        if (tp.state === 'act' && tp.act) { const a = tp.act; m.a = [a.kind, a.idx, r2(a.time), r2(a.s), r2(a.a), r2(a.r)]; }  // 친구 화면에 휘두르는 모습
      }
      if (s === 'select') {  // 방장 던전 고르기: 커서 · 난이도 · 깬 던전(손님 화면에 같은 고르기 창)
        const pr = Game.prof;
        Object.assign(m, { sel: UI.select.sel, diff: UI.select.diff, floor: UI.select.floor, cl: Object.keys(pr.cleared || {}), cd: pr.clearedDiff || {} });
      }
      const key = JSON.stringify(m);
      if (key !== lastSent || keepT <= 0) { Net.send(m); lastSent = key; keepT = 1; }
      // 파티 방장: 손님마다 그 둘레 몹 · 탄 · 장판 + 그동안 생긴 효과
      if (World.remotes.length && s === 'run') {
        const g = World.takeGone();
        for (const q of World.remotes) { const sn = World.snapshot(q); sn.g = g; sn.ev = evQ.get(q.pid) || []; evQ.set(q.pid, []); Net.sendTo(q.pid, sn); }
      }
    }
    viewTick();
    for (const info of ms) updateBody(info, dt);
  }
  function updateBody(info, dt) {
    const mt = mateOf(info.pid), now = mt.now;
    if (!together(now)) { mt.body = null; return; }
    const k = info.cls + ':' + (info.weapon ? info.weapon.uid + ':' + info.weapon.base : '') + ':' + JSON.stringify(info.sockets || {});
    let body = mt.body;
    if (!body || k !== mt.key) {  // 처음 · 직업 · 무기 · 속성석이 바뀌면 다시
      mt.key = k;
      body = mt.body = { pid: info.pid, cls: clsOf(info), prof: { cls: info.cls, equip: { weapon: info.weapon }, sockets: info.sockets || {} }, stats: { fx: {} },
        x: now.x, y: now.y, fv: { x: 0, y: 1 }, state: 'idle', walkT: 0, flash: 0, charge: 0, act: null };
    }
    body.lv = info.lv;
    const d = Math.hypot(now.x - body.x, now.y - body.y);
    if (d > 80) { body.x = now.x; body.y = now.y; }  // 너무 멀면 바로(새로 들어옴 등)
    else { const f = 1 - Math.exp(-dt * (now.st === 'dodge' ? 20 : 12)); body.x += (now.x - body.x) * f; body.y += (now.y - body.y) * f; }
    if (now.fx || now.fy) body.fv = { x: now.fx, y: now.fy };
    body.state = now.st || 'idle';
    if (body.state === 'idle' && d > 2) body.state = 'walk';  // 따라가는 중에는 걷는 모습
    body.dodgeV = body.fv; body.dead = body.state === 'dead';
    if (body.state === 'walk') body.walkT += dt;
    // 휘두르는 중: 받은 동작 · 시간에서 이어서(다음 소식까지 시간만 흐름)
    const a = now.a, def = a && actDef(body.cls, a[0], a[1]);
    if (body.state === 'act' && def) {
      if (!body.act || body.act.key !== a.join()) body.act = { key: a.join(), def, kind: a[0], idx: a[1], time: a[2], s: a[3], a: a[4], r: a[5] };
      else body.act.time += dt;
    } else { body.act = null; if (body.state === 'act') body.state = 'idle'; }
  }
  // 마을 · 던전에 그릴 친구 몸들
  const bodies = () => [...mates.values()].map(m => m.body).filter(Boolean);
  const townMates = () => (Game.scene === 'town' ? bodies() : []);
  const runMates = () => (Game.scene === 'run' ? bodies() : []);
  // 마을 왼쪽 아래 패널: 파티원 한 줄씩(직업 Lv · 어디 · 연결 속도)
  function panelLines() {
    if (Net.state === 'hosting') return [{ s: '방 ' + Net.code + ' · 친구 기다리는 중', col: '#e0d0ff' }];
    if (Net.state === 'joining') return [{ s: '방 ' + Net.code + ' 들어가는 중', col: '#e0d0ff' }];
    if (!Net.linked) return [];
    return Net.members().map(m => {
      const now = (mates.get(m.pid) || {}).now, where = now && now.s !== 'town' ? WHERE[now.s] || '' : '';
      return { s: (m.host ? '방장 · ' : '') + clsOf(m).name + ' Lv.' + m.lv + (where ? ' · ' + where : m.ping ? ' · ' + m.ping + 'ms' : ''), col: colorOf(m.pid) };
    });
  }

  // ── 같이 싸우기(3단계) ──
  // 손님 → 방장: 동작(act) · 위치(pos의 x · y · 스틱 · 무적) · 장비(kit). 방장 → 그 손님: 몹 소식(snap, 1초 20번) · 맞음(hurt). 방장 → 모두: 처치(kill).
  const evQ = new Map();  // 손님마다 모아 둔 효과 알림
  let snapQ = [], runKits = new Map();
  const myKit = () => { const pr = Game.prof; return { cls: pr.cls || 'swordsman', lv: pr.lv, equip: pr.equip, sockets: pr.sockets }; };
  const kitProf = k => ({ cls: k.cls, lv: k.lv, equip: k.equip, sockets: k.sockets, potions: 0, stones: {}, scrolls: {} });
  // 방장: 같이 들어온 손님마다 그 장비로 만든 몸(world.js start)
  function remotePlayers() {
    const out = [];
    for (const [pid, k] of runKits) {
      const info = Net.members().find(m => m.pid === pid);
      const kit = k || (info && { cls: info.cls, lv: info.lv, equip: { weapon: info.weapon }, sockets: info.sockets || {} });
      if (!kit) continue;
      const q = createPlayer(kitProf(kit));
      q.remote = true; q.pid = pid; q.apartT = 0;
      out.push(q);
    }
    return out;
  }
  // 방장: 손님 위치 소식을 그 손님 몸에(방장 쪽에서도 스틱 값으로 걷게 해 두고, 소식이 오면 그 자리로)
  function remotePos(q, m) {
    q.x = m.x; q.y = m.y;
    if (q.state !== 'act' && (m.fx || m.fy)) q.fv = { x: m.fx, y: m.fy };
    q.rmove = m.mx !== undefined ? { x: m.mx, y: m.my } : null;
    q.ifr = !!m.ifr;
    const wasDead = q.dead;
    q.dead = m.st === 'dead';  // 손님 쓰러짐(몹은 안 노림, 누운 모습)
    if (q.dead) { q.state = 'dead'; q.act = null; } else if (wasDead) q.state = 'idle';
  }
  // 손님: 내 동작을 방장 쪽 내 몸에
  function sendAct(a) { Net.send(Object.assign({ t: 'act', fl: World.floorNo }, a)); }
  Net.on('act', (m, from) => {
    const q = World.remotes.find(q => q.pid === from);
    if (!q || Game.scene !== 'run' || (m.fl || 0) !== World.floorNo) return;
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
  // 방장: 손님 몸이 맞음 → 그 손님 기기에서 무적 · 방어 · 피해(대시 중이면 빗나감)
  function remoteHurt(q, src, dmgRaw, knock) {
    if (q.dead || q.ifr) return 'miss';
    const enemy = !!src.def, slow = enemy ? !!((src.affixes && src.affixes.includes('frost')) || src.def.chillHit) : !!src.chill;
    Net.sendTo(q.pid, { t: 'hurt', d: Math.round(dmgRaw * 10) / 10, k: knock, x: r1(src.x), y: r1(src.y), slow: slow ? 1 : 0, cz: enemy && (src.chill > 0 || src.state === 'frozen') ? 1 : 0 });
    return 'hit';
  }
  Net.on('hurt', m => {
    if (!World.mirror || Game.scene !== 'run') return;
    const p = World.player;
    const r = hurtPlayer(p, { x: m.x, y: m.y, chill: m.cz, state: m.cz ? 'frozen' : '' }, m.d, m.k);
    if (r === 'hit' && m.slow) p.slowT = 2;
  });
  // 방장: 몹 처치 → 손님들도 각자 경험치 · 전리품
  function hostKill(e) { Net.send({ t: 'kill', id: e.id }); }
  Net.on('kill', m => { if (World.mirror && Game.scene === 'run') World.remoteKill(m.id); });
  // 방장: 효과 알림 모으기(그 손님 snap 에 실어 보냄)
  function queue(pid, ev) { let q = evQ.get(pid); if (!q) evQ.set(pid, q = []); if (q.length < 400) q.push(ev); }
  // 손님: 몹 소식은 모아 두었다가 다음 계산 때 적용(world.js update)
  Net.on('snap', m => { if (World.mirror && Game.scene === 'run') { snapQ.push(m); if (snapQ.length > 6) snapQ.shift(); } });
  function applySnaps() { const q = snapQ; snapQ = []; for (const m of q) World.applySnap(m); }
  // 장비가 바뀜(던전 안 가방) → 방장 쪽 내 몸도
  function kitChanged() { if (World.mirror && Game.scene === 'run') Net.send({ t: 'kit', kit: myKit() }); }
  Net.on('kit', (m, from) => { runKits.set(from, m.kit); const q = World.remotes.find(q => q.pid === from); if (q) { q.prof = kitProf(m.kit); refreshStats(q); } });

  // ── 쓰러짐 · 살리기 · 같이 나가기(4단계) ──
  // 파티 던전에서 체력이 0 이 되면(유니크 두 번째 기회가 없을 때) 살아 있는 파티원이 있으면 쓰러져 기다린다(world.js playerDown).
  // 쓰러진 파티원 옆(REVIVE_R)에서 공격 버튼을 REVIVE_HOLD 초 누르고 있으면 revive → 그 기기에서 체력 절반으로 일어남. 모두 쓰러지면 실패.
  // 방장이 계단을 오르면 leave → 손님들도 같이 결과 화면(쓰러져 있었어도). 손님은 혼자 먼저 나갈 수 있다.
  const inParty = () => !!(Game.scene === 'run' && (World.remotes.length || World.mirror));
  const runBodies = () => (World.remotes.length ? World.remotes : runMates());  // 방장 = 손님 몸들, 손님 = 받은 위치로 그리는 몸들
  // 같은 파티 던전에 살아 있는 파티원이 있나
  function mateUp() {
    if (!inParty()) return false;
    if (World.remotes.length) return World.remotes.some(q => !q.dead);
    if (!Net.linked) return false;
    return [...mates.values()].some(m => m.now && m.now.s === 'run' && m.now.r === World.partySeed && m.now.st !== 'dead');
  }
  function reviveTarget() {
    const p = World.player;
    if (!inParty() || p.dead) return null;
    let best = null, bd = REVIVE_R;
    for (const m of runBodies()) if (m.dead) { const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  const canRevive = () => !!reviveTarget();
  let reviveK = 0, reviveCd = 0, reviving = null;
  function reviveTick(dt) {
    reviveCd -= dt;
    const tg = reviveTarget();
    if (tg && Input.isDown('attack') && !World.inputLock) {
      if (reviving !== tg) { reviving = tg; reviveK = 0; }
      reviveK += dt;
      if (reviveK >= REVIVE_HOLD && reviveCd <= 0) {
        if (Net.role === 'host') Net.sendTo(tg.pid, { t: 'revive' }); else Net.send({ t: 'revive', to: tg.pid });
        reviveK = 0; reviveCd = 1.5; Sfx.potion();
      }
    } else reviveK = Math.max(0, reviveK - dt * 2);
  }
  Net.on('revive', (m, from) => {
    if (Net.role === 'host' && m.to && m.to !== Net.myId) { Net.sendTo(m.to, { t: 'revive', from }); return; }  // 손님 → 다른 손님 살리기는 방장이 전함
    if (Game.scene === 'run' && World.player.downed) World.revive();
  });
  // 던전 그림용: 쓰러진 파티원마다 { m, k(살리는 정도 0~1), near(내가 옆에 있나) }
  function reviveInfo() {
    if (!inParty()) return [];
    const tg = reviveTarget();
    return runBodies().filter(m => m.dead).map(m => ({ m, k: m === tg && reviving === tg ? Math.min(1, reviveK / REVIVE_HOLD) : 0, near: m === tg }));
  }
  function leaveTogether() { Net.send({ t: 'leave' }); }
  // 끝없는 심연: 방장이 계단을 내려가면 같은 런의 손님도 같이 다음 층으로(쓰러져 있던 손님도 일어나서)
  function descendTogether(f) { Net.send({ t: 'descend', f, r: World.partySeed }); }
  Net.on('descend', m => {
    if (!World.mirror || Game.scene !== 'run' || m.r !== World.partySeed) return;
    snapQ = [];
    Game.toast('방장과 같이 ' + m.f + '층으로 내려가요');
    World.descend(m.f);
  });
  Net.on('leave', () => {
    if (!World.mirror || Game.scene !== 'run') return;
    Game.toast('방장과 같이 마을로 돌아가요');
    Sfx.stairs();
    World.finishParty('clear');
  });

  // ── 머리 위 말풍선(파티): 강화 결과 · 속성석/보석 합치기 · 유니크 획득 ──
  // 내 머리 위에 띄우고 파티원 모두에게도 보낸다(bubble, 방장이 전함). BUBBLE_SHOW 초 동안, 새 일이 생기면 바뀜. 파티원이 유니크를 얻으면 소리 · 알림 글도.
  // b = { kind: 'forge', item, ok, n(도전한 단계) } · { kind: 'stone', stone } · { kind: 'unique', item } · { kind: 'jar', item }(도박꾼 항아리 결과)
  const BUBBLE_SHOW = 4;
  // 항아리 말풍선(2026-10-25 사용자: 유니크는 화려하게, 레어는 적당히, 매직 · 일반은 망했다는 느낌) — 등급마다 보이는 시간도 다름
  const jarTier = it => (it.uniq ? 'jackpot' : it.rarity >= 2 ? 'good' : 'bad');
  const showFor = f => (f.kind !== 'jar' ? BUBBLE_SHOW : { jackpot: 6, good: 4, bad: 3.5 }[jarTier(f.item)]);
  let bubMine = null;
  const bubs = new Map();  // 피어 이름 → 말풍선
  function brag(b) {
    if (!Net.linked) return;
    b = JSON.parse(JSON.stringify(b));
    bubMine = Object.assign({ t: 0 }, b);
    Net.send({ t: 'bubble', b });
  }
  const forgeShow = (item, ok, before) => brag({ kind: 'forge', item, ok, n: before + 1 });
  Net.on('bubble', (m, from) => {
    relay(m, from);
    const b = m.b;
    bubs.set(from, Object.assign({ t: 0 }, b));
    const who = Net.members().find(x => x.pid === from);
    const name = who ? clsOf(who).name + ' 친구' : '친구';
    if (b.kind === 'unique') { Sfx.unique(0.6); Game.toast(name + '가 유니크를 얻었어요 — ' + b.item.name); }
    else if (b.kind === 'jar') {
      const tier = jarTier(b.item);
      if (tier === 'jackpot') { Sfx.unique(0.6); Game.toast(name + '가 항아리에서 유니크를 뽑았어요! — ' + b.item.name); }
      else if (tier === 'good') Sfx.drop(2);
      else Sfx.forgeFail();  // 꽝: 둔탁한 쿵 + 내려가는 소리
    }
    else if (b.ok !== false && Game.scene === 'town') Sfx.stone();
  });
  function bubbleTick(dt) {
    if (bubMine && (bubMine.t += dt) > showFor(bubMine)) bubMine = null;
    for (const [pid, f] of [...bubs]) if ((f.t += dt) > showFor(f)) bubs.delete(pid);
  }
  // 말풍선 하나: (x, y) = 머리 위 끝(화면 좌표). 톡 튀어나와 살짝 떠오르고 끝에 흐려진다
  function bubble(ctx, f, x, y) {
    if (f.kind === 'jar') { jarBubble(ctx, f, x, y); return; }
    const k = f.t, a = k > BUBBLE_SHOW - 0.6 ? Math.max(0, (BUBBLE_SHOW - k) / 0.6) : 1;
    const s = Math.min(1, 0.5 + k / 0.15 * 0.5) + (k < 0.35 ? Math.sin(k / 0.35 * Math.PI) * 0.12 : 0);
    // 종류별 글 · 색
    let top, main, col, edge, glow, bg = '#1d151b';
    if (f.kind === 'forge') { top = '+' + f.n + ' 강화'; main = f.ok ? '성공!' : '실패'; col = f.ok ? '#ffd36a' : '#ff7a6a'; edge = f.ok ? '#ffd36a' : '#a05a5a'; glow = f.ok ? '255,211,106' : null; bg = f.ok ? '#2a1f0e' : '#1d1416'; }
    else if (f.kind === 'stone') { const c = ELEMENTS[f.stone.el].color; top = '합치기 성공!'; main = stoneName(f.stone); col = c; edge = c; glow = '255,255,255'; }
    else { top = '유니크 획득!'; main = f.item.name; col = RARITY[f.item.rarity].color; edge = col; glow = '255,170,80'; bg = '#2a1a0c'; }
    ctx.font = 'bold 15px ' + Gfx.FONT;
    const w = Math.max(128, Math.ceil(ctx.measureText(main).width) + 58), h = 40;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(Math.round(x), Math.round(y - 6 * Math.min(1, k / 0.4)));
    ctx.scale(s, s);
    ctx.fillStyle = edge;  // 꼬리
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    Gfx.panel(ctx, -w / 2, -h - 2, w, h, { border: edge, bg });
    const ix = -w / 2 + 22, iy = -h / 2 - 2;
    if (glow) {  // 아이콘 뒤 빛(유니크는 반짝이며)
      const g = ctx.createRadialGradient(ix, iy, 0, ix, iy, 20 + (f.kind === 'unique' ? Math.sin(k * 10) * 3 : 0));
      g.addColorStop(0, 'rgba(' + glow + ',0.55)'); g.addColorStop(1, 'rgba(' + glow + ',0)');
      ctx.fillStyle = g; ctx.fillRect(-w / 2 + 2, -h, 40, h - 4);
    }
    if (f.kind === 'stone') Gfx.stoneIcon(ctx, f.stone, ix, iy, 26);
    else Gfx.icon(ctx, f.item, ix, iy, 26);
    if (f.kind === 'forge' && !f.ok) {  // 실패: 아이콘 위 금 간 표시
      ctx.strokeStyle = 'rgba(255,122,106,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-w / 2 + 12, -h + 6); ctx.lineTo(-w / 2 + 32, -8); ctx.stroke();
    }
    T_(ctx, top, -w / 2 + 44, -h + 15, 12, f.kind === 'unique' ? '#ffb86a' : '#e8dcc8');
    T_(ctx, main, -w / 2 + 44, -h + 33, f.kind === 'forge' ? 16 : 15, col);
    ctx.restore();
  }
  // 항아리 결과 말풍선. 대박(유니크) = 크게 튀어나옴 · 뒤에서 도는 금빛 빛살 · 무지개 테두리 · 둘레를 도는 별,
  // 쏠쏠(레어) = 금빛 테두리 · 아이콘 뒤 빛 · 반짝 둘, 꽝(매직 · 일반) = 잿빛 · 아이콘에 금 · 축 처지며 가라앉음 · 식은땀 한 방울
  function jarBubble(ctx, f, x, y) {
    const k = f.t, dur = showFor(f), tier = jarTier(f.item), it = f.item;
    const a = k > dur - 0.6 ? Math.max(0, (dur - k) / 0.6) : 1;
    const big = tier === 'jackpot' ? 1.2 : 1, pop = tier === 'bad' ? 0.06 : tier === 'good' ? 0.14 : 0.3;
    const s = big * (Math.min(1, 0.5 + k / 0.15 * 0.5) + (k < 0.4 ? Math.sin(k / 0.4 * Math.PI) * pop : 0));
    const rc = RARITY[it.rarity].color;
    const top = tier === 'jackpot' ? '★ 항아리 대박! ★' : tier === 'good' ? '항아리 쏠쏠!' : it.rarity ? '항아리 꽝…' : '항아리 대꽝…';
    const hue = (k * 160) % 360;
    const edge = tier === 'jackpot' ? 'hsl(' + hue + ',95%,65%)' : tier === 'good' ? '#ffd34d' : '#5a5058';
    const bg = tier === 'jackpot' ? '#2a1a0c' : tier === 'good' ? '#2a220e' : '#151216';
    ctx.font = 'bold 15px ' + Gfx.FONT;
    const w = Math.max(140, Math.ceil(ctx.measureText(it.name).width) + 58), h = 40;
    ctx.save();
    ctx.globalAlpha = a;
    // 대박 · 쏠쏠은 떠오르고, 꽝은 축 처져 내려가며 살짝 기운다
    const dy = tier === 'bad' ? Math.min(8, k * 5) : -6 * Math.min(1, k / 0.4);
    ctx.translate(Math.round(x), Math.round(y + dy));
    if (tier === 'bad') ctx.rotate(-0.06 * Math.min(1, k / 0.8));
    ctx.scale(s, s);
    if (tier === 'jackpot') {  // 뒤에서 도는 빛살(밝게 더하기)
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(0, -h / 2 - 2); ctx.rotate(k * 0.9);
      for (let i = 0; i < 10; i++) {
        ctx.rotate(Math.PI / 5);
        ctx.fillStyle = 'hsla(' + ((hue + i * 36) % 360) + ',95%,62%,' + (0.16 + 0.06 * Math.sin(k * 6 + i)) + ')';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, -w * 0.75); ctx.lineTo(9, -w * 0.75); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = edge;  // 꼬리
    ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
    Gfx.panel(ctx, -w / 2, -h - 2, w, h, { border: edge, bg });
    const ix = -w / 2 + 22, iy = -h / 2 - 2;
    if (tier !== 'bad') {  // 아이콘 뒤 빛
      const glow = tier === 'jackpot' ? '255,170,80' : '255,211,77', r = tier === 'jackpot' ? 22 + Math.sin(k * 10) * 3 : 18;
      const g = ctx.createRadialGradient(ix, iy, 0, ix, iy, r);
      g.addColorStop(0, 'rgba(' + glow + ',' + (tier === 'jackpot' ? 0.7 : 0.45) + ')'); g.addColorStop(1, 'rgba(' + glow + ',0)');
      ctx.fillStyle = g; ctx.fillRect(-w / 2 + 2, -h, 40, h - 4);
    }
    if (tier === 'bad') ctx.globalAlpha = a * 0.6;
    Gfx.icon(ctx, it, ix, iy, 26);
    ctx.globalAlpha = a;
    if (tier === 'bad') {  // 아이콘 위 금 · 식은땀
      ctx.strokeStyle = 'rgba(160,150,160,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ix - 8, iy - 12); ctx.lineTo(ix + 1, iy - 2); ctx.lineTo(ix - 3, iy + 3); ctx.lineTo(ix + 8, iy + 12); ctx.stroke();
      const sy = -h - 4 + Math.min(6, k * 4);
      ctx.fillStyle = '#8ac8ff';
      ctx.beginPath(); ctx.moveTo(w / 2 - 6, sy - 7); ctx.quadraticCurveTo(w / 2 - 1, sy, w / 2 - 6, sy + 2); ctx.quadraticCurveTo(w / 2 - 11, sy, w / 2 - 6, sy - 7); ctx.fill();
    }
    T_(ctx, top, -w / 2 + 44, -h + 15, 12, tier === 'jackpot' ? 'hsl(' + ((hue + 40) % 360) + ',95%,72%)' : tier === 'good' ? '#ffe08a' : '#8a7e88');
    T_(ctx, it.name, -w / 2 + 44, -h + 33, 15, tier === 'bad' ? (it.rarity ? '#5a7ab0' : '#9a9298') : rc);
    // 반짝이는 별(대박 = 둘레를 도는 여섯, 쏠쏠 = 모서리 둘)
    const star = (sx, sy, r, col) => { ctx.fillStyle = col; ctx.fillRect(sx - r, sy - 1, r * 2, 2); ctx.fillRect(sx - 1, sy - r, 2, r * 2); };
    if (tier === 'jackpot') for (let i = 0; i < 6; i++) {
      const an = k * 1.6 + i * Math.PI / 3, tw = 0.5 + 0.5 * Math.sin(k * 8 + i * 2);
      star(Math.cos(an) * (w / 2 + 8), -h / 2 - 2 + Math.sin(an) * (h / 2 + 12), 2 + tw * 3, 'hsl(' + ((hue + i * 60) % 360) + ',100%,80%)');
    }
    else if (tier === 'good') { const tw = Math.sin(k * 5); if (tw > 0) { star(w / 2 - 4, -h - 2, 1 + tw * 3, '#fff6c0'); star(-w / 2 + 6, -4, 1 + (1 - tw) * 2, '#fff6c0'); } }
    ctx.restore();
  }
  // 마을(town.js) · 던전(world.js) 그림: 내 머리 위 · 파티원 머리 위. sx/sy = 게임 좌표 → 화면 좌표, off = 발에서 머리 위까지
  function drawBubbles(ctx, me, sx, sy, off = 78) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bubMine && me) bubble(ctx, bubMine, sx(me.x), sy(me.y) - off);
    const here = Game.scene === 'run' ? runBodies() : townMates();
    for (const b of here) { const f = bubs.get(b.pid); if (f) bubble(ctx, f, sx(b.x), sy(b.y) - off); }
    ctx.restore();
  }

  // 한쪽이 던전을 나가거나 끊김: 방장 = 그 손님 몸을 빼고 계속, 손님 = 방장이 나가면 몹을 내 기기에서 이어서(3초 기다림 — 같이 들어갈 때 조금 어긋나도 되게)
  let apartT = 0;
  const inSameRun = pid => { const m = mates.get(pid); return !!(Net.linked && m && m.now && m.now.s === 'run' && m.now.r === World.partySeed); };
  function partyWatch(dt) {
    if (Game.scene !== 'run' || !World.partySeed) { apartT = 0; return; }
    for (const q of [...World.remotes]) {
      q.apartT = inSameRun(q.pid) ? 0 : (q.apartT || 0) + dt;
      if (q.apartT >= 3) { World.dropRemote(q.pid); Game.toast(clsOf(q.prof).name + ' 친구가 던전을 나갔어요'); }
    }
    if (!World.mirror) { apartT = 0; return; }
    apartT = inSameRun(Net.hostId) ? 0 : apartT + dt;
    if (apartT >= 3) { apartT = 0; World.takeover(); Game.toast('방장이 던전을 나가서 혼자 계속해요'); }
  }

  // ── 파티로 던전 들어가기 ──
  // 방장이 던전 고르기에서 들어가기 → 파티원마다: 레벨이 모자람 · 마을에 없음은 못 감, 나머지에게 "같이 들어갈까요?".
  // 방장 창(coopwait)에 파티원마다 대답이 보이고, 모두 대답하면(또는 방장이 '출발') 예라고 한 사람들과 같은 씨앗으로 들어간다(go).
  // 예라고 한 손님은 출발 소식이 올 때까지 기다린다(coopgo). 아무도 못 가면 방장에게 혼자 갈지 묻는다.
  const INVITE_WAIT = 30;
  const ST_TEXT = { wait: ['묻는 중', '#b48cff'], yes: ['같이 가요!', '#7dff8a'], no: ['안 가요', '#ff8a6a'], lv: ['레벨 부족', '#ff8a6a'], busy: ['마을에 없음', '#9a8e96'] };
  let invite = null;  // 방장: { def, diff, seed, t, st: 피어 → 상태, kits: 피어 → 장비 }
  let lastInvite = null;
  const diffName = (diff, def) => (diff && !(def && def.endless) ? ' · ' + DIFFS[diff].name : '');
  const runDef = m => (m.f ? endlessDef(m.f) : DUNGEONS.find(d => d.id === m.id));  // 초대 · 출발 소식 → 던전
  function askSolo(text, sub) {
    const iv = lastInvite;
    if (!iv || Game.scene !== 'select') { Game.toast(text); return; }
    Game.overlay({ type: 'confirm', text, sub: sub || '혼자 들어갈까요?', defaultYes: false, yes: () => Game.startRun(iv.def, iv.diff) });
  }
  // 방장: 던전 고르기에서 들어가기를 눌렀을 때(ui.js select). true = 파티가 맡음(바로 들어가지 않음)
  function hostEnter(def, diff) {
    if (!Net.linked || Net.role !== 'host') return false;
    lastInvite = { def, diff };
    const st = new Map();
    for (const m of Net.members()) {
      const now = (mates.get(m.pid) || {}).now;
      st.set(m.pid, m.lv < def.lv ? 'lv' : !now || now.s !== 'town' ? 'busy' : 'wait');
    }
    const asks = [...st].filter(([, s]) => s === 'wait').map(([pid]) => pid);
    if (!asks.length) {
      const allLv = [...st.values()].every(s => s === 'lv');
      askSolo(allLv ? '파티원 모두 레벨이 모자라 같이 못 들어가요' : '지금 같이 갈 수 있는 파티원이 없어요', (allLv ? '입장 Lv.' + def.lv + ' — ' : '') + '혼자 들어갈까요?');
      return true;
    }
    invite = { def, diff, seed: 1 + Math.floor(Math.random() * 2e9), t: INVITE_WAIT, st, kits: new Map() };
    for (const pid of asks) Net.sendTo(pid, { t: 'invite', id: def.id, f: def.floor, diff, seed: invite.seed });
    Game.overlay({ type: 'coopwait' });
    return true;
  }
  function inviteEnd() {
    invite = null;
    const i = Game.overlays.findIndex(o => o.type === 'coopwait');
    if (i >= 0) { if (i === Game.overlays.length - 1) Game.closeOverlay(); else Game.overlays.splice(i, 1); }
  }
  // 방장: 모두 대답했나 → 출발 / 아무도 못 감
  function checkInvite() {
    if (!invite) return;
    const st = [...invite.st];
    if (st.some(([, s]) => s === 'wait')) return;
    if (st.some(([, s]) => s === 'yes')) go(); else { inviteEnd(); askSolo('같이 갈 파티원이 없어요'); }
  }
  // 방장: 예라고 한 사람들과 출발(아직 대답 안 한 사람에게는 취소)
  function go() {
    const iv = invite, yes = [...iv.st].filter(([, s]) => s === 'yes').map(([pid]) => pid);
    for (const [pid, s] of iv.st) if (s === 'wait') Net.sendTo(pid, { t: 'inviteCancel' });
    inviteEnd();
    runKits = new Map(yes.map(pid => [pid, iv.kits.get(pid)]));
    const size = 1 + yes.length;
    for (const pid of yes) Net.sendTo(pid, { t: 'go', id: iv.def.id, f: iv.def.floor, diff: iv.diff, seed: iv.seed, size });
    Game.startRun(iv.def, iv.diff, iv.seed, size);
  }
  // 방장이 기다리는 창: 파티원마다 대답 · 출발(예가 한 명이라도 있으면) · 취소
  function waitUpdate() {
    if (!invite) return;
    const anyYes = [...invite.st.values()].includes('yes');
    if (Input.wasPressed('ok') && anyYes) { go(); return; }
    if (Input.wasPressed('back') || Input.wasPressed('pause')) {
      for (const [pid, s] of invite.st) if (s === 'wait' || s === 'yes') Net.sendTo(pid, { t: 'inviteCancel' });
      inviteEnd(); Game.toast('같이 들어가기를 취소했어요');
    }
  }
  function waitDraw(ctx) {
    time += 1 / 60;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });
    if (!invite) return;
    const rows = [...invite.st], h = 150 + rows.length * 26, top = 270 - h / 2;
    Gfx.panel(ctx, 230, top, 500, h, { border: '#b48cff' });
    T_(ctx, invite.def.name + diffName(invite.diff, invite.def), 480, top + 34, 19, '#f0e0b8', 'center');
    T_(ctx, '파티원에게 같이 들어갈지 묻는 중' + dots() + '  ' + Math.ceil(invite.t) + '초', 480, top + 58, 13, '#b48cff', 'center');
    rows.forEach(([pid, s], i) => {
      const m = Net.members().find(x => x.pid === pid), y = top + 88 + i * 26, [txt, col] = ST_TEXT[s];
      T_(ctx, m ? clsOf(m).name + ' Lv.' + m.lv : '?', 420, y, 14, colorOf(pid), 'right');
      T_(ctx, txt, 440, y, 14, col);
    });
    const anyYes = rows.some(([, s]) => s === 'yes'), by = top + h - 44;
    [['출발 ' + L('ok'), 'ok', anyYes ? '#7dff8a' : '#5a5058'], ['취소 ' + L('back'), 'back', '#e8e0d0']].forEach(([s, k, c], i) => {
      const bx = 480 - 130 + i * 140;
      UI.zone(bx, by, 120, 34, { key: k, now: true });
      Gfx.panel(ctx, bx, by, 120, 32, { border: i ? '#5a4650' : anyYes ? '#4a8a50' : '#3a3036', bg: '#1d151b' });
      T_(ctx, s, bx + 60, by + 21, 14, c, 'center');
    });
  }
  // 손님: 초대를 받음
  let goWait = null;  // 손님: 예라고 하고 출발을 기다리는 중 { def, diff, seed }
  Net.on('invite', m => {
    const def = runDef(m);
    if (!def || Game.scene !== 'town') { Net.send({ t: 'inviteNo', why: 'busy' }); return; }
    const prof = Game.prof;
    if (prof.lv < def.lv) { Net.send({ t: 'inviteNo', why: 'lv' }); return; }
    Sfx.ui('ok');  // 초대 알림(예전엔 겹친 이름 wake 가 소리를 냈음)
    Game.overlay({ type: 'confirm', invite: m.seed, defaultYes: true,
      text: '방장이 ' + def.name + diffName(m.diff, def) + '에 들어가요',
      sub: '같이 들어갈까요? (입장 Lv.' + def.lv + ')',
      yes: () => { Net.send({ t: 'inviteYes', seed: m.seed, kit: myKit() }); goWait = { def, diff: m.diff, seed: m.seed }; Game.overlay({ type: 'coopgo' }); },  // kit = 방장 쪽 내 몸 장비
      no: () => Net.send({ t: 'inviteNo', why: 'no' }) });
  });
  // 손님: 방장이 출발 → 같은 씨앗으로 들어간다(size = 파티 인원, 몹 체력 배율을 방장과 같게)
  Net.on('go', m => {
    if (!goWait || m.seed !== goWait.seed) return;
    const g = goWait;
    closeGoWait();
    Game.startRun(g.def, g.diff, g.seed, m.size);
  });
  function closeGoWait() {
    goWait = null;
    const i = Game.overlays.findIndex(o => o.type === 'coopgo');
    if (i >= 0) { if (i === Game.overlays.length - 1) Game.closeOverlay(); else Game.overlays.splice(i, 1); }
  }
  // 손님: 출발을 기다리는 창(취소하면 안 가요로)
  function goUpdate() {
    if (Input.wasPressed('back') || Input.wasPressed('pause')) { Net.send({ t: 'inviteNo', why: 'no' }); closeGoWait(); }
  }
  function goDraw(ctx) {
    time += 1 / 60;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 960, 540);
    UI.zone(0, 0, 960, 540, { key: null });
    Gfx.panel(ctx, 260, 200, 440, 140, { border: '#b48cff' });
    if (!goWait) return;
    T_(ctx, goWait.def.name + diffName(goWait.diff, goWait.def), 480, 236, 18, '#f0e0b8', 'center');
    T_(ctx, '방장이 출발하기를 기다리는 중' + dots(), 480, 264, 14, '#b48cff', 'center');
    UI.zone(420, 284, 120, 40, { key: 'back', now: true });
    Gfx.panel(ctx, 420, 288, 120, 32, { border: '#5a4650', bg: '#1d151b' });
    T_(ctx, '취소 ' + L('back'), 480, 309, 14, '#e8e0d0', 'center');
  }
  // 손님: 방장이 취소함 → 묻는 창 · 기다리는 창을 닫는다
  Net.on('inviteCancel', () => {
    const os = Game.overlays, i = os.findIndex(o => o.invite);
    const had = i >= 0 || goWait;
    if (i >= 0) { if (i === os.length - 1) Game.closeOverlay(); else os.splice(i, 1); }
    closeGoWait();
    if (had) Game.toast('방장이 같이 들어가기를 취소했어요');
  });
  // 방장: 대답
  Net.on('inviteYes', (m, from) => {
    if (!invite || m.seed !== invite.seed || !invite.st.has(from)) return;
    invite.st.set(from, 'yes'); invite.kits.set(from, m.kit || null);
    checkInvite();
  });
  Net.on('inviteNo', (m, from) => {
    if (!invite || !invite.st.has(from)) return;
    invite.st.set(from, m.why === 'lv' ? 'lv' : m.why === 'busy' ? 'busy' : 'no');
    checkInvite();
  });

  // ── 손님: 방장의 던전 고르기를 같이 본다(2026-10-25 사용자: 던파 파티 던전 입장처럼) ──
  // 방장이 고르기 화면에 들어가면 손님(마을, 다른 창이 없을 때)에게 같은 창이 열리고 커서 · 난이도가 따라 움직인다. 손님은 보기만(닫기는 됨).
  // 잠김 표시 = 실제 규칙: 앞 던전 · 난이도는 방장 것, 입장 레벨은 내 것. 방장이 들어가기를 누르면 그 위에 "같이 들어갈까요?"
  let viewClosed = false;
  const hostNow = () => (mates.get(Net.hostId) || {}).now;
  const viewOpen = () => Game.overlays.some(o => o.type === 'coopview');
  function viewTick() {
    if (Net.role !== 'guest') return;
    const hn = hostNow(), on = hn && hn.s === 'select';
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
    const hn = hostNow();
    if (!hn || hn.sel === undefined) return;
    const S = UI.select, keep = [S.sel, S.diff, S.top, S.floor];
    S.sel = hn.sel; S.diff = hn.diff; S.floor = hn.floor || 1;
    const cl = {};
    for (const id of hn.cl || []) cl[id] = true;
    const story = hn.sel >= DUNGEONS.length ? Object.assign({}, prof.story, { trueEnding: 1 }) : prof.story;  // 방장이 끝없는 심연 줄이면 내 화면에도 그 줄
    S.draw(ctx, Object.assign({}, prof, { cleared: cl, clearedDiff: hn.cd || {}, story }), t);
    [S.sel, S.diff, S.top, S.floor] = keep;
    UI.zone(0, 0, 960, 540, { key: null });  // 보기만: 눌러도 아무 일 없게
    const m = Net.members().find(x => x.host);
    Gfx.panel(ctx, 250, 6, 460, 30, { border: '#b48cff' });
    T_(ctx, '방장' + (m ? '(' + clsOf(m).name + ' Lv.' + m.lv + ')' : '') + '이 던전을 고르는 중' + dots(), 480, 27, 14, '#e0d0ff', 'center');
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

  return { open, update, draw, tick, townMates, runMates, panelLines, colorOf, hostEnter, guestBlocked, waitUpdate, waitDraw, goUpdate, goDraw, viewUpdate, viewDraw,
    remotePlayers, remoteHurt, sendAct, hostKill, queue, applySnaps, kitChanged,
    inParty, mateUp, canRevive, reviveTick, reviveInfo, leaveTogether, descendTogether, forgeShow, brag, drawBubbles };
})();
