// 온라인 협동 연결(2026-10-25 사용자: 방 코드로 2명, 던전만 같이 — 메모/multiplayer-plan.md 1단계).
// WebRTC 로 기기끼리 바로 잇는다. 처음 서로 찾는 일만 PeerJS 무료 중계 서버(0.peerjs.com)가 한다 — index.html 의 peerjs script.
// 방장 = 피어 이름 'abyss-farm-' + 4자리 방 코드, 손님 = 이름 없이 만들고 그 이름으로 잇는다. 한 방에 손님 한 명.
// 주고받는 것: { t: 'hello' } 서로 판 번호 · 직업 · 레벨 · 무기, ping/pong 연결 속도, bye 나감. 그 밖의 t 는 Net.on(t, fn) 으로 받는다.
const Net = (() => {
  const PREFIX = 'abyss-farm-';
  const VER = (() => { const s = [...document.scripts].find(s => s.src.includes('?v=')); return s ? s.src.split('?v=')[1] : ''; })();
  const JOIN_WAIT = 12000;   // 손님: 이만큼(ms) 안에 못 이으면 실패
  const PING_EVERY = 2;      // 초
  const LOST_AFTER = 9;      // 이만큼(초) 아무 소식이 없으면 끊긴 것(폰이 꺼지거나 데이터가 끊김)

  // state: off · hosting(방을 열고 기다림 — 아직 중계 서버에 안 붙었으면 opened false) · joining · ready(서로 인사함) · error
  let peer = null, conn = null, role = null, code = '', state = 'off', opened = false;
  let mate = null, err = '', ping = 0, pingT = 0, heardT = 0, joinTimer = null;
  const handlers = {};

  const available = () => typeof Peer !== 'undefined';
  const toast = s => { if (typeof Game !== 'undefined') Game.toast(s); };

  // 내 캐릭터 소개(상대 함께하기 창에 아바타 · 이름)
  function me() {
    const prof = Game.prof;
    return { t: 'hello', ver: VER, cls: prof.cls || 'swordsman', lv: prof.lv, weapon: prof.equip.weapon || null, sockets: prof.sockets || {} };  // sockets = 친구 화면 칼 궤적 · 차지 고리 색
  }

  function reset() {
    if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
    if (conn) { try { conn.close(); } catch (e) { /* 이미 닫힘 */ } }
    if (peer) { try { peer.destroy(); } catch (e) { /* 이미 없앰 */ } }
    peer = null; conn = null; role = null; code = ''; opened = false; mate = null; ping = 0;
  }

  // 방 만들기: 4자리 코드가 이미 쓰이고 있으면 다른 코드로 몇 번 더
  function host(tries = 0) {
    if (!available()) { fail({ type: 'no-lib' }); return; }
    reset();
    role = 'host'; state = 'hosting'; err = '';
    code = String(1000 + Math.floor(Math.random() * 9000));
    const pr = peer = new Peer(PREFIX + code);
    pr.on('open', () => { if (pr === peer) opened = true; });
    pr.on('connection', c => {
      if (pr !== peer) return;
      if (conn) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); }); return; }  // 이미 친구가 있다
      attach(c);
    });
    pr.on('error', e => {
      if (pr !== peer) return;
      if (e.type === 'unavailable-id' && tries < 5) { host(tries + 1); return; }
      if (e.type === 'peer-unavailable') return;  // 방장에게는 상관없음
      if (conn && state === 'ready' && /^(network|socket-error|socket-closed|server-error)$/.test(e.type)) return;  // 중계 서버만 끊김 — 이미 이은 친구는 그대로
      fail(e);
    });
    // 중계 서버와만 끊김: 이어진 친구는 그대로, 새 친구를 받으려면 다시 붙는다
    pr.on('disconnected', () => { if (pr === peer && !pr.destroyed) setTimeout(() => { if (pr === peer && !pr.destroyed && pr.disconnected) pr.reconnect(); }, 1500); });
  }

  // 방 들어가기
  function join(c) {
    if (!available()) { fail({ type: 'no-lib' }); return; }
    reset();
    role = 'guest'; state = 'joining'; err = ''; code = c;
    const pr = peer = new Peer();
    pr.on('open', () => { if (pr === peer) attach(pr.connect(PREFIX + c, { reliable: true })); });
    pr.on('error', e => { if (pr === peer) fail(e); });
    joinTimer = setTimeout(() => { if (state === 'joining') fail({ type: 'timeout' }); }, JOIN_WAIT);
  }

  function attach(c) {
    conn = c;
    c.on('open', () => { if (c !== conn) return; heardT = 0; c.send(me()); });
    c.on('data', m => { if (c === conn) onData(m); });
    c.on('close', () => { if (c === conn) lost(); });
    c.on('error', () => { if (c === conn) lost(); });
  }

  function onData(m) {
    if (!m || typeof m !== 'object') return;
    heardT = 0;
    if (m.t === 'hello') {
      if (m.ver !== VER) {
        send({ t: 'ver', ver: VER });
        if (role === 'host') { dropMate(); toast('친구 게임 판이 달라요 — 둘 다 새로고침해 주세요'); }
        else fail({ type: 'ver', theirs: m.ver });
        return;
      }
      const first = !mate;
      mate = m; state = 'ready';
      if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
      if (first) { toast(role === 'host' ? '친구가 들어왔어요' : '방에 들어갔어요'); if (typeof Sfx !== 'undefined') Sfx.pickup(); }
      return;
    }
    if (m.t === 'ver') { if (role === 'guest') fail({ type: 'ver', theirs: m.ver }); else { dropMate(); toast('친구 게임 판이 달라요 — 둘 다 새로고침해 주세요'); } return; }
    if (m.t === 'full') { fail({ type: 'full' }); return; }
    if (m.t === 'bye') { lost(true); return; }
    if (m.t === 'ping') { send({ t: 'pong', at: m.at }); return; }
    if (m.t === 'pong') { ping = Math.round(performance.now() - m.at); return; }
    if (handlers[m.t]) handlers[m.t](m);
  }

  // 방장: 친구만 내보내고 방은 그대로 연다
  function dropMate() {
    const c = conn;
    conn = null; mate = null; ping = 0;
    if (c) setTimeout(() => { try { c.close(); } catch (e) { /* 이미 닫힘 */ } }, 300);
    if (role === 'host') state = 'hosting';
  }

  function lost(bye) {
    if (role === 'host') {
      const had = !!mate;
      dropMate();
      if (had) toast(bye ? '친구가 방을 나갔어요' : '친구 연결이 끊겼어요');
    } else {
      const had = state === 'ready';
      reset(); state = had ? 'off' : 'error';
      if (!had) err = '연결이 끊겼어요';
      toast(had ? (bye ? '방장이 방을 닫았어요' : '방장 연결이 끊겼어요') : err);
    }
  }

  const MSG = {
    'no-lib': '파티 기능을 불러오지 못했어요 — 인터넷을 켜고 새로고침해 주세요',
    'peer-unavailable': '그 방을 못 찾았어요 — 방 코드를 확인해 주세요',
    timeout: '연결이 안 돼요 — 방 코드 · 인터넷을 확인해 주세요',
    full: '그 방에는 이미 친구가 있어요',
    'browser-incompatible': '이 브라우저는 파티 기능을 못 써요',
    network: '중계 서버에 연결하지 못했어요 — 인터넷을 확인해 주세요',
    'server-error': '중계 서버에 연결하지 못했어요 — 잠시 뒤 다시 해 주세요',
    'socket-error': '중계 서버에 연결하지 못했어요 — 인터넷을 확인해 주세요',
    'socket-closed': '중계 서버 연결이 끊겼어요',
    'unavailable-id': '방 코드를 만들지 못했어요 — 다시 해 주세요',
  };
  function fail(e) {
    const type = (e && e.type) || 'unknown';
    reset();
    state = 'error';
    err = type === 'ver' ? '두 사람 게임 판이 달라요 (내 판 ' + VER + ' · 방장 ' + e.theirs + ') — 새로고침해 주세요' : MSG[type] || '연결하지 못했어요 (' + type + ')';
    toast(err);
  }

  // 나가기: 상대에게 알리고 닫는다
  function leave() {
    if (conn && conn.open) { try { conn.send({ t: 'bye' }); } catch (e) { /* 이미 닫힘 */ } }
    const c = conn, pr = peer;
    conn = null; peer = null;
    setTimeout(() => { try { if (c) c.close(); if (pr) pr.destroy(); } catch (e) { /* 이미 닫힘 */ } }, 200);  // bye 가 나갈 틈
    reset(); state = 'off'; err = '';
  }

  function send(m) { if (conn && conn.open) { try { conn.send(m); } catch (e) { /* 닫히는 중 */ } } }

  // 매 화면(game.js frame): 연결 속도 재기 · 오래 소식 없으면 끊긴 것으로
  function update(dt) {
    if (!conn || !conn.open) return;
    heardT += dt;
    if (heardT > LOST_AFTER) { lost(); return; }
    pingT -= dt;
    if (pingT <= 0) { pingT = PING_EVERY; send({ t: 'ping', at: performance.now() }); }
  }

  return {
    available, host, join, leave, send, update, VER,
    refresh: () => { if (state === 'ready') send(me()); },  // 레벨 · 무기가 바뀌면 다시 소개(친구 화면의 내 모습)
    on: (t, fn) => { handlers[t] = fn; },
    get state() { return state; }, get role() { return role; }, get code() { return code; }, get opened() { return opened; },
    get mate() { return mate; }, get err() { return err; }, get ping() { return ping; },
    get linked() { return state === 'ready'; },
  };
})();
// 페이지를 닫거나 떠나면 상대에게 알린다
window.addEventListener('pagehide', () => { if (Net.state !== 'off') Net.leave(); });
