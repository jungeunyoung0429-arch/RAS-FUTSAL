const $ = (selector) => document.querySelector(selector);
const divisionNames = {중등남:'중등부 남', 중등여:'중등부 여', 고등남:'고등부 남', 고등여:'고등부 여'};
const dates = ['10/19','10/21','10/26','11/6','11/14','11/21'];
const dow = Object.fromEntries(matches.map(match => [match.date, match.dow]));
const venueNames = ['A','B','C','D'];
let activeDay = '11/14';
let page = 0;
const groupSize = 3;
const allDay = date => date.replace('/','.') + ' (' + dow[date] + ')';
const kick = match => match.time.split('~')[0];
const FORFEIT = {"M025":"고잔고","M026":"신길고","M027":"성안고","M030":"신길고","M033":"성안고","M035":"신길고","M036":"고잔고","M084":"성안고","M085":"신길고","M090":"성안고","M091":"고잔고","M095":"신길고","M097":"성안고","M103":"신길고","M106":"고잔고","M112":"신길고","M116":"성안고","M119":"고잔고","M126":"고잔고","M132":"신길고","M139":"신길고","M145":"신길고"};
const played = matches.filter(m => !m.wo);
const woMatches = matches.filter(m => m.wo);
const CEREMONY = {
  '11/14': [['08:15','중등부 개회식'],['12:00','고등부 개회식']],
  '11/21': [['08:15','고등부 개회식'],['11:00','고등부 폐회식 · 중등부 개회식'],['14:35','중등부 폐회식']]
};
const SESSION = {
  '11/14': [['중등부','08:30 ~ 11:45'],['고등부','12:16 ~ 14:19']],
  '11/21': [['고등부','08:30 ~ 10:33'],['중등부','11:20 ~ 14:35']]
};
const sortedMatches = [...played].sort((a,b) => dates.indexOf(a.date)-dates.indexOf(b.date) || kick(a).localeCompare(kick(b)) || a.court-b.court);
function addOptions(select, items) {
  for (const [value, label] of items) select.add(new Option(label, value));
}
for (const select of [$('#division'),$('#div-filter')]) addOptions(select, [['','전체 부문'], ...Object.entries(divisionNames)]);
addOptions($('#day-filter'), [['','전체 날짜'], ...dates.map(d => [d,allDay(d)])]);
for (const day of ['11/14','11/21']) {
  const button = document.createElement('button');
  button.textContent = allDay(day);
  button.dataset.day = day;
  button.onclick = () => { activeDay = day; page = 0; showDayInfo(); showCards(); };
  $('#dates').append(button);
}
function showDayInfo() {
  const cer = CEREMONY[activeDay] || [], ses = SESSION[activeDay] || [];
  const wo = woMatches.filter(m => m.date === activeDay);
  $('#dayinfo').innerHTML =
    (ses.length ? '<div class="day-rows">' + ses.map(([k,v]) => `<span><b>${k}</b> ${v}</span>`).join('') + '</div>' : '') +
    (cer.length ? '<ul class="day-cer">' + cer.map(([t,n]) => `<li><i>${t}</i>${n}</li>`).join('') + '</ul>' : '') +
    '<p class="day-heed"><b>경기 시각은 참고용입니다.</b> 앞 경기가 일찍 끝나면 순서가 당겨질 수 있습니다. 경기 30분~1시간 전부터 대기하고 장내 방송에 귀 기울여 주세요. 대기 공간 — 체육관 · 아람관 · 자람관 (히터 가동)</p>' +
    (wo.length ? '<div class="day-wo"><b>몰수 처리 · ' + wo.length + '경기</b>' +
      wo.map(m => { const l = m.wo === 1 ? null : m.wo; return m; }).map(m => {
        const lose = FORFEIT[m.id], win = m.t1 === lose ? m.t2 : m.t1;
        return `<span>${win} 1 : 0 ${lose} <i>${lose} 불참</i></span>`; }).join('') +
      '<small>해당 경기는 진행하지 않으며 순위에는 위 결과로 반영됩니다.</small></div>' : '');
}
const tmin = t => (+t.slice(0,2)) * 60 + (+t.slice(3,5));
const nowMin = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };
const todayKey = () => { const d = new Date(); return (d.getMonth()+1) + '/' + d.getDate(); };
let jumped = false;

