// 함께하기 창(마을 메뉴 → 함께하기, overlay 'coop'): 방 만들기 · 방 들어가기(4자리 방 코드) · 방 안(두 캐릭터 · 연결 속도).
// 창을 닫아도 방은 그대로 열려 있다(마을 왼쪽 아래 패널에 방 코드 · 친구 표시). 던전 같이 들어가기는 2단계.
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
    T_(ctx, '함께하기', 480, Y + 40, 24, '#e0d0ff', 'center');
    T_(ctx, '온라인 협동 · 방 코드로 2명', 480, Y + 62, 12, '#9a8eaa', 'center');
    if (entering) { drawEntry(ctx); return; }
    const st = Net.state;
    if (!Net.available()) T_(ctx, '함께하기를 불러오지 못했어요 — 인터넷을 켜고 새로고침해 주세요', 480, Y + 110, 13, '#ff8a6a', 'center');
    if (st === 'hosting') {
      T_(ctx, '방 코드', 480, Y + 108, 14, '#9a8eaa', 'center');
      if (Net.opened) T_(ctx, Net.code.split('').join(' '), 480, Y + 160, 52, '#ffd36a', 'center');
      else T_(ctx, '방을 여는 중' + dots(), 480, Y + 150, 20, '#c8b8a0', 'center');
      T_(ctx, '친구가 마을 메뉴 → 함께하기 → 방 들어가기에서 이 숫자를 넣으면 돼요', 480, Y + 200, 12, '#c8b8a0', 'center');
      if (Net.opened) T_(ctx, '친구를 기다리는 중' + dots(), 480, Y + 228, 15, '#b48cff', 'center');
    } else if (st === 'joining') {
      T_(ctx, '방 ' + Net.code + ' 에 들어가는 중' + dots(), 480, Y + 160, 20, '#c8b8a0', 'center');
    } else if (st === 'ready') {
      drawRoom(ctx, prof);
    } else {
      T_(ctx, '친구와 같은 던전에 들어가 함께 싸워요. 마을은 각자.', 480, Y + 112, 14, '#c8b8a0', 'center');
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
    T_(ctx, '던전 같이 들어가기는 다음 단계에서 만들어요', 480, Y + 272, 12, '#8a7e88', 'center');
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

  const dots = () => '.'.repeat(1 + Math.floor(time * 2) % 3);
  function UI_hint(ctx, s) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 496, 960, 44);
    T_(ctx, s, 480, 522, 13, '#8a7e88', 'center');
  }

  return { open, update, draw };
})();
