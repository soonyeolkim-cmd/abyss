// 온라인 파티 연결(2026-10-25 사용자: 방 코드로 파티 — 처음 2명 → 최대 4명, 메모/multiplayer-plan.md).
// WebRTC 로 기기끼리 바로 잇는다. 처음 서로 찾는 일만 PeerJS 무료 중계 서버(0.peerjs.com)가 한다 — index.html 의 peerjs script.
// 방장 = 피어 이름 'abyss-farm-' + 4자리 방 코드. 손님(최대 3명)은 모두 방장에게만 잇는다(별 모양) — 손님끼리 오갈 소식은 방장이 대신 전한다(coop.js).
// 방 코드는 이 기기에 한 번 정해 두고 계속 쓴다(2026-10-25 사용자: 방장 코드를 계속 바꿀 필요 없음). '방 코드 바꾸기'로만 새로.
// 주고받는 것: hello 판 번호 · 직업 · 레벨 · 무기 · 속성석, roster 방장이 알려 주는 파티원 목록, ping/pong 연결 속도, bye 나감, full 꽉 참.
// 그 밖의 t 는 Net.on(t, (m, from) => …) 으로 받는다. from = 보낸 사람 피어 이름(방장이 전해 준 것은 m.from).
const Net = (() => {
  const PREFIX = 'abyss-farm-';
  const VER = (() => { const s = [...document.scripts].find(s => s.src.includes('?v=')); return s ? s.src.split('?v=')[1] : ''; })();
  const MAX_GUESTS = 3;      // 방장 + 3 = 4명
  const JOIN_WAIT = 12000;   // 손님: 이만큼(ms) 안에 못 이으면 실패
  const PING_EVERY = 2;      // 초
  const LOST_AFTER = 9;      // 이만큼(초) 아무 소식이 없으면 끊긴 것(폰이 꺼지거나 데이터가 끊김)
  const CODE_KEY = 'abyss-room-code', JOIN_KEY = 'abyss-last-join';

  // state: off · hosting(방을 열고 기다림) · joining · ready(파티원이 한 명 이상) · error
  let peer = null, role = null, code = '', state = 'off', opened = false, err = '', myId = '', hostId = '';
  let joinTimer = null, roster = [];
  const links = new Map();  // 피어 이름 → { conn, info(hello), ping, heardT, pingT } — 방장: 손님들, 손님: 방장 하나
  const handlers = {};

  const available = () => typeof Peer !== 'undefined';
  const toast = s => { if (typeof Game !== 'undefined') Game.toast(s); };
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* 저장 못 하는 환경 */ } return v; };
  const rnd4 = () => String(1000 + Math.floor(Math.random() * 9000));
  // 내 방 코드(이 기기에 한 번 정해 두고 계속)
  function myCode() { let c = store(CODE_KEY); if (!/^\d{4}$/.test(c || '')) c = store(CODE_KEY, rnd4()); return c; }
  function newCode() { return store(CODE_KEY, rnd4()); }

  // 내 캐릭터 소개(파티원 화면에 아바타 · 이름 · 칼 궤적 색)
  function me() {
    const prof = Game.prof;
    return { t: 'hello', ver: VER, cls: prof.cls || 'swordsman', lv: prof.lv, weapon: prof.equip.weapon || null, sockets: prof.sockets || {} };
  }
  const infoOf = h => ({ cls: h.cls, lv: h.lv, weapon: h.weapon, sockets: h.sockets });

  function reset() {
    if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
    for (const l of links.values()) { try { l.conn.close(); } catch (e) { /* 이미 닫힘 */ } }
    links.clear();
    if (peer) { try { peer.destroy(); } catch (e) { /* 이미 없앰 */ } }
    peer = null; role = null; code = ''; opened = false; myId = ''; hostId = ''; roster = [];
  }

  // 방 만들기: 내 방 코드로. 이 코드가 아직 쓰이는 중이면(방금 닫은 방이 중계 서버에 남음 등) 3초 뒤 다시, 다섯 번 안 되면 새 코드
  function host(tries = 0) {
    if (!available()) { fail({ type: 'no-lib' }); return; }
    reset();
    role = 'host'; state = 'hosting'; err = '';
    if (tries >= 5) { code = newCode(); toast('방 코드가 아직 쓰이는 중이라 새 코드(' + code + ')로 열었어요'); }
    else code = myCode();
    const pr = peer = new Peer(PREFIX + code);
    pr.on('open', id => { if (pr === peer) { opened = true; myId = hostId = id; } });
    pr.on('connection', c => {
      if (pr !== peer) return;
      if (links.size >= MAX_GUESTS) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); }); return; }
      attach(c, c.peer);
    });
    pr.on('error', e => {
      if (pr !== peer) return;
      if (e.type === 'unavailable-id') { const t = tries; setTimeout(() => { if (pr === peer) host(t + 1); }, tries < 5 ? 3000 : 0); return; }
      if (e.type === 'peer-unavailable') return;  // 방장에게는 상관없음
      if (links.size && /^(network|socket-error|socket-closed|server-error)$/.test(e.type)) return;  // 중계 서버만 끊김 — 이미 이은 파티원은 그대로
      fail(e);
    });
    // 중계 서버와만 끊김: 이어진 파티원은 그대로, 새 파티원을 받으려면 다시 붙는다
    pr.on('disconnected', () => { if (pr === peer && !pr.destroyed) setTimeout(() => { if (pr === peer && !pr.destroyed && pr.disconnected) pr.reconnect(); }, 1500); });
  }

  // 방 들어가기
  function join(c) {
    if (!available()) { fail({ type: 'no-lib' }); return; }
    reset();
    role = 'guest'; state = 'joining'; err = ''; code = c; hostId = PREFIX + c;
    store(JOIN_KEY, c);
    const pr = peer = new Peer();
    pr.on('open', id => { if (pr === peer) { myId = id; attach(pr.connect(hostId, { reliable: true }), hostId); } });
    pr.on('error', e => { if (pr === peer) fail(e); });
    joinTimer = setTimeout(() => { if (state === 'joining') fail({ type: 'timeout' }); }, JOIN_WAIT);
  }

  function attach(c, pid) {
    const l = { conn: c, info: null, ping: 0, heardT: 0, pingT: 0 };
    links.set(pid, l);
    c.on('open', () => { if (links.get(pid) !== l) return; l.heardT = 0; c.send(me()); });
    c.on('data', m => { if (links.get(pid) === l) onData(pid, l, m); });
    c.on('close', () => { if (links.get(pid) === l) lost(pid); });
    c.on('error', () => { if (links.get(pid) === l) lost(pid); });
  }

  // 방장: 파티원 목록(나 + 손님들)을 모두에게
  function sendRoster() {
    if (role !== 'host') return;
    const list = [Object.assign({ pid: myId }, infoOf(me()))];
    for (const [pid, l] of links) if (l.info) list.push(Object.assign({ pid }, infoOf(l.info)));
    send({ t: 'roster', list });
  }

  function onData(pid, l, m) {
    if (!m || typeof m !== 'object') return;
    l.heardT = 0;
    if (m.t === 'hello') {
      if (m.ver !== VER) {
        try { l.conn.send({ t: 'ver', ver: VER }); } catch (e) { /* 닫히는 중 */ }
        if (role === 'host') { drop(pid); toast('친구 게임 판이 달라요 — 모두 새로고침해 주세요'); }
        else fail({ type: 'ver', theirs: m.ver });
        return;
      }
      const first = !l.info;
      l.info = infoOf(m);
      state = 'ready';
      if (joinTimer) { clearTimeout(joinTimer); joinTimer = null; }
      if (role === 'host') { sendRoster(); if (first) { toast('친구가 들어왔어요 (' + count() + '/4)'); if (typeof Sfx !== 'undefined') Sfx.pickup(); } }
      else if (first) { toast('방에 들어갔어요'); if (typeof Sfx !== 'undefined') Sfx.pickup(); }
      return;
    }
    if (m.t === 'roster' && role === 'guest') { roster = m.list || []; return; }
    if (m.t === 'ver') { if (role === 'guest') fail({ type: 'ver', theirs: m.ver }); else { drop(pid); toast('친구 게임 판이 달라요 — 모두 새로고침해 주세요'); } return; }
    if (m.t === 'full') { fail({ type: 'full' }); return; }
    if (m.t === 'bye') { lost(pid, true); return; }
    if (m.t === 'ping') { try { l.conn.send({ t: 'pong', at: m.at }); } catch (e) { /* 닫히는 중 */ } return; }
    if (m.t === 'pong') { l.ping = Math.round(performance.now() - m.at); return; }
    if (handlers[m.t]) handlers[m.t](m, m.from || pid);
  }

  // 방장: 손님 하나만 내보내고 방은 그대로
  function drop(pid) {
    const l = links.get(pid);
    links.delete(pid);
    if (l) setTimeout(() => { try { l.conn.close(); } catch (e) { /* 이미 닫힘 */ } }, 300);
    if (role === 'host') { if (!count1()) state = 'hosting'; sendRoster(); }
  }
  const count1 = () => [...links.values()].filter(l => l.info).length;  // 인사까지 마친 손님 수

  function lost(pid, bye) {
    if (role === 'host') {
      const had = !!(links.get(pid) || {}).info;
      drop(pid);
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
    full: '그 방은 꽉 찼어요 (4명)',
    'browser-incompatible': '이 브라우저는 파티 기능을 못 써요',
    network: '중계 서버에 연결하지 못했어요 — 인터넷을 확인해 주세요',
    'server-error': '중계 서버에 연결하지 못했어요 — 잠시 뒤 다시 해 주세요',
    'socket-error': '중계 서버에 연결하지 못했어요 — 인터넷을 확인해 주세요',
    'socket-closed': '중계 서버 연결이 끊겼어요',
  };
  function fail(e) {
    const type = (e && e.type) || 'unknown';
    reset();
    state = 'error';
    err = type === 'ver' ? '게임 판이 달라요 (내 판 ' + VER + ' · 방장 ' + e.theirs + ') — 새로고침해 주세요' : MSG[type] || '연결하지 못했어요 (' + type + ')';
    toast(err);
  }

  // 나가기: 모두에게 알리고 닫는다
  function leave() {
    const ls = [...links.values()], pr = peer;
    for (const l of ls) { try { if (l.conn.open) l.conn.send({ t: 'bye' }); } catch (e) { /* 이미 닫힘 */ } }
    links.clear(); peer = null;
    setTimeout(() => { try { for (const l of ls) l.conn.close(); if (pr) pr.destroy(); } catch (e) { /* 이미 닫힘 */ } }, 200);  // bye 가 나갈 틈
    reset(); state = 'off'; err = '';
  }

  // 보내기: 방장 = 모든 손님에게(except 빼고), 손님 = 방장에게. 방장이 보내는 것에는 from = 방장
  function send(m, except) {
    for (const [pid, l] of links) {
      if (pid === except || !l.conn.open) continue;
      try { l.conn.send(m); } catch (e) { /* 닫히는 중 */ }
    }
  }
  function sendTo(pid, m) { const l = links.get(pid); if (l && l.conn.open) { try { l.conn.send(m); } catch (e) { /* 닫히는 중 */ } } }

  // 매 화면(game.js frame): 연결 속도 재기 · 오래 소식 없으면 끊긴 것으로
  function update(dt) {
    for (const [pid, l] of [...links]) {
      if (!l.conn.open) continue;
      l.heardT += dt;
      if (l.heardT > LOST_AFTER) { lost(pid); continue; }
      l.pingT -= dt;
      if (l.pingT <= 0) { l.pingT = PING_EVERY; try { l.conn.send({ t: 'ping', at: performance.now() }); } catch (e) { /* 닫히는 중 */ } }
    }
  }

  // 나 말고 파티원들 [{ pid, cls, lv, weapon, sockets, host }] — 방장: 손님들, 손님: 방장 + 다른 손님
  function members() {
    if (state !== 'ready') return [];
    if (role === 'host') return [...links].filter(([, l]) => l.info).map(([pid, l]) => Object.assign({ pid, host: false, ping: l.ping }, l.info));
    const hl = links.get(hostId);
    return roster.filter(r => r.pid !== myId).map(r => Object.assign({}, r, { host: r.pid === hostId, ping: r.pid === hostId && hl ? hl.ping : 0 }));
  }
  const count = () => 1 + (role === 'host' ? count1() : members().length);
  // 파티 안 순서(방장 0 · 손님 1~3) — 색 · 이름표용
  function slotOf(pid) {
    if (role === 'host') { if (pid === myId) return 0; return 1 + [...links.keys()].indexOf(pid); }
    const i = roster.findIndex(r => r.pid === pid);
    return i < 0 ? 0 : i;
  }

  return {
    available, host, join, leave, send, sendTo, update, members, count, slotOf, VER, MAX: MAX_GUESTS + 1,
    on: (t, fn) => { handlers[t] = fn; },
    refresh: () => { if (state !== 'ready') return; if (role === 'host') sendRoster(); else send(me()); },  // 레벨 · 무기 · 속성석이 바뀌면 다시 소개
    newCode: () => { const c = newCode(); return c; },
    get state() { return state; }, get role() { return role; }, get code() { return code || myCode(); }, get opened() { return opened; },
    get err() { return err; }, get myId() { return myId; }, get hostId() { return hostId; },
    get lastJoin() { return store(JOIN_KEY) || ''; },
    get ping() { const ms = members().map(m => m.ping || 0); return ms.length ? Math.max(...ms) : 0; },
    get linked() { return state === 'ready'; },
  };
})();
// 페이지를 닫거나 떠나면 파티원에게 알린다
window.addEventListener('pagehide', () => { if (Net.state !== 'off') Net.leave(); });
