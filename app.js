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
function showCards() {
  const list = sortedMatches.filter(m => m.date === activeDay && (!$('#division').value || m.div === $('#division').value));
  document.querySelectorAll('[data-day]').forEach(b => b.setAttribute('aria-pressed', b.dataset.day === activeDay));
  const start = page * groupSize;
  $('#cards').innerHTML = list.slice(start,start+groupSize).map(m => `<button class="match-card" data-id="${m.id}"><span class="card-top"><span>COURT ${venueNames[m.court-1]} &nbsp; / &nbsp; ${m.rd}</span><span class="division">${divisionNames[m.div]}</span></span><span class="pair"><span>${m.t1}</span><i>VS</i><span>${m.t2}</span></span><span class="card-foot"><span><b>${kick(m)}</b> &nbsp; 킥오프</span><span>경기 정보 ↗</span></span></button>`).join('');
  $('#page-status').textContent = `${start+1}–${Math.min(list.length,start+groupSize)} / ${list.length} 경기`;
  $('#prev').disabled = page===0;
  $('#next').disabled = start+groupSize>=list.length;
}
$('#prev').onclick = () => {page--;showCards()};
$('#next').onclick = () => {page++;showCards()};
$('#division').onchange = () => {page=0;showCards()};
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
  $('#detail-body').innerHTML=`<h2>${m.t1} <em class="muted">VS</em> ${m.t2}</h2><dl>${[['일정','2026.'+allDay(m.date)],['경기 시간',m.time],['부문',divisionNames[m.div]+' · '+m.rd],['장소','원곡중학교 · '+venueNames[m.court-1]+'구장']].map(([k,v])=>`<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><p class="muted">현장 진행 상황에 따라 킥오프 시각이 달라질 수 있습니다.</p>`;
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
function chooseCourt(court) {
  const index=venueNames.indexOf(court);
  document.querySelectorAll('[data-court]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.court===court));
  $('#court-detail').innerHTML=`<span class="court-id">COURT ${court}</span>${index+1}구장 · 본부 ${['왼쪽 위','오른쪽 위','왼쪽 아래','오른쪽 아래'][index]}`;
}
document.querySelectorAll('[data-court]').forEach(b=>b.onclick=()=>chooseCourt(b.dataset.court));
$('[data-venue]').onclick=()=>{location.hash='venue'};
showDayInfo();
showCards();
chooseCourt('A');
