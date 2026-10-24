// 폰 터치 조작(2026-10-24 사용자: 깃허브에 올려 폰으로). 터치 화면에서만 나온다.
// 왼쪽 절반 = 이동 스틱(누른 자리가 가운데), 오른쪽 = 버튼(키보드와 같은 글자: X 공격 · C 대시 · V 회전 · Z 특수 · 1 물약), 위 = I 가방 · Esc 메뉴.
// 버튼은 키보드 키를 누른 것처럼 Input 에 넣는다 → 메뉴에서도 X = 선택 · C = 취소 그대로.
const Touch = (() => {
  const on = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!on) return { on: false };

  const css = document.createElement('style');
  css.textContent = `
    body { touch-action: none; -webkit-user-select: none; user-select: none; }
    #tc { position: fixed; inset: 0; pointer-events: none; z-index: 5; font-family: sans-serif; }
    #tc .b { position: absolute; pointer-events: auto; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(40, 30, 36, 0.45); border: 2px solid rgba(255, 220, 150, 0.45); color: #f0e0b8; font-weight: bold; line-height: 1; }
    #tc .b.on { background: rgba(255, 211, 106, 0.4); }
    #tc .b small { font-size: 10px; font-weight: normal; margin-top: 2px; color: #d8c8b0; }
    #tc .sq { border-radius: 10px; }
    #tc #stk { position: absolute; width: 120px; height: 120px; border-radius: 50%; border: 2px solid rgba(255, 220, 150, 0.35); background: rgba(40, 30, 36, 0.3); display: none; }
    #tc #knob { position: absolute; width: 52px; height: 52px; border-radius: 50%; background: rgba(255, 220, 150, 0.45); left: 34px; top: 34px; }
    #rot { position: fixed; inset: 0; z-index: 9; background: #000; color: #f0e0b8; display: none; align-items: center; justify-content: center; text-align: center; font: bold 20px sans-serif; }
    @media (orientation: portrait) { #rot { display: flex; } }
  `;
  document.head.appendChild(css);
  const root = document.createElement('div');
  root.id = 'tc';
  root.innerHTML = '<div id="stk"><div id="knob"></div></div>';
  document.body.appendChild(root);
  const rot = document.createElement('div');
  rot.id = 'rot';
  rot.innerHTML = '폰을 가로로 돌려 주세요<br><small style="font-size:13px;font-weight:normal">심연으로</small>';
  document.body.appendChild(rot);

  // 버튼: [키, 글자, 이름, 오른쪽에서 · 아래에서(px), 크기]
  const BTNS = [
    ['KeyX', 'X', '공격', 30, 34, 76],
    ['KeyC', 'C', '대시', 120, 22, 58],
    ['KeyZ', 'Z', '특수', 40, 124, 58],
    ['KeyV', 'V', '회전', 112, 96, 52],
    ['Digit1', '1', '물약', 186, 30, 46],
  ];
  const TOP = [['KeyI', 'I', '가방', 96], ['Escape', '≡', '메뉴', 30]];
  const els = {};
  function makeBtn(code, ch, name, style, size, sq) {
    const b = document.createElement('div');
    b.className = 'b' + (sq ? ' sq' : '');
    Object.assign(b.style, style, { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.36) + 'px' });
    b.innerHTML = ch + '<small>' + name + '</small>';
    const down = e => { e.preventDefault(); b.classList.add('on'); Input.virtualKey(code, true); };
    const up = e => { e.preventDefault(); b.classList.remove('on'); Input.virtualKey(code, false); };
    b.addEventListener('touchstart', down, { passive: false });
    b.addEventListener('touchend', up, { passive: false });
    b.addEventListener('touchcancel', up, { passive: false });
    root.appendChild(b);
    els[code] = b;
  }
  for (const [code, ch, name, r, bt, size] of BTNS) makeBtn(code, ch, name, { right: r + 'px', bottom: bt + 'px' }, size);
  for (const [code, ch, name, r] of TOP) makeBtn(code, ch, name, { right: r + 'px', top: '12px' }, 50, true);

  // 직업마다 버튼 이름(마법사: V 마법진 · Z 마력탄)
  setInterval(() => {
    const C = typeof clsOf === 'function' && typeof Game !== 'undefined' ? clsOf(Game.prof) : null;
    if (!C) return;
    const set = (code, t) => { const s = els[code] && els[code].querySelector('small'); if (s && s.textContent !== t) s.textContent = t; };
    set('KeyV', C.slotShort.charge); set('KeyZ', C.slotShort.wave);
  }, 500);

  // 이동 스틱: 화면 왼쪽 절반 어디든 누르면 그 자리가 가운데
  const stk = document.getElementById('stk'), knob = document.getElementById('knob'), R = 50;
  let sid = null, cx = 0, cy = 0;
  const area = document.createElement('div');
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
  const end = e => { const t = find(e); if (!t) return; sid = null; stk.style.display = 'none'; Input.setTouchStick(0, 0); };
  area.addEventListener('touchend', end); area.addEventListener('touchcancel', end);
  function moveTo(x, y) {
    let dx = x - cx, dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.left = (34 + dx) + 'px'; knob.style.top = (34 + dy) + 'px';
    Input.setTouchStick(dx / R, dy / R);
  }

  // 화면 두 번 눌러 확대 · 길게 눌러 메뉴 막기
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  return { on: true };
})();
