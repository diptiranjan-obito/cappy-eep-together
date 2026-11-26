/* Capy Wonderland · Together (live counts, shared records, chat)
   Add to index.html:  <script src="sync.js"></script>  (just before </body>) */
(function () {
  'use strict';

  /* ===== STEP 1: PASTE YOUR FIREBASE CONFIG HERE ===== */
    const firebaseConfig = {
    apiKey: 'AIzaSyDrXqbkZTCX0fMvy48okuBpl5lIT5emGlE',
    authDomain: 'cappy-eep.firebaseapp.com',
    databaseURL: 'https://cappy-eep-default-rtdb.firebaseio.com',
    projectId: 'cappy-eep',
    appId: '1:169061578833:web:07d0731447ec5d74546070'
  };
  const PEOPLE = ['Anshu', 'Trisha'];
  /* ================================================= */

  const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const KEY = 'capy_sync_v1';
  const LOGKEY = 'capy_eep_local_logs_v3';

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
  let me = PEOPLE.indexOf(saved.me) > -1 ? saved.me : null;
  let room = saved.room || null;
  let lastRead = Number(saved.lastRead) || 0;
  let pick = me;
  let msgs = [], logs = [], presence = {};
  let tab = 'chat';
  let sendFn = null;

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ me: me, room: room, lastRead: lastRead })); } catch (e) { /* ignore */ }
  }
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  const tagCls = (p) => (p === 'Anshu' ? 'atlas' : 'trisha');

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
    .cs-dock{position:fixed;right:14px;bottom:16px;z-index:40;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
    .cs-chip{background:var(--card-bg);border:1px solid var(--card-border);border-radius:999px;padding:6px 12px;font-size:.8rem;font-weight:700;color:var(--text-lavender);backdrop-filter:blur(10px)}
    .cs-badge{background:var(--accent-gold);color:#1b1230;border-radius:999px;padding:0 7px;font-size:.75rem;font-weight:700}
    .cs-note{font-size:.9rem;color:var(--text-lavender);line-height:1.45;margin-bottom:14px}
    .cs-msgs{display:flex;flex-direction:column;gap:8px;max-height:42vh;min-height:120px;overflow-y:auto;padding:4px 2px 8px}
    .cs-msg{align-self:flex-start;max-width:82%;background:rgba(255,255,255,.07);border:1px solid rgba(235,222,255,.12);border-radius:16px 16px 16px 4px;padding:8px 12px}
    .cs-msg.mine{align-self:flex-end;background:rgba(230,169,107,.2);border-color:rgba(230,169,107,.4);border-radius:16px 16px 4px 16px}
    .cs-msg.sys{align-self:center;max-width:94%;text-align:center;background:rgba(185,154,255,.14);border-radius:14px}
    .cs-who{font-size:.74rem;font-weight:700;color:var(--accent-lavender)}
    .cs-text{font-size:.95rem;line-height:1.35;word-break:break-word;white-space:pre-wrap}
    .cs-time{font-size:.68rem;color:var(--text-muted);margin-top:2px}
    .cs-empty{text-align:center;color:var(--text-muted);font-size:.88rem;padding:24px 0}
    .cs-send{display:flex;gap:8px;margin-top:8px}
    .cs-send .cozy-input{flex:1}
    .cs-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
    .cs-card{background:rgba(255,255,255,.04);border:1px solid rgba(235,222,255,.12);border-radius:16px;padding:10px 12px}
    .cs-line{display:flex;justify-content:space-between;font-size:.82rem;margin-top:6px;color:var(--text-lavender)}
    .cs-line b{color:var(--accent-gold);font-family:'Fredoka',sans-serif}
    .sync-status{font-size:.78rem;color:var(--text-muted);margin-top:10px;min-height:1.2em}
  `;
  document.head.appendChild(css);

  /* ---------- markup ---------- */
  const host = document.createElement('div');
  host.innerHTML = `
    <div class="cs-dock">
      <div class="cs-chip" id="csChip" hidden></div>
      <button class="icon-pill-btn" id="csFab" type="button">
        <span aria-hidden="true">💬</span><span>Together</span>
        <span class="cs-badge" id="csBadge" hidden>0</span>
      </button>
    </div>
    <div class="modal-backdrop" id="csModal">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="csTitle" tabindex="-1">
        <div class="modal-header">
          <h2 id="csTitle"><span aria-hidden="true">💬</span> Together</h2>
          <button class="close-btn" id="csClose" type="button" aria-label="Close">✕</button>
        </div>
        <div id="csJoin" hidden>
          <p class="cs-note">Pick who you are and a secret room code (8+ characters). Use the same code on both phones.</p>
          <div class="group-label" id="csWho">I am</div>
          <div class="identity-pills" role="group" aria-labelledby="csWho" id="csPills"></div>
          <div class="form-group" style="margin-top:14px">
            <label for="csRoom">Room code</label>
            <input class="cozy-input" id="csRoom" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="e.g. capy-moon-4821" />
          </div>
          <button class="btn-jump" id="csJoinBtn" type="button" style="font-size:1.05rem;padding:14px"><span aria-hidden="true">✨</span><span>Join the room</span></button>
          <div class="sync-status" id="csJoinStatus" role="status"></div>
        </div>
        <div id="csMain" hidden>
          <div class="filter-tabs" role="group" aria-label="Sections">
            <button class="filter-tab active" type="button" data-tab="chat" aria-pressed="true">Chat</button>
            <button class="filter-tab" type="button" data-tab="records" aria-pressed="false">Records</button>
          </div>
          <div id="csChat">
            <div class="cs-msgs" id="csMsgs" aria-live="polite"></div>
            <div class="cs-send">
              <input class="cozy-input" id="csInput" maxlength="500" autocomplete="off" placeholder="Say something cozy…" aria-label="Message" />
              <button class="btn-eep" id="csSend" type="button" style="padding:10px 16px">Send</button>
            </div>
          </div>
          <div id="csRecords" hidden></div>
          <button class="reset-link" id="csChange" type="button" style="margin-top:10px">Change name or room code</button>
          <div class="sync-status" id="csStatus" role="status"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(host);
  const $ = (id) => document.getElementById(id);
  const fab = $('csFab'), chip = $('csChip'), badge = $('csBadge'), modal = $('csModal');
  const joinBox = $('csJoin'), mainBox = $('csMain'), msgsEl = $('csMsgs'), recEl = $('csRecords');
  const counterEl = document.getElementById('sheepCounter');

  function setStatus(t) { $('csStatus').textContent = t; $('csJoinStatus').textContent = t; }
  const isOpen = () => modal.classList.contains('open');

  /* ---------- identity on the page ---------- */
  function applyIdentity() {
    window.CAPY_ME = me;
    const l = document.getElementById('counterOwnerLabel');
    if (me && l && l.firstChild && l.firstChild.nodeType === 3) l.firstChild.nodeValue = me + '’s Sheep Tonight ';
  }

  /* ---------- rendering ---------- */
  function fmtTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  function fmtDate(iso) {
    const p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '';
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderChat() {
    msgsEl.textContent = '';
    if (!msgs.length) msgsEl.appendChild(el('div', 'cs-empty', 'No messages yet. Say hi! 🦫'));
    msgs.forEach((m) => {
      const mine = m.who === me;
      const b = el('div', 'cs-msg' + (mine ? ' mine' : '') + (m.sys ? ' sys' : ''));
      if (!mine && !m.sys) b.appendChild(el('div', 'cs-who', m.who));
      b.appendChild(el('div', 'cs-text', m.text));
      b.appendChild(el('div', 'cs-time', fmtTime(m.ts)));
      msgsEl.appendChild(b);
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function line(label, val) {
    const d = el('div', 'cs-line');
    d.appendChild(el('span', '', label));
    d.appendChild(el('b', '', String(val)));
    return d;
  }

  function renderRecords() {
    recEl.textContent = '';
    const grid = el('div', 'cs-grid');
    PEOPLE.forEach((p) => {
      const mine = logs.filter((l) => l.who === p);
      const total = mine.reduce((a, l) => a + (Number(l.count) || 0), 0);
      const pr = presence[p];
      const card = el('div', 'cs-card');
      card.appendChild(el('span', 'user-tag ' + tagCls(p), p));
      card.appendChild(line('Tonight 🐑', pr ? (pr.count || 0) : '–'));
      card.appendChild(line('Nights', mine.length));
      card.appendChild(line('Total sheep', total));
      card.appendChild(line('Average', mine.length ? Math.round(total / mine.length) : 0));
      card.appendChild(line('Kidnappings 🦫', mine.filter((l) => l.kidnapped).length));
      grid.appendChild(card);
    });
    recEl.appendChild(grid);

    const list = el('div', 'log-list');
    const sorted = logs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 30);
    if (!sorted.length) list.appendChild(el('div', 'cs-empty', 'No shared eep sessions yet.'));
    sorted.forEach((l) => {
      const row = el('div', 'log-item');
      const left = el('div', 'log-left');
      const top = el('div', 'log-date');
      top.appendChild(el('span', 'user-tag ' + tagCls(l.who), l.who));
      top.appendChild(document.createTextNode(fmtDate(l.date) + (l.kidnapped ? ' 🛸' : ' 💤')));
      left.appendChild(top);
      if (l.note) left.appendChild(el('div', 'log-note', '“' + l.note + '”'));
      row.appendChild(left);
      row.appendChild(el('div', 'log-count', '🐑 ' + (Number(l.count) || 0)));
      list.appendChild(row);
    });
    recEl.appendChild(list);
  }

  function renderChip() {
    const p = PEOPLE.find((x) => x !== me);
    const pr = presence[p];
    if (!me || !pr) { chip.hidden = true; return; }
    chip.hidden = false;
    chip.textContent = p + ' ' + (pr.online ? '🟢' : '⚪') + ' 🐑 ' + (pr.count || 0);
  }

  function updateBadge() {
    const newest = msgs.reduce((a, m) => Math.max(a, m.ts || 0), 0);
    if (isOpen() && tab === 'chat' && newest > lastRead) { lastRead = newest; persist(); }
    const n = msgs.filter((m) => m.who !== me && (m.ts || 0) > lastRead).length;
    badge.hidden = !n;
    badge.textContent = n > 9 ? '9+' : String(n);
  }

  /* ---------- panel UI ---------- */
  function renderPills() {
    const box = $('csPills');
    box.textContent = '';
    PEOPLE.forEach((p) => {
      const b = el('button', 'id-pill' + (pick === p ? ' active-' + p.toLowerCase() : ''), p);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(pick === p));
      b.addEventListener('click', () => { pick = p; renderPills(); });
      box.appendChild(b);
    });
  }

  function showPanel() {
    const needJoin = !me || !room;
    joinBox.hidden = !needJoin;
    mainBox.hidden = needJoin;
    if (needJoin) { renderPills(); $('csRoom').value = room || ''; }
    modal.classList.add('open');
    modal.querySelector('.modal-card').focus();
    if (!needJoin) { renderChat(); renderRecords(); updateBadge(); }
  }
  function hidePanel() { modal.classList.remove('open'); fab.focus(); }

  fab.addEventListener('click', showPanel);
  $('csClose').addEventListener('click', hidePanel);
  modal.addEventListener('click', (e) => { if (e.target === modal) hidePanel(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) hidePanel(); });

  host.querySelectorAll('.filter-tab').forEach((b) => {
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      host.querySelectorAll('.filter-tab').forEach((x) => {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      $('csChat').hidden = tab !== 'chat';
      recEl.hidden = tab !== 'records';
      if (tab === 'chat') { renderChat(); updateBadge(); } else renderRecords();
    });
  });

  $('csJoinBtn').addEventListener('click', () => {
    const code = $('csRoom').value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    if (!pick) { setStatus('Please choose who you are.'); return; }
    if (code.length < 8) { setStatus('Room code needs at least 8 characters.'); return; }
    me = pick; room = code; lastRead = 0;
    persist();
    location.reload();
  });

  $('csChange').addEventListener('click', () => {
    me = null; room = null; persist();
    location.reload();
  });

  function send() {
    const input = $('csInput');
    const text = input.value.trim();
    if (!text || !sendFn) return;
    sendFn(text);
    input.value = '';
  }
  $('csSend').addEventListener('click', send);
  $('csInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });

  /* ---------- Firebase ---------- */
  async function start() {
    if (!me || !room) return;
    if (/PASTE/.test(firebaseConfig.apiKey)) { setStatus('Add your Firebase config at the top of sync.js first.'); return; }
    setStatus('Connecting…');
    let A, D;
    try {
      const mods = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-database.js')]);
      A = mods[0]; D = mods[1];
    } catch (e) { setStatus('Could not load Firebase (offline?).'); return; }

    const db = D.getDatabase(A.initializeApp(firebaseConfig));
    const base = 'rooms/' + room;
    const myP = D.ref(db, base + '/presence/' + me);
    const countNow = () => parseInt(counterEl.textContent, 10) || 0;
    const listen = (q, cb) => D.onValue(q, cb, () => setStatus('Can’t reach the room. Check your database rules and config.'));

    listen(D.ref(db, '.info/connected'), (s) => {
      if (s.val() === true) {
        D.onDisconnect(myP).update({ online: false, ts: D.serverTimestamp() });
        D.update(myP, { online: true, count: countNow(), ts: Date.now() });
        setStatus('Connected 🟢 · room: ' + room);
      } else setStatus('Reconnecting…');
    });

    let t;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => D.update(myP, { count: countNow(), ts: Date.now() }), 400);
    }).observe(counterEl, { childList: true, characterData: true, subtree: true });

    listen(D.ref(db, base + '/presence'), (s) => {
      presence = s.val() || {};
      renderChip();
      if (isOpen() && tab === 'records') renderRecords();
    });

    let known = new Set(), ready = false;
    listen(D.ref(db, base + '/logs'), (s) => {
      const v = s.val() || {};
      known = new Set(Object.keys(v));
      logs = Object.keys(v).map((k) => v[k]);
      ready = true;
      if (isOpen() && tab === 'records') renderRecords();
    });

    // Push my new Eep Log entries (the page saves them in localStorage)
    setInterval(() => {
      if (!ready) return;
      let local = [];
      try { local = JSON.parse(localStorage.getItem(LOGKEY) || '[]'); } catch (e) { local = []; }
      local.forEach((e) => {
        if (!e || e.who !== me || !e.id || known.has(e.id)) return;
        known.add(e.id);
        D.set(D.ref(db, base + '/logs/' + e.id), e);
        if (Date.now() - (e.createdAt || 0) < 120000) {
          D.push(D.ref(db, base + '/chat'), {
            who: me, sys: true, ts: Date.now(),
            text: e.kidnapped
              ? '🛸🦫 ' + me + ' counted ' + e.count + ' sheep and got Capy-kidnapped to Wonderland!'
              : '🐑💤 ' + me + ' counted ' + e.count + ' sheep and is off to Capy Wonderland. Eep well! 🦫✨'
          });
        }
      });
    }, 1500);

    listen(D.query(D.ref(db, base + '/chat'), D.limitToLast(100)), (s) => {
      const list = [];
      s.forEach((c) => { list.push(c.val()); });
      msgs = list;
      if (isOpen() && tab === 'chat') renderChat();
      updateBadge();
    });

    sendFn = (text) => D.push(D.ref(db, base + '/chat'), { who: me, text: text.slice(0, 500), ts: Date.now() });
  }

  /* ---------- boot ---------- */
  applyIdentity();
  if (!me || !room) showPanel(); else start();
})();
