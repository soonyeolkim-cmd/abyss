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
    if (p.state === 'act') {
      const a = p.act, d = a.def, t = a.time;
      const ph = t < a.s ? 0 : t < a.s + a.a ? 1 : 2;
      const k = ph === 0 ? t / a.s : ph === 1 ? (t - a.s) / a.a : Math.min(1, (t - a.s - a.a) / a.r);
      if (d.spin) {
        th = aim + (ph === 1 ? k * Math.PI * 4 : ph === 0 ? -0.6 : 0);
        if (ph === 1) trail = { a0: th - 2.6, a1: th, fade: 1 };
      } else if (d.thrust) {
        th = aim;
        push = ph === 0 ? -3 * k : ph === 1 ? lerp(-3, 9, Math.min(1, k * 2)) : lerp(9, 2, k);
      } else {
        const s0 = d.swing[0] * RAD, s1 = d.swing[1] * RAD;
        th = aim + (ph === 0 ? s0 : ph === 1 ? lerp(s0, s1, k) : s1);
        if (ph >= 1 && (ph === 1 || t - a.s - a.a < 0.1)) trail = { a0: aim + s0, a1: th, fade: ph === 1 ? 1 : 1 - (t - a.s - a.a) / 0.1 };
      }
    } else if (p.charge > 0) {
      // 기를 모으는 중: 칼을 뒤로 젖혀 든다(다 모이면 떨린다)
      th = aim + (flip ? 1 : -1) * 2.4 + (p.charge >= 1 ? Math.sin(time * 60) * 0.06 : 0);
    } else if (p.state === 'hurt' || p.state === 'dead') {
      th = Math.PI / 2 + (flip ? 0.5 : -0.5);
    }
    return { th, hx: hx + p.fv.x * push, hy: hy + p.fv.y * push, flip, trail };
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
    if (p.state === 'hurt') name = base + '_hit_anim_f0';
    if (p.state === 'dodge') {
      name = Gfx.anim(base + '_run_anim', time, 20);
      for (let i = 3; i >= 1; i--) Gfx.spr(ctx, name, p.x - p.dodgeV.x * i * 6, p.y - p.dodgeV.y * i * 6, { flip: o.flip, flash: '#9ad8ff', alpha: 0.25 / i });
      o.alpha = 0.85;
    }
    if (p.state === 'act' && p.act.def.dash && p.act.time >= p.act.s && p.act.time < p.act.s + p.act.a) {
      for (let i = 3; i >= 1; i--) Gfx.spr(ctx, name, p.x - p.fv.x * i * 8, p.y - p.fv.y * i * 8, { flip: o.flip, flash: '#ffffff', alpha: 0.22 / i });
    }
    if (p.state === 'dead') { o.rot = o.flip ? -Math.PI / 2 : Math.PI / 2; name = base + '_hit_anim_f0'; }
    const w = p.prof.equip.weapon;
    const drawWeapon = () => {
      if (!w || p.state === 'dead') return;
      const icon = Items.base(w).icon;
      Gfx.spr(ctx, icon, pose.hx, pose.hy, { rot: pose.th + Math.PI / 2, grip: WEAPON_GRIP, flash: o.flash ? '#ffffff' : false, tint: Items.base(w).tint, tintAlpha: Gfx.WEAPON_TINT });
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
    if (behind) drawWeapon();
    Gfx.spr(ctx, name, p.x, p.y - (p.state === 'dead' ? -4 : 0), o);
    if (!behind) drawWeapon();
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
      // 칼끝이 지나간 자리: 두툼한 색 초승달 + 안쪽 흰 날 + 칼끝 쪽 반짝(휘두른 뒤 0.1초 흐려지며 사라짐)
      const R = FRAMES[Items.base(w).icon][3] - WEAPON_GRIP + 5;
      const col = (p.act ? Elements.color(p.prof, p.act.def.slot || 'none', null) : null) || 'rgb(170,215,255)';
      const { a0, a1 } = pose.trail, f = pose.trail.fade === undefined ? 1 : Math.max(0, pose.trail.fade);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      crescent(ctx, pose.hx, pose.hy, R - 2, a0, a1, 11, col, 0.42 * f);
      crescent(ctx, pose.hx, pose.hy, R, a0 + (a1 - a0) * 0.3, a1, 4, '#ffffff', 0.8 * f);
      const g = ctx.createRadialGradient(pose.hx + Math.cos(a1) * R, pose.hy + Math.sin(a1) * R * 0.82, 0, pose.hx + Math.cos(a1) * R, pose.hy + Math.sin(a1) * R * 0.82, 7);
      g.addColorStop(0, 'rgba(255,255,255,' + 0.45 * f + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(pose.hx + Math.cos(a1) * R - 7, pose.hy + Math.sin(a1) * R * 0.82 - 7, 14, 14);
      ctx.restore();
    }
  }

  function enemy(ctx, e, time, p) {
    const d = e.def;
    const moving = e.moving || e.state === 'charge';
    const base = d.idle ? d.sprite + (moving ? '_run_anim' : '_idle_anim') : d.sprite + '_anim';
    const name = e.state === 'frozen' ? (d.idle ? d.sprite + '_idle_anim_f0' : d.sprite + '_anim_f0') : Gfx.anim(base, time + e.walkT, e.state === 'charge' ? 16 : 8);
    const flip = e.fv.x < 0;
    let x = e.x, y = e.y - e.z;
    const o = { flip, flash: e.flash > 0 ? '#ffffff' : false, scale: e.scale || 1, tint: d.tint, tintAlpha: d.tintAlpha };
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
    const tele = e.state === 'windup' && (committed(e) || d.superArmor) || ['slam', 'chargeWind', 'fan'].includes(e.state);
    if (tele && !o.flash && Math.floor(time * 14) % 2 === 0) o.flash = '#ff4030';
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
        else { o.rot = (flip ? 1 : -1) * Math.PI / 2; y += 3; o.alpha = Math.max(0, 1 - Math.max(0, e.t - 0.5) / 0.6); }
        break;
    }
    Gfx.spr(ctx, name, x, y, o);
    if (d.acc && e.state !== 'dead') bossAcc(ctx, d.acc, x, y, o.scale, flip, time);
    if (e.cutT > 0 && e.state !== 'dead') {  // 베인 상처: 머리 위 붉은 사선 두 줄(깜빡)
      if (e.cutT > 1 || Math.floor(time * 8) % 2) { ctx.fillStyle = '#ff5a4a'; const hx = Math.round(e.x), hy = Math.round(y - e.h - 4); for (let i = 0; i < 4; i++) { ctx.fillRect(hx - 3 + i, hy + 2 - i, 1, 1); ctx.fillRect(hx + i, hy + 2 - i, 1, 1); } }
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
    if (e.def.boss || e.hp >= e.maxHp || e.dying || e.state === 'dead') return;
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
    if ((e.rank !== 'elite' && e.rank !== 'unique') || e.dying || e.state === 'dead') return;
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
    ctx.font = 'bold 7px ' + FONT; ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText('마을로 가는 계단', s.x + 0.5, s.y - 11.5);
    ctx.fillStyle = '#bfefff'; ctx.fillText('마을로 가는 계단', s.x, s.y - 12);
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
  // 섬광 검기: 날아가는 쪽으로 볼록한 초승달
  function wave(ctx, s) {
    const hex = s.col && s.col[0] === '#' ? s.col : '#b39cff', dark = Gfx.mix(hex, 0.45, 'black'), light = Gfx.mix(hex, 0.45, 'white');
    if (s.orb) {  // 마력탄: 보석 색 구슬(어두운 테두리 · 밝은 심) + 꼬리 + 도는 흰 별 = 내 것
      const y = s.y - 8;
      ctx.save();
      glow(ctx, s.x, y, s.r + 8, hex, 0.45);
      comet(ctx, s, y, 22, s.r, 0.85);
      ctx.globalAlpha = 1;
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(s.x, y, s.r + 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hex; ctx.beginPath(); ctx.arc(s.x, y, s.r + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(s.x - 0.6, y - 0.6, s.r * 0.75, 0, Math.PI * 2); ctx.fill();
      star4(ctx, s.x, y, s.r + 4, (s.t || 0) * 8, '#ffffff', 0.55);
      ctx.restore();
      return;
    }
    if (s.ball) {  // 속성석 부과 능력의 탄(화염구 · 얼음 파편): 혜성 꼬리 + 보석 색 4각 별(어두운 테두리) + 작은 밝은 심 — 둥근 몹 탄과 모양이 다르게
      const y = s.y - 8, rot = (s.t || 0) * 10;
      ctx.save();
      glow(ctx, s.x, y, s.r + 8, hex, 0.4);
      comet(ctx, s, y, 16, s.r, 0.85);
      star4(ctx, s.x, y, s.r + 5.5, rot, dark, 1);
      star4(ctx, s.x, y, s.r + 4, rot, hex, 1);
      star4(ctx, s.x, y, s.r + 1.5, rot, light, 1);
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
    if (s.stone) {  // 속성 검기: 보석 색 그대로(어두운 테두리 · 가는 밝은 날)
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
          ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.5 + k * 0.6), f.r * 0.6 * (0.5 + k * 0.6), 0, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'streak':
          ctx.strokeStyle = 'rgba(200,230,255,' + (0.8 * (1 - k)) + ')'; ctx.lineWidth = 4 * (1 - k) + 1;
          ctx.beginPath(); ctx.moveTo(f.x0, f.y0 - 8); ctx.lineTo(f.follow.x, f.follow.y - 8); ctx.stroke();
          break;
        case 'ring': {
          const c = f.col && f.col !== '#ffffff' ? f.col : 'rgb(190,225,255)', R = f.r * (0.7 + 0.3 * k), spin = k * Math.PI * 2.4, e = 1 - k;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.16 * e; ctx.fillStyle = c;
          ctx.beginPath(); ctx.ellipse(f.follow.x, f.follow.y - 2, R, R * 0.55, 0, 0, Math.PI * 2); ctx.fill();
          for (let j = 0; j < 2; j++) {
            const h = spin + j * Math.PI;
            crescent(ctx, f.follow.x, f.follow.y - 6, R, h - 2.6, h, 10 * e + 2, c, 0.5 * e, 0.6);
            crescent(ctx, f.follow.x, f.follow.y - 6, R + 1, h - 1.5, h, 3 * e + 1, '#ffffff', 0.75 * e, 0.6);
          }
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
          ctx.save();
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = ELEMENTS.thunder.color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x0, y0);
          for (let i = 1; i < 6; i++) { const q = i / 6; ctx.lineTo(x0 + (x1 - x0) * q + (Math.random() - 0.5) * 8, y0 + (y1 - y0) * q + (Math.random() - 0.5) * 8); }
          ctx.lineTo(x1, y1); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8; ctx.stroke();
          ctx.restore();
          break;
        }
      }
    }
  }

  // 장판(불길 · 독안개): 속성 색 도트 덩어리
  // 마법진: 겹 원 + 도는 룬 눈금 + 육망성, 터질 때까지 차오르며 밝아지고, 터진 뒤 퍼지며 사라진다
  function magicCircle(ctx, f, time) {
    const k = Math.min(1, f.t / f.delay), after = Math.max(0, f.t - f.delay);
    const R = f.r * (after ? 1 + after * 1.5 : 0.65 + 0.35 * k), a = after ? Math.max(0, 1 - after / 0.4) : 0.45 + 0.55 * k;
    if (a <= 0) return;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(1, 0.6);
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
    ctx.restore();
  }

  function field(ctx, f, time) {
    if (f.magic) { magicCircle(ctx, f, time); return; }
    if (f.blast) {
      // 화염 강화 몹의 죽음 폭발 예고: 붉은 원이 차오른다
      if (f.done) return;
      const k = Math.min(1, f.t / f.delay);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,90,40,' + (0.5 + 0.5 * Math.sin(time * 30)) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,90,40,0.25)';
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * k, f.r * 0.6 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    const col = ELEMENTS[f.el].color, fade = Math.min(1, (f.life - f.t) / 0.5);
    ctx.save();
    ctx.globalAlpha = 0.22 * fade;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7 * fade;
    for (let i = 0; i < 4; i++) {
      const a = time * (f.el === 'fire' ? 3 : 1.2) + i * 1.7 + f.x;
      ctx.fillRect(Math.round(f.x + Math.cos(a) * f.r * 0.6), Math.round(f.y + Math.sin(a * 1.3) * f.r * 0.35 - (f.el === 'fire' ? (time * 20 + i * 5) % 6 : 0)), 2, 2);
    }
    ctx.restore();
  }

  // 플레이어 빛 반경만 밝고 그 밖은 거의 깜깜한 어둠(디아블로)
  function darkness(ctx, x, y, cam) {
    const g = ctx.createRadialGradient(x, y, LIGHT_R * 0.45, x, y, LIGHT_R * 1.25);
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
    const p = { x: 0, y: 0, fv: { x: 1, y: 0.1 }, flip: false, state: 'idle', walkT: 0, charge: 0 };
    const pose = weaponPose(p, time), w = prof.equip.weapon;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(k, k);
    ctx.imageSmoothingEnabled = false;
    shadow(ctx, 0, 0, 9, 0, 1.2);
    Gfx.spr(ctx, Gfx.anim(clsOf(prof).sprite + '_idle_anim', time, 6), 0, 0, {});
    if (w) { const b = Items.base(w); Gfx.spr(ctx, b.icon, pose.hx, pose.hy, { rot: pose.th + Math.PI / 2, grip: WEAPON_GRIP, tint: b.tint, tintAlpha: Gfx.WEAPON_TINT }); }
    ctx.restore();
  }

  return { avatar, shadow, player, enemy, bossAcc, enemyBar, drop, dropLabel, aura, nameTag, chest, stairs, shot, wave, field, fx, darkness, floatText };
})();
