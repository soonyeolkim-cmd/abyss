// 폰 터치 조작(2026-10-24 사용자: 깃허브에 올려 폰으로). 터치 화면에서만 나온다.
// 게임 중(던전 · 마을 걷기): 왼쪽 절반 = 이동 스틱(누른 자리가 가운데), 오른쪽 = 기술 버튼(HUD 가운데 도트 기술 아이콘: 공격 · 대시 · 회전 · 특수),
//   마을에서는 기술 · 물약 버튼을 숨기고 기본 버튼이 말풍선 '대화'(던전 입구 앞이면 '던전') — 말 걸 사람이 가까이 없으면 흐리게(2026-10-25 사용자: 기본 버튼이 대화라 헷갈림)
//   물약 = 왼쪽 체력 구슬 위, 메뉴 = 오른쪽 빈 띠 위(띠가 좁으면 왼쪽 위 — 오른쪽 위 자동 지도를 가리지 않게). 버튼은 반쯤 비치게(2026-10-25 사용자).
//   가방 버튼은 없음(2026-10-25 사용자: 메뉴 → 장비 스테이터스로 열면 됨)
// 이야기 장면: 넘기기(한 줄) · 건너뛰기(장면 통째) 버튼 따로, 광차는 건너뛰기만. 터치로 하는 중엔 키 이름 안내 글을 숨긴다(Input.touchMode)
// 메뉴 화면(캐릭터 선택 · 던전 고르기 · 가방 등 창): 스틱 · 기술 버튼을 숨기고 화면을 손가락으로 바로 누른다(ui.js 누를 곳 — 한 번 = 고르기, 한 번 더 = 선택).
//   확인 버튼은 없고 왼쪽 위 '‹ 뒤로'만(2026-10-26 사용자: 봉인의 숲처럼). 이야기 · 광차는 같은 자리에 '‹ 건너뛰기', 화면 아무 데나 누르면 넘기기. 그 창의 Z 일은 오른쪽 아래 알약 버튼.
// 기술 버튼(2026-10-26 다듬기): 큰 기본 공격을 가운데 두고 대시 · 차지 · 특수가 부채꼴로 둘러쌈, 기력이 모자라면 흐리게(HUD 기력 글자 빨강과 같은 때)
//   넘치는 목록(던전 · 주머니 · 대장간 · 상점 · 소리 목록)은 손가락으로 위아래로 끌어 넘긴다(ui.js scrollArea, 2026-10-25 사용자: 화면 옆 화살표 버튼 말고 폰답게 스와이프로)
// 버튼은 키보드 키를 누른 것처럼 Input 에 넣는다. 패드 · 키보드를 쓰면 가상패드를 숨기고, 화면을 만지면 다시 보인다.
const Touch = (() => {
  const on = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!on) return { on: false };

  const css = document.createElement('style');
  css.textContent = `
    body { touch-action: none; -webkit-user-select: none; user-select: none; }
    #tc { position: fixed; inset: 0; pointer-events: none; z-index: 5; font-family: sans-serif; }
    #tc .b { position: absolute; pointer-events: auto; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box;
      background: radial-gradient(circle at 50% 38%, rgba(74, 54, 66, 0.42), rgba(18, 12, 18, 0.34) 70%);
      border: 2px solid rgba(255, 214, 140, 0.34); box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.35);
      color: rgba(244, 228, 190, 0.85); font-weight: bold; line-height: 1; transition: transform 0.06s, opacity 0.15s; }
    #tc .b.on { transform: scale(0.92); background: radial-gradient(circle at 50% 38%, rgba(255, 214, 120, 0.5), rgba(120, 80, 40, 0.35) 70%); border-color: rgba(255, 226, 160, 0.85); }
    #tc .b.big { border-width: 3px; border-color: rgba(255, 214, 140, 0.45); }
    #tc .b.low { opacity: 0.4; border-color: rgba(255, 110, 90, 0.5); }
    #tc .b canvas { image-rendering: pixelated; opacity: 0.9; }
    #tc .b small { font-size: 10px; font-weight: bold; margin-top: 2px; color: rgba(236, 222, 196, 0.85); text-shadow: 0 1px 2px #000, 0 0 2px #000; }
    #tc .sq { border-radius: 12px; }
    #tc .pill { border-radius: 20px; flex-direction: row; font-size: 15px; background: rgba(30, 22, 30, 0.78); }
    #tc .back { border-radius: 10px; flex-direction: row; gap: 4px; font-size: 15px; background: rgba(30, 22, 30, 0.8); border-color: rgba(255, 214, 140, 0.45); }
    #tc .back b { font-size: 20px; margin-top: -2px; }
    #tc .back span { white-space: nowrap; }
    #tc.menu .play, #tc:not(.menu) .menu, #tc.town .fight { display: none; }
    #tc .b.far { opacity: 0.45; }
    #tc .b .cd { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; display: none; }
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

  // 기술 버튼: [키, 속성석 칸(아이콘 · 이름), 기본 버튼 가운데에서 각도(도, 0 = 왼쪽 · 90 = 위) · 거리, 크기]. 기본 버튼 가운데 = 오른쪽 · 아래에서 BC px
  const BC = 74, BTNS = [
    ['KeyX', 'basic', 0, 0, 84],
    ['KeyC', 'dash', 4, 92, 60],
    ['KeyV', 'charge', 47, 94, 60],
    ['KeyZ', 'wave', 88, 92, 60],
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
  for (const [code, slot, deg, dist, size] of BTNS) {
    const px = Math.max(2, Math.round(size * 0.5 / ICON)) * ICON;  // 도트가 고르게 커지게 18 의 배수
    const a = deg * Math.PI / 180, cx = BC + Math.cos(a) * dist, cy = BC + Math.sin(a) * dist;  // 오른쪽 · 아래에서 잰 가운데
    const b = makeBtn(code, '<canvas width="' + ICON + '" height="' + ICON + '" style="width:' + px + 'px;height:' + px + 'px"></canvas><small></small>' + (slot === 'wave' || slot === 'charge' ? '<i class="cd"></i>' : ''),
      { right: Math.round(cx - size / 2) + 'px', bottom: Math.round(cy - size / 2) + 'px' }, size, size, slot === 'basic' ? 'play big' : 'play fight');  // fight = 던전에서만
    els[slot] = b;
  }
  // 물약: 체력 구슬 바로 위(캔버스 자리에 맞춰 setInterval 에서 옮긴다)
  const potion = makeBtn('Digit1', '<canvas width="16" height="22" style="width:24px;height:33px"></canvas><small></small>', {}, 54, 54, 'play fight');
  const menuBtn = makeBtn('Escape', '≡<small>메뉴</small>', {}, 50, 50, 'sq play');
  // 메뉴 화면 버튼: 왼쪽 위 '‹ 뒤로'(Backspace = 취소만, 2026-10-26 사용자: 봉인의 숲처럼 확인 버튼 없이 · 뒤로는 왼쪽 위).
  //   방향 버튼은 없다(2026-10-25 사용자: 화면 옆 화살표는 폰 조작이 아님) — 고르기는 화면을 바로 누르고, 넘치는 목록은 끌어서 넘긴다
  const back = makeBtn('Backspace', '<b>‹</b><span>뒤로</span>', {}, 84, 36, 'back menu');
  const backLabel = back.querySelector('span');
  // 그 창의 Z 일(모두 넣기 · 수량 정하기 등): 오른쪽 아래
  const spec = makeBtn('KeyZ', '', {}, 120, 40, 'pill menu');
  // 아이폰 둥근 모서리 · 노치(2026-10-26 사용자: 왼쪽 위 뒤로 버튼이 곡면에 걸려 이상함): iOS 가 알려 주는 안전 영역(env(safe-area-inset-*))을 재서 피한다.
  //   안전 영역이 있는 폰(가로)은 모서리 곡면이 약 55px 라, 위 버튼은 모서리 아래(CORNER)로 내리고 아래 버튼은 홈 막대 위로 올린다. 노치는 옆 가운데라 위쪽은 괜찮다
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  const safe = () => { const c = getComputedStyle(probe); return { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 }; };
  const CORNER = 52;
  let backW = 84;  // 띠에 맞춘 뒤로 버튼 너비(글자가 긴 '건너뛰기'는 mode 에서 넓힘)
  function placeSide() {
    const r = canvas.getBoundingClientRect(), W = window.innerWidth, gap = 8, S = safe(), round = S.l > 0 || S.r > 0 || S.t > 0;
    const topY = round ? Math.max(CORNER, S.t + gap) : gap;
    // 뒤로: 캔버스 왼쪽 빈 띠가 넉넉하면 거기(화면을 안 가림), 아니면 화면 왼쪽 위(안전 영역 안)
    const band = Math.round(r.left), wide = band >= 58, bw = backW = wide ? Math.min(96, band - 8) : 84;
    Object.assign(back.style, { left: (wide ? Math.round((band - bw) / 2) : Math.max(gap, S.l + 4)) + 'px', top: topY + 'px', width: (backLabel.textContent.length > 2 ? Math.max(bw, 92) : bw) + 'px', height: '36px', fontSize: (bw < 80 ? 13 : 15) + 'px' });
    Object.assign(spec.style, { left: '', right: Math.max(gap, Math.round((W - r.right - 120) / 2), round ? 14 : 0) + 'px', bottom: Math.max(gap, S.b + 6) + 'px' });
    // 메뉴: 캔버스 오른쪽 빈 띠에 들어가면 거기 위, 아니면 왼쪽 위(오른쪽 위는 던전 자동 지도 자리)
    const fit = W - r.right >= 46;  // 버튼 겉 크기 54(50 + 테두리) — 캔버스 가장자리(지도 오른쪽 끝 바깥)에 조금 걸치는 것까지는 괜찮다
    Object.assign(menuBtn.style, fit ? { left: Math.min(W - 58, Math.round(r.right + (W - r.right - 54) / 2)) + 'px', top: topY + 'px' } : { left: Math.max(12, S.l + 4) + 'px', top: Math.max(12, topY) + 'px' });
  }
  placeSide();
  window.addEventListener('resize', placeSide);
  setTimeout(placeSide, 300);  // 캔버스 크기가 정해진 뒤 한 번 더

  // 버튼 그림 · 이름 · 자리: 직업 · 낀 속성석 · 장면이 바뀌면 다시
  const drawn = {};
  function refresh() {
    if (typeof Game === 'undefined' || !Game.prof) return;
    const prof = Game.prof, C = clsOf(prof);
    for (const slot in els) {
      if (slot === 'basic' && inTown) continue;  // 마을: 말 걸기 버튼(mode 에서 그림)
      const st = Elements.socket(prof, slot), col = st ? ELEMENTS[st.el].color : '#a89cb0';
      const key = slotIconOf(prof, slot) + col;
      if (drawn[slot] !== key) {
        const g = els[slot].querySelector('canvas').getContext('2d');
        g.clearRect(0, 0, ICON, ICON);
        g.drawImage(Hud.pixIcon(slotIconOf(prof, slot), col), 0, 0);
        drawn[slot] = key;
      }
      const s = els[slot].querySelector('small'), t = slotShortOf(Game.prof, slot);
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
  // 특수기 쿨타임 · 그림자 숨기 대기(2026-10-31): 버튼이 어두워졌다가 12시부터 시계 방향으로 밝아진다(HUD 기술 칸과 같게)
  const cds = [
    { el: els.wave.querySelector('.cd'), on: false, k: p => (p.cls.special.cd && p.specialCd > 0 ? p.specialCd / specialCdOf(p) : 0) },
    { el: els.charge.querySelector('.cd'), on: false, k: p => (p.hideCd > 0 ? p.hideCd / hideCdOf(p) : 0) },
  ];
  function cdTick() {
    const p = typeof Game !== 'undefined' && Game.scene === 'run' ? World.player : null;
    for (const c of cds) {
      const k = p ? Math.min(1, c.k(p)) : 0;
      if (k > 0) {
        c.el.style.background = 'conic-gradient(transparent 0 ' + Math.round((1 - k) * 360) + 'deg, rgba(0, 0, 0, 0.55) 0 360deg)';
        if (!c.on) { c.on = true; c.el.style.display = 'block'; }
      } else if (c.on) { c.on = false; c.el.style.display = 'none'; }
    }
    requestAnimationFrame(cdTick);
  }
  requestAnimationFrame(cdTick);

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
  const letGo = () => { for (const b of root.querySelectorAll('.b.on')) { b.classList.remove('on'); } for (const k of ['KeyX', 'KeyC', 'KeyZ', 'KeyV', 'Digit1', 'Escape', 'Backspace']) Input.virtualKey(k, false); stickEnd(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) letGo(); });
  window.addEventListener('blur', letGo);
  window.addEventListener('gamepaddisconnected', e => { delete padRest[e.gamepad.index]; delete padHeld[e.gamepad.index]; });

  // 게임 중인가 메뉴 화면인가(창이 열렸거나 던전 · 마을 밖이면 메뉴), 마을을 걷는 중인가
  let menuMode = null, inTown = false;
  // 마을: 기본 버튼 = 말 걸기(말풍선 그림 · '대화' / 던전 입구 앞이면 '던전'), 가까이 말 걸 곳이 없으면 흐리게
  function townButton() {
    const b = els.basic, near = Town.near;
    if (drawn.basic !== 'talk') {
      const g = b.querySelector('canvas').getContext('2d');
      g.clearRect(0, 0, ICON, ICON);
      g.drawImage(Hud.pixIcon('talk', '#e8d8b0'), 0, 0);
      drawn.basic = 'talk';
    }
    const s = b.querySelector('small'), t = near && near.id === 'gate' ? '던전' : '대화';
    if (s.textContent !== t) s.textContent = t;
    b.classList.toggle('far', !near);
  }
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
      // 장면이 바뀌면 눌려 있던 버튼을 뗀다
      for (const b of root.querySelectorAll('.b.on')) b.classList.remove('on');
      if (m) { stickEnd(); refresh(); }
    }
    const town = !m && Game.scene === 'town';
    if (town !== inTown) { inTown = town; root.classList.toggle('town', town); if (!town) { els.basic.classList.remove('far'); refresh(); } }
    if (town) townButton();
    back.style.display = m && (Game.scene === 'title' || Game.scene === 'splash') && !Game.overlays.length ? 'none' : '';  // 캐릭터 선택은 뒤로 갈 곳이 없다
    // 이야기 · 광차: 같은 자리 '건너뛰기'(장면 통째) — 한 줄 넘기기는 화면 아무 데나 누르기
    const top = Game.overlays[Game.overlays.length - 1], talk = top && top.type === 'talk', ride = top && top.type === 'ride';
    const bl = talk || ride ? '건너뛰기' : '뒤로';
    if (backLabel.textContent !== bl) { backLabel.textContent = bl; back.style.width = (bl.length > 2 ? Math.max(backW, 92) : backW) + 'px'; }  // 긴 글자는 한 줄에 들어가게 넓게
    // 기력이 모자란 기술 버튼은 흐리게(던전에서만)
    const p = !m && Game.scene === 'run' ? World.player : null;
    if (p) {
      const need = { charge: costOf(p.prof, 'charge'), wave: costOf(p.prof, 'special'), dash: dashCost(p) };
      for (const slot in need) els[slot].classList.toggle('low', p.sp < need[slot]);
    } else for (const slot of ['charge', 'wave', 'dash']) els[slot].classList.remove('low');
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
  const at = t => { const r = canvas.getBoundingClientRect(); return { x: (t.clientX - r.left) / r.width * 960, y: (t.clientY - r.top) / r.height * 540 }; };
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    t0 = { id: t.identifier, x: t.clientX, y: t.clientY };
    UI.touchHold(at(t));
    mode();  // 방금 창이 열렸을 수도 있으니 지금 장면으로
    if (menuMode) UI.dragStart(at(t));  // 넘치는 목록 위면 끌어 넘기기 준비
  }, { passive: false });
  // 끌기: 목록 위에서 손가락을 위아래로 움직이면 목록이 손가락을 따라 넘어가고, 그 손가락은 누르기로 치지 않는다
  canvas.addEventListener('touchmove', e => {
    const t = t0 && [...e.changedTouches].find(q => q.identifier === t0.id);
    if (!t) return;
    if (menuMode && UI.dragMove(at(t))) t0.swiped = true;
    UI.touchHold(t0.swiped || Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 24 ? null : at(t));
  }, { passive: true });
  canvas.addEventListener('touchcancel', () => { t0 = null; UI.touchHold(null); UI.dragEnd(); }, { passive: true });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    UI.touchHold(null);
    UI.dragEnd();  // 튕겼으면 조금 더 미끄러진다
    const t = t0 && [...e.changedTouches].find(q => q.identifier === t0.id);
    if (!t || t0.swiped || Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 24) { t0 = null; return; }
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
