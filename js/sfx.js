// 효과음: 코드로 만든 소리(WebAudio) + 녹음된 소리(js/sounds.js 의 mp3 base64 — 2026-10-25 사용자: 무료 음원으로). 둘 다 file:// 에서도 된다(fetch 없이 글자를 풀어서).
// 브라우저는 사용자가 키 · 버튼을 누른 뒤에야 소리를 낼 수 있어서, 첫 입력 때 소리 장치를 연다.
const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null;
  function ensure() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      master = ac.createGain();
      master.gain.value = 0.32;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      decodeAll();
    }
    // 멈춤(suspended) · 끊김(아이폰 interrupted) 모두 다시 켠다. 손가락 동작 안에서 소리 없는 한 조각을 틀어야 아이폰이 장치를 열어 준다
    if (ac.state !== 'running') {
      const r = ac.resume();
      if (r && r.catch) r.catch(() => {});
      try {
        const s = ac.createBufferSource();
        s.buffer = ac.createBuffer(1, 1, 22050);
        s.connect(ac.destination);
        s.start(0);
      } catch (e) { /* 아직 못 여는 때 */ }
    }
    return ac;
  }
  window.addEventListener('keydown', ensure);
  window.addEventListener('pointerdown', ensure);
  window.addEventListener('touchstart', ensure);
  // 폰 브라우저는 손가락을 뗄 때(touchend · pointerup)를 '사용자 동작'으로 쳐서 그때만 소리를 켜 준다(2026-10-24 폰에서 소리 안 남)
  window.addEventListener('touchend', ensure, true);
  window.addEventListener('pointerup', ensure, true);
  window.addEventListener('click', ensure, true);
  // 소리를 낼 때마다 장치가 멈춰 있으면 다시 깨운다(2026-10-24: 패드로만 하면 장치가 안 열리거나 멈춘 채로 남아 강화 소리가 안 들림)
  // 크기 = 설정 '효과음 크기'(0 ~ 10, 0 = 끔). sound === false 는 시험 도구가 모두 끌 때
  const level = () => (Input.settings.sound === false ? 0 : (Input.settings.sfx ?? 8) / 10);
  const on = () => {
    if (!level()) return false;
    if (!ac) ensure();
    else if (ac.state !== 'running') ac.resume();
    if (ac) master.gain.value = 0.32 * level();
    return !!ac;
  };

  // 녹음된 소리: SOUNDS[이름] = [[mp3 base64, 앞 여백, 길이], …] → 장치를 열 때 한 번에 풀어 둔다. 여러 개면 돌아가며(같은 소리만 반복되지 않게)
  const bufs = {}, turn = {};
  function decodeAll() {
    if (typeof SOUNDS === 'undefined') return;
    for (const k in SOUNDS) SOUNDS[k].forEach((v, i) => {
      const bin = atob(v[0]), u = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j);
      const done = b => { (bufs[k] || (bufs[k] = []))[i] = { b, lead: v[1], dur: v[2] }; };
      try { const r = ac.decodeAudioData(u.buffer, done, () => {}); if (r && r.then) r.then(done, () => {}); } catch (e) { /* 못 푸는 소리는 건너뜀 */ }
    });
  }
  // vol = 크기, rate = 빠르기(음 높이), delay = 늦게, pick = 몇 번째(없으면 돌아가며)
  function smp(k, { vol = 0.5, rate = 1, delay = 0, pick } = {}) {
    if (!on()) return;
    const list = bufs[k] && bufs[k].filter(Boolean);
    if (!list || !list.length) return;
    const n = pick !== undefined ? pick % list.length : (turn[k] = ((turn[k] || 0) + 1 + Math.floor(Math.random() * (list.length - 1 || 1))) % list.length);
    const v = list[n], s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = v.b; s.playbackRate.value = rate * (0.96 + Math.random() * 0.08);  // 조금씩 다르게
    g.gain.value = vol;
    s.connect(g); g.connect(master);
    const t = ac.currentTime + delay;
    s.start(t, v.lead, v.dur);
  }

  // 음 하나: 주파수 f → f2 로 미끄러지며 dur 초
  function tone({ type = 'square', f = 440, f2 = null, dur = 0.1, vol = 0.2, delay = 0 }) {
    if (!on()) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // 잡음: 걸러서 휙 · 쾅 · 칙 같은 소리
  function noise({ dur = 0.1, vol = 0.25, freq = 1200, q = 0.8, type = 'bandpass', delay = 0, sweep = null }) {
    if (!on()) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  let lastHit = 0, lastKill = 0;
  const once = (t, ms) => { const now = performance.now(); if (now - t.v < ms) return false; t.v = now; return true; };
  const uiT = { v: 0 }, growlT = { v: 0 };
  return {
    wake: ensure,
    get loaded() { return Object.keys(bufs).reduce((n, k) => n + bufs[k].filter(Boolean).length, 0); },  // 풀어 둔 녹음 소리 수(시험용)
    swing: () => noise({ dur: 0.09, vol: 0.12, freq: 2600, sweep: 900, q: 0.6 }),
    heavySwing: () => noise({ dur: 0.16, vol: 0.18, freq: 1800, sweep: 400, q: 0.5 }),
    // 때림(녹음 = 주먹 · 둔탁한 타격, 치명타 = 더 무거운 것 + 높은 쨍)
    hit(crit) {
      const now = performance.now();
      if (now - lastHit < 30) return;  // 여러 마리를 한 번에 맞혀도 소리는 한 번
      lastHit = now;
      smp(crit ? 'crit' : 'hit', { vol: crit ? 0.95 : 0.8 });
      tone({ type: 'triangle', f: 160, f2: 60, dur: 0.07, vol: 0.14 });
      if (crit) tone({ type: 'square', f: 1400, f2: 700, dur: 0.08, vol: 0.1 });
    },
    kill: () => { const now = performance.now(); if (now - lastKill < 40) return; lastKill = now; smp('kill', { vol: 0.7, rate: 0.9 }); tone({ type: 'sawtooth', f: 220, f2: 50, dur: 0.18, vol: 0.06 }); },
    // 정예 · 고유 몹 · 보스 졸개가 쓰러질 때 짧은 신음(보통 몹은 너무 많아서 빼고)
    grunt: () => smp('grunt', { vol: 0.5, rate: 0.85 }),
    hurt: () => { smp('hurt', { vol: 0.75 }); tone({ type: 'square', f: 180, f2: 90, dur: 0.1, vol: 0.08 }); },
    dash: () => { noise({ dur: 0.15, vol: 0.1, freq: 800, sweep: 2400, q: 0.5 }); smp('cloth', { vol: 0.35, rate: 1.3 }); },
    gold: () => smp('coins', { vol: 0.55, rate: 1.1 }),
    // 아이템이 바닥에 떨어질 때: 가죽 떨어지는 소리, 레어 이상은 종소리
    drop(rarity) {
      if (rarity >= 2) { smp('bell', { vol: 0.45, rate: 1.2 }); [880, 1320, 1760].forEach((f, i) => tone({ type: 'sine', f, dur: 0.5, vol: 0.08, delay: i * 0.06 })); return; }
      smp('dropItem', { vol: 0.6, rate: rarity ? 1.15 : 1 });
    },
    // 마법사(2026-10-25): 마력탄 = 짧은 마법 소리, 마법진 터짐 = 긴 마법 소리
    cast: () => smp('cast', { vol: 0.55, rate: 1.15 }),
    spell: () => smp('spell', { vol: 0.7 }),
    // 끝없는 심연 문 지나기(방 하나 = 맵 하나)
    door: () => { smp('doorOpen', { vol: 0.6 }); },
    // 메뉴: 고르기 · 확인 · 뒤로 · 안 됨(game.js 가 창 · 메뉴 화면에서 부름)
    ui: kind => { if (!once(uiT, 40)) return; smp({ move: 'uiMove', ok: 'uiOk', back: 'uiBack', deny: 'uiDeny' }[kind] || 'uiMove', { vol: kind === 'move' ? 0.35 : 0.5 }); },
    // 대장장이 강화(2026-10-24 사용자 '효과음이 안 들린다' → 크고 또렷하게 다시): 시작 = 빛 모이는 휘익, 시도 중 = 모루 망치질(점점 높게),
    // 성공 = 쨍 + 올라가는 팡파르 + 반짝, 실패 = 둔탁한 쿵 + 내려가는 소리
    forgeStart: () => { noise({ dur: 1.4, vol: 0.1, freq: 400, sweep: 3200, q: 0.7 }); tone({ type: 'sine', f: 220, f2: 660, dur: 1.4, vol: 0.06 }); },
    forgeTap: (k = 0) => {
      smp('anvil', { vol: 0.8, rate: 1 + k * 0.04 });  // 모루 망치질(녹음)
      tone({ type: 'triangle', f: 1100 + k * 140, dur: 0.18, vol: 0.12 });
    },
    forgeOk: () => {
      smp('bell', { vol: 0.6 });
      noise({ dur: 0.1, vol: 0.3, freq: 2600, q: 2 });
      [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, dur: 0.2, vol: 0.14, delay: 0.08 + i * 0.08 }));
      [2093, 2637, 3136].forEach((f, i) => tone({ type: 'sine', f, dur: 0.35, vol: 0.12, delay: 0.42 + i * 0.06 }));
    },
    forgeFail: () => {
      smp('plank', { vol: 0.8, rate: 0.8 });
      noise({ dur: 0.18, vol: 0.25, freq: 500, q: 0.8 });
      tone({ type: 'triangle', f: 140, f2: 50, dur: 0.3, vol: 0.3 });
      tone({ type: 'sawtooth', f: 330, f2: 80, dur: 0.6, vol: 0.18, delay: 0.12 });
    },
    // 세공사 합치기(2026-10-24 사용자: 합칠 때 소리가 없었다): 세 개가 모이는 딩 · 딩 · 딩 + 커지는 반짝. 큰 크기일수록 낮게 울리고 길게
    combine: (size = 1) => {
      const b = 1 - Math.min(0.4, size * 0.06);
      [660, 880, 1100].forEach((f, i) => tone({ type: 'triangle', f: f * b, dur: 0.12, vol: 0.16, delay: i * 0.09 }));
      noise({ dur: 0.5, vol: 0.12, freq: 3000, sweep: 6000, q: 1, delay: 0.27 });
      [1320, 1760, 2640].forEach((f, i) => tone({ type: 'sine', f: f * b, dur: 0.5 + size * 0.05, vol: 0.13, delay: 0.3 + i * 0.05 }));
    },
    // 유니크 획득(2026-10-25 사용자: 유니크 먹으면 소리): 쨍 + 올라가는 팡파르 + 낮은 울림 + 높은 반짝. k = 크기(친구가 얻었을 때는 작게)
    unique: (k = 1) => {
      smp('bell', { vol: 0.6 * k, rate: 1.1 });
      noise({ dur: 0.12, vol: 0.2 * k, freq: 3000, q: 2 });
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ type: 'square', f, dur: 0.16, vol: 0.12 * k, delay: 0.05 + i * 0.07 }));
      tone({ type: 'triangle', f: 262, dur: 0.8, vol: 0.14 * k, delay: 0.4 });
      [1568, 2093, 2637, 3136].forEach((f, i) => tone({ type: 'sine', f, dur: 0.6, vol: 0.1 * k, delay: 0.42 + i * 0.05 }));
    },
    // 합칠 수 없을 때(개수 · 골드 부족)
    deny: () => { smp('uiDeny', { vol: 0.5 }); tone({ type: 'square', f: 180, f2: 140, dur: 0.1, vol: 0.06 }); },
    reveal: () => [660, 880, 1320, 1760].forEach((f, i) => tone({ type: 'sine', f, dur: 0.35, vol: 0.1, delay: i * 0.08 })),
    pickup: () => smp('leather', { vol: 0.6 }),
    block: perfect => { noise({ dur: 0.08, vol: 0.2, freq: 3200, q: 4 }); tone({ type: 'triangle', f: perfect ? 1500 : 900, f2: perfect ? 1400 : 700, dur: perfect ? 0.35 : 0.18, vol: 0.12 }); if (perfect) tone({ type: 'sine', f: 2400, dur: 0.4, vol: 0.06, delay: 0.03 }); },
    stone: () => { smp('glass', { vol: 0.45, rate: 1.3 }); tone({ type: 'sine', f: 1800, dur: 0.25, vol: 0.06, delay: 0.04 }); },
    potion: () => { tone({ type: 'sine', f: 300, f2: 700, dur: 0.25, vol: 0.18 }); noise({ dur: 0.2, vol: 0.06, freq: 1500 }); },
    // 콘텐츠 해금(2026-10-29): 오르는 짧은 나팔 + 길게 울리는 화음
    unlock: () => { [392, 523, 659, 784].forEach((f, i) => tone({ type: 'square', f, dur: 0.14, vol: 0.08, delay: i * 0.08 })); [1046, 1318, 1568].forEach(f => tone({ type: 'triangle', f, dur: 0.8, vol: 0.07, delay: 0.34 })); },
    levelUp: () => [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f, dur: 0.18, vol: 0.1, delay: i * 0.09 })),
    chest: () => { smp('latch', { vol: 0.6 }); smp('creak', { vol: 0.45, delay: 0.06 }); tone({ type: 'triangle', f: 400, f2: 800, dur: 0.3, vol: 0.08, delay: 0.15 }); },
    // 몹이 깨어남(무리째): 으르렁(1초에 한 번까지)
    growl: () => { if (!once(growlT, 900)) return; smp('growl', { vol: 0.45, rate: 0.9 + Math.random() * 0.2 }); },
    roar: () => { smp('growl', { vol: 0.9, rate: 0.55, pick: 1 }); noise({ dur: 0.7, vol: 0.2, freq: 220, sweep: 90, q: 0.9 }); tone({ type: 'sawtooth', f: 90, f2: 55, dur: 0.7, vol: 0.12 }); },
    charged: () => tone({ type: 'square', f: 880, f2: 1320, dur: 0.12, vol: 0.1 }),
    fire: () => noise({ dur: 0.35, vol: 0.28, freq: 600, sweep: 150, q: 0.6 }),
    frost: () => { tone({ type: 'sine', f: 2200, f2: 1400, dur: 0.25, vol: 0.1 }); noise({ dur: 0.2, vol: 0.12, freq: 4000, q: 2 }); },
    zap: () => { noise({ dur: 0.12, vol: 0.22, freq: 3000, q: 3 }); tone({ type: 'square', f: 900, f2: 200, dur: 0.12, vol: 0.08 }); },
    blast: () => { noise({ dur: 0.4, vol: 0.35, freq: 400, sweep: 80, q: 0.7 }); tone({ type: 'triangle', f: 90, f2: 40, dur: 0.4, vol: 0.25 }); },
    stairs: () => [392, 523, 659].forEach((f, i) => tone({ type: 'sine', f, dur: 0.3, vol: 0.12, delay: i * 0.12 })),
    // 광차(2026-10-25): 출발 = 쇠 삐걱 + 덜컹, 달리는 동안 = 철길 이음매 덜컹(rail 을 0.22초마다)
    cartGo: () => { tone({ type: 'sawtooth', f: 180, f2: 320, dur: 0.35, vol: 0.06 }); noise({ dur: 0.25, vol: 0.25, freq: 260, q: 1.2 }); },
    rail: () => { noise({ dur: 0.05, vol: 0.16, freq: 340, q: 1.6 }); noise({ dur: 0.04, vol: 0.1, freq: 900, q: 2, delay: 0.07 }); },
  };
})();
