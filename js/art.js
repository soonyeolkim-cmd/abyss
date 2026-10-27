// 던전 안 그리기(방 좌표, 2배 화면). 캐릭터에 공격 동작 그림이 없어서 무기 그림을 돌려 휘두른다.
const Art = (() => {
  const FONT = Gfx.FONT;
  const RAD = Math.PI / 180;
  const lerp = (a, b, k) => a + (b - a) * k;

  function shadow(ctx, x, y, r, z, a) {
    const k = Math.max(0.4, 1 - (z || 0) / 120);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.4 * a) + ')';
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y), r * k, r * 0.4 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 초승달 궤적(2026-10-24 사용자 '자로 잰 듯한 이펙트가 어색'): 같은 두께 띠 대신 양끝이 뾰족하고 가운데가 두툼한 면.
  // 중심 (cx, cy), 반지름 R, 꼬리 a0 → 머리 a1, 가장 두꺼운 곳 w. sym = 양쪽 대칭(검기), 아니면 머리 쪽이 더 두껍다(칼질). sy = 세로 눌림(위에서 본 느낌)
  function crescent(ctx, cx, cy, R, a0, a1, w, col, alpha, sy = 0.82, sym = false) {
    if (alpha <= 0.01 || w <= 0) return;
    const N = 18, out = [], inn = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = a0 + (a1 - a0) * u;
      const t = sym ? w * Math.pow(Math.sin(Math.PI * u), 0.7) : w * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.12)), 0.75) * (0.3 + 0.7 * u);
      out.push([cx + Math.cos(a) * (R + t / 2), cy + Math.sin(a) * (R + t / 2) * sy]);
      inn.push([cx + Math.cos(a) * (R - t / 2), cy + Math.sin(a) * (R - t / 2) * sy]);
    }
    ctx.save();
    ctx.globalAlpha = alpha; ctx.fillStyle = col;
    ctx.beginPath();
    out.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = inn.length - 1; i >= 0; i--) ctx.lineTo(inn[i][0], inn[i][1]);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // 무기 손잡이: 그림 맨 아래(자루 끝)에서 이만큼 위를 손에 쥔다
  const WEAPON_GRIP = 4;
  // 무기 각도(칼끝 방향)와 손 위치
  function weaponPose(p, time) {
    const aim = Math.atan2(p.fv.y, p.fv.x);
    const flip = p.fv.x < -0.05 || (Math.abs(p.fv.x) <= 0.05 && p.flip);
    p.flip = flip;
    // 서 있을 때(2026-10-24 사용자 '무기 쥔 모습이 어색하다'): 손을 몸 옆 · 허리 높이로, 칼끝은 살짝 앞으로 + 숨 쉬듯 살짝 흔들림
    let th = -Math.PI / 2 + (flip ? -0.35 : 0.35) + Math.sin(time * 2.2) * 0.04 * (flip ? -1 : 1), push = 0, trail = null;
    const hx = p.x + (flip ? -7 : 7), hy = p.y - 6 + (p.state === 'walk' ? Math.abs(Math.sin(p.walkT * 12)) * -1 : 0);
    // 양손 카타르 · 싸이(암살자): 주먹 앞으로 내민 무기라 서 있을 때도 날끝이 앞 · 살짝 아래를 겨눈다(2026-10-25 사용자: 위로 세워 드니 촌스러움)
    if (p.cls.dual) th = (flip ? Math.PI - 0.55 : 0.55) + Math.sin(time * 2.2) * 0.04 * (flip ? -1 : 1);
    const reachK = p.cls.dual ? 6 : 9;  // 찌를 때 손이 나가는 거리(양손 무기는 짧게)
    if (p.state === 'act') {
      const a = p.act, d = a.def, t = a.time;
      const ph = t < a.s ? 0 : t < a.s + a.a ? 1 : 2;
      const k = ph === 0 ? t / a.s : ph === 1 ? (t - a.s) / a.a : Math.min(1, (t - a.s - a.a) / a.r);
      if (d.spin) {
        th = aim + (ph === 1 ? k * Math.PI * 4 : ph === 0 ? -0.6 : 0);
        if (ph === 1) trail = { a0: th - 2.6, a1: th, fade: 1 };
      } else if (d.thrust) {
        th = aim;
        push = ph === 0 ? -3 * k : ph === 1 ? lerp(-3, reachK, Math.min(1, k * 2)) : lerp(reachK, 2, k);
        if (d.off) push = -2;  // 왼손 찌르기(암살자): 오른손은 당겨 둔다
      } else {
        const s0 = d.swing[0] * RAD, s1 = d.swing[1] * RAD;
        th = aim + (ph === 0 ? s0 : ph === 1 ? lerp(s0, s1, k) : s1);
        if (d.noBody || d.area) return { th, hx: hx + p.fv.x * push, hy: hy + p.fv.y * push, flip, trail: null, off: p.cls.dual ? offPose(p, time, { th, hx, hy, trail: null }, aim, flip) : undefined };  // 돌진 베기(띠) · 망치 내려찍기(바닥 타원): 칼 궤적 대신 판정 모양 그림
        // 칼 궤적은 판정 부채꼴(정면 ± arc) 안만 그린다 — 칼은 시작각부터 휘둘러도 궤적은 판정 각도에서 시작 · 끝(2026-10-26 이펙트 범위 = 판정 범위)
        const arc = Math.min(Math.PI, ((a.hd && a.hd.arc) || d.arc || 180) * RAD), clip = v => Math.max(-arc, Math.min(arc, v));
        if (ph >= 1 && (ph === 1 || t - a.s - a.a < 0.1)) trail = { a0: aim + clip(s0), a1: aim + clip(th - aim), fade: ph === 1 ? 1 : 1 - (t - a.s - a.a) / 0.1 };
      }
    } else if (p.charge > 0) {
      // 기를 모으는 중: 칼을 뒤로 젖혀 든다(다 모이면 떨린다)
      th = aim + (flip ? 1 : -1) * 2.4 + (p.charge >= 1 ? Math.sin(time * 60) * 0.06 : 0);
    } else if (p.state === 'hurt' || p.state === 'dead') {
      th = Math.PI / 2 + (flip ? 0.5 : -0.5);
    }
    const pose = { th, hx: hx + p.fv.x * push, hy: hy + p.fv.y * push, flip, trail };
    if (p.cls.dual) pose.off = offPose(p, time, pose, aim, flip);
    return pose;
  }
  // 양손 무기(암살자, 2026-10-25 사용자): 왼손 무기 — 몸 뒤쪽 손에 들고, 휘두를 때는 오른손과 거울처럼(교차 베기 = X), 돌 때는 반대편,
  // 찌를 때는 당겨 두었다가 왼손 차례(off)면 찌른다
  function offPose(p, time, main, aim, flip) {
    // 서 있을 때: 몸 뒤 가슴 높이에서 날끝이 앞 · 살짝 위(오른손은 허리에서 앞 · 아래) — 두 날이 앞으로 겹쳐 보이는 자세
    let th = (flip ? Math.PI + 0.3 : -0.3) - Math.sin(time * 2.2) * 0.04 * (flip ? -1 : 1), push = 0, trail = null;
    let hx = p.x + (flip ? -3 : 3), hy = p.y - 10 + (p.state === 'walk' ? Math.abs(Math.sin(p.walkT * 12 + 1.5)) * -1 : 0);
    if (p.state === 'act') {
      const a = p.act, d = a.def, t = a.time;
      const ph = t < a.s ? 0 : t < a.s + a.a ? 1 : 2;
      const k = ph === 0 ? t / a.s : ph === 1 ? (t - a.s) / a.a : Math.min(1, (t - a.s - a.a) / a.r);
      if (d.spin) {
        th = main.th + Math.PI;
        hx = 2 * p.x - main.hx; hy = main.hy;
        if (main.trail) trail = { a0: main.trail.a0 + Math.PI, a1: main.trail.a1 + Math.PI, fade: main.trail.fade };
      } else if (d.thrust) {
        th = aim;
        push = d.off ? (ph === 0 ? -3 * k : ph === 1 ? lerp(-3, 6, Math.min(1, k * 2)) : lerp(6, 2, k)) : -2;
        hx = p.x - p.fv.y * (flip ? -4 : 4); hy = p.y - 7 + p.fv.x * (flip ? -1 : 1);
      } else {
        th = aim - (main.th - aim);
        if (main.trail) trail = { a0: aim - (main.trail.a0 - aim), a1: aim - (main.trail.a1 - aim), fade: main.trail.fade };  // 오른손 궤적의 거울(판정 각도 안)
      }
    } else if (p.state === 'hurt' || p.state === 'dead') {
      th = Math.PI / 2 + (flip ? -0.5 : 0.5);
    }
    return { th, hx: hx + p.fv.x * push, hy: hy + p.fv.y * push, trail };
  }

  function player(ctx, p, time) {
    // 유니크 잎사귀 방패가 준비돼 있으면 발밑에 초록 고리
    if (p.stats.fx && p.stats.fx.leaf && !(p.leafT > 0) && !p.dead) {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(time * 4);
      ctx.strokeStyle = '#7dff8a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 9, 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const base = p.cls.sprite;
    let name = Gfx.anim(base + '_idle_anim', time, 6);
    const o = { flash: p.flash > 0 };
    const pose = weaponPose(p, time);
    o.flip = pose.flip;
    if (p.state === 'walk') name = Gfx.anim(base + '_run_anim', p.walkT, 10);
    if (p.state === 'hurt' || p.state === 'stun') name = base + '_hit_anim_f0';
    // 레이드 벌 표시(머리 위): 기절 = 도는 노란 별 셋 · 공허 표식 = 맥동하는 보랏빛 눈(남은 시간 동안)
    if (p.state === 'stun' && !p.dead) {
      ctx.fillStyle = '#ffd36a';
      for (let i = 0; i < 3; i++) { const a = time * 6 + i * 2.1; ctx.fillRect(Math.round(p.x + Math.cos(a) * 7) - 1, Math.round(p.y - 25 + Math.sin(a) * 2), 2, 2); }
    }
    if (p.markT > 0 && !p.dead) {
      const y = Math.round(p.y - 31), k = 0.6 + 0.4 * Math.sin(time * 8);
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = '#c06aff'; ctx.beginPath(); ctx.ellipse(p.x, y, 4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0a22'; ctx.fillRect(Math.round(p.x) - 1, y - 1, 2, 2);
      ctx.restore();
    }
    if (p.state === 'dodge') {
      name = Gfx.anim(base + '_run_anim', time, 20);
      for (let i = 3; i >= 1; i--) Gfx.spr(ctx, name, p.x - p.dodgeV.x * i * 6, p.y - p.dodgeV.y * i * 6, { flip: o.flip, flash: '#9ad8ff', alpha: 0.25 / i });
      o.alpha = 0.85;
    }
    if (p.state === 'act' && p.act.def.dash && p.act.time >= p.act.s && p.act.time < p.act.s + p.act.a) {
      for (let i = 3; i >= 1; i--) Gfx.spr(ctx, name, p.x - p.fv.x * i * 8, p.y - p.fv.y * i * 8, { flip: o.flip, flash: '#ffffff', alpha: 0.22 / i });
    }
    if (p.state === 'dead') { o.rot = o.flip ? -Math.PI / 2 : Math.PI / 2; name = base + '_hit_anim_f0'; }
    // 암살자 그림자 숨기: 어둡게 반투명 + 발밑 그림자 아지랑이(2026-10-25)
    if (p.hidden) { o.alpha = 0.42 + 0.08 * Math.sin(time * 6); o.tint = '#3a2a6a'; o.tintAlpha = 0.55; }
    const w = p.prof.equip.weapon;
    const drawWeapon = (ps = pose) => {
      if (!w || p.state === 'dead') return;
      const icon = Items.base(w).icon;
      Gfx.spr(ctx, icon, ps.hx, ps.hy, { rot: ps.th + Math.PI / 2, grip: WEAPON_GRIP, flash: o.flash && !p.hidden ? '#ffffff' : false, tint: Items.base(w).tint, tintAlpha: Gfx.WEAPON_TINT, alpha: p.hidden ? o.alpha : undefined });
    };
    // 차지 고리: 발밑에 시계 방향으로 차오르고, 다 모이면 굵게 깜빡인다(봉인의 숲과 같은 표시)
    if (p.charge > 0) {
      const full = p.charge >= 1;
      ctx.save();
      ctx.strokeStyle = Elements.color(p.prof, 'charge');  // 차지 칸 속성 색(없으면 흰색)
      ctx.globalAlpha = full ? 0.7 + Math.sin(time * 30) * 0.3 : 0.6;
      ctx.lineWidth = full ? 2 : 1.2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 11, 6, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.charge);
      ctx.stroke();
      if (full && Math.random() < 0.4) { ctx.fillStyle = Elements.color(p.prof, 'charge'); ctx.fillRect(Math.round(p.x + (Math.random() - 0.5) * 22), Math.round(p.y - Math.random() * 22), 1, 1); }
      ctx.restore();
    }
    const behind = p.fv.y < -0.35 && p.state !== 'act';
    const offFront = pose.off && p.state === 'act' && p.fv.y > 0.3;  // 왼손 무기는 보통 몸 뒤, 아래를 보고 휘두를 때만 앞
    if (pose.off && !offFront) drawWeapon(pose.off);
    if (behind) drawWeapon();
    Gfx.spr(ctx, name, p.x, p.y - (p.state === 'dead' ? -4 : 0), o);
    if (!behind) drawWeapon();
    if (offFront) drawWeapon(pose.off);
    // 칼 궤적: 그 기술 칸에 속성석이 있으면 속성 색, 없으면 흰색(봉인의 숲 규칙)
    if (pose.trail && w && p.act && p.act.def.orbTip) {
      // 롯드 · 스태프: 끝의 빛 구슬이 지나간 자리에 흐려지는 구슬 다섯 개(봉인의 숲 지팡이와 같은 결)
      const R = FRAMES[Items.base(w).icon][3] - WEAPON_GRIP + 2;
      const col = Elements.color(p.prof, 'basic', null) || '#c9b8ff';
      const { a0, a1 } = pose.trail, f = pose.trail.fade === undefined ? 1 : Math.max(0, pose.trail.fade);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const u = i / 5, a = a1 - (a1 - a0) * u * 0.8, x = pose.hx + Math.cos(a) * R, y = pose.hy + Math.sin(a) * R * 0.82, r = 4.5 * (1 - u * 0.7);
        ctx.globalAlpha = 0.55 * (1 - u) * f; ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.9 * (1 - u) * f; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, Math.max(1, r - 1.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (pose.trail && w) {
      bladeTrail(ctx, p, w, pose.hx, pose.hy, pose.trail);
      if (pose.off && pose.off.trail) bladeTrail(ctx, p, w, pose.off.hx, pose.off.hy, pose.off.trail);  // 양손: 왼손 궤적도
    }
  }
  // 칼끝이 지나간 자리: 두툼한 색 초승달 + 안쪽 흰 날 + 칼끝 쪽 반짝(휘두른 뒤 0.1초 흐려지며 사라짐)
  // 그 칸 속성석 단계(2026-10-26 사용자: 마법사처럼 검사도 레벨에 따라): 1 = 궤적을 따라 속성 알갱이 · 2 = 바깥 빛 한 겹 더 · 알갱이 더 · 3 = 칼끝 오로라.
  // → 같은 날 다시(사용자: '3레벨 · 7레벨 화속성이 똑같아 보인다'): 단계마다 궤적이 굵고 진해지고, 2 = 안쪽으로 넓게 번지는 속성 빛, 3 = 달아오른 날 끝 한 겹 + 큰 오로라.
  //   굵어지는 만큼 안쪽으로만(바깥 끝은 예전 그대로 R + 3.5 — 이펙트 범위 = 판정 범위)
  // 궤적 반지름은 칼 길이 그대로(판정 reach 와 거의 같음 — 이펙트 범위 = 판정 범위)
  function bladeTrail(ctx, p, w, hx, hy, trail) {
    const hd = p.act && p.act.hd, R = Math.max(FRAMES[Items.base(w).icon][3] - WEAPON_GRIP + 5, hd && hd.reach && p.act.kind !== 'stab' ? hd.reach[1] - 3 : 0);
    const st = p.act && p.prof.sockets ? Elements.socket(p.prof, p.act.def.slot || 'none') : null, T = Elements.tier(st);
    const col = st ? ELEMENTS[st.el].color : 'rgb(170,215,255)';
    const { a0, a1 } = trail, f = trail.fade === undefined ? 1 : Math.max(0, trail.fade);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (T >= 3) { ctx.globalAlpha = f; Gfx.aurora(ctx, hx + Math.cos(a1) * R * 0.65, hy + Math.sin(a1) * R * 0.55, 13, st.size); ctx.globalCompositeOperation = 'lighter'; }
    if (T >= 2) { const w = 18 + T * 2; crescent(ctx, hx, hy, R + 3 - w / 2, a0, a1, w, col, (0.2 + 0.08 * T) * f); }  // 안쪽으로 넓게 번지는 속성 빛
    const mw = 11 + T * 2;
    crescent(ctx, hx, hy, R + 3.5 - mw / 2, a0, a1, mw, col, (0.42 + T * 0.08) * f);
    if (T >= 3) crescent(ctx, hx, hy, R - 1, a0 + (a1 - a0) * 0.15, a1, 6, Gfx.mix(col, 0.55, 'white'), 0.6 * f);  // 달아오른 날 끝
    crescent(ctx, hx, hy, R, a0 + (a1 - a0) * 0.3, a1, 4, '#ffffff', 0.8 * f);
    if (T) {
      const n = 2 + T * 3, fr = Math.floor(performance.now() / 50);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, a = a1 - (a1 - a0) * u * 0.85, rr = R - 3 - (i % 3) * 2;
        elemBit(ctx, st.el, hx + Math.cos(a) * rr, hy + Math.sin(a) * rr * 0.82 - (st.el === 'fire' ? u * 4 : st.el === 'poison' ? -u * 3 : 0), 1.2 + T * 0.4, f * (1 - u * 0.5), i, col, fr);
      }
    }
    const g = ctx.createRadialGradient(hx + Math.cos(a1) * R, hy + Math.sin(a1) * R * 0.82, 0, hx + Math.cos(a1) * R, hy + Math.sin(a1) * R * 0.82, 7);
    g.addColorStop(0, 'rgba(255,255,255,' + 0.45 * f + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(hx + Math.cos(a1) * R - 7, hy + Math.sin(a1) * R * 0.82 - 7, 14, 14);
    ctx.restore();
  }

  function enemy(ctx, e, time, p) {
    const d = e.def;
    const moving = e.moving || e.state === 'charge';
    const base = d.idle ? d.sprite + (moving ? '_run_anim' : '_idle_anim') : d.sprite + '_anim';
    let name = e.state === 'frozen' ? (d.idle ? d.sprite + '_idle_anim_f0' : d.sprite + '_anim_f0') : Gfx.anim(base, time + e.walkT, e.state === 'charge' ? 16 : 8);
    const flip = e.fv.x < 0;
    let x = e.x, y = e.y - e.z;
    const o = { flip, flash: e.flash > 0 ? '#ffffff' : false, scale: e.scale || 1, tint: d.tint, tintAlpha: d.tintAlpha };
    if (d.part) { Raid.drawPart(ctx, e, time); return; }  // 레이드 공허 수정 · 구슬
    if (d.raid && e.state === 'exposed') name = 'raid_warden_open';  // 갈비가 벌어져 심장이 드러남
    if (d.raid && e.state === 'phaseShift' && Math.floor(time * 16) % 2) o.flash = '#ffffff';
    if (d.pix && pixMob(ctx, e, time, o)) return;  // 끝없는 심연 도트 몹: 땅속 · 사라짐처럼 따로 그리는 때
    if (d.pix && e.state !== 'dead' && e.state !== 'air' && e.state !== 'down') {  // 한두 장 그림이라 걷기 · 떠 있기를 흔들림으로
      if (d.blink) y -= 2 + Math.round(Math.sin(time * 3 + e.walkT) * 1.5);  // 다리 없는 망령: 늘 떠서 일렁임
      else if (e.moving) y -= Math.floor((time + e.walkT) * (d.r <= 4 ? 10 : 7)) % 2;
    }
    // 보스 예고
    if (e.state === 'slam') {
      const k = 1 - e.t / e.windupT;
      ctx.save();
      ctx.fillStyle = 'rgba(255,40,30,' + (0.1 + 0.2 * k) + ')';
      ctx.strokeStyle = 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')';
      ctx.beginPath(); ctx.ellipse(e.x, e.y, d.slam.radius, d.slam.radius * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(e.x, e.y, d.slam.radius * k, d.slam.radius * 0.6 * k, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (e.state === 'chargeWind') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,60,40,' + (0.35 + 0.35 * Math.sin(time * 30)) + ')';
      ctx.lineWidth = e.r * 2;
      ctx.beginPath(); ctx.moveTo(e.x, e.y - 4); ctx.lineTo(e.x + e.chargeV.x * 160, e.y - 4 + e.chargeV.y * 160); ctx.stroke();
      ctx.restore();
    }
    const tele = e.state === 'windup' && (committed(e) || d.superArmor) || ['slam', 'leapWind', 'chargeWind', 'fan', 'orbWind', 'ringWind'].includes(e.state);
    if (tele && !o.flash && Math.floor(time * 14) % 2 === 0) o.flash = '#ff4030';
    if (d.shield && e.state === 'recover' && !o.flash && Math.floor(time * 6) % 3 === 0) o.flash = '#5fe0d0';  // 방패병 틈: 청록으로 깜빡
    if (d.shield && SHIELD_UP.includes(e.state) && e.state !== 'dead') {  // 방패가 막는 쪽(앞 ±약 72°)을 발밑 뼈빛 호로
      const a = Math.atan2(e.fv.y / GROUND_Y, e.fv.x), w = Math.acos(SHIELD.front), R = e.r + 6;
      ctx.save();
      ctx.strokeStyle = 'rgba(236,224,204,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * GROUND_Y, 0, a - w, a + w); ctx.stroke();
      ctx.restore();
    }
    // 상태이상 색: 빙결 = 얼음빛(움직임 멈춤), 냉기 · 균열 = 가끔 푸른빛, 감전 = 가끔 노란빛
    if (!o.flash) {
      const tick = Math.floor(time * 10 + e.walkT * 3) % 4;
      if (e.state === 'frozen') o.flash = '#a8eaff';
      else if ((e.chill > 0 || e.crackT > 0) && tick === 0) o.flash = '#cfefff';
      else if (e.shockT > 0 && tick === 2) o.flash = '#fff2a0';
    }
    if (e.spawnT > 0) {
      const k = Math.min(1, e.spawnT / 0.7);
      o.alpha = 1 - k;
      y += k * 8;
    }
    switch (e.state) {
      case 'hurt': x += Math.round(Math.sin(time * 60) * 1); break;
      case 'stagger': case 'tired': x += Math.round(Math.sin(time * 30) * 1.5); break;
      case 'air': o.rot = (flip ? 1 : -1) * (0.4 + Math.min(0.8, e.juggle * 0.25)); y += 4; break;
      case 'down': o.rot = (flip ? 1 : -1) * Math.PI / 2; y += 3; break;
      case 'getup': o.rot = (flip ? 1 : -1) * Math.PI / 4; break;
      case 'dead':
        if (d.boss) { o.alpha = Math.max(0, 1 - e.t / 1.5); o.flash = Math.floor(time * 20) % 2 ? '#ffffff' : false; }
        else if (d.rooted) o.alpha = Math.max(0, 1 - e.t / 0.9);  // 촉수: 그 자리에서 스러짐
        else { o.rot = (flip ? 1 : -1) * Math.PI / 2; y += 3; o.alpha = Math.max(0, 1 - Math.max(0, e.t - 0.5) / 0.6); }
        break;
    }
    Gfx.spr(ctx, name, x, y, o);
    if (d.acc && e.state !== 'dead') bossAcc(ctx, d.acc, x, y, o.scale, flip, time);
    if (d.raid) Raid.drawBoss(ctx, e, x, y, time);
    if (e.wardT > 0 && e.state !== 'dead' && !e.dying) {  // 보호막 사제의 보호막: 몸을 감싼 청록 막(일렁임)
      const k = 0.5 + 0.5 * Math.sin(time * 6 + e.walkT);
      ctx.save();
      ctx.strokeStyle = 'rgba(95,224,208,' + (0.45 + 0.3 * k) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y - e.h / 2), e.r + 4, e.h / 2 + 3, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(95,224,208,' + (0.08 + 0.06 * k) + ')'; ctx.fill();
      ctx.restore();
    }
    if (e.cutT > 0 && e.state !== 'dead') {  // 베인 상처: 머리 위 붉은 사선 두 줄(깜빡)
      if (e.cutT > 1 || Math.floor(time * 8) % 2) { ctx.fillStyle = '#ff5a4a'; const hx = Math.round(e.x), hy = Math.round(y - e.h - 4); for (let i = 0; i < 4; i++) { ctx.fillRect(hx - 3 + i, hy + 2 - i, 1, 1); ctx.fillRect(hx + i, hy + 2 - i, 1, 1); } }
    }
    if (e.disarmT > 0 && e.state !== 'dead') {  // 싸이 무장해제: 머리 위 부러진 칼(잿빛, 끝날 무렵 깜빡)
      if (e.disarmT > 0.8 || Math.floor(time * 8) % 2) {
        const hx = Math.round(e.x) + 6, hy = Math.round(y - e.h - 6);
        ctx.fillStyle = '#1c1a26'; ctx.fillRect(hx - 1, hy - 1, 3, 8);
        ctx.fillStyle = '#c8c8d8'; ctx.fillRect(hx, hy, 1, 3); ctx.fillRect(hx, hy + 4, 1, 2);
        ctx.fillStyle = '#8a6a4a'; ctx.fillRect(hx - 1, hy + 6, 3, 1);
      }
    }
    if ((e.state === 'windup' && committed(e) && !d.boss) && Math.floor(time * 12) % 2 === 0) {
      ctx.font = 'bold 10px ' + FONT; ctx.textAlign = 'center'; ctx.fillStyle = '#ff4a3a';
      ctx.fillText('!', e.x, y - e.h - 2);
    }
    if (e.state === 'tired' || (e.state === 'stagger' && d.boss)) {
      ctx.fillStyle = '#ffe066';
      for (let k = 0; k < 3; k++) { const a = time * 6 + k * 2.1; ctx.fillRect(Math.round(e.x + Math.cos(a) * 8), Math.round(y - e.h - 3 + Math.sin(a) * 2), 2, 2); }
    }
  }

  // 끝없는 심연 도트 몹의 특별한 때(그렸으면 true): 땅속 촉수(땅속 · 솟기 예고 · 들어감) · 순간이동자(사라짐 · 나타남)
  function pixMob(ctx, e, time, o) {
    const d = e.def, x = Math.round(e.x), y = Math.round(e.y);
    if (d.burrow && (e.under || e.state === 'rise' || e.state === 'sink')) {
      if (e.state === 'rise') {  // 솟기 예고 = 그 자리 판정(burrow.r) 바닥 타원이 차오름 + 구멍이 떨림
        const k = 1 - e.t / d.burrow.rise, R = d.burrow.r;
        ctx.save();
        ctx.fillStyle = 'rgba(255,40,30,' + (0.1 + 0.2 * k) + ')'; ctx.strokeStyle = 'rgba(255,80,60,' + (0.5 + 0.5 * k) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(e.x, e.y, R * k, R * GROUND_Y * k, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        Gfx.spr(ctx, 'tentacle_hole', x + (Math.floor(time * 30) % 2 ? 1 : -1), y);
      } else if (e.state === 'sink') {  // 들어감: 구멍 안으로 미끄러짐(구멍 윗줄 아래는 안 보이게)
        const k = 1 - e.t / d.burrow.sink;
        Gfx.spr(ctx, 'tentacle_hole', x, y);
        ctx.save();
        ctx.beginPath(); ctx.rect(x - 8, y - 30, 16, 27); ctx.clip();
        Gfx.spr(ctx, 'tentacle_anim_f0', x, y + Math.round(k * 22), { flip: o.flip });
        ctx.restore();
      } else {  // 땅속: 구멍이 따라 기어옴(움직이면 흙 알갱이)
        Gfx.spr(ctx, 'tentacle_hole', x, y, { alpha: e.awake ? 0.85 : 0.7 });
        if (e.moving) {
          ctx.fillStyle = '#4a2a3a';
          for (let i = 0; i < 3; i++) { const a = time * 9 + i * 2.1; ctx.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y - 2 - Math.abs(Math.sin(a * 1.3)) * 4), 1, 1); }
        }
      }
      return true;
    }
    if (d.blink && (e.state === 'blinkOut' || e.state === 'blinkIn')) {
      const out = e.state === 'blinkOut', k = 1 - e.t / (out ? d.blink.out : d.blink.inn), fy = y - 2;
      // 발밑 검보라 소용돌이(사라질 땐 커지고 나타날 땐 줄어듦)
      const R = 4 + 6 * (out ? k : 1 - k);
      ctx.save();
      ctx.fillStyle = 'rgba(42,22,48,0.6)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (out) Gfx.spr(ctx, k < 0.5 && Math.floor(time * 20) % 2 ? 'blinker_anim_f0' : 'blinker_fade', x, fy, { flip: o.flip, alpha: 1 - k * 0.8 });
      else Gfx.spr(ctx, k > 0.7 ? 'blinker_anim_f0' : 'blinker_fade', x, fy, { flip: o.flip, alpha: 0.3 + 0.7 * k });
      return true;
    }
    return false;
  }

  // 보스 장식(data.js acc): 왕관 · 뿔 · 빛나는 눈 · 몸 빛 · 고름. 좌표는 그림 한 칸 단위(발밑 가운데 기준), s = 그림 배율
  function bossAcc(ctx, acc, x, y, s, flip, time) {
    const P = (px, py, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + (flip ? -px - 1 : px) * s), Math.round(y + py * s), Math.ceil(s), Math.ceil(s)); };
    const glow = (gx, gy, r, col, a) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cx = x + (flip ? -gx : gx) * s, cy = y + gy * s, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * s);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(cx - r * s, cy - r * s, r * s * 2, r * s * 2); ctx.restore();
    };
    const pulse = 0.75 + 0.25 * Math.sin(time * 4);
    for (const a of acc) {
      if (a.t === 'crown') ['g.g.g.g', 'ggggggg', 'gg.r.gg'].forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') P(a.x + i - 3.5, a.y + j, c === 'r' ? '#ff4a6a' : j === 2 ? '#c8962e' : '#ffd36a'); }));
      if (a.t === 'horns') for (let k = 0; k < 4; k++) { P(a.x - a.gap / 2 - k * 0.6, a.y - k, '#e8dcc4'); P(a.x + a.gap / 2 + k * 0.6, a.y - k, '#e8dcc4'); }
      if (a.t === 'eyes') { glow(a.x, a.y, a.gap * 1.6, a.col, 0.5 * pulse); P(a.x - a.gap / 2 - 0.5, a.y, a.col); P(a.x + a.gap / 2 - 0.5, a.y, a.col); }
      if (a.t === 'glow') glow(0, a.y, a.r, a.col, 0.35 * pulse);
      if (a.t === 'boils') a.pts.forEach(([bx, by], i) => P(bx, by, (Math.floor(time * 3) + i) % 3 ? '#d8ff5a' : '#a8c040'));
    }
  }

  function enemyBar(ctx, e) {
    if (e.def.boss || e.hp >= e.maxHp || e.dying || e.state === 'dead' || untouchable(e)) return;  // 땅속 · 사라진 몹은 막대도 숨김
    const w = 16, x = Math.round(e.x - w / 2), y = Math.round(e.y - e.z - e.h - 5);
    ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = '#5a1010'; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#e04040'; ctx.fillRect(x, y, Math.round(w * Math.max(0, e.hp) / e.maxHp), 2);
  }

  function drop(ctx, d, time) {
    const y = d.y - d.z;
    shadow(ctx, d.x, d.y, 3, d.z, 0.6);
    if (d.kind === 'gold') { Gfx.spr(ctx, Gfx.anim('coin_anim', time + d.x * 0.01, 8), d.x, y + 1); return; }
    if (d.kind === 'stone') {
      const col = ELEMENTS[d.stone.el].color;
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 6);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      Gfx.stoneIcon(ctx, d.stone, d.x, y - 5, 12);
      return;
    }
    if (d.kind === 'scroll') { Gfx.scrollIcon(ctx, d.scroll, d.x, y - 4, 10); return; }
    if (d.kind === 'core') {  // 심연의 핵(레이드 보상): 청록 심장 보석 + 맥동하는 빛
      const cy = Math.round(y - 6 + Math.sin(time * 3 + d.x) * 1), cx = Math.round(d.x), k = 0.5 + 0.5 * Math.sin(time * 6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 10);
      g.addColorStop(0, 'rgba(95,224,208,' + (0.5 + 0.3 * k) + ')'); g.addColorStop(1, 'rgba(95,224,208,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - 10, cy - 10, 20, 20); ctx.restore();
      ['.oo.oo.', 'otTotTo', 'ottwttT', '.otttT.', '..otT..', '...o...'].forEach((row, j) => [...row].forEach((c, i) => {
        if (c === '.') return;
        ctx.fillStyle = c === 'o' ? '#120a14' : c === 't' ? CORE_COLOR : c === 'T' ? '#2a8a88' : '#ffffff'; ctx.fillRect(cx - 3 + i, cy - 3 + j, 1, 1);
      }));
      return;
    }
    if (d.kind === 'essence') {  // 심연 정수: 보랏빛 수정 + 일렁이는 빛
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 6 + d.x);
      ctx.fillStyle = ESSENCE_COLOR;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      Gfx.essenceIcon(ctx, d.x, y - 5 + Math.sin(time * 3 + d.x) * 1, 10);
      return;
    }
    const it = d.item, col = RARITY[it.rarity].color;
    if (it.rarity > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 5);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      // 빛기둥: 매직은 짧게, 레어는 높게(디아블로처럼 멀리서도 보이게)
      const hgt = it.rarity === 3 ? 95 : it.rarity === 2 ? 70 : 28;  // 유니크는 더 높게
      const g = ctx.createLinearGradient(0, d.y - hgt, 0, d.y);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col);
      ctx.globalAlpha = it.rarity >= 2 ? 0.45 : 0.3;
      ctx.fillStyle = g; ctx.fillRect(d.x - 2, d.y - hgt, 4, hgt);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(Math.round(d.x), Math.round(y - 6));
    Gfx.icon(ctx, it, 0, 0, 12);
    ctx.restore();
  }

  // 바닥 아이템 이름표(어둠 위에 그린다): 어두운 바탕 + 등급 색 글자
  function dropLabel(ctx, d) {
    if (d.z > 0) return;
    const it = d.item, col = RARITY[it.rarity].color;
    ctx.font = 'bold 6px ' + FONT; ctx.textAlign = 'center';
    const w = ctx.measureText(it.name).width + 6, y = d.y - 22;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(Math.round(d.x - w / 2), y - 6, Math.round(w), 8);
    ctx.fillStyle = col; ctx.fillText(it.name, d.x, y);
  }

  // 정예(파랑) · 고유(금색) 발밑 기운
  function aura(ctx, e, time) {
    if (e.rank !== 'elite' && e.rank !== 'unique') return;
    if (e.state === 'dead' || e.dying) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 4 + e.walkT);
    ctx.fillStyle = NAME_COLOR[e.rank];
    ctx.beginPath(); ctx.ellipse(e.x, e.y, e.r + 5, (e.r + 5) * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 정예 · 고유 이름(머리 위)
  function nameTag(ctx, e) {
    if ((e.rank !== 'elite' && e.rank !== 'unique') || e.dying || e.state === 'dead' || untouchable(e)) return;
    ctx.font = 'bold 6px ' + FONT; ctx.textAlign = 'center';
    const y = Math.round(e.y - e.z - e.h - 9);
    ctx.fillStyle = '#000'; ctx.fillText(e.name, e.x + 0.5, y + 0.5);
    ctx.fillStyle = NAME_COLOR[e.rank]; ctx.fillText(e.name, e.x, y);
  }

  function chest(ctx, c) {
    const f = c.open ? Math.min(2, Math.floor(c.t * 12)) : 0;
    Gfx.spr(ctx, 'chest_full_open_anim_f' + f, c.x, c.y, { scale: c.big ? 2 : 1 });
    if (!c.open) {
      ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(Date.now() / 200);
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(c.x - 1, c.y - (c.big ? 40 : 24), 2, 4);
      ctx.restore();
    }
  }

  function stairs(ctx, s, time) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(time * 4);
    ctx.fillStyle = '#7dd3ff';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    Gfx.spr(ctx, 'floor_stairs', s.x - 8, s.y - 8, { topLeft: true });
  }
  // 계단 표시(2026-10-27 사용자: 보스를 잡고 나온 계단이 잘 보이게 → "너무 화려, 도트 느낌으로") — 모든 던전 계단.
  //   어둠 바로 위 1배 화면(world.js)에 칸 단위로만 그린다(매끈한 그라데이션 · 선 없이):
  //   far(0~1) = 빛 밖인 만큼 계단 그림을 다시 얹음 · 점으로 퍼지는 고리 · 3칸 계단식 옅은 빛기둥 · 올라가는 빛 점 · 2장 깜빡 ▼
  const STAIR_COL = '#7dd3ff', STAIR_HI = '#bfefff';
  function stairsMark(ctx, s, time, far) {
    const x = Math.round(s.x), y = Math.round(s.y), blink = Math.floor(time * 3) % 2;
    ctx.save();
    if (far > 0) {
      ctx.globalAlpha = far * (0.3 + 0.15 * blink); ctx.fillStyle = STAIR_COL;
      ctx.fillRect(x - 12, y - 3, 24, 6); ctx.fillRect(x - 9, y - 5, 18, 10);
      ctx.globalAlpha = far;
      Gfx.spr(ctx, 'floor_stairs', x - 8, y - 8, { topLeft: true });
    }
    ctx.fillStyle = STAIR_COL;
    const ph = (time % 1.6) / 1.6, r = 9 + Math.floor(ph * 5) * 2;  // 고리: 2칸씩 뚝뚝 커지는 점선 타원
    ctx.globalAlpha = 0.55 * (1 - ph);
    for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.5), 1, 1); }
    const band = [[5, 0.22], [3, 0.14], [2, 0.07]];  // 빛기둥: 아래부터 [반폭, 진하기] 10칸씩
    band.forEach(([w, al], i) => { ctx.globalAlpha = al + 0.04 * blink; ctx.fillRect(x - w, y - 4 - (i + 1) * 10, w * 2, 10); });
    ctx.fillStyle = STAIR_HI;
    for (let j = 0; j < 3; j++) {  // 빛 점: 기둥 안에서 천천히 떠오름
      const t = (time * 0.6 + j / 3) % 1;
      ctx.globalAlpha = 0.8 * (1 - t);
      ctx.fillRect(x - 3 + j * 3, Math.round(y - 4 - t * 28), 1, 1);
    }
    const ay = y - 24 - blink;  // ▼(7 · 5 · 3 · 1칸), 2장으로 한 칸 오르내림
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(x - 4, ay - 1, 9, 6);
    ctx.fillStyle = STAIR_HI;
    for (let i = 0; i < 4; i++) ctx.fillRect(x - 3 + i, ay + i, 7 - i * 2, 1);
    ctx.restore();
  }
  // 계단 이름(2배 화면 · 어둠 위): ▼ 바로 위, 움직이지 않음
  function stairsLabel(ctx, s) {
    ctx.font = 'bold 7px ' + FONT; ctx.textAlign = 'center';
    const label = s.label || '마을로 가는 계단';  // 끝없는 심연: 다음 층이 있으면 'N층으로 가는 계단'
    const x = Math.round(s.x), y = Math.round(s.y) - 28;
    ctx.fillStyle = '#000'; ctx.fillText(label, x + 0.5, y + 0.5);
    ctx.fillStyle = STAIR_HI; ctx.fillText(label, x, y);
    ctx.textAlign = 'left';
  }

  function shot(ctx, s, time) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 3 + Math.sin(time * 20), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 내 투사체 표시(2026-10-24 사용자: 용암 지옥 몹의 빨간 탄과 헷갈린다): 몹 탄은 둥근 빛, 내 것은 흰 테두리 4각 별 + 혜성 꼬리
  function star4(ctx, x, y, R, rot, fill, alpha) {
    ctx.globalAlpha = alpha; ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, r = i % 2 ? R * 0.32 : R; if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }
  function comet(ctx, s, y, len, w, alpha = 0.6) {  // 날아온 쪽으로 가늘어지는 꼬리
    const sp = Math.hypot(s.vx, s.vy) || 1, dx = s.vx / sp, dy = s.vy / sp;
    const g = ctx.createLinearGradient(s.x, y, s.x - dx * len, y - dy * len);
    g.addColorStop(0, s.col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(s.x - dy * w, y + dx * w); ctx.lineTo(s.x - dx * len, y - dy * len); ctx.lineTo(s.x + dy * w, y - dx * w); ctx.closePath(); ctx.fill();
  }

  // 속성 알갱이 하나(검사 칼 궤적 · 회전베기 · 검기 공용, 2026-10-26): 불 = 불티 빛 · 얼음 = 마름모 얼음 조각 · 번개 = 짧게 꺾인 전기 · 독 = 방울. 끝나면 'lighter' 로 둔다
  function elemBit(ctx, el, x, y, s, a, i, col, fr) {
    if (a <= 0.02) return;
    if (el === 'fire') { glow(ctx, x, y, s * 1.8, i % 2 ? '#ffd36a' : col, a); ctx.globalCompositeOperation = 'lighter'; return; }
    ctx.globalCompositeOperation = 'lighter';
    if (el === 'frost') {
      ctx.globalAlpha = a; ctx.fillStyle = i % 2 ? '#ffffff' : Gfx.mix(col, 0.5, 'white');
      ctx.beginPath(); ctx.moveTo(x, y - s * 1.5); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x, y + s * 1.5); ctx.lineTo(x - s * 0.6, y); ctx.closePath(); ctx.fill();
    } else if (el === 'thunder') {
      const b = Math.sin(fr * 4.7 + i * 3.1) * Math.PI * 2, L = s * 2.5;
      ctx.globalAlpha = a; ctx.strokeStyle = i % 2 ? '#ffffff' : Gfx.mix(col, 0.4, 'white'); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * L * 0.5 + 1, y + Math.sin(b) * L * 0.5); ctx.lineTo(x + Math.cos(b + 0.5) * L, y + Math.sin(b + 0.5) * L); ctx.stroke();
    } else if (el === 'poison') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a; ctx.fillStyle = i % 2 ? '#d8ffb0' : col;
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
    }
  }
  // 회전베기 · 선풍 베기 고리의 속성 알갱이(단계 1부터, 단계마다 는다): 도는 두 칼끝 뒤를 따라, 판정 반지름 안쪽
  function ringMotif(ctx, f, R, spin, e, T, c) {
    const n = 3 + T * 3, fr = Math.floor(f.t * 20), x0 = f.follow.x, y0 = f.follow.y - 3;
    for (let j = 0; j < 2; j++) for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, a = spin + j * Math.PI - u * 2.2, rr = R - 5 - (i % 3) * 3;
      elemBit(ctx, f.el, x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr * GROUND_Y - (f.el === 'fire' ? u * 7 : f.el === 'poison' ? -u * 3 : 0), 1.3 + T * 0.45, e * (1 - u * 0.55), i + j, c, fr);
    }
  }
  // 검기 속성 알갱이(단계 1부터): 초승달 뒤로 흩어지며 남음(지나온 길 = 이미 판정이 지나간 곳). 돌린 좌표(날아가는 쪽 = +x) 안에서
  function waveMotif(ctx, s, T, hex, fade) {
    const n = 3 + T * 3, t = s.t || 0, fr = Math.floor(t * 20);
    for (let i = 0; i < n; i++) {
      const u = (t * 3 + i / n) % 1, side = (((i * 0.618) % 1) * 2 - 1) * 11 * (1 - u * 0.3);
      elemBit(ctx, s.stone.el, -6 - u * (16 + T * 6), side + (s.stone.el === 'fire' ? -u * 4 : s.stone.el === 'poison' ? u * u * 6 : 0), 1.3 + T * 0.4, fade * (1 - u), i, hex, fr);
    }
  }
  // 속성 탄은 보석과 같은 색으로 진하게(2026-10-25 사용자: 화염 탄이 보석보다 옅고 하얗다).
  // 예전엔 '더하기' 빛으로 겹쳐 그려 색이 하얗게 떴다 → 몸은 보석 색 그대로 덮어 칠하고, 바깥은 보석의 어두운 색 테두리, 가운데만 작게 밝게
  function glow(ctx, x, y, r, col, a) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // 마력탄: 보석 색 구슬(어두운 테두리 · 밝은 심) + 꼬리 + 도는 흰 별 = 내 것.
  // 마력탄 칸 속성석 단계(s.tier, 2026-10-26 사용자: 레벨에 따라 멋져지게 · 구간마다)마다 더해진다:
  //   1 보통 · 큰 = 조금 크게 · 긴 꼬리 · 꼬리 빛 알갱이 · 속성 무늬(불 = 너울대는 불꽃 · 얼음 = 도는 얼음 조각 · 번개 = 튀는 전기 · 독 = 떨어지는 방울)
  //   2 완전한 = + 도는 빛 고리 · 무늬 하나 더 · 더 밝게   3 전설 · 태초 = + 오로라(속성석 테두리와 같은 색) · 고리 둘 · 큰 별
  function orb(ctx, s, hex, light) {
    const y = s.y - 8, T = s.tier || 0, t = s.t || 0, r = s.r + T * 0.9;
    const sp = Math.hypot(s.vx, s.vy) || 1, dx = s.vx / sp, dy = s.vy / sp, P = Math.PI * 2;
    ctx.save();
    if (T >= 3) Gfx.aurora(ctx, s.x, y, r + 12, s.ss || 6);
    glow(ctx, s.x, y, r + 8 + T * 3, hex, 0.45 + T * 0.08);
    comet(ctx, s, y, 22 + T * 8, r, 0.85);
    if (T) {  // 꼬리 빛 알갱이: 지나온 길에 남아 흩어짐
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = light;
      for (let i = 0; i < 3 + T * 2; i++) {
        const u = ((t * 5 + i * 0.37) % 1), back = 6 + u * (18 + T * 8), side = Math.sin(i * 2.3 + t * 9) * (2 + u * 4);
        ctx.globalAlpha = 0.8 * (1 - u);
        ctx.fillRect(Math.round(s.x - dx * back - dy * side), Math.round(y - dy * back + dx * side), 1 + (i % 2), 1 + (i % 2));
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    if (T >= 2) {  // 도는 빛 고리(전설 · 태초는 둘)
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = light; ctx.lineWidth = 1;
      for (let j = 0; j < (T >= 3 ? 2 : 1); j++) {
        ctx.globalAlpha = 0.6 - j * 0.2;
        ctx.beginPath(); ctx.ellipse(s.x, y, r + 5 + j * 3, (r + 5 + j * 3) * 0.42, t * (3 + j * 2) * (j ? -1 : 1), 0, P); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // 몸통(2026-10-26 사용자: 경계가 뚜렷하지 않게): 테두리 없이 가운데 흰빛 → 밝은 색 → 속성 색 → 투명으로 번지는 빛 덩어리. 판정(s.r)은 그대로
    const R = r + 6, g = ctx.createRadialGradient(s.x - 0.5, y - 0.5, 0, s.x, y, R);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.22, light); g.addColorStop(0.55, hex); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, y, R, 0, P); ctx.fill();
    glow(ctx, s.x, y, r + 2, '#ffffff', 0.35);  // 심을 한 번 더 밝게
    ctx.globalCompositeOperation = 'source-over';
    if (T) orbMotif(ctx, s, y, r, T, t, hex, light, dx, dy);
    // 내 것 표시(몹 탄은 둥근 빛뿐): 흰 4각 별 — 크게 옅게 한 번 + 작게 진하게 한 번 겹쳐 번지게
    const S = r + 3 + (T >= 3 ? 2 : 0);
    ctx.globalCompositeOperation = 'lighter';
    star4(ctx, s.x, y, S * 1.2, t * 8, '#ffffff', 0.14 + T * 0.03);
    star4(ctx, s.x, y, S, t * 8, '#ffffff', 0.3 + T * 0.06);
    ctx.restore();
  }
  // 마력탄 속성 무늬(단계 1부터, 2부터 하나 더)
  function orbMotif(ctx, s, y, r, T, t, hex, light, dx, dy) {
    const n = T >= 2 ? 3 : 2, P = Math.PI * 2;
    ctx.globalCompositeOperation = 'lighter';
    if (s.el === 'fire') {  // 뒤쪽으로 너울대는 불꽃: 번지는 불빛 덩이(테두리 없이)
      for (let i = 0; i < n + 1; i++) {
        const a = Math.atan2(-dy, -dx) + (i - n / 2) * 0.55, fl = 0.6 + 0.4 * Math.sin(t * 30 + i * 2), L = (r * 0.7 + 1 + T * 1.5) * fl;
        const x = s.x + Math.cos(a) * (r + L * 0.5), yy = y + Math.sin(a) * (r + L * 0.5);
        glow(ctx, x, yy, 2.5 + L * 0.6, i % 2 ? '#ffd36a' : hex, 0.8);
      }
    } else if (s.el === 'frost') {  // 둘레를 도는 얼음 조각(마름모)
      for (let i = 0; i < n; i++) {
        const a = t * 5 + i * P / n, x = s.x + Math.cos(a) * (r + 5), yy = y + Math.sin(a) * (r + 5) * 0.6, k = 2 + T * 0.5;
        ctx.globalAlpha = 0.9; ctx.fillStyle = i % 2 ? '#ffffff' : light;
        ctx.beginPath(); ctx.moveTo(x, yy - k); ctx.lineTo(x + k * 0.6, yy); ctx.lineTo(x, yy + k); ctx.lineTo(x - k * 0.6, yy); ctx.closePath(); ctx.fill();
      }
    } else if (s.el === 'thunder') {  // 튀는 전기(0.05초마다 모양이 바뀜)
      const f = Math.floor(t * 20);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const q = Math.sin(f * 7.1 + i * 3.3), a = q * Math.PI + i * 2, L = 3 + T * 1.2;
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(s.x + Math.cos(a) * (r + 1), y + Math.sin(a) * (r + 1));
        ctx.lineTo(s.x + Math.cos(a + 0.4) * (r + 1 + L * 0.55), y + Math.sin(a + 0.4) * (r + 1 + L * 0.55));
        ctx.lineTo(s.x + Math.cos(a - 0.15) * (r + 1 + L), y + Math.sin(a - 0.15) * (r + 1 + L)); ctx.stroke();
      }
    } else if (s.el === 'poison') {  // 뒤로 떨어지는 독 방울
      for (let i = 0; i < n; i++) {
        const u = (t * 2.5 + i / n) % 1, x = s.x - dx * (r + 2 + u * 10) + (i - 1) * 3, yy = y - dy * (r + 2 + u * 10) + u * u * 10;
        ctx.globalAlpha = 1 - u * 0.7; ctx.fillStyle = i % 2 ? '#d8ffb0' : hex;
        ctx.beginPath(); ctx.arc(x, yy, 2 + T * 0.5, 0, P); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - 1), Math.round(yy - 1), 1, 1);  // 방울 반짝
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // 섬광 검기: 날아가는 쪽으로 볼록한 초승달
  function wave(ctx, s) {
    const hex = s.col && s.col[0] === '#' ? s.col : '#b39cff', dark = Gfx.mix(hex, 0.45, 'black'), light = Gfx.mix(hex, 0.45, 'white');
    if (s.orb) { orb(ctx, s, hex, light); return; }
    if (s.knife) {  // 암살자 표창: 날아가는 쪽을 겨눈 은빛 단검(어두운 테두리 · 보랏빛 손잡이) + 뒤로 흐린 빛 줄
      ctx.save();
      ctx.translate(s.x, s.y - 8);
      ctx.rotate(Math.atan2(s.vy, s.vx));
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#c8d0ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-5, 0); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#1c1a26';
      ctx.beginPath(); ctx.moveTo(8.5, 0); ctx.lineTo(-1.5, -3.2); ctx.lineTo(-1.5, 3.2); ctx.closePath(); ctx.fill();
      ctx.fillRect(-7, -1.8, 6, 3.6);
      ctx.fillStyle = '#d8deea';
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-1, -2); ctx.lineTo(-1, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -0.6, 6, 1);
      ctx.fillStyle = '#9aa0b0'; ctx.fillRect(-2, -3, 1.5, 6);  // 코등이
      ctx.fillStyle = '#6a4a8a'; ctx.fillRect(-6.5, -1, 4.5, 2);  // 손잡이
      ctx.restore();
      return;
    }
    if (s.ball) {  // 속성석 부과 능력의 탄(화염구 · 얼음 파편): 혜성 꼬리 + 보석 색 4각 별(어두운 테두리) + 작은 밝은 심 — 둥근 몹 탄과 모양이 다르게
      // 단계(s.tier, 2026-10-26): 꼬리가 길고 빛이 커지며, 2 = 꼬리 한 겹 더(밝은 색), 3 = 오로라 후광
      // 그림 전체를 vs 배로(기본 칸 돌 크기 — 태초 1 = 예전 그대로, 보통은 절반 아래, 2026-10-26 사용자: 투사체 크기 차이가 안 느껴짐). R0 = 배율 빼기 전 반지름
      const y = s.y - 8, rot = (s.t || 0) * 10, T = s.tier || 0, v = s.vs || 1, R0 = s.r / v;
      ctx.save();
      if (T >= 3) { ctx.globalAlpha = 0.9; Gfx.aurora(ctx, s.x, y, (R0 + 7) * v, 6); ctx.globalAlpha = 1; }
      glow(ctx, s.x, y, (R0 + 8 + T * 2) * v, hex, 0.4 + T * 0.08);
      if (T >= 2) comet(ctx, Object.assign({}, s, { col: light }), y, 26 * v, s.r + v, 0.55);
      comet(ctx, s, y, (16 + T * 4) * v, s.r, 0.85);
      star4(ctx, s.x, y, (R0 + 5.5) * v, rot, dark, 1);
      star4(ctx, s.x, y, (R0 + 4) * v, rot, hex, 1);
      star4(ctx, s.x, y, (R0 + 1.5) * v, rot, light, 1);
      star4(ctx, s.x, y, s.r * 0.6, rot, '#ffffff', 0.9);
      ctx.restore();
      return;
    }
    // 날아가는 쪽으로 볼록한 초승달 면 + 뒤로 흐려지는 잔상 두 겹 + 흰 날(검기 칸 속성 색)
    const a = Math.atan2(s.vy, s.vx);
    const fade = Math.min(1, s.left / 40), col = s.stone ? s.col : 'rgb(140,200,255)';
    ctx.save();
    ctx.translate(s.x, s.y - 8);
    ctx.rotate(a);
    if (s.def && s.def.wave && s.def.wave.scale) ctx.scale(s.def.wave.scale, s.def.wave.scale);  // 검기 크기
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 2; i >= 1; i--) crescent(ctx, -8 - i * 6, 0, 13, -1.25, 1.25, 7 - i * 1.5, col, 0.22 / i * fade, 1, true);
    if (s.stone) {  // 속성 검기: 보석 색 그대로(어두운 테두리 · 가는 밝은 날). 검기 칸 속성석 단계: 1 = 뒤로 흩어지는 속성 알갱이 · 2 = 잔상 한 겹 더 · 3 = 오로라
      const T = Elements.tier(s.stone);
      if (T >= 3) { ctx.globalAlpha = fade; Gfx.aurora(ctx, -6, 0, 15, s.stone.size); }
      if (T >= 2) { ctx.globalCompositeOperation = 'lighter'; crescent(ctx, -26, 0, 13, -1.1, 1.1, 5, hex, 0.3 * fade, 1, true); }
      if (T) waveMotif(ctx, s, T, hex, fade);
      ctx.globalCompositeOperation = 'source-over';
      crescent(ctx, -8, 0, 13, -1.34, 1.34, 10, dark, 0.95 * fade, 1, true);
      crescent(ctx, -8, 0, 13, -1.3, 1.3, 8, hex, fade, 1, true);
      crescent(ctx, -7, 0, 13, -1.05, 1.05, 3, light, fade, 1, true);
      crescent(ctx, -6.5, 0, 13, -0.8, 0.8, 1.4, '#ffffff', 0.85 * fade, 1, true);
    } else {
      crescent(ctx, -8, 0, 13, -1.3, 1.3, 8, col, 0.55 * fade, 1, true);
      crescent(ctx, -7, 0, 13, -1.05, 1.05, 3, '#ffffff', 0.95 * fade, 1, true);
    }
    ctx.restore();
  }

  function fx(ctx, list) {
    for (const f of list) {
      const k = Math.min(1, f.t / f.life);
      switch (f.type) {
        case 'spark': {
          const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t - (f.z + f.vz * f.t - 200 * f.t * f.t);
          const sz = f.s || 1;
          ctx.globalAlpha = 1 - k * k; ctx.fillStyle = f.col; ctx.fillRect(Math.round(x), Math.round(y), sz, sz);
          ctx.globalAlpha = 1;
          break;
        }
        case 'impact': {  // 맞은 자리 흰 번쩍임
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const y = f.y - f.z, R = f.r * (0.55 + 0.6 * k);
          star4(ctx, f.x, y, R, f.rot, '#ffffff', 0.95 * (1 - k));
          star4(ctx, f.x, y, R * 0.6, f.rot + Math.PI / 4, '#fff3c4', 0.7 * (1 - k));
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
        }
        case 'dust': {
          const x = f.x + f.vx * f.t, y = f.y + f.vy * f.t - (f.vz * f.t);
          ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#7a6e74'; ctx.fillRect(Math.round(x - 1), Math.round(y - 1), 3, 2);
          ctx.globalAlpha = 1;
          break;
        }
        case 'swipe': {
          const a = Math.atan2(f.fv.y, f.fv.x);
          ctx.strokeStyle = 'rgba(255,90,60,' + (1 - k) + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(f.x, f.y - 6, f.r, a - 1, a + 1); ctx.stroke();
          break;
        }
        case 'shock':
          ctx.strokeStyle = 'rgba(255,200,120,' + (1 - k) + ')'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.5 + k * 0.5), f.r * GROUND_Y * (0.5 + k * 0.5), 0, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'shadowpath': {  // 암살자 그림자 베기 · 백스탭 순간이동: 지나간 직선에 어두운 빛 띠(굵기 w) + 색 띠 + 흰 날 + 양 끝 번쩍임
          const pts = f.follow ? [f.pts[0], [f.follow.x, f.follow.y]] : f.pts;  // follow = 몸을 따라 늘어나는 띠(그림자 베기)
          if (!pts || pts.length < 2) break;
          ctx.save();
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          const W = f.w || 12;
          const line = (w, col, a) => { ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 6) : ctx.moveTo(x, y - 6))); ctx.stroke(); };
          line(W * (1 - k * 0.5) + 2, '#2a1840', 0.5 * (1 - k));
          ctx.globalCompositeOperation = 'lighter';
          line(W * 0.5 * (1 - k) + 1, f.col, 0.6 * (1 - k));
          line(2 + W * 0.08 * (1 - k), '#ffffff', 0.9 * (1 - k));
          for (const [x, y] of [pts[0], pts[pts.length - 1]]) star4(ctx, x, y - 6, (W * 0.4 + 4) * (1 - k) + 2, k * 2, '#ffffff', 0.8 * (1 - k));
          ctx.restore();
          ctx.globalAlpha = 1;
          break;
        }
        case 'streak':
          ctx.strokeStyle = 'rgba(200,230,255,' + (0.8 * (1 - k)) + ')'; ctx.lineWidth = 4 * (1 - k) + 1;
          ctx.beginPath(); ctx.moveTo(f.x0, f.y0 - 8); ctx.lineTo(f.follow.x, f.follow.y - 8); ctx.stroke();
          break;
        case 'ring': {
          const c = f.col && f.col !== '#ffffff' ? f.col : 'rgb(190,225,255)', R = f.r * (0.7 + 0.3 * k), spin = k * Math.PI * 2.4, e = 1 - k;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const T = f.tier || 0;
          if (T >= 3) { ctx.globalAlpha = e; Gfx.aurora(ctx, f.follow.x, f.follow.y - 3, R * 0.85, f.ss || 6); ctx.globalCompositeOperation = 'lighter'; }
          ctx.globalAlpha = (0.16 + T * 0.04) * e; ctx.fillStyle = c;
          ctx.beginPath(); ctx.ellipse(f.follow.x, f.follow.y, R, R * GROUND_Y, 0, 0, Math.PI * 2); ctx.fill();
          for (let j = 0; j < 2; j++) {
            const h = spin + j * Math.PI;
            crescent(ctx, f.follow.x, f.follow.y - 3, R - 3, h - 2.6, h, 9 * e + 2, c, (0.5 + T * 0.08) * e, GROUND_Y);
            crescent(ctx, f.follow.x, f.follow.y - 3, R - 2, h - 1.5, h, 3 * e + 1, '#ffffff', 0.75 * e, GROUND_Y);
            if (T >= 2) crescent(ctx, f.follow.x, f.follow.y - 3, R * 0.62, h - 1.6, h + 0.6, 4 * e + 1, c, 0.45 * e, GROUND_Y);  // 안쪽 고리 하나 더
          }
          if (T) ringMotif(ctx, f, R, spin, e, T, c);
          ctx.restore();
          break;
        }
        case 'breath': {  // 마법사 마력 숨결(2026-10-26 사용자: 각진 부채꼴이 어색 → 흩뿌려지는 느낌): 지팡이 끝에서 부드러운 빛 뭉치들이
          // 조금씩 늦게 나와 바깥으로 흘러가며 커지고 옅어진다(가운데로 몰림 · 좌우 흔들림). 뭉치 자리 · 크기는 f.seed 로 정해 둔다. 가운데 몸통 빛 · 반짝이 덧붙임
          // 판정 부채꼴(몸 가운데에서 길이 R · 반각 h) 안에서만 그린다(2026-10-26 이펙트 범위 = 판정 범위). 높이만 지팡이 쪽으로 8 올림
          const o = f.follow || f, ox = o.x, oy = o.y - 8, h = f.arc * Math.PI / 180;
          const rnd = (i, j) => { const v = Math.sin((f.seed || 0) + i * 12.9898 + j * 78.233) * 43758.5453; return v - Math.floor(v); };
          // 기본 칸 속성석 단계(f.tier, 2026-10-26): 1 = 속성 알갱이(불티 · 얼음 반짝이 · 전기 · 독 방울) · 2 = 뭉치 · 알갱이 더 · 3 = 지팡이 끝 오로라
          const T = f.tier || 0, n = Math.round((f.big ? 30 : 20) * (1 + 0.1 * T)), white = f.col === '#c9b8ff';
          const puff = (x, y, s, al) => {
            const g = ctx.createRadialGradient(x, y, 0, x, y, s);
            g.addColorStop(0, white ? 'rgba(255,255,255,0.9)' : f.col); g.addColorStop(0.45, f.col); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = al; ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
          };
          ctx.save();
          if (T >= 3) { ctx.globalAlpha = 1 - k; Gfx.aurora(ctx, ox + Math.cos(f.a) * f.R * 0.45, oy + Math.sin(f.a) * f.R * 0.45, f.R * 0.3, f.ss || 6); }
          ctx.globalCompositeOperation = 'lighter';
          // 몸통: 가운데 줄을 따라 겹친 큰 뭉치 넷 — 테두리 없는 부드러운 부채꼴 빛
          const grow = Math.min(1, k * 3 + 0.2), wide = Math.tan(Math.min(h, 1.2));
          for (let j = 0; j < 4; j++) {
            const d = f.R * (0.22 + 0.17 * j) * grow;
            puff(ox + Math.cos(f.a) * d, oy + Math.sin(f.a) * d, Math.max(3, Math.min(d * wide * 0.9 + 3, f.R - d)), 0.32 * (1 - k) * (1 - j * 0.15));
          }
          for (let i = 0; i < n; i++) {
            const delay = rnd(i, 1) * 0.28, q = Math.max(0, Math.min(1, (k - delay) / 0.7));
            if (q <= 0 || q >= 1) continue;
            const spread = (rnd(i, 2) * 2 - 1) * h * 0.85, wob = Math.sin(q * 6 + i) * 0.1 * h;
            const ang = f.a + spread + wob, s0 = (3 + 7 * q) * (0.7 + 0.6 * rnd(i, 5)) * (f.big ? 1.2 : 1);
            const d = Math.min(f.R * (0.15 + 0.85 * (1 - (1 - q) * (1 - q))) * (0.8 + 0.2 * rnd(i, 4)), f.R - s0 * 0.6);
            const s = Math.min(s0, Math.max(2, d * Math.tan(Math.max(0.05, h - Math.abs(spread + wob))) + 2));  // 부채꼴 옆 선 밖으로 안 나가게
            puff(ox + Math.cos(ang) * d, oy + Math.sin(ang) * d, s, Math.pow(Math.sin(Math.PI * q), 0.6) * 0.7);
          }
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < (f.big ? 10 : 6); i++) {  // 반짝이: 뭉치보다 빨리 멀리
            const q = Math.max(0, Math.min(1, (k - rnd(i, 6) * 0.3) / 0.5));
            if (q <= 0 || q >= 1) continue;
            const ang = f.a + (rnd(i, 7) * 2 - 1) * h * 0.9, d = f.R * 0.95 * q;
            ctx.globalAlpha = 0.9 * (1 - q); ctx.fillRect(Math.round(ox + Math.cos(ang) * d), Math.round(oy + Math.sin(ang) * d), 1, 1);
          }
          if (T) breathMotif(ctx, f, k, T, ox, oy, h, rnd);
          ctx.restore();
          break;
        }
        case 'pulse': {  // 마력 파동: 몸에서 퍼지는 두 겹 빛 고리
          const c = f.col && f.col !== '#ffffff' ? f.col : '#b39cff', e = 1 - k;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let j = 0; j < 2; j++) {
            const r = f.r * Math.min(1, k * 1.3 + j * 0.25);
            ctx.globalAlpha = (j ? 0.5 : 0.85) * e; ctx.strokeStyle = j ? '#ffffff' : c; ctx.lineWidth = j ? 1.5 : 4 * e + 1;
            ctx.beginPath(); ctx.ellipse(f.x, f.y - 4, r, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.globalAlpha = 0.15 * e; ctx.fillStyle = c;
          ctx.beginPath(); ctx.ellipse(f.x, f.y - 4, f.r * k, f.r * 0.6 * k, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          break;
        }
        case 'nova': nova(ctx, f, k); break;
        case 'thrust': thrustFx(ctx, f, k); break;
        case 'sweep': sweepFx(ctx, f, k); break;
        case 'burst':  // 속성 폭발: 퍼지는 원 + 테두리
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.35 * (1 - k);
          ctx.fillStyle = f.col;
          ctx.beginPath(); ctx.ellipse(f.x, f.y - 4, f.r * (0.4 + 0.6 * k), f.r * 0.6 * (0.4 + 0.6 * k), 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.9 * (1 - k);
          ctx.strokeStyle = f.col; ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
          break;
        case 'bolt': case 'strike': {  // 번개: 꺾인 선
          const x0 = f.type === 'strike' ? f.x + 6 : f.x0, y0 = f.type === 'strike' ? f.y - 90 : f.y0;
          const x1 = f.type === 'strike' ? f.x : f.x1, y1 = f.type === 'strike' ? f.y - 4 : f.y1;
          // 단계(f.tier, 2026-10-26): 굵어지고, 2 = 곁가지 + 떨어진 자리 번쩍, 3 = 빛 번짐 + 줄기 두 가닥
          const T = f.tier || 0;
          ctx.save();
          ctx.globalAlpha = 1 - k;
          const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0); for (let i = 1; i < 6; i++) { const q = i / 6; ctx.lineTo(x0 + (x1 - x0) * q + (Math.random() - 0.5) * 8, y0 + (y1 - y0) * q + (Math.random() - 0.5) * 8); } ctx.lineTo(x1, y1); };
          if (T >= 3) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,240,140,0.35)'; ctx.lineWidth = 7; path(); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; }
          ctx.strokeStyle = ELEMENTS.thunder.color; ctx.lineWidth = 2 + T * 0.7;
          path(); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8 + T * 0.3; ctx.stroke();
          if (T >= 3) { ctx.strokeStyle = ELEMENTS.thunder.color; ctx.lineWidth = 1.2; path(); ctx.stroke(); }  // 두 번째 가닥
          if (T >= 2) for (let b = 0; b < T; b++) {  // 곁가지
            const q = 0.3 + 0.2 * b, bx = x0 + (x1 - x0) * q, by = y0 + (y1 - y0) * q, a = Math.random() * Math.PI * 2;
            ctx.strokeStyle = ELEMENTS.thunder.color; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * 6, by + Math.sin(a) * 6); ctx.lineTo(bx + Math.cos(a + 0.6) * 11, by + Math.sin(a + 0.6) * 11); ctx.stroke();
          }
          if (T >= 2 && k < 0.5) glow(ctx, x1, y1, 5 + T * 2, '#fff2a0', 0.8 * (1 - k * 2));
          ctx.restore();
          break;
        }
      }
    }
  }

  // 마력 숨결 속성 알갱이(단계 1부터, 단계마다 는다): 불 = 솟는 불티 · 얼음 = 도는 얼음 반짝이 · 번개 = 튀는 짧은 전기 · 독 = 떨어지는 방울
  function breathMotif(ctx, f, k, T, ox, oy, h, rnd) {
    const m = Math.round((5 + T * 4) * (f.big ? 1.5 : 1)), light = Gfx.mix(f.col, 0.5, 'white'), P = Math.PI * 2;
    for (let i = 0; i < m; i++) {
      const q = Math.max(0, Math.min(1, (k - rnd(i, 8) * 0.3) / 0.6));
      if (q <= 0 || q >= 1) continue;
      const ang = f.a + (rnd(i, 9) * 2 - 1) * h * 0.85, d = f.R * (0.15 + 0.75 * (1 - (1 - q) * (1 - q))) * (0.8 + 0.2 * rnd(i, 10));
      const x = ox + Math.cos(ang) * d, y = oy + Math.sin(ang) * d, fade = Math.sin(Math.PI * q);
      if (f.el === 'fire') {
        glow(ctx, x, y - q * 8, 2 + T * 0.6, i % 2 ? '#ffd36a' : '#ff9a4a', 0.95 * fade);
        ctx.globalCompositeOperation = 'lighter';
      } else if (f.el === 'frost') {
        const s = 1.5 + T * 0.6;
        ctx.globalAlpha = 0.95 * fade; ctx.fillStyle = i % 2 ? '#ffffff' : light;
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.5); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x, y + s * 1.5); ctx.lineTo(x - s * 0.6, y); ctx.closePath(); ctx.fill();
      } else if (f.el === 'thunder') {
        const fr = Math.floor(f.t * 20), L = 3 + T * 1.5, b = Math.sin(fr * 4.7 + i * 3.1) * P;
        ctx.globalAlpha = 0.95 * fade; ctx.strokeStyle = i % 2 ? '#ffffff' : light; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(b) * L * 0.5 + 1, y + Math.sin(b) * L * 0.5); ctx.lineTo(x + Math.cos(b + 0.5) * L, y + Math.sin(b + 0.5) * L); ctx.stroke();
      } else if (f.el === 'poison') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = i % 2 ? '#d8ffb0' : f.col;
        ctx.beginPath(); ctx.arc(x, y + q * q * 8, 1.2 + T * 0.4, 0, P); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
      }
    }
  }
  // 찌르는 빛(fx 'thrust', 2026-10-26 이펙트 범위 = 판정 범위): 판정 그대로 — 부채꼴(길이 R · 반각 arc) 또는 띠(band = 반폭, noBody).
  // 빠르게 뻗고 흐려진다. 안쪽 흰 줄기 · 끝 반짝. 그 칸 속성석 단계 1부터 속성 알갱이, 2부터 줄기 더, 3 오로라
  function thrustFx(ctx, f, k) {
    const o = f.follow || f, x0 = o.x, y0 = o.y - 6, e = 1 - k, ca = Math.cos(f.a), sa = Math.sin(f.a), T = f.tier || 0;
    const L = f.R * (0.55 + 0.45 * Math.min(1, k * 4)), h = (f.arc || 0) * RAD, light = Gfx.mix(f.col, 0.5, 'white');
    const at = (u, side) => [x0 + ca * u - sa * side, y0 + sa * u + ca * side];  // 앞으로 u · 옆으로 side
    ctx.save();
    if (T >= 3) { ctx.globalAlpha = e; Gfx.aurora(ctx, x0 + ca * L * 0.55, y0 + sa * L * 0.55, L * 0.35, f.ss || 6); }
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(x0, y0, x0 + ca * L, y0 + sa * L);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.55, f.col); g.addColorStop(1, light);
    ctx.globalAlpha = (0.45 + T * 0.06) * e; ctx.fillStyle = g;
    ctx.beginPath();
    if (f.band) { const [ax, ay] = at(-4, -f.band), [bx, by] = at(L, -f.band * 0.6), [cx, cy] = at(L, f.band * 0.6), [dx, dy] = at(-4, f.band); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.lineTo(dx, dy); }
    else { ctx.moveTo(x0, y0); ctx.arc(x0, y0, L, f.a - h, f.a + h); }
    ctx.closePath(); ctx.fill();
    const n = 2 + (T >= 2 ? 2 : 0) + (f.band ? 1 : 0);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {  // 흰 줄기: 판정 안에서 앞쪽으로
      const v = n === 1 ? 0 : i / (n - 1) * 2 - 1, u0 = L * (0.25 + 0.15 * ((i * 0.37) % 1)), u1 = L * (0.8 + 0.2 * ((i * 0.61) % 1));
      const side = u => f.band ? v * f.band * 0.5 : Math.tan(h) * u * v * 0.6;
      const [ax, ay] = at(u0, side(u0)), [bx, by] = at(u1, side(u1));
      ctx.globalAlpha = (i === Math.floor(n / 2) ? 0.9 : 0.5) * e; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    const [tx, ty] = at(L * 0.92, 0);
    star4(ctx, tx, ty, 3 + T + 3 * e, k * 3, '#ffffff', 0.8 * e);
    if (T) {
      const m = 2 + T * 2, fr = Math.floor(f.t * 20);
      for (let i = 0; i < m; i++) {
        const u = L * (0.3 + 0.65 * ((i * 0.618 + k * 0.5) % 1)), v = ((i * 0.43) % 1) * 2 - 1, side = f.band ? v * f.band * 0.7 : Math.tan(h) * u * v * 0.75;
        const [bx, by] = at(u, side);
        elemBit(ctx, f.el, bx, by - (f.el === 'fire' ? k * 4 : 0), 1.2 + T * 0.4, e, i, f.col, fr);
      }
    }
    ctx.restore();
  }
  // 백스탭 큰 베기(fx 'sweep', 2026-10-26 사용자: 판정 반지름 42 · ±160° 그대로 그리기): 몸 둘레를 정면 기준 -arc → +arc 로 빠르게 휘두르는 그림자 초승달.
  // 어두운 그림자 띠 + 색 띠 + 흰 날. 차지 칸 속성석 단계 1부터 알갱이, 2부터 안쪽 초승달 하나 더, 3 오로라
  function sweepFx(ctx, f, k) {
    const o = f.follow || f, x0 = o.x, y0 = o.y - 6, e = 1 - k, T = f.tier || 0, A = Math.min(Math.PI, (f.arc || 160) * RAD);
    const q = Math.min(1, k * 2.4), a0 = f.a - A, a1 = f.a - A + 2 * A * q, R = f.R;
    ctx.save();
    if (T >= 3) { ctx.globalAlpha = e; Gfx.aurora(ctx, x0, y0, R * 0.7, f.ss || 6); }
    crescent(ctx, x0, y0, R - 9, a0, a1, 18 * e + 2, '#2a1840', 0.45 * e, 1);  // 그림자 띠(판정 끝 R 안쪽)
    ctx.globalCompositeOperation = 'lighter';
    crescent(ctx, x0, y0, R - 7, a0, a1, 14 * e + 2, f.col, (0.55 + T * 0.06) * e, 1);
    if (T >= 2) crescent(ctx, x0, y0, R * 0.6, a0 + 0.3, a1, 6 * e + 1, f.col, 0.4 * e, 1);
    crescent(ctx, x0, y0, R - 2, a0 + (a1 - a0) * 0.4, a1, 3 * e + 1, '#ffffff', 0.85 * e, 1);
    star4(ctx, x0 + Math.cos(a1) * (R - 4), y0 + Math.sin(a1) * (R - 4), 4 + 4 * e, k * 4, '#ffffff', 0.8 * e);
    if (T) {
      const m = 4 + T * 3, fr = Math.floor(f.t * 20);
      for (let i = 0; i < m; i++) {
        const u = (i + 0.5) / m, a = a1 - (a1 - a0) * u, rr = R - 6 - (i % 3) * 4;
        elemBit(ctx, f.el, x0 + Math.cos(a) * rr, y0 + Math.sin(a) * rr - (f.el === 'fire' ? u * 5 : 0), 1.3 + T * 0.45, e * (1 - u * 0.5), i, f.col, fr);
      }
    }
    ctx.restore();
  }
  // 마법진이 터질 때(fx 'nova'): 번쩍임 + 번지는 바닥 빛 + 퍼지는 고리 + 속성 모양
  //   불 = 바깥으로 튀며 솟는 불꽃 덩이 · 얼음 = 바깥을 겨눈 얼음 조각 · 번개 = 사방으로 뻗는 전기 · 독 = 부풀어 퍼지는 독구름 · 없음 = 보랏빛 별 고리.
  //   단계(f.tier) 1부터 고리 한 겹 더, 2부터 솟는 빛기둥, 3은 오로라. 알갱이 수도 단계마다 는다
  //   맞을 때 터지는 작은 폭발(bare — 기본 공격 · 회전베기 속성 폭발)도 단계가 보이게(2026-10-26 사용자: 3 · 7레벨이 똑같다):
  //   2 = 낮은 빛기둥 · 위로 튀는 불티, 3 = 고리 세 겹 · 작은 오로라 · 빛기둥 더 높게. 바닥으로는 판정 반지름 f.r 그대로(기둥 · 불티는 위로만)
  function nova(ctx, f, k) {
    // 판정 반지름 f.r 안에서만(2026-10-26 이펙트 범위 = 판정 범위): 바닥 빛 · 고리 · 알갱이 모두 f.r 까지. bare = 빛기둥 · 오로라 없이(검사 회전베기 속성 폭발)
    const T = f.tier || 0, P = Math.PI * 2, e = 1 - k, ease = 1 - e * e, light = Gfx.mix(f.col, 0.5, 'white'), y0 = f.y;
    const rnd = (i, j) => { const v = Math.sin((f.seed || 0) + i * 12.9898 + j * 78.233) * 43758.5453; return v - Math.floor(v); };
    ctx.save();
    if (T >= 3) { ctx.globalAlpha = e; Gfx.aurora(ctx, f.x, y0, f.r * (f.bare ? 0.55 : 0.85), f.ss || 6); }
    ctx.globalCompositeOperation = 'lighter';
    // 바닥 빛: 테두리 없이 번지는 둥근 빛
    const gR = f.r * (0.5 + 0.5 * ease);
    ctx.save(); ctx.translate(f.x, y0); ctx.scale(1, GROUND_Y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, gR);
    g.addColorStop(0, light); g.addColorStop(0.5, f.col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5 * e; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, gR, 0, P); ctx.fill();
    for (let j = 0; j < (T >= 3 ? 3 : T ? 2 : 1); j++) {  // 퍼지는 고리(단계 1부터 한 겹 더, 3이면 세 겹 — 조금씩 늦게)
      const q = Math.max(0, Math.min(1, (k - j * 0.12) / 0.75));
      if (q <= 0 || q >= 1) continue;
      ctx.globalAlpha = (j ? 0.6 : 0.9) * (1 - q); ctx.strokeStyle = j === 1 ? '#ffffff' : j ? light : f.col; ctx.lineWidth = (j ? 1.5 : 3 + T * 0.5) * (1 - q) + 1;
      ctx.beginPath(); ctx.arc(0, 0, f.r * (0.3 + 0.68 * (1 - (1 - q) * (1 - q))), 0, P); ctx.stroke();
    }
    ctx.restore();
    if (k < 0.3) glow(ctx, f.x, y0 - 2, f.r * (f.bare ? 0.4 + 0.06 * T : 0.6), '#ffffff', (f.bare ? 0.5 + 0.1 * T : 0.8) * (1 - k / 0.3));  // 가운데 번쩍임(단계마다 크고 밝게)
    ctx.globalCompositeOperation = 'lighter';
    if (T >= 2) {  // 솟는 빛기둥: 가늘어지며 사라짐(작은 폭발은 낮고 가늘게)
      const H = (34 + T * 12) * (f.bare ? 0.8 : 1), w = f.r * (f.bare ? 0.34 : 0.36) * e;
      const lg = ctx.createLinearGradient(f.x, f.y, f.x, f.y - H);
      lg.addColorStop(0, light); lg.addColorStop(0.35, f.col); lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.6 * e; ctx.fillStyle = lg;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - H / 2, w / 2 + 1, H / 2, 0, 0, P); ctx.fill();
      ctx.globalAlpha = 0.5 * e; ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(f.x) - 1, Math.round(f.y - H * 0.75), 2, Math.round(H * 0.6));  // 기둥 가운데 흰 심
    }
    if (T >= 2) for (let i = 0; i < T * 4; i++) {  // 위로 튀는 불티(속성 밝은 색, 가운데 둘레에서 솟음)
      const q = Math.min(1, k * (1 + 0.5 * rnd(i, 7))), a = rnd(i, 8) * P, d = f.r * 0.45 * rnd(i, 9);
      if (q >= 1) continue;
      const sx = f.x + Math.cos(a) * d, sy = y0 + Math.sin(a) * d * GROUND_Y - q * (14 + T * 6) * (0.6 + 0.4 * rnd(i, 10));
      ctx.globalAlpha = 1 - q; ctx.fillStyle = i % 3 ? light : '#ffffff'; ctx.fillRect(Math.round(sx), Math.round(sy), 1 + (T >= 3 && i % 2 ? 1 : 0), 2);
    }
    const n = 8 + T * 4;
    for (let i = 0; i < n; i++) {
      const ang = (i + rnd(i, 1) * 0.6) * P / n, sp = 0.66 + 0.3 * rnd(i, 2), q = Math.min(1, k * (1.1 + 0.4 * rnd(i, 3)));
      if (q >= 1) continue;
      const d = (f.r - (f.el === 'frost' ? 6 : 3)) * sp * (1 - (1 - q) * (1 - q)), x = f.x + Math.cos(ang) * d, y = y0 + Math.sin(ang) * d * GROUND_Y;
      if (f.el === 'fire') {  // 튀며 솟는 불꽃 덩이
        glow(ctx, x, y - q * (10 + T * 3), Math.min(f.r * 0.15, 4 + T + 3 * rnd(i, 4)) * (1 - q * 0.5), i % 3 ? f.col : '#ffd36a', 0.9 * (1 - q));
        ctx.globalCompositeOperation = 'lighter';
      } else if (f.el === 'frost') {  // 바깥을 겨눈 얼음 조각
        const L = Math.min(f.r * 0.14, 4 + T * 1.5 + 3 * rnd(i, 4)), W = 1.5 + T * 0.3, c = Math.cos(ang), s = Math.sin(ang) * GROUND_Y, m = Math.hypot(c, s), ux = c / m, uy = s / m;
        ctx.globalAlpha = 1 - q * q; ctx.fillStyle = i % 2 ? '#ffffff' : light;
        ctx.beginPath(); ctx.moveTo(x + ux * L, y + uy * L); ctx.lineTo(x - uy * W, y + ux * W); ctx.lineTo(x - ux * L * 0.4, y - uy * L * 0.4); ctx.lineTo(x + uy * W, y - ux * W); ctx.closePath(); ctx.fill();
      } else if (f.el === 'thunder') {  // 사방으로 뻗는 전기: 가운데에서 그 자리까지 꺾인 선(0.05초마다 모양이 바뀜)
        if (i % 2) continue;
        const fr = Math.floor(f.t * 20);
        ctx.globalAlpha = 0.95 * (1 - q); ctx.strokeStyle = i % 4 ? light : '#ffffff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(f.x, y0);
        for (let j = 1; j <= 4; j++) { const u = j / 4, w = Math.sin(fr * 3.1 + i * 1.7 + j * 2.3) * 4 * (j < 4 ? 1 : 0); ctx.lineTo(f.x + (x - f.x) * u - Math.sin(ang) * w, y0 + (y - y0) * u + Math.cos(ang) * w); }
        ctx.stroke();
      } else if (f.el === 'poison') {  // 부풀어 퍼지는 독구름
        ctx.globalCompositeOperation = 'source-over';
        const s = Math.min(f.r * 0.15, 5 + T + 4 * rnd(i, 4)) * (0.6 + 0.6 * q), cg = ctx.createRadialGradient(x, y - q * 4, 0, x, y - q * 4, s);
        cg.addColorStop(0, i % 2 ? '#d8ffb0' : f.col); cg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.6 * (1 - q); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y - q * 4, s, 0, P); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
      } else {  // 속성석 없음: 보랏빛 별
        star4(ctx, x, y - 4, 2 + 2 * (1 - q), q * 3, i % 2 ? '#ffffff' : f.col, 0.9 * (1 - q));
      }
    }
    ctx.restore();
  }

  // 장판(불길 · 독안개): 속성 색 도트 덩어리
  // 마법진: 겹 원 + 도는 룬 눈금 + 육망성, 터질 때까지 차오르며 밝아지고, 터진 뒤 퍼지며 사라진다.
  // 마법진 칸 속성석 단계(f.tier, 2026-10-26 사용자: 레벨에 따라 멋져지게 · 구간마다)마다 더해진다:
  //   1 보통 · 큰 = 속성 무늬(불 = 둘레에서 피어오르는 불꽃 · 얼음 = 꼭짓점 얼음 결정 + 서리 살 · 번개 = 고리를 튀는 전기 · 독 = 끓어오르는 방울)
  //   2 완전한 = + 바깥 룬 고리(반대로 도는 점) · 차오르는 빛기둥   3 전설 · 태초 = + 오로라(속성석 테두리와 같은 색) · 더 밝게
  function magicCircle(ctx, f, time) {
    const k = Math.min(1, f.t / f.delay), after = Math.max(0, f.t - f.delay);
    // 터진 뒤에는 커지지 않고 그 자리에서 사라진다(판정 = f.r, 2026-10-26 이펙트 범위 = 판정 범위)
    const R = f.r * (after ? 1 : 0.65 + 0.35 * k), a = after ? Math.max(0, 1 - after / 0.3) : 0.45 + 0.55 * k;
    if (a <= 0) return;
    const T = f.tier || 0;
    if (T >= 3) { ctx.save(); ctx.globalAlpha = a; Gfx.aurora(ctx, f.x, f.y, R * 0.85, f.ss || 6); ctx.restore(); }
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(1, GROUND_Y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 * a; ctx.fillStyle = f.col;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = f.col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2); ctx.stroke();
    // 도는 룬 눈금
    const rot = time * 1.6;
    for (let i = 0; i < 12; i++) {
      const t = rot + i * Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(Math.cos(t) * R * 0.8, Math.sin(t) * R * 0.8); ctx.lineTo(Math.cos(t + 0.12) * R * 0.97, Math.sin(t + 0.12) * R * 0.97); ctx.stroke();
    }
    // 육망성(반대로 돈다)
    ctx.globalAlpha = 0.75 * a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    for (let s = 0; s < 2; s++) {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) { const t = -rot * 0.7 + s * Math.PI / 3 + i * Math.PI * 2 / 3; const x = Math.cos(t) * R * 0.74, y = Math.sin(t) * R * 0.74; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
    if (T) circleGround(ctx, f, time, R, a, T, rot);
    ctx.restore();
    if (T) circleRise(ctx, f, time, R, a, T, k, after);
  }
  // 마법진 바닥 무늬(납작하게 눌린 좌표 — magicCircle 안에서)
  function circleGround(ctx, f, time, R, a, T, rot) {
    const P = Math.PI * 2, light = Gfx.mix(f.col, 0.5, 'white');
    if (T >= 2) {  // 안쪽 룬 고리(판정 안): 반대로 도는 점 12개 + 가는 원
      ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = f.col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.5, 0, P); ctx.stroke();
      ctx.fillStyle = light;
      for (let i = 0; i < 12; i++) { const t = -rot * 0.8 + i * P / 12; ctx.fillRect(Math.round(Math.cos(t) * R * 0.5) - 1, Math.round(Math.sin(t) * R * 0.5) - 1, 2, 2); }
      ctx.globalAlpha = 0.5 * a; ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, R * 0.3, 0, P); ctx.stroke();
    }
    if (f.el === 'frost') {  // 육망성 꼭짓점의 얼음 결정 + 가운데로 뻗는 서리 살
      ctx.globalAlpha = 0.55 * a; ctx.strokeStyle = light; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) { const t = -rot * 0.7 + i * P / 6; ctx.beginPath(); ctx.moveTo(Math.cos(t) * R * 0.2, Math.sin(t) * R * 0.2); ctx.lineTo(Math.cos(t) * R * 0.72, Math.sin(t) * R * 0.72); ctx.stroke(); }
      for (let i = 0; i < 6; i++) {
        const t = -rot * 0.7 + i * P / 6, x = Math.cos(t) * R * 0.74, y = Math.sin(t) * R * 0.74, s = 3 + T;
        ctx.globalAlpha = 0.95 * a; ctx.fillStyle = i % 2 ? '#ffffff' : light;
        ctx.beginPath(); ctx.moveTo(x, y - s * 1.4); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x, y + s * 1.4); ctx.lineTo(x - s * 0.6, y); ctx.closePath(); ctx.fill();
      }
    } else if (f.el === 'thunder') {  // 고리를 따라 튀는 전기(0.05초마다 모양이 바뀜)
      const fr = Math.floor(time * 20);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 3 + T; i++) {
        const q = Math.sin(fr * 5.3 + i * 7.7) * 43758.5, a0 = (q - Math.floor(q)) * P, span = 0.5 + 0.2 * T;
        ctx.globalAlpha = 0.9 * a;
        ctx.beginPath();
        for (let j = 0; j <= 5; j++) {
          const t = a0 + span * j / 5, rr = R * (0.9 + (j % 2 ? 0.12 : -0.04) * Math.sin(fr + i + j));
          if (j) ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); else ctx.moveTo(Math.cos(t) * rr, Math.sin(t) * rr);
        }
        ctx.stroke();
      }
    } else if (f.el === 'poison') {  // 끓어오르는 방울: 커졌다가 톡 터지는 고리
      ctx.lineWidth = 1;
      for (let i = 0; i < 4 + T * 2; i++) {
        const u = (time * 1.6 + i * 0.29) % 1, t = i * 2.4, d = R * (0.2 + 0.55 * ((i * 0.37) % 1));
        const x = Math.cos(t) * d, y = Math.sin(t) * d, s = 1.5 + u * (3 + T);
        ctx.globalAlpha = (u < 0.85 ? 0.8 : (1 - u) * 5) * a; ctx.strokeStyle = i % 2 ? '#d8ffb0' : f.col;
        ctx.beginPath(); ctx.arc(x, y, s, 0, P); ctx.stroke();
      }
    } else if (f.el === 'fire') {  // 일렁이는 불 고리(굵기가 흔들림)
      ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2 + Math.sin(time * 25) * 1;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.95, 0, P); ctx.stroke();
    }
  }
  // 마법진 위로 솟는 것(바로 선 좌표): 속성 알갱이 · 빛기둥(단계 2부터)
  function circleRise(ctx, f, time, R, a, T, k, after) {
    const P = Math.PI * 2, light = Gfx.mix(f.col, 0.5, 'white');
    ctx.save();
    if (T >= 2) {  // 빛기둥: 차오를수록 밝게, 터지면 번쩍 사라짐
      const H = 26 + T * 10, w = R * (0.35 + 0.1 * T) * (after ? 1 + after * 2 : 0.6 + 0.4 * k), al = after ? a : 0.25 + 0.35 * k;
      const g = ctx.createLinearGradient(f.x, f.y, f.x, f.y - H);
      g.addColorStop(0, light); g.addColorStop(0.4, f.col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * al; ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - H / 2, w / 2, H / 2, 0, 0, P); ctx.fill();
    }
    const n = (f.el === 'fire' ? 8 : 5) + T * 3;
    for (let i = 0; i < n; i++) {
      const t = i * P / n + i * 0.7, u = (time * (f.el === 'fire' ? 1.8 : 0.9) + i * 0.37) % 1;
      const ring = f.el === 'fire' ? 0.88 : 0.3 + 0.55 * ((i * 0.53) % 1), bx = f.x + Math.cos(t) * R * ring, by = f.y + Math.sin(t) * R * GROUND_Y * ring;
      if (f.el === 'fire') {  // 둘레에서 피어올라 작아지는 불꽃
        glow(ctx, bx, by - u * (12 + T * 4), (5 + T * 1.5) * (1 - u * 0.6), i % 2 ? '#ffd36a' : f.col, a * (1 - u * 0.4));
      } else if (f.el === 'frost') {  // 천천히 떠오르는 서리 반짝이
        ctx.globalCompositeOperation = 'lighter';
        star4(ctx, bx, by - u * 14, 1.5 + T * 0.5, time * 2 + i, '#ffffff', 0.8 * a * Math.sin(Math.PI * u));
      } else if (f.el === 'thunder') {  // 위로 튀는 짧은 불티
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * a * (1 - u); ctx.fillStyle = i % 2 ? '#ffffff' : light;
        ctx.fillRect(Math.round(bx + Math.sin(u * 30 + i) * 2), Math.round(by - u * 16), 1, 2);
      } else if (f.el === 'poison') {  // 떠오르는 독 거품
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.7 * a * (1 - u); ctx.fillStyle = i % 2 ? '#d8ffb0' : f.col;
        ctx.beginPath(); ctx.arc(bx + Math.sin(u * 8 + i) * 2, by - u * 12, 1 + T * 0.4, 0, P); ctx.fill();
      }
    }
    ctx.restore();
  }

  // 레이드 파동: delay 동안 보스 발밑에서 보랏빛이 모이며 깜빡(예고) → 바닥 고리 띠(반지름 R, 두께 w = 판정 띠)가 퍼짐
  function voidWave(ctx, f, time) {
    ctx.save();
    ctx.translate(f.x, f.y); ctx.scale(1, GROUND_Y);
    if (f.t < f.delay) {
      const k = f.t / f.delay;
      ctx.strokeStyle = 'rgba(192,106,255,' + (0.4 + 0.5 * Math.abs(Math.sin(time * 18))) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 34 * (1 - k) + 10, 0, Math.PI * 2); ctx.stroke();  // 안쪽으로 모이는 고리
    } else {
      const R = (f.t - f.delay) * f.speed, fade = Math.min(1, (f.life - f.t) / 0.3);
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = '#c06aff'; ctx.lineWidth = f.w;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#f0d0ff'; ctx.lineWidth = 2;  // 띠 가운데 밝은 줄(띠 안)
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  function field(ctx, f, time) {
    if (f.magic) { magicCircle(ctx, f, time); return; }
    if (f.wave) { voidWave(ctx, f, time); return; }
    if (f.blast) {
      // 화염 강화 몹의 죽음 폭발 예고: 붉은 원이 차오른다
      if (f.done) return;
      const k = Math.min(1, f.t / f.delay);
      ctx.save();
      const c = f.voidBlast ? '192,106,255' : '255,90,40';  // 레이드 공허 장판 = 보랏빛
      ctx.strokeStyle = 'rgba(' + c + ',' + (0.5 + 0.5 * Math.sin(time * 30)) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(' + c + ',0.25)';
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * k, f.r * 0.6 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    // 장판(2026-10-26): 테두리 없이 번지는 바닥 빛 + 속성 알갱이(불 = 솟는 불꽃 · 얼음 = 반짝이는 서리 · 독 = 끓는 방울), 알갱이 수는 넓이를 따라
    // 단계(f.tier, 2026-10-26): 알갱이가 늘고 밝아지며, 2 = 안쪽 둘레를 도는 밝은 빛 고리, 3 = 둘레 반짝이(모두 반지름 f.r 안)
    const T = f.tier || 0, col = ELEMENTS[f.el].color, fade = Math.min(1, (f.life - f.t) / 0.5, f.t / 0.15), P = Math.PI * 2, n = Math.max(3, Math.round(f.r / 4 * (1 + 0.5 * T)));
    ctx.save();
    ctx.translate(f.x, f.y); ctx.scale(1, 0.6);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, f.r * 1.1);
    g.addColorStop(0, col); g.addColorStop(0.6, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = ((f.el === 'frost' ? 0.3 : 0.26) + T * 0.05) * fade; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, f.r * 1.1, 0, P); ctx.fill();
    if (T >= 2) {  // 안쪽 둘레를 도는 밝은 빛 고리(끊긴 호 셋)
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = Gfx.mix(col, 0.5, 'white'); ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const a = time * 1.6 + i * P / 3; ctx.globalAlpha = (0.35 + 0.1 * T) * fade; ctx.beginPath(); ctx.arc(0, 0, f.r * 0.85, a, a + 1.1); ctx.stroke(); }
    }
    ctx.restore();
    if (T >= 3) {  // 둘레 반짝이
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) { const a = i * P / 8 - time * 0.9, tw = 0.5 + 0.5 * Math.sin(time * 9 + i * 2); star4(ctx, f.x + Math.cos(a) * f.r * 0.9, f.y + Math.sin(a) * f.r * 0.9 * 0.6, 2 + tw * 1.5, time * 3, '#ffffff', 0.8 * tw * fade); }
      ctx.restore();
    }
    ctx.save();
    for (let i = 0; i < n; i++) {
      const h = Math.sin(f.x * 0.37 + f.y * 0.11 + i * 12.9898) * 43758.5, rr = h - Math.floor(h), t = i * 2.39996 + f.x;
      const d = f.r * Math.sqrt((i + 0.5) / n) * 0.85, x = f.x + Math.cos(t) * d, y = f.y + Math.sin(t) * d * 0.6;
      if (f.el === 'fire') {
        const u = (time * 1.7 + rr) % 1;
        glow(ctx, x, y - u * 9, (2.5 + f.r * 0.05) * (1 - u * 0.5), i % 3 ? col : '#ffd36a', 0.85 * fade * (1 - u * 0.6));
      } else if (f.el === 'frost') {
        ctx.globalCompositeOperation = 'lighter';
        star4(ctx, x, y - 1, 1.5 + rr * 1.5, 0, '#ffffff', 0.7 * fade * (0.5 + 0.5 * Math.sin(time * 4 + i * 2.1)));
      } else if (f.el === 'poison') {
        const u = (time * 1.3 + rr) % 1;
        ctx.globalCompositeOperation = 'source-over'; ctx.lineWidth = 1;
        ctx.globalAlpha = 0.75 * fade * (u < 0.8 ? 1 : (1 - u) * 5); ctx.strokeStyle = i % 2 ? '#d8ffb0' : col;
        ctx.beginPath(); ctx.ellipse(x, y, 1 + u * 2.5, (1 + u * 2.5) * 0.8, 0, 0, P); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 플레이어 빛 반경만 밝고 그 밖은 거의 깜깜한 어둠(디아블로)
  function darkness(ctx, x, y, cam, R = LIGHT_R) {  // R = 빛 반경(레이드 방은 넓게)
    const g = ctx.createRadialGradient(x, y, R * 0.45, x, y, R * 1.25);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(cam.x - 10, cam.y - 10, VIEW_W + 20, VIEW_H + 20);
  }

  function floatText(ctx, t) {
    const k = t.t / t.life;
    ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.font = 'bold ' + (t.big ? 9 : 7) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText(fmtGold(t.s), t.x + 0.5, t.y - t.z + 0.5);
    ctx.fillStyle = t.col; ctx.fillText(fmtGold(t.s), t.x, t.y - t.z);
    ctx.globalAlpha = 1;
  }

  // 장비 스테이터스 창의 아바타(2026-10-24 사용자): 발밑 (x, y), k 배 크기. 낀 무기를 서 있는 자세 그대로 든다
  function avatar(ctx, prof, x, y, k, time) {
    const p = { x: 0, y: 0, fv: { x: 1, y: 0.1 }, flip: false, state: 'idle', walkT: 0, charge: 0, cls: clsOf(prof) };  // cls: 양손 무기(암살자) 자세
    const pose = weaponPose(p, time), w = prof.equip.weapon;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(k, k);
    ctx.imageSmoothingEnabled = false;
    shadow(ctx, 0, 0, 9, 0, 1.2);
    const hold = ps => { const b = Items.base(w); Gfx.spr(ctx, b.icon, ps.hx, ps.hy, { rot: ps.th + Math.PI / 2, grip: WEAPON_GRIP, tint: b.tint, tintAlpha: Gfx.WEAPON_TINT }); };
    if (w && pose.off) hold(pose.off);  // 양손 무기(암살자): 왼손 무기는 몸 뒤
    Gfx.spr(ctx, Gfx.anim(clsOf(prof).sprite + '_idle_anim', time, 6), 0, 0, {});
    if (w) hold(pose);
    ctx.restore();
  }

  return { avatar, shadow, player, enemy, bossAcc, enemyBar, drop, dropLabel, aura, nameTag, chest, stairs, stairsMark, stairsLabel, shot, wave, field, fx, darkness, floatText };
})();
