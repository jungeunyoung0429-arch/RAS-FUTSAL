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
const FORFEIT = {"M025": "고잔고", "M026": "신길고", "M030": "신길고", "M035": "신길고", "M085": "신길고", "M091": "고잔고", "M095": "신길고", "M103": "신길고", "M112": "신길고", "M126": "고잔고", "M132": "신길고", "M139": "신길고", "M145": "신길고"};
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
  dialog.querySelector('.close').onclick=()=>dialog.close();
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

/* 몰수 경기는 기록원이 입력하지 않으므로 여기서 1:0 으로 채웁니다 */
const WOSCORE = (() => {
  const s = {};
  for (const m of woMatches) {
    const lose = FORFEIT[m.id];
    if (lose) s[m.id] = (m.t1 === lose) ? [0,1] : [1,0];
  }
  return s;
})();
/* 신길고·고잔고 몰수는 치른 경기(11/6 M030·M112·M132)까지 1:0 으로 — 라이브 센터(live.js normalize)와 같은 계산 */
const allScores = () => {
  const s = Object.assign({}, WOSCORE, (LIVE && LIVE.scores) || {});
  for (const [id, lose] of Object.entries(FORFEIT)) {
    const m = matches.find(x => x.id === id); if (!m) continue;
    const side = m.t1 === lose ? 0 : 1, p = (s[id] || [0,0]).slice();
    p[side] = 0; p[1-side] = Math.max(+p[1-side], 1); s[id] = p;
  }
  return s;
};
const mvpOf = id => (LIVE && LIVE.mvps && LIVE.mvps[id]) || null;
const goalsOf = id => (LIVE && LIVE.goals && LIVE.goals[id]) || null;

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
  return Object.values(T)
    .map(t => ({ ...t, pt: t.w*3 + t.d, gd: t.gf - t.ga }))
    .sort((p,q) => q.pt-p.pt || q.gd-p.gd || q.gf-p.gf || p.team.localeCompare(q.team));
}

function showRank() {
  if (!$('#st-body') || !$('#st-tabs')) return;   /* index.html 이 아직 옛 버전이면 건너뜁니다 */
  $('#st-tabs').innerHTML = Object.entries(divisionNames)
    .map(([k,n]) => `<button data-sd="${k}" aria-pressed="${k===stDiv}">${n}</button>`).join('');
  const rows = table(stDiv), done = rows.reduce((n,t) => n + t.p, 0) / 2;
  $('#st-body').innerHTML =
    `<table class="sttab"><thead><tr><th>순위</th><th class="tm">팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr></thead><tbody>` +
    rows.map((t,i) => {
      const rk = (i && rows[i-1].pt===t.pt && rows[i-1].gd===t.gd && rows[i-1].gf===t.gf) ? '' : i+1;
      return `<tr${t.p ? '' : ' class="none"'}><td>${rk}</td><th class="tm">${t.team}</th>
        <td>${t.p}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
        <td>${t.gd>0?'+':''}${t.gd}</td><td><b>${t.pt}</b></td></tr>`;
    }).join('') + '</tbody></table>';
  if ($('#st-when')) $('#st-when').textContent = LIVE
    ? `${done}경기 반영 · 방금 갱신`
    : (liveFail ? '기록 연결을 기다리는 중입니다' : '기록을 불러오는 중…');
}
if ($('#st-tabs')) $('#st-tabs').onclick = e => {
  const b = e.target.closest('[data-sd]'); if (!b) return;
  stDiv = b.dataset.sd; showRank();
};

showDayInfo();
showCards();
showRank();
chooseCourt('A');
pullLive();
setInterval(pullLive, 12000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) pullLive(); });
