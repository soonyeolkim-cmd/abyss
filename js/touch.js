// 폰 터치 조작(2026-10-24 사용자: 깃허브에 올려 폰으로). 터치 화면에서만 나온다.
// 게임 중(던전 · 마을 걷기): 왼쪽 절반 = 이동 스틱(누른 자리가 가운데), 오른쪽 = 기술 버튼(HUD 가운데 도트 기술 아이콘: 공격 · 대시 · 회전 · 특수),
//   물약 = 왼쪽 체력 구슬 위, 위 = 가방 · 메뉴. 버튼은 반쯤 비치게(2026-10-25 사용자).
// 메뉴 화면(캐릭터 선택 · 던전 고르기 · 가방 등 창): 스틱 · 기술 버튼을 숨기고 화면을 손가락으로 바로 누른다(ui.js 누를 곳). 오른쪽 아래 = 뒤로 (+ 그 창의 Z 일).
// 버튼은 키보드 키를 누른 것처럼 Input 에 넣는다. 패드 · 키보드를 쓰면 가상패드를 숨기고, 화면을 만지면 다시 보인다.
const Touch = (() => {
  const on = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!on) return { on: false };

  const css = document.createElement('style');
  css.textContent = `
    body { touch-action: none; -webkit-user-select: none; user-select: none; }
    #tc { position: fixed; inset: 0; pointer-events: none; z-index: 5; font-family: sans-serif; }
    #tc .b { position: absolute; pointer-events: auto; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(40, 30, 36, 0.16); border: 2px solid rgba(255, 220, 150, 0.22); color: rgba(240, 224, 184, 0.75); font-weight: bold; line-height: 1; }
    #tc .b.on { background: rgba(255, 211, 106, 0.3); border-color: rgba(255, 220, 150, 0.6); }
    #tc .b canvas { image-rendering: pixelated; opacity: 0.8; }
    #tc .b small { font-size: 10px; font-weight: normal; margin-top: 1px; color: rgba(216, 200, 176, 0.75); text-shadow: 0 0 2px #000; }
    #tc .sq { border-radius: 10px; }
    #tc .pill { border-radius: 20px; flex-direction: row; font-size: 15px; }
    #tc.menu .play, #tc:not(.menu) .menu { display: none; }
    #tc.ext > * { display: none !important; }
    #tc #stk { position: absolute; width: 120px; height: 120px; border-radius: 50%; border: 2px solid rgba(255, 220, 150, 0.22); background: rgba(40, 30, 36, 0.15); display: none; }
    #tc #knob { position: absolute; width: 52px; height: 52px; border-radius: 50%; background: rgba(255, 220, 150, 0.3); left: 34px; top: 34px; }
    #rot { position: fixed; inset: 0; z-index: 9; background: #000; color: #f0e0b8; display: none; align-items: center; justify-content: center; text-align: center; font: bold 20px sans-serif; }
    @media (orientation: portrait) { #rot { display: flex; } }
  `;
  document.head.appendChild(css);
  const root = document.createElement('div');
  root.id = 'tc';
  root.innerHTML = '<div id="stk" class="play"><div id="knob"></div></div>';
  document.body.appendChild(root);
  const rot = document.createElement('div');
  rot.id = 'rot';
  rot.innerHTML = '폰을 가로로 돌려 주세요<br><small style="font-size:13px;font-weight:normal">심연속으로</small>';
  document.body.appendChild(rot);

  // 기술 버튼: [키, 속성석 칸(아이콘 · 이름), 오른쪽에서 · 아래에서(px), 크기]
  const BTNS = [
    ['KeyX', 'basic', 30, 34, 76],
    ['KeyC', 'dash', 120, 22, 58],
    ['KeyZ', 'wave', 40, 124, 58],
    ['KeyV', 'charge', 112, 96, 52],
  ];
  const els = {};
  function makeBtn(code, html, style, w, h, cls) {
    const b = document.createElement('div');
    b.className = 'b ' + cls;
    Object.assign(b.style, style, { width: w + 'px', height: h + 'px', fontSize: Math.round(Math.min(w, h) * 0.36) + 'px' });
    b.innerHTML = html;
    const down = e => { e.preventDefault(); b.classList.add('on'); Input.virtualKey(code, true); };
    const up = e => { e.preventDefault(); b.classList.remove('on'); Input.virtualKey(code, false); if (typeof Sfx !== 'undefined') Sfx.wake(); };  // 뗄 때 소리 장치 깨우기(폰 정책)
    b.addEventListener('touchstart', down, { passive: false });
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    root.appendChild(b);
    return b;
  }
  const ICON = 18;  // hud.js pixIcon 크기(16 + 테두리)
  for (const [code, slot, r, bt, size] of BTNS) {
    const px = Math.max(2, Math.round(size * 0.5 / ICON)) * ICON;  // 도트가 고르게 커지게 18 의 배수
    const b = makeBtn(code, '<canvas width="' + ICON + '" height="' + ICON + '" style="width:' + px + 'px;height:' + px + 'px"></canvas><small></small>',
      { right: r + 'px', bottom: bt + 'px' }, size, size, 'play');
    els[slot] = b;
  }
  // 물약: 체력 구슬 바로 위(캔버스 자리에 맞춰 setInterval 에서 옮긴다)
  const potion = makeBtn('Digit1', '<canvas width="16" height="22" style="width:24px;height:33px"></canvas><small></small>', {}, 54, 54, 'play');
  makeBtn('KeyI', 'I<small>가방</small>', { right: '96px', top: '12px' }, 50, 50, 'sq play');
  makeBtn('Escape', '≡<small>메뉴</small>', { right: '30px', top: '12px' }, 50, 50, 'sq play');
  // 메뉴 화면: 뒤로(Backspace = 취소만) · 그 창의 Z 일
  const back = makeBtn('Backspace', '◀ 뒤로', { right: '10px', bottom: '8px' }, 96, 40, 'pill menu');
  const spec = makeBtn('KeyZ', '', { right: '114px', bottom: '8px' }, 120, 40, 'pill menu');

  // 버튼 그림 · 이름 · 자리: 직업 · 낀 속성석 · 장면이 바뀌면 다시
  const drawn = {};
  function refresh() {
    if (typeof Game === 'undefined' || !Game.prof) return;
    const prof = Game.prof, C = clsOf(prof);
    for (const slot in els) {
      const st = Elements.socket(prof, slot), col = st ? ELEMENTS[st.el].color : '#a89cb0';
      const key = C.icons[slot] + col;
      if (drawn[slot] !== key) {
        const g = els[slot].querySelector('canvas').getContext('2d');
        g.clearRect(0, 0, ICON, ICON);
        g.drawImage(Hud.pixIcon(C.icons[slot], col), 0, 0);
        drawn[slot] = key;
      }
      const s = els[slot].querySelector('small'), t = C.slotShort[slot];
      if (s.textContent !== t) s.textContent = t;
    }
    // 물약 병 그림(그림 파일이 늦게 읽히면 다음 번에 그려진다) + 남은 개수
    const pg = potion.querySelector('canvas').getContext('2d');
    pg.imageSmoothingEnabled = false;
    pg.clearRect(0, 0, 16, 22);
    Gfx.spr(pg, 'flask_big_red', 8, 21, {});
    const pn = potion.querySelector('small'), pt = '×' + prof.potions;
    if (pn.textContent !== pt) pn.textContent = pt;
    // 물약 자리: 캔버스의 체력 구슬(960x540 에서 가운데 66, 위 끝 432 · "체력" 글자 426) 바로 위
    const r = canvas.getBoundingClientRect(), k = r.width / 960;
    Object.assign(potion.style, { left: Math.round(r.left + 66 * k - 27) + 'px', top: Math.round(r.top + 356 * k - 27) + 'px' });
  }
  setInterval(refresh, 500);

  // 패드 · 키보드를 연결해 쓰면 가상패드를 모두 숨긴다(2026-10-25 사용자). 화면을 다시 만지면 나온다
  let ext = false, lastDev = Input.device;
  function setExt(v) {
    if (v === ext) return;
    ext = v;
    root.classList.toggle('ext', v);
    if (v) { for (const b of root.querySelectorAll('.b.on')) b.classList.remove('on'); stickEnd(); }
  }
  window.addEventListener('gamepadconnected', () => setExt(true));
  window.addEventListener('keydown', () => setExt(true));  // 진짜 키보드(가상 버튼은 keydown 을 안 낸다)
  window.addEventListener('touchstart', () => { Input.touched(); lastDev = 'touch'; setExt(false); }, { capture: true, passive: true });
  // 패드를 직접 본다(2026-10-25 폰에서 안 숨겨짐): 안드로이드 패드는 버튼 번호가 표준과 달라 Input 이 모르는 버튼일 수 있다.
  // 어느 버튼이든 새로 눌리거나, 스틱 · 트리거 축이 처음 본 쉬는 자리에서 크게 움직이면 숨긴다(쉴 때 -1 인 트리거 축도 있어서 '처음 값'과 비교)
  const padRest = {}, padHeld = {};
  function padMoved() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const rest = padRest[p.index] || (padRest[p.index] = p.axes.slice()), held = padHeld[p.index] || (padHeld[p.index] = []);
      let moved = p.axes.some((v, i) => Math.abs(v - (rest[i] || 0)) > 0.5);
      p.buttons.forEach((b, i) => { const on = b.pressed || b.value > 0.5; if (on && !held[i]) moved = true; held[i] = on; });
      if (moved) { setExt(true); return; }
    }
  }
  // 화면을 떠나면(전화 · 다른 앱) 손가락을 뗀 것으로 — 돌아왔을 때 스틱 · 버튼이 눌린 채 남지 않게
  const letGo = () => { for (const b of root.querySelectorAll('.b.on')) { b.classList.remove('on'); } for (const k of ['KeyX', 'KeyC', 'KeyZ', 'KeyV', 'Digit1', 'KeyI', 'Escape', 'Backspace']) Input.virtualKey(k, false); stickEnd(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });
  window.addEventListener('blur', letGo);
  window.addEventListener('gamepaddisconnected', e => { delete padRest[e.gamepad.index]; delete padHeld[e.gamepad.index]; });

  // 게임 중인가 메뉴 화면인가(창이 열렸거나 던전 · 마을 밖이면 메뉴)
  let menuMode = null;
  function mode() {
    if (typeof Game === 'undefined') return;
    if (Input.device !== lastDev) {  // 패드 버튼 · 스틱을 움직였다
      lastDev = Input.device;
      if (lastDev === 'pad') setExt(true);
    }
    padMoved();
    const m = Game.overlays.length > 0 || (Game.scene !== 'run' && Game.scene !== 'town');
    if (m !== menuMode) {
      menuMode = m;
      root.classList.toggle('menu', m);
      if (m) { for (const b of root.querySelectorAll('.b.on')) b.classList.remove('on'); stickEnd(); refresh(); }
    }
    back.style.display = m && (Game.scene === 'title' || Game.scene === 'splash') && !Game.overlays.length ? 'none' : '';  // 캐릭터 선택은 뒤로 갈 곳이 없다
    const top = Game.overlays[Game.overlays.length - 1], bl = top && (top.type === 'talk' || top.type === 'ride') ? '건너뛰기 ▶' : '◀ 뒤로';  // 이야기 · 광차 장면은 건너뛰기
    if (back.textContent !== bl) back.textContent = bl;
    const sl = m ? UI.touchSpecial() : null;
    spec.style.display = sl ? '' : 'none';
    if (sl && spec.textContent !== sl) spec.textContent = sl;
  }
  setInterval(mode, 100);

  // 이동 스틱: 화면 왼쪽 절반 어디든 누르면 그 자리가 가운데
  const stk = document.getElementById('stk'), knob = document.getElementById('knob'), R = 50;
  let sid = null, cx = 0, cy = 0;
  const area = document.createElement('div');
  area.className = 'play';
  Object.assign(area.style, { position: 'absolute', left: '0', top: '70px', width: '50%', bottom: '0', pointerEvents: 'auto' });
  root.insertBefore(area, stk);
  area.addEventListener('touchstart', e => {
    e.preventDefault();
    if (sid !== null) return;
    const t = e.changedTouches[0];
    sid = t.identifier; cx = t.clientX; cy = t.clientY;
    Object.assign(stk.style, { display: 'block', left: (cx - 60) + 'px', top: (cy - 60) + 'px' });
    moveTo(t.clientX, t.clientY);
  }, { passive: false });
  const find = e => [...e.changedTouches].find(t => t.identifier === sid);
  area.addEventListener('touchmove', e => { e.preventDefault(); const t = find(e); if (t) moveTo(t.clientX, t.clientY); }, { passive: false });
  function stickEnd() { sid = null; stk.style.display = 'none'; Input.setTouchStick(0, 0); }
  const end = e => { if (find(e)) stickEnd(); };
  area.addEventListener('touchend', end); area.addEventListener('touchcancel', end);
  function moveTo(x, y) {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.left = (34 + dx) + 'px'; knob.style.top = (34 + dy) + 'px';
    Input.setTouchStick(dx / R, dy / R);
  }

  // 메뉴 화면 누르기: 손가락을 거의 안 움직이고 뗀 자리를 960x540 좌표로 바꿔 ui.js 에 넘긴다
  let t0 = null;
  canvas.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; t0 = { id: t.identifier, x: t.clientX, y: t.clientY }; }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const t = t0 && [...e.changedTouches].find(q => q.identifier === t0.id);
    if (!t || Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 24) { t0 = null; return; }
    t0 = null;
    mode();  // 방금 창이 열렸을 수도 있으니 지금 장면으로
    if (!menuMode) return;
    const r = canvas.getBoundingClientRect();
    UI.tap((t.clientX - r.left) / r.width * 960, (t.clientY - r.top) / r.height * 540);
  }, { passive: false });

  // 화면 두 번 눌러 확대 · 길게 눌러 메뉴 막기
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  mode(); refresh();
  return { on: true };
})();
