// 효과음: 파일 없이 코드로 만든 소리(WebAudio). file:// 에서도 된다.
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
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  window.addEventListener('keydown', ensure);
  window.addEventListener('pointerdown', ensure);
  window.addEventListener('touchstart', ensure);
  // 소리를 낼 때마다 장치가 멈춰 있으면 다시 깨운다(2026-10-24: 패드로만 하면 장치가 안 열리거나 멈춘 채로 남아 강화 소리가 안 들림)
  const on = () => {
    if (Input.settings.sound === false) return false;
    if (!ac) ensure();
    else if (ac.state !== 'running') ac.resume();
    return !!ac;
  };

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

  let lastHit = 0;
  return {
    wake: ensure,
    swing: () => noise({ dur: 0.09, vol: 0.12, freq: 2600, sweep: 900, q: 0.6 }),
    heavySwing: () => noise({ dur: 0.16, vol: 0.18, freq: 1800, sweep: 400, q: 0.5 }),
    hit(crit) {
      const now = performance.now();
      if (now - lastHit < 30) return;  // 여러 마리를 한 번에 맞혀도 소리는 한 번
      lastHit = now;
      noise({ dur: 0.07, vol: 0.32, freq: 900, q: 1.2 });
      tone({ type: 'triangle', f: 160, f2: 60, dur: 0.09, vol: 0.28 });
      if (crit) tone({ type: 'square', f: 1400, f2: 700, dur: 0.08, vol: 0.12 });
    },
    kill: () => { tone({ type: 'sawtooth', f: 260, f2: 50, dur: 0.22, vol: 0.12 }); noise({ dur: 0.18, vol: 0.12, freq: 500, q: 0.7 }); },
    hurt: () => { tone({ type: 'square', f: 180, f2: 90, dur: 0.14, vol: 0.18 }); noise({ dur: 0.1, vol: 0.2, freq: 400 }); },
    dash: () => noise({ dur: 0.15, vol: 0.12, freq: 800, sweep: 2400, q: 0.5 }),
    gold: () => { tone({ type: 'square', f: 1760, dur: 0.05, vol: 0.06 }); tone({ type: 'square', f: 2350, dur: 0.07, vol: 0.05, delay: 0.05 }); },
    // 아이템이 바닥에 떨어질 때: 등급이 높을수록 높고 길게(레어는 종소리)
    drop(rarity) {
      if (rarity >= 2) { [880, 1320, 1760].forEach((f, i) => tone({ type: 'sine', f, dur: 0.5, vol: 0.14, delay: i * 0.06 })); return; }
      tone({ type: 'triangle', f: rarity ? 1100 : 700, f2: rarity ? 900 : 500, dur: 0.12, vol: 0.14 });
    },
    // 대장장이 강화(2026-10-24 사용자 '효과음이 안 들린다' → 크고 또렷하게 다시): 시작 = 빛 모이는 휘익, 시도 중 = 모루 망치질(점점 높게),
    // 성공 = 쨍 + 올라가는 팡파르 + 반짝, 실패 = 둔탁한 쿵 + 내려가는 소리
    forgeStart: () => { noise({ dur: 1.4, vol: 0.1, freq: 400, sweep: 3200, q: 0.7 }); tone({ type: 'sine', f: 220, f2: 660, dur: 1.4, vol: 0.06 }); },
    forgeTap: (k = 0) => {
      noise({ dur: 0.06, vol: 0.32, freq: 2400, q: 2 });
      tone({ type: 'triangle', f: 1100 + k * 140, dur: 0.18, vol: 0.2 });
      tone({ type: 'square', f: 200, f2: 90, dur: 0.08, vol: 0.14 });
    },
    forgeOk: () => {
      noise({ dur: 0.1, vol: 0.4, freq: 2600, q: 2 });
      [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'square', f, dur: 0.2, vol: 0.14, delay: 0.08 + i * 0.08 }));
      [2093, 2637, 3136].forEach((f, i) => tone({ type: 'sine', f, dur: 0.35, vol: 0.12, delay: 0.42 + i * 0.06 }));
    },
    forgeFail: () => {
      noise({ dur: 0.18, vol: 0.4, freq: 500, q: 0.8 });
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
    // 합칠 수 없을 때(개수 · 골드 부족)
    deny: () => tone({ type: 'square', f: 180, f2: 140, dur: 0.12, vol: 0.12 }),
    reveal: () => [660, 880, 1320, 1760].forEach((f, i) => tone({ type: 'sine', f, dur: 0.35, vol: 0.1, delay: i * 0.08 })),
    pickup: () => tone({ type: 'triangle', f: 600, f2: 900, dur: 0.08, vol: 0.12 }),
    stone: () => { tone({ type: 'sine', f: 1200, dur: 0.2, vol: 0.12 }); tone({ type: 'sine', f: 1800, dur: 0.25, vol: 0.08, delay: 0.05 }); },
    potion: () => { tone({ type: 'sine', f: 300, f2: 700, dur: 0.25, vol: 0.18 }); noise({ dur: 0.2, vol: 0.06, freq: 1500 }); },
    levelUp: () => [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f, dur: 0.18, vol: 0.1, delay: i * 0.09 })),
    chest: () => { noise({ dur: 0.2, vol: 0.15, freq: 300, q: 2 }); tone({ type: 'triangle', f: 400, f2: 800, dur: 0.3, vol: 0.12, delay: 0.1 }); },
    wake: () => tone({ type: 'sawtooth', f: 120, f2: 200, dur: 0.18, vol: 0.08 }),
    roar: () => { noise({ dur: 0.7, vol: 0.3, freq: 220, sweep: 90, q: 0.9 }); tone({ type: 'sawtooth', f: 90, f2: 55, dur: 0.7, vol: 0.18 }); },
    charged: () => tone({ type: 'square', f: 880, f2: 1320, dur: 0.12, vol: 0.1 }),
    fire: () => noise({ dur: 0.35, vol: 0.28, freq: 600, sweep: 150, q: 0.6 }),
    frost: () => { tone({ type: 'sine', f: 2200, f2: 1400, dur: 0.25, vol: 0.1 }); noise({ dur: 0.2, vol: 0.12, freq: 4000, q: 2 }); },
    zap: () => { noise({ dur: 0.12, vol: 0.22, freq: 3000, q: 3 }); tone({ type: 'square', f: 900, f2: 200, dur: 0.12, vol: 0.08 }); },
    blast: () => { noise({ dur: 0.4, vol: 0.35, freq: 400, sweep: 80, q: 0.7 }); tone({ type: 'triangle', f: 90, f2: 40, dur: 0.4, vol: 0.25 }); },
    stairs: () => [392, 523, 659].forEach((f, i) => tone({ type: 'sine', f, dur: 0.3, vol: 0.12, delay: i * 0.12 })),
  };
})();
