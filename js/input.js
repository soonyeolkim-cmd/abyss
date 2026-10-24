// 키보드 · 마우스 · 패드 입력을 '동작' 이름으로 합친다. 버튼 5개(기본 공격 · 대시 · 회전베기 · 특수기 · 물약) — 2026-10-24 사용자 지정 배치:
//  키보드만(기본): 방향키 이동 · X 기본 공격 · C 대시 · V 회전베기(누르면 바로) · Z 특수기 · 1 물약 · I/Tab 가방 · Esc/P 메뉴
//  마우스는 쓰지 않는다(2026-10-24 사용자: 클릭해도 창 고르기 말고는 아무 일 없게)
//  패드(엑박 이름, 버튼 위치 기준): X 기본 공격 · A 대시 · B 회전베기 · Y 특수기 · LB 물약 · Back 가방 · Start 메뉴
//  메뉴: 선택 = Enter · X(키보드만) · 왼쪽 클릭 · 패드 A, 취소 = Esc · Backspace · C(키보드만) · 패드 B
//  패드 종류(설정): 엑박 = 아래 A · 오른쪽 B, 스위치 = 오른쪽 A · 아래 B — 메뉴 선택은 언제나 그 패드의 A
const Input = (() => {
  const ACTIONS = ['left', 'right', 'up', 'down', 'attack', 'dodge', 'charge', 'special', 'potion', 'pause', 'inv', 'ok', 'back'];
  const KEYS = {
    keys: {
      ArrowLeft: ['left'], ArrowRight: ['right'], ArrowUp: ['up'], ArrowDown: ['down'],
      KeyX: ['attack', 'ok'], KeyC: ['dodge', 'back'], KeyV: ['charge'], KeyZ: ['special'],
      Digit1: ['potion'], Numpad1: ['potion'], KeyI: ['inv'], Tab: ['inv'],
      Escape: ['pause', 'back'], KeyP: ['pause', 'back'], Enter: ['ok'], NumpadEnter: ['ok'], Backspace: ['back'],
    },
  };
  // 패드 버튼 번호: 0 아래(A) · 1 오른쪽(B) · 2 왼쪽(X) · 3 위(Y) · 4 LB · 5 RB · 6 LT · 7 RT · 8 Back · 9 Start · 12~15 십자키
  const PAD = { 2: ['attack'], 0: ['dodge'], 1: ['charge'], 3: ['special'], 4: ['potion'],
    8: ['inv'], 9: ['pause'], 12: ['up'], 13: ['down'], 14: ['left'], 15: ['right'] };

  const LABELS = {
    keys: { attack: 'X', dodge: 'C', charge: 'V', special: 'Z', potion: '1', pause: 'Esc', inv: 'I', ok: 'X', back: 'C', move: '방향키' },
    pad: { attack: 'X', dodge: 'A', charge: 'B', special: 'Y', potion: 'LB', pause: 'Start', inv: 'Back', ok: 'A', back: 'B', move: '스틱' },
  };
  // 스위치 패드에서 같은 위치 버튼 이름
  const SWITCH_NAMES = { X: 'Y', A: 'B', B: 'A', Y: 'X', LB: 'L', RB: 'R', LT: 'ZL', RT: 'ZR', Back: '-', Start: '+' };

  // 설정(이 기기에 저장)
  const settings = (() => {
    const d = { kbMode: 'keys', padLayout: 'xbox', cursorAim: false, sound: true };
    try { return Object.assign(d, JSON.parse(localStorage.getItem('farming-game-settings') || '{}')); } catch (e) { return d; }
  })();
  function saveSettings() { try { localStorage.setItem('farming-game-settings', JSON.stringify(settings)); } catch (e) { /* 저장 못 하는 환경 */ } }
  const padOk = () => (settings.padLayout === 'switch' ? 1 : 0);
  const padNo = () => (settings.padLayout === 'switch' ? 0 : 1);
  const map = () => KEYS.keys;

  const keyHeld = new Set(), mouseHeld = new Set(), down = {}, pressed = {};
  let padPrev = {}, stick = { x: 0, y: 0 }, device = 'key';
  const mouse = { x: 480, y: 270, active: false };
  const navHold = { left: 0, right: 0, up: 0, down: 0 }, navFire = {};
  let lastPoll = performance.now();

  const press = list => { for (const a of list) pressed[a] = true; };
  window.addEventListener('keydown', e => {
    const list = map()[e.code];
    if (!list) return;
    e.preventDefault();
    if (!e.repeat) press(list);
    keyHeld.add(e.code);
    device = 'key';
  });
  window.addEventListener('keyup', e => { keyHeld.delete(e.code); });
  // 폰 터치(touch.js): 버튼 = 키를 누른 것과 같게, 스틱 = 패드 스틱처럼(2026-10-24)
  let touchStick = { x: 0, y: 0 };
  function virtualKey(code, isDown) {
    const list = map()[code];
    if (!list) return;
    if (isDown) { if (!keyHeld.has(code)) press(list); keyHeld.add(code); device = 'touch'; if (typeof Sfx !== 'undefined') Sfx.wake(); }
    else keyHeld.delete(code);
  }
  function setTouchStick(x, y) { touchStick = { x, y }; if (x || y) device = 'touch'; }
  window.addEventListener('blur', () => { keyHeld.clear(); mouseHeld.clear(); });

  function attachMouse(canvas) {
    const pos = e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width * 960;
      mouse.y = (e.clientY - r.top) / r.height * 540;
    };
    // 클릭은 게임에 아무 일도 하지 않는다(창만 고른다). 오른쪽 클릭 메뉴만 막는다
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  function poll() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastPoll) / 1000);
    lastPoll = now;
    const padDown = {};
    stick = { x: 0, y: 0 };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      for (const i in PAD) {
        const b = p.buttons[i];
        if (b && (b.pressed || b.value > 0.5)) for (const a of PAD[i]) padDown[a] = true;
      }
      const ok = p.buttons[padOk()], no = p.buttons[padNo()];
      if (ok && ok.pressed) padDown.ok = true;
      if (no && no.pressed) padDown.back = true;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.3) stick = { x: ax, y: ay };
    }
    for (const a in padDown) if (!padPrev[a]) { pressed[a] = true; device = 'pad'; if (typeof Sfx !== 'undefined') Sfx.wake(); }  // 패드만 써도 소리 장치를 깨운다
    if (stick.x || stick.y) device = 'pad';
    if (Math.hypot(touchStick.x, touchStick.y) > 0.3) stick = touchStick;  // 터치 스틱
    padPrev = padDown;
    const keyDown = {};
    for (const code of keyHeld) for (const a of (map()[code] || [])) keyDown[a] = true;
    for (const a of ACTIONS) down[a] = !!(keyDown[a] || padDown[a] || mouseHeld.has(a));
    // 메뉴 이동: 방향키 · WASD · 십자키 · 스틱(크게 기울였을 때)
    const dirOn = {
      left: down.left || keyDown.navLeft || stick.x < -0.6, right: down.right || keyDown.navRight || stick.x > 0.6,
      up: down.up || keyDown.navUp || stick.y < -0.6, down: down.down || keyDown.navDown || stick.y > 0.6,
    };
    for (const d in navHold) {
      navFire[d] = false;
      if (dirOn[d]) {
        if (navHold[d] === 0) navFire[d] = true;
        navHold[d] += dt;
        if (navHold[d] > 0.32) { navFire[d] = true; navHold[d] = 0.24; }
      } else navHold[d] = 0;
    }
  }

  function move() {
    let x = stick.x, y = stick.y;
    if (down.left) x = -1;
    if (down.right) x = 1;
    if (down.up) y = -1;
    if (down.down) y = 1;
    if (Math.abs(x) < 0.25) x = 0;
    if (Math.abs(y) < 0.25) y = 0;
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }

  function endFrame() { for (const k in pressed) delete pressed[k]; }
  // 장면이 바뀔 때 눌린 것 버리기(누르고 있던 방향은 바로 다시 반복되지 않게)
  function clear() { endFrame(); for (const d in navHold) if (navHold[d]) navHold[d] = 0.001; }

  // 버튼 이름: 지금 쓰는 장치 · 조작 방식 · 패드 종류에 맞게
  function label(a) {
    if (device === 'pad') {
      const n = LABELS.pad[a];
      if (a === 'ok' || a === 'back') return n;  // 메뉴 선택 · 취소는 어느 패드든 그 패드의 A · B
      return settings.padLayout === 'switch' ? (SWITCH_NAMES[n] || n) : n;
    }
    return LABELS.keys[a];
  }

  // 패드 진동(패드로 하는 중일 때만)
  function rumble(strength, ms) {
    if (device !== 'pad') return;
    try {
      for (const p of navigator.getGamepads ? navigator.getGamepads() : []) {
        if (p && p.vibrationActuator) p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.7 }).catch(() => {});
      }
    } catch (e) { /* 진동 없는 패드 */ }
  }

  // 조작 보기 화면용: 장치를 정해서 이름 얻기 ('kb' = 지금 키보드 방식, 'pad' = 지금 패드 종류)
  function labelFor(dev, a) {
    if (dev === 'pad') {
      const n = LABELS.pad[a];
      if (a === 'ok' || a === 'back') return n;
      return settings.padLayout === 'switch' ? (SWITCH_NAMES[n] || n) : n;
    }
    return LABELS.keys[a];
  }

  return {
    virtualKey, setTouchStick, poll, endFrame, clear, move, label, labelFor, attachMouse, settings, saveSettings, mouse, rumble,
    isDown: a => !!down[a],
    wasPressed: a => !!pressed[a],
    nav: d => !!navFire[d],
    // 키보드+마우스로 하는 중이고 마우스 조준을 켰으면 커서 쪽으로 공격한다
    get device() { return device; },
  };
})();