/* 하루치를 한 화면에 — 지나간 경기 · 지금 경기 · 다음 경기를 스크롤로 훑어봅니다 */
function showCards() {
  const div = $('#division').value;
  const dayAll = sortedMatches.filter(m => m.date === activeDay);
  const list = dayAll.filter(m => !div || m.div === div);
  document.querySelectorAll('[data-day]').forEach(b => b.setAttribute('aria-pressed', b.dataset.day === activeDay));
  if (!list.length) {
    $('#cards').innerHTML = '<p class="empty">조건에 맞는 경기가 없습니다.</p>';
    $('#page-status').textContent = '0경기';
    return;
  }
  const SC = allScores();
  const slots = [...new Set(dayAll.map(kick))].sort();       /* 번호는 그 날 전체 기준으로 매깁니다 */
  const shown = [...new Set(list.map(kick))].sort();
  const isToday = activeDay === todayKey();
  const nm = nowMin();
  /* 지금 진행 중인 슬롯 — 없으면 다음에 열릴 슬롯 */
  let liveT = null;
  if (isToday) {
    liveT = shown.find(t => nm >= tmin(t) && nm < tmin(t) + 15) || shown.find(t => tmin(t) > nm) || null;
  }
  const cer = (CEREMONY[activeDay] || []).slice();
  let html = '', doneN = 0;

  for (const t of shown) {
    while (cer.length && tmin(cer[0][0]) <= tmin(t)) {
      const c = cer.shift();
      html += `<div class="dcere"><i>${c[0]}</i><b>${c[1]}</b></div>`;
    }
    const row = list.filter(m => kick(m) === t);
    const no = slots.indexOf(t) + 1;
    const over = isToday && tmin(t) + 15 <= nm;
    const live = t === liveT;
    const cells = venueNames.map(cn => {
      const m = row.find(x => venueNames[x.court-1] === cn);
      if (!m) return `<div class="dcell none"><span class="dcourt">${cn}</span><em>경기 없음</em></div>`;
      const s = SC[m.id], w1 = s && +s[0] > +s[1], w2 = s && +s[1] > +s[0];
      if (s) doneN++;
      const mv = mvpOf(m.id);
      return `<button class="dcell${s ? ' done' : ''}" data-id="${m.id}">
        <span class="dcourt">${cn}</span><span class="ddiv">${divisionNames[m.div]}</span>
        <span class="dteam${w1 ? ' win' : w2 ? ' los' : ''}">${m.t1}</span>
        <span class="dsc">${s ? `${s[0]}<em>:</em>${s[1]}` : 'VS'}</span>
        <span class="dteam${w2 ? ' win' : w1 ? ' los' : ''}">${m.t2}</span>
        ${mv ? `<span class="dmvp"><i>MVP</i>${mv.name}</span>` : ''}</button>`;
    }).join('');
    html += `<div class="dslot${over ? ' over' : ''}${live ? ' atnow' : ''}"${live ? ' id="now-slot"' : ''}>
      <div class="dbar"><b>${no}경기</b><span>${row[0].time}</span>
        ${live ? '<i class="tag">지금</i>' : over ? '<i class="tag o">종료</i>' : ''}</div>
      <div class="dgrid">${cells}</div></div>`;
  }
  $('#cards').innerHTML = html;
  $('#page-status').textContent =
    `${shown.length}개 시간대 · ${list.length}경기${doneN ? ` · ${doneN}경기 종료` : ''}`;
  const nb = $('#now'); if (nb) nb.hidden = !document.getElementById('now-slot');
  if (!jumped && isToday) { jumped = true; setTimeout(toNow, 160); }
}
function toNow() {
  const el = document.getElementById('now-slot');
  if (el) el.scrollIntoView({ behavior:'smooth', block:'center' });
}
if ($('#now')) $('#now').onclick = toNow;
$('#division').onchange = () => showCards();
function buildFixtures() {
  const date = $('#day-filter').value, div = $('#div-filter').value, school = $('#team-filter').value.trim();
  const filtered = sortedMatches.filter(m => (!date || date===m.date) && (!div || div===m.div) && (!school || [m.t1,m.t2].some(team => team.includes(school))));
  $('#result-count').textContent = filtered.length + '경기';
  $('#fixture-list').innerHTML = filtered.map(m => `<button class="fixture" data-id="${m.id}"><small>${allDay(m.date)}<br>${kick(m)}</small><b>${m.t1} <em>VS</em> ${m.t2}</b><small>${divisionNames[m.div]}<br>COURT ${venueNames[m.court-1]}</small></button>`).join('') || '<p class="empty">조건에 맞는 경기가 없습니다.</p>';
  $('#fixture-list').scrollTop=0;
}
$('#all').onclick = () => { $('#day-filter').value=''; $('#div-filter').value=$('#division').value; $('#team-filter').value='';buildFixtures();$('#schedule').showModal(); };
for (const id of ['#day-filter','#div-filter','#team-filter']) $(id).oninput=buildFixtures;
function matchDetail(event) {
  const target=event.target.closest('[data-id]');
  if (!target) return;
  const m=played.find(item => item.id===target.dataset.id);
  const s=allScores()[m.id], mv=mvpOf(m.id), gl=goalsOf(m.id);
  const rows=[['일정','2026.'+allDay(m.date)],['경기 시간',m.time],['부문',divisionNames[m.div]+' · '+m.rd],['장소','원곡중학교 · '+venueNames[m.court-1]+'구장']];
  if(s) rows.unshift(['결과',`${m.t1} ${s[0]} : ${s[1]} ${m.t2}`]);
  if(mv) rows.push(['MVP', mv.name + (mv.team ? ` (${mv.team})` : '')]);
  if(gl&&gl.length) rows.push(['득점', gl.map(g=>`${g.name||'-'} <small>${g.t===1?m.t1:m.t2}</small>`).join(' · ')]);
  $('#detail-body').innerHTML=`<h2>${m.t1} <em class="muted">VS</em> ${m.t2}</h2><dl>${rows.map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><p class="muted">현장 진행 상황에 따라 킥오프 시각이 달라질 수 있습니다.</p>`;
  $('#detail').showModal();
}
$('#cards').onclick=matchDetail;
$('#fixture-list').onclick=matchDetail;
for (const dialog of document.querySelectorAll('dialog')) {
  const x = dialog.querySelector('.close');
  if (x) x.onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{
    if(e.target!==dialog) return;
    const r=dialog.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dialog.close();
  });
}
/* 실제 배치 — A 왼쪽 위 · D 오른쪽 위 · B 왼쪽 아래 · C 오른쪽 아래 */
const COURTPOS = { A:'운동장 왼쪽 위', B:'운동장 왼쪽 아래', C:'운동장 오른쪽 아래', D:'운동장 오른쪽 위' };
const COURTUSE = { A:'남자부', B:'남자부', C:'여자부', D:'여자부' };
function chooseCourt(court) {
  document.querySelectorAll('[data-court]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.court===court));
  $('#court-detail').innerHTML=`<span class="court-id">COURT ${court}</span>${COURTPOS[court]} · ${COURTUSE[court]} 경기장`;
}
document.querySelectorAll('[data-court]').forEach(b=>b.onclick=()=>chooseCourt(b.dataset.court));
$('[data-venue]').onclick=()=>{location.hash='venue'};
/* ── 실시간 점수 · 순위 ──────────────────────────────────────────
   기록원이 /record 에서 저장한 결과를 /api/live 로 읽어 옵니다. 12초마다 새로 고칩니다. */
let LIVE = null, liveFail = 0;
let stDiv = '중등남';
let boardTab = 'rank';     /* rank | scorer | school */
let curSchool = null;
let schoolQ = '';
let scorerAll = false;

/* ── 몰수 처리 ────────────────────────────────────────────────
   몰수 경기는 치렀든 안 치렀든 전부 「몰수 팀 0 : 상대 1」로 고정합니다.
   그래야 기권한 팀과 이미 붙은 학교만 득을 보는 일이 없습니다.          */
const BYID = (() => { const o = {}; for (const m of matches) o[m.id] = m; return o; })();
const WOSCORE = (() => {
  const s = {};
  for (const id of Object.keys(FORFEIT)) {
    const m = BYID[id], lose = FORFEIT[id];
    if (m && lose) s[id] = (m.t1 === lose) ? [0,1] : [1,0];
  }
  return s;
})();
/* 몰수 점수가 기록원 입력보다 우선입니다 */
const allScores = () => Object.assign({}, (LIVE && LIVE.scores) || {}, WOSCORE);
/* 몰수 팀의 득점·MVP 는 집계에서 빼냅니다 */
const mvpOf = id => {
  const mv = (LIVE && LIVE.mvps && LIVE.mvps[id]) || null;
  return (mv && FORFEIT[id] && mv.team === FORFEIT[id]) ? null : mv;
};
const goalsOf = id => {
  const g = (LIVE && LIVE.goals && LIVE.goals[id]) || null;
  const lose = FORFEIT[id], m = BYID[id];
  if (!g || !lose || !m) return g;
  return g.filter(x => (x.t === 1 ? m.t1 : m.t2) !== lose);
};

async function pullLive() {
  try {
    const r = await fetch('/api/live?cb=' + Date.now(), { cache:'no-store' });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (!d || typeof d.scores !== 'object') throw new Error('shape');
    LIVE = d; liveFail = 0;
  } catch (e) { liveFail++; }
  showCards(); showRank();
}

function table(div) {
  const S = allScores(), T = {};
  for (const m of matches) {
    if (m.div !== div) continue;
    for (const t of [m.t1, m.t2]) T[t] = T[t] || { team:t, p:0, w:0, d:0, l:0, gf:0, ga:0 };
  }
  for (const m of matches) {
    const s = S[m.id];
    if (m.div !== div || !s) continue;
    const x = T[m.t1], y = T[m.t2];
    if (!x || !y) continue;
    const a = +s[0], b = +s[1];
    x.p++; y.p++; x.gf += a; x.ga += b; y.gf += b; y.ga += a;
    if (a > b) { x.w++; y.l++; } else if (a < b) { y.w++; x.l++; } else { x.d++; y.d++; }
  }
  const rows = Object.values(T).map(t => ({ ...t, pt: t.w*3 + t.d, gd: t.gf - t.ga }));

  /* 동점일 때는 그 팀들끼리 치른 경기만 따로 집계합니다 (승자승) */
  const h2h = group => {
    const names = new Set(group.map(t => t.team)), mini = {};
    for (const t of group) mini[t.team] = { pt:0, gd:0 };
    for (const m of matches) {
      const s = S[m.id];
      if (m.div !== div || !s || !names.has(m.t1) || !names.has(m.t2)) continue;
      const a = +s[0], b = +s[1];
      mini[m.t1].gd += a - b; mini[m.t2].gd += b - a;
      if (a > b) mini[m.t1].pt += 3; else if (a < b) mini[m.t2].pt += 3;
      else { mini[m.t1].pt++; mini[m.t2].pt++; }
    }
    return group.sort((p,q) =>
      mini[q.team].pt - mini[p.team].pt ||
      mini[q.team].gd - mini[p.team].gd ||
      q.gd - p.gd || q.gf - p.gf || p.team.localeCompare(q.team));
  };

  const byPt = {};
  for (const t of rows) (byPt[t.pt] = byPt[t.pt] || []).push(t);
  return Object.keys(byPt).map(Number).sort((a,b) => b - a)
    .flatMap(pt => byPt[pt].length > 1 ? h2h(byPt[pt]) : byPt[pt]);
}

/* ── 등번호로 선수 가려내기 ───────────────────────────────────
   기록원이 「7 김보미」「7」「7번 김보미」를 섞어 적어도 한 선수로 셉니다.
   같은 팀에서 그 번호로 한 번이라도 이름이 적혔으면 그 이름을 씁니다.      */
const PRE   = /^\s*(\d{1,2})\s*번?\s*/;
const pNo   = s => { const m = String(s||'').match(PRE); return m ? String(+m[1]) : null; };
const pRest = s => String(s||'').replace(PRE, '').replace(/^번\s*/, '').trim();
const tKey  = (div, team) => div + '|' + team;

function nameBook() {
  const bk = {};
  for (const m of matches) {
    const g = goalsOf(m.id);
    if (!g) continue;
    for (const x of g) {
      const no = pNo(x.name), nm = pRest(x.name);
      if (!no || !nm) continue;
      const k = tKey(m.div, x.t === 1 ? m.t1 : m.t2);
      bk[k] = bk[k] || {};
      if (!bk[k][no]) bk[k][no] = nm;
    }
  }
  return bk;
}
function who(bk, div, team, raw) {
  const no = pNo(raw), rest = pRest(raw), txt = String(raw||'').trim();
  if (!no) return { key: txt, label: txt };          /* 번호 없이 이름만 적은 경우 */
  const k = tKey(div, team);
  const nm = rest || (bk[k] && bk[k][no]) || '';
  return { key: no, label: nm ? `${no} ${nm}` : `${no}번` };
}

/* 득점왕 — 몰수 팀 선수는 goalsOf 단계에서 이미 빠집니다 */
function scorers(div) {
  const bk = nameBook(), map = new Map();
  for (const m of matches) {
    if (m.div !== div) continue;
    const g = goalsOf(m.id);
    if (!g) continue;
    for (const x of g) {
      if (!String(x.name || '').trim()) continue;
      const team = x.t === 1 ? m.t1 : m.t2;
      const w = who(bk, div, team, x.name);
      const k = team + '\u0000' + w.key;
      const cur = map.get(k) || { name: w.label, team, n: 0 };
      if (w.label.length > cur.name.length) cur.name = w.label;   /* 이름이 붙은 쪽을 보여줍니다 */
      cur.n++; map.set(k, cur);
    }
  }
  /* 시즌 중 등번호가 바뀐 선수는 번호가 달라 두 명으로 잡힙니다.
     같은 팀에서 이름이 같으면 한 사람으로 합치고, 번호는 떼고 이름만 보여줍니다. */
  const byName = new Map();
  for (const v of map.values()) {
    const bare = pRest(v.name);
    if (!bare) continue;
    const k = v.team + '\u0000' + bare;
    (byName.get(k) || byName.set(k, []).get(k)).push(v);
  }
  const merged = [];
  const eaten = new Set();
  for (const [k, group] of byName) {
    if (group.length < 2) continue;
    const bare = k.split('\u0000')[1];
    merged.push({ name: bare, team: group[0].team,
                  n: group.reduce((s,v) => s + v.n, 0) });
    group.forEach(v => eaten.add(v));
  }
  return [...[...map.values()].filter(v => !eaten.has(v)), ...merged]
    .sort((a,b) => b.n - a.n || a.team.localeCompare(b.team) || a.name.localeCompare(b.name));
}

/* 학교 → 그 학교가 가진 팀(부문) 목록 */
const SCHOOLS = (() => {
  const o = {};
  for (const m of matches) for (const t of [m.t1, m.t2]) (o[t] = o[t] || new Set()).add(m.div);
  return Object.keys(o).sort((a,b) => a.localeCompare(b))
    .map(name => ({ name, divs: [...o[name]].sort() }));
})();

const dkey = d => { const [m,x] = String(d).split('/').map(Number); return m*100 + x; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function rankView() {
  const rows = table(stDiv);
  return `<div class="rtw"><table class="sttab"><thead><tr><th>순위</th><th class="tm">팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득점</th><th>실점</th><th>득실</th><th>승점</th></tr></thead><tbody>` +
    rows.map((t,i) => {
      const rk = i + 1;
      return `<tr${t.p ? '' : ' class="none"'}><td>${rk}</td><th class="tm">${t.team}</th>
        <td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
        <td>${t.gf}</td><td>${t.ga}</td>
        <td class="gd">${t.gd>0?'+':''}${t.gd}</td><td><b>${t.pt}</b></td></tr>`;
    }).join('') + '</tbody></table></div>' +
    `<div class="rulebox"><b>승점</b> 승 3점 · 무승부 1점 · 패 0점
      <br><b>동점일 때</b> 승자승 → 골득실차 → 다득점 순으로 가립니다.
      <br><b>기권·몰수</b> 상대 팀 1 : 0 승리로 처리합니다.</div>`;
}

function scorerView() {
  const rows = scorers(stDiv);
  if (!rows.length) return '<p class="empty">아직 기록된 득점이 없습니다.</p>';
  const CAP = 20, show = scorerAll ? rows : rows.slice(0, CAP);
  const rank = [];
  rows.forEach((r,i) => rank[i] = (i && rows[i-1].n === r.n) ? '' : i+1);
  return `<table class="sttab sctab"><thead><tr><th>순위</th><th class="tm">선수</th><th class="tm">학교</th><th>골</th></tr></thead><tbody>` +
    show.map((r,i) =>
      `<tr${i===0?' class="top"':''}><td>${rank[i]}</td><th class="tm">${esc(r.name)}</th>
        <td class="tm sch">${esc(r.team)}</td><td><b>${r.n}</b></td></tr>`).join('') +
    '</tbody></table>' +
    (rows.length > CAP
      ? `<button class="moreb" id="smore">${scorerAll
          ? '접기' : `${rows.length - CAP}명 더 보기 (전체 ${rows.length}명)`}</button>`
      : '');
}

function schoolView() {
  if (curSchool) return schoolDetail(curSchool);
  const q = schoolQ.trim();
  const list = SCHOOLS.filter(s => !q || s.name.includes(q));
  return `<div class="schbar"><input id="sq" type="search" enterkeyhint="search" autocomplete="off"
      placeholder="학교 이름을 검색하세요" value="${esc(schoolQ)}"><em>${list.length}개교</em></div>` +
    (list.length
      ? `<div class="schgrid">${list.map(s =>
          `<button class="schcard" data-school="${esc(s.name)}"><b>${esc(s.name)}</b>
            <span>${s.divs.map(d => divisionNames[d]).join(' · ')}</span></button>`).join('')}</div>`
      : '<p class="empty">그런 이름의 학교가 없습니다.</p>');
}

function schoolDetail(name) {
  const S = allScores();
  const mine = SCHOOLS.find(s => s.name === name);
  if (!mine) return '<p class="empty">학교를 찾지 못했습니다.</p>';
  let out = `<button class="schback" id="sback">← 참가교 목록</button>
    <div class="schname">${esc(name)}</div>`;
  for (const div of mine.divs) {
    const rows = table(div), me = rows.find(r => r.team === name), rk = rows.indexOf(me) + 1;
    const ms = matches.filter(m => m.div === div && (m.t1 === name || m.t2 === name))
      .sort((a,b) => (a.date === b.date ? a.time.localeCompare(b.time) : dkey(a.date) - dkey(b.date)));
    out += `<div class="schdiv"><h4>${divisionNames[div]}</h4>
      <div class="schsum">
        <div><b>${me && me.p ? rk + '위' : '–'}</b><span>순위</span></div>
        <div><b>${me ? me.pt : 0}</b><span>승점</span></div>
        <div><b>${me ? `${me.w}승 ${me.d}무 ${me.l}패` : '–'}</b><span>전적</span></div>
        <div><b>${me ? (me.gd > 0 ? '+' : '') + me.gd : '–'}</b><span>골득실</span></div>
      </div>
      <ul class="schms">` +
      ms.map(m => {
        const s = S[m.id], home = m.t1 === name, opp = home ? m.t2 : m.t1;
        let res = '<i class="wait">예정</i>', sc = '';
        if (s) {
          const my = +s[home ? 0 : 1], th = +s[home ? 1 : 0];
          sc = `${my} : ${th}`;
          res = my > th ? '<i class="w">승</i>' : my < th ? '<i class="l">패</i>' : '<i class="d">무</i>';
        }
        return `<li${m.wo ? ' class="wo"' : ''}><span class="d"><b>${m.date}</b>${m.wo
            ? '<i>경기 없음</i>'
            : `<i>${m.time.slice(0,5)} · ${venueNames[m.court-1]}구장</i>`}</span>
          <span class="o">${esc(opp)}</span><span class="s">${sc}</span>${res}</li>`;
      }).join('') + '</ul></div>';
  }
  return out;
}

function showRank() {
  if (!$('#st-body') || !$('#st-tabs')) return;   /* index.html 이 아직 옛 버전이면 건너뜁니다 */
  const bt = $('#bd-tabs');
  if (bt) bt.innerHTML = [['rank','순위'],['scorer','득점왕'],['school','학교별']]
    .map(([k,n]) => `<button data-b="${k}" aria-pressed="${k===boardTab}">${n}</button>`).join('');
  $('#st-tabs').hidden = boardTab === 'school';
  $('#st-tabs').innerHTML = boardTab === 'school' ? '' : Object.entries(divisionNames)
    .map(([k,n]) => `<button data-sd="${k}" aria-pressed="${k===stDiv}">${n}</button>`).join('');
  $('#st-body').innerHTML =
    boardTab === 'scorer' ? scorerView() :
    boardTab === 'school' ? schoolView() : rankView();
  if (boardTab === 'school' && !curSchool) {
    const inp = $('#sq');
    if (inp) {
      let composing = false;
      inp.addEventListener('compositionstart', () => composing = true);
      inp.addEventListener('compositionend', () => { composing = false; schoolQ = inp.value; redrawSchools(); });
      inp.addEventListener('input', () => { if (!composing) { schoolQ = inp.value; redrawSchools(); } });
    }
  }
  const done = table(stDiv).reduce((n,t) => n + t.p, 0) / 2;
  if ($('#st-when')) $('#st-when').textContent = LIVE
    ? (boardTab === 'school' ? '기록 반영 중' : `${done}경기 반영 · 방금 갱신`)
    : (liveFail ? '기록 연결을 기다리는 중입니다' : '기록을 불러오는 중…');
}

/* 검색 중에는 입력칸을 다시 그리지 않습니다 (한글 입력이 끊기지 않게) */
function redrawSchools() {
  const q = schoolQ.trim(), list = SCHOOLS.filter(s => !q || s.name.includes(q));
  const g = $('.schgrid'), em = $('.schbar em'), body = $('#st-body');
  if (em) em.textContent = list.length + '개교';
  const html = list.length
    ? list.map(s => `<button class="schcard" data-school="${esc(s.name)}"><b>${esc(s.name)}</b>
        <span>${s.divs.map(d => divisionNames[d]).join(' · ')}</span></button>`).join('')
    : '';
  if (g) { g.innerHTML = html; g.hidden = !list.length; }
  const old = body.querySelector('.empty');
  if (!list.length && !old) body.insertAdjacentHTML('beforeend', '<p class="empty">그런 이름의 학교가 없습니다.</p>');
  if (list.length && old) old.remove();
}

if ($('#bd-tabs')) $('#bd-tabs').onclick = e => {
  const b = e.target.closest('[data-b]'); if (!b) return;
  boardTab = b.dataset.b; curSchool = null; scorerAll = false; showRank();
};
if ($('#st-tabs')) $('#st-tabs').onclick = e => {
  const b = e.target.closest('[data-sd]'); if (!b) return;
  stDiv = b.dataset.sd; scorerAll = false; showRank();
};
if ($('#st-body')) $('#st-body').onclick = e => {
  const c = e.target.closest('[data-school]');
  if (c) { curSchool = c.dataset.school; showRank(); $('#standings').scrollIntoView({behavior:'smooth',block:'start'}); return; }
  if (e.target.closest('#sback')) { curSchool = null; showRank(); return; }
  if (e.target.closest('#smore')) { scorerAll = !scorerAll; showRank(); }
};

showDayInfo();
showCards();
showRank();
chooseCourt('A');
pullLive();
setInterval(pullLive, 12000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) pullLive(); });

/* ── 풋살화 빌리기 ─────────────────────────────────────────
   본부에 신청만 보냅니다. 다른 사람의 신청 내용은 읽어오지 않습니다. */
(function shoe() {
  const dlg = $('#shoeDlg'), btn = $('#shoeBtn');
  if (!dlg || !btn) return;
  const teams = [...new Set(matches.flatMap(m => [m.t1, m.t2]))].sort((a,b) => a.localeCompare(b));
  const DOW = {}; for (const m of matches) DOW[m.date] = m.dow;
  const days  = [...new Set(matches.map(m => m.date))]
    .sort((a,b) => dkey(a) - dkey(b)).filter(d => dkey(d) >= dkey(todayKey()));
  const fill = (sel, arr, val) => {
    sel.innerHTML = arr.map(([v,t]) => `<option value="${v}">${t}</option>`).join('');
    if (val) sel.value = val;
  };
  btn.onclick = () => {
    fill($('#sSchool'), teams.map(t => [t,t]));
    fill($('#sSize'), Array.from({length:13}, (_,i) => { const n = 230 + i*5; return [n, n]; }), 250);
    const ds = (days.length ? days : [...new Set(matches.map(m => m.date))].sort((a,b)=>dkey(a)-dkey(b)));
    fill($('#sDate'), ds.map(d => [d, d + ' (' + (DOW[d] || '') + ')']));
    $('#sAgree').checked = false; $('#sErr').hidden = true;
    $('#sName').value = ''; $('#sClass').value = '';
    dlg.showModal();
  };
  $('#sSubmit').onclick = async e => {
    e.preventDefault();
    const name = $('#sName').value.trim(), err = $('#sErr');
    const fail = msg => { err.textContent = msg; err.hidden = false; };
    if (!name) return fail('이름을 적어 주세요.');
    if (!$('#sAgree').checked) return fail('반납 확인에 체크해 주세요.');
    const payload = { type:'shoe', request:true, id:'S' + Date.now().toString(36),
      value: { school:$('#sSchool').value, name, klass:$('#sClass').value.trim(),
               size:Number($('#sSize').value), date:$('#sDate').value,
               status:'신청', at:new Date().toISOString() } };
    $('#sSubmit').disabled = true;
    try {
      const r = await fetch('/api/data', { method:'POST',
        headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const j = await r.json();
      if (!j || !j.ok) throw new Error();
      dlg.close(); alert('신청했습니다. 경기 전에 본부에서 받아 가세요.');
    } catch (_) {
      fail('신청이 저장되지 않았습니다. 잠시 뒤 다시 눌러 주세요.');
    } finally { $('#sSubmit').disabled = false; }
  };
})();
