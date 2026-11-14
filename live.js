const filePreview = location.protocol === 'file:';
const $ = s => document.querySelector(s);
const escapeText = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const divNames = {중등남:'중등부 남', 중등여:'중등부 여', 고등남:'고등부 남', 고등여:'고등부 여'};
const courts = ['','A','B','C','D'];
const koreanTime = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function now(){
  const p=Object.fromEntries(koreanTime.formatToParts(new Date()).map(part=>[part.type,part.value]));
  return {day:Number(p.month)+'/'+Number(p.day),year:Number(p.year),minutes:Number(p.hour)*60+Number(p.minute),time:p.hour+':'+p.minute};
}
const numericDate=d=>{const [m,n]=d.split('/').map(Number);return m*100+n};
const minutes=t=>{const [h,m]=t.split(':').map(Number);return h*60+m};
const kickoff=m=>m.time.split('~')[0];
const days=[...new Set(matches.map(m=>m.date))].sort((a,b)=>numericDate(a)-numericDate(b));
const weekday=Object.fromEntries(matches.map(m=>[m.date,m.dow]));
const dateLabel=d=>d.replace('/','.')+' ('+weekday[d]+')';
function nearestDay(t){
  if(t.year>2026)return days.at(-1);
  if(t.year<2026)return days[0];
  return days.find(d=>numericDate(d)>=numericDate(t.day))||days.at(-1);
}
let day=nearestDay(now()), pinned=false, division='중등남', openCourt=0, data=null, loading=false, stale=false;
const forfeit={'M025':'고잔고','M026':'신길고','M030':'신길고','M035':'신길고','M085':'신길고','M091':'고잔고','M095':'신길고','M103':'신길고','M112':'신길고','M126':'고잔고','M132':'신길고','M139':'신길고','M145':'신길고'};
function normalize(record){
  for(const m of matches){
    if(!forfeit[m.id])continue;
    const side=m.t1===forfeit[m.id]?0:1;
    const pair=record.scores[m.id]||[0,0];
    pair[side]=0; pair[1-side]=Math.max(pair[1-side],1);record.scores[m.id]=pair;
    record.goals[m.id]=(record.goals[m.id]||[]).filter(g=>g.t!==side+1);
  }
  return record;
}
/* 오늘 경기는 시간표보다 실제 진행(입력된 결과)을 따른다 — 현장이 밀리거나 당겨져도 보드가 맞게 보인다.
   구장의 「마지막으로 결과가 들어온 경기」 바로 다음 경기가 지금 경기, 그 뒤는 경기 전, 그 앞인데 결과가 없으면 결과 대기. */
function progress(m){
  const list=matches.filter(x=>x.date===m.date&&x.court===m.court&&!x.wo).sort((a,b)=>minutes(kickoff(a))-minutes(kickoff(b)));
  let last=-1;list.forEach((x,i)=>{if(data.scores[x.id])last=i});
  return {i:list.findIndex(x=>x.id===m.id),last};
}
function state(m,t){
  const diff=t.year===2026?numericDate(m.date)-numericDate(t.day):2026-t.year;
  const [start,end]=m.time.split('~').map(minutes);
  if(data?.scores[m.id])return ['done','결과'];
  if(!diff&&data){
    const {i,last}=progress(m);
    if(i<last)return ['pending','결과 대기'];
    if(i===last+1&&(last>=0||t.minutes>=start-20))return ['active','진행 중'];
    return ['soon','경기 전'];
  }
  if(!diff&&t.minutes>=start&&t.minutes<end)return ['active','경기 시간'];
  if(diff<0||(!diff&&t.minutes>=end))return ['pending',data?'결과 대기':filePreview?'결과 미연결':'기록 확인 중'];
  return ['soon','경기 전'];
}
const dayMatches=()=>matches.filter(m=>m.date===day&&!m.wo).sort((a,b)=>minutes(kickoff(a))-minutes(kickoff(b))||a.court-b.court);
function featured(list,t){
  const ongoing=list.find(m=>state(m,t)[0]==='active');
  if(ongoing)return ongoing;
  const upcoming=list.find(m=>state(m,t)[0]==='soon');
  if(upcoming)return upcoming;
  return [...list].reverse().find(m=>data?.scores[m.id])||list.at(-1);
}
function score(m){
  const pair=data?.scores[m.id];
  if(pair)return pair[0]+' <i>:</i> '+pair[1];
  return state(m,now())[0]==='soon'?'<i>VS</i>':'<i>– : –</i>';
}
function streamFor(m){
  const list=(data?.streams[m.date]||[]).filter(s=>minutes(s.time)<=minutes(kickoff(m)));
  return list.sort((a,b)=>minutes(b.time)-minutes(a.time))[0];
}
function replay(m){
  if(!data?.scores[m.id])return '';
  const video=streamFor(m);
  return video?' <a class="replay" target="_blank" rel="noopener" href="https://youtu.be/'+video.id+'?t='+Math.max(0,(minutes(kickoff(m))-minutes(video.time))*60-15)+'">경기 다시보기 ↗</a>':'';
}
/* 구장별 유튜브 버튼: 구장 라이브 주소(record.html 입력) → 없으면 그날 전체 중계 → 없으면 중계일에만 「준비 중」 */
const broadcastDays=['11/14','11/21'];
function courtLive(court,m,t){
  const own=data?.courts?.[day]?.[court];
  const past=t.year>2026||(t.year===2026&&numericDate(day)<numericDate(t.day));
  if(own){
    const href=own.id?'https://youtu.be/'+own.id:own.url;
    return '<a class="yt" href="'+escapeText(href)+'" target="_blank" rel="noopener" aria-label="'+courts[court]+'구장 유튜브 '+(past?'중계 영상':'라이브')+' (새 창)"><i aria-hidden="true"></i>'+(past?'중계 영상':'유튜브 라이브')+' ↗</a>';
  }
  const all=streamFor(m)||(data?.streams[day]||[])[0];
  if(all)return '<a class="yt" href="https://youtu.be/'+all.id+'" target="_blank" rel="noopener" aria-label="운동장 전체 유튜브 중계 (새 창)"><i aria-hidden="true"></i>'+(past?'중계 영상':'유튜브 중계')+' ↗</a>';
  if(broadcastDays.includes(day)&&!past)return '<span class="yt off" title="중계 주소가 등록되면 버튼이 열립니다"><i aria-hidden="true"></i>중계 준비 중</span>';
  return '';
}
function board(court,list,t){
  const m=featured(list,t),[kind,status]=state(m,t);
  const next=list[list.indexOf(m)+1];
  return `<article class="board ${kind}"><div class="board-head"><span class="court-mark">${courts[court]}</span><strong>COURT ${courts[court]}</strong><span class="state">${status}</span></div>
    <div class="arena"><small>${m.time.replace('~',' – ')} &nbsp; / &nbsp; ${divNames[m.div]} · ${m.rd}</small><div class="duel"><b>${m.t1}</b><strong>${score(m)}</strong><b>${m.t2}</b></div></div>
    <div class="board-foot"><span>${next?'<small>다음</small> '+kickoff(next)+' &nbsp; '+next.t1+' · '+next.t2:'당일 마지막 경기'}</span><div class="foot-act">${courtLive(court,m,t)}<button data-open="${court}" aria-label="${courts[court]}구장 전체 경기">전체 경기 ↗</button></div></div></article>`;
}
function showCourt(court){
  openCourt=court;
  const list=dayMatches().filter(m=>m.court===court);
  $('#court-title').textContent=courts[court]+'구장 경기 기록';
  $('#list-summary').textContent=dateLabel(day)+' · '+list.length+'경기';
  const t=now();
  const html=list.map(m=>{
    const goals=(data?.goals[m.id]||[]).map(g=>escapeText(g.name||'득점자 미기록')+' ('+(g.t===1?m.t1:m.t2)+')'+(g.min?' '+escapeText(g.min)+'′':'')).join(' · ');
    return `<article class="game-row"><div class="game-meta">${m.time} · ${divNames[m.div]} · ${m.rd}<span>${state(m,t)[1]}</span></div><div class="game-pair"><b>${m.t1}</b><strong>${score(m)}</strong><b>${m.t2}</b></div>${goals?'<p>득점 &nbsp; '+goals+'</p>':''}${replay(m)}</article>`;
  }).join('');
  if($('#court-games').innerHTML!==html)$('#court-games').innerHTML=html;
  if(!$('#court-dialog').open)$('#court-dialog').showModal();
}
function showStream(t){
  const wrap=$('#stream-wrap'),slots=data?.streams[day]||[];
  if(!slots.length){wrap.hidden=true;wrap.replaceChildren();delete wrap.dataset.key;return}
  let selected=slots[0];
  if(day===t.day&&t.year===2026)for(const slot of slots)if(t.minutes>=minutes(slot.time)-20)selected=slot;
  if(wrap.dataset.key===day+selected.id)return;
  wrap.hidden=false;wrap.dataset.key=day+selected.id;
  wrap.innerHTML=`<div class="section-label"><i></i> MATCH BROADCAST</div><div class="section-head"><h2>경기 중계<span>.</span></h2><a href="https://youtu.be/${selected.id}" target="_blank" rel="noopener" class="text-btn">유튜브에서 보기 ↗</a></div><iframe title="선택한 경기일 중계" src="https://www.youtube-nocookie.com/embed/${selected.id}" allowfullscreen></iframe>`;
}
const PNAMES = {
  "중등남|원곡중": { "6":"이준", "7":"이담", "10":"진승연", "17":"윤하율" },
  "중등남|본오중": { "5":"MUCO CHRIST RABY", "6":"김지현", "7":"전유담", "8":"정민준" },
  "중등남|선부중": { "19":"윤성림" },
  "중등남|중앙중": { "8":"공선우", "21":"이윤기", "99":"문주원" },
  "중등남|해솔중": { "4":"김민규", "8":"김진우", "11":"박주원" },
  "중등여|이호중": { "7":"김보미", "8":"남지우", "15":"윤설" },
  "중등여|별망중": { "6":"전하은", "10":"최단" },
  "중등여|해솔중": { "2":"주소율", "6":"황채윤", "7":"김다율", "12":"김보민" },
  "중등여|본오중": { "4":"김지윤" },
  "중등여|선일중": { "9":"아리아나" },
  "중등여|부곡중": { "5":"손민서" },
  "중등여|원곡중": { "7":"한채윤", "12":"김나연" }
};
/* 「8」 「8번」 「8. 공선우」 「해솔 12번 김보민」 모두 같은 형식으로 읽습니다 */
const PRE = /^\s*\D{0,6}?(\d{1,3})\s*번?\s*[.·,]?\s*/;
const pNo   = s => { const m = String(s||"").match(PRE); return m ? m[1] : null; };
const pRest = s => String(s||"").replace(PRE, "").replace(/^번\s*/, "").trim();
const tKey  = (div, team) => div + "|" + team;

/* 모든 기록을 훑어 부문·팀·등번호별 이름 사전을 만듭니다 */
function nameBook(){
  const bk = {};
  const put = (k, no, nm) => {
    if(!k || !no || !nm) return;
    bk[k] = bk[k] || {};
    if(!bk[k][no]) bk[k][no] = nm;
  };
  Object.entries(PNAMES).forEach(([k, o]) => Object.entries(o).forEach(([n, v]) => put(k, n, v)));
  matches.forEach(m => {
    const goals = data?.goals[m.id]; if(!goals) return;
    goals.forEach(g => {
      const team = g.t === 1 ? m.t1 : m.t2;
      put(tKey(m.div, team), pNo(g.name), pRest(g.name));
    });
  });
  return bk;
}
/* 저장된 문자열 → { key, label }
   확정 명단(PNAMES)에 그 등번호가 있으면 저장된 이름보다 명단을 우선합니다.
   기록 중 다른 부문 선수를 잘못 눌러도 화면에는 올바른 이름이 나옵니다. */
function who(bk, div, team, raw){
  const no = pNo(raw), rest = pRest(raw);
  if(!no) return { key: String(raw||"").trim(), label: String(raw||"").trim() };
  const k = tKey(div, team);
  const fixed = PNAMES[k] && PNAMES[k][no];
  const nm = fixed || rest || (bk[k] && bk[k][no]) || "";
  return { key: no, label: nm ? `${no} ${nm}` : `${no}번` };
}

function scorerTable(){
  const bk = nameBook(), t = {};
  matches.forEach(m => {
    (data?.goals[m.id] || []).forEach(g => {
      if(!String(g.name || "").trim()) return;
      const team = g.t === 1 ? m.t1 : m.t2;
      const w = who(bk, m.div, team, g.name);
      const k = m.div + "|" + team + "|" + w.key;
      t[k] = t[k] || { div:m.div, team, name:w.label, n:0 };
      t[k].n++;
    });
  });
  const rows = Object.values(t);
  rows.sort((a, b) => b.n - a.n || a.team.localeCompare(b.team, "ko") || a.name.localeCompare(b.name, "ko"));
  return rows;
}

function showRanks(){
  const rows=scorerTable().filter(r=>r.div===division).slice(0,12);
  const target=$('#ranking');
  if(!rows.length){
    target.innerHTML='<p class="rank-empty">'+(data?'이 부문에는 등록된 득점 기록이 없습니다.':stale?'득점 기록 연결을 기다리는 중입니다.':filePreview?'실시간 모드에서 부문별 득점 순위를 확인할 수 있습니다.':'득점 기록을 불러오는 중입니다.')+'</p>';
    return;
  }
  let rank=0;
  const body=rows.map((r,i)=>{
    if(!i||rows[i-1].n!==r.n)rank=i+1;
    return '<tr><td>'+String(rank).padStart(2,'0')+'</td><th scope="row">'+escapeText(r.name)+'</th><td>'+escapeText(r.team)+'</td><td><b>'+r.n+'</b></td></tr>';
  }).join('');
  target.innerHTML='<table><thead><tr><th>순위</th><th>선수</th><th>학교</th><th>득점</th></tr></thead><tbody>'+body+'</tbody></table>';
}
/* 리그 순위: 기존 사이트와 같은 계산 — 승 3 · 무 1 · 패 0, 승점 → 골득실 → 다득점 → 이름 순 */
let stdDiv='중등남';
const teamsIn=div=>[...new Set(matches.filter(m=>m.div===div).flatMap(m=>[m.t1,m.t2]))];
function leagueTable(div){
  const rows=teamsIn(div).map(t=>({t,gp:0,w:0,d:0,l:0,gf:0,ga:0,pt:0}));
  const ix=Object.fromEntries(rows.map(r=>[r.t,r]));
  matches.filter(m=>m.div===div&&data?.scores[m.id]).forEach(m=>{
    const [a,b]=data.scores[m.id],x=ix[m.t1],y=ix[m.t2];if(!x||!y)return;
    x.gp++;y.gp++;x.gf+=a;x.ga+=b;y.gf+=b;y.ga+=a;
    if(a>b){x.w++;y.l++;x.pt+=3}else if(b>a){y.w++;x.l++;y.pt+=3}else{x.d++;y.d++;x.pt++;y.pt++}
  });
  rows.sort((x,y)=>y.pt-x.pt||(y.gf-y.ga)-(x.gf-x.ga)||y.gf-x.gf||x.t.localeCompare(y.t));
  return rows;
}
function recentForm(div,team){
  return matches.filter(m=>m.div===div&&data?.scores[m.id]&&(m.t1===team||m.t2===team))
    .sort((a,b)=>numericDate(a.date)-numericDate(b.date)||a.slot-b.slot).slice(-5)
    .map(m=>{const s=data.scores[m.id],me=m.t1===team?s[0]:s[1],yo=m.t1===team?s[1]:s[0];return me>yo?'W':me<yo?'L':'D'});
}
function showStandings(){
  const rows=leagueTable(stdDiv),played=rows.reduce((n,r)=>n+r.gp,0)/2;
  const mark={W:'승',D:'무',L:'패'};
  const body=rows.map((r,i)=>{
    const gd=r.gf-r.ga,f=recentForm(stdDiv,r.t);
    return '<tr'+(i<4?' class="top"':'')+'><td class="c-rk">'+(i+1)+'</td><th scope="row" class="c-tm">'+escapeText(r.t)+'</th><td>'+r.gp+'</td><td>'+r.w+'</td><td>'+r.d+'</td><td>'+r.l+'</td><td class="c-gf">'+r.gf+'</td><td class="c-ga">'+r.ga+'</td><td>'+(gd>0?'+':'')+gd+'</td><td class="c-pt">'+r.pt+'</td><td class="c-fm">'+(f.map(x=>'<i class="f'+x+'" title="'+mark[x]+'">'+mark[x]+'</i>').join('')||'<span>–</span>')+'</td></tr>';
  }).join('');
  const html='<table><caption class="sr">'+divNames[stdDiv]+' 리그 순위</caption><thead><tr><th class="c-rk">순위</th><th class="c-tm">팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th class="c-gf">득점</th><th class="c-ga">실점</th><th>득실</th><th class="c-pt">승점</th><th class="c-fm">최근 5경기</th></tr></thead><tbody>'+body+'</tbody></table>';
  if($('#standing').innerHTML!==html)$('#standing').innerHTML=html;
  $('#std-note').textContent=data?divNames[stdDiv]+' '+rows.length+'팀 · 결과 입력 '+played+'경기 기준':stale?'기록 연결을 기다리는 중입니다. 연결되면 순위가 채워집니다.':filePreview?'실시간 모드에서 기록이 반영된 순위를 확인할 수 있습니다.':'기록을 불러오는 중입니다.';
}
function tick(){
  const t=now();
  $('#clock').textContent=t.time;
  $('#clock-date').textContent=t.year+'.'+t.day.replace('/','.');
}
function render(){
  const t=now();
  if(!pinned)day=nearestDay(t);
  const list=dayMatches(),activeCourts=[...new Set(list.map(m=>m.court))].sort();
  document.querySelectorAll('[data-day]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.day===day));
  const hasResult=list.filter(m=>data?.scores[m.id]).length;
  const goalsRecorded=list.reduce((sum,m)=>sum+(data?.goals[m.id]?.length||0),0);
  $('#summary').textContent=dateLabel(day)+' · '+activeCourts.length+'개 구장 · '+list.length+'경기';
  const html=activeCourts.map(c=>board(c,list.filter(m=>m.court===c),t)).join('');
  if($('#scoreboards').innerHTML!==html){
    const focusCourt=document.activeElement?.dataset.open;
    $('#scoreboards').innerHTML=html;
    if(focusCourt)$('#scoreboards').querySelector('[data-open="'+focusCourt+'"]')?.focus({preventScroll:true});
  }
  $('#sync').textContent=filePreview?'오프라인 미리보기':stale?'기록 연결 지연':data?'기록 연결 · 12초마다 갱신':'경기 기록 연결 중';
  $('#lamp').className=stale?'delay':data?'linked':'';
  $('#update-note').textContent=data?
    '결과 입력 '+hasResult+' / '+list.length+'경기 · 기록된 득점 '+goalsRecorded+'골 · 마지막 확인 '+koreanTime.formatToParts(new Date(data.updated)).filter(x=>['hour','minute'].includes(x.type)).map(x=>x.value).join(':')+' KST'+(stale?' · 최근 수신한 기록을 표시합니다.':''):
    filePreview?'시안용 대진표입니다. 실시간 점수는 동봉한 전달 안내에 따라 확인할 수 있습니다.':stale?'기록을 불러오는 동안 대진표를 표시합니다. 잠시 후 자동으로 다시 연결합니다.':'대진표를 표시하고 있습니다.';
  showStream(t);showStandings();showRanks();
  if($('#court-dialog').open)showCourt(openCourt);
}
async function refresh(){
  if(filePreview||loading||document.hidden)return;
  loading=true;
  try{
    const r=await fetch('/api/live',{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!r.ok)throw Error('records');
    data=normalize(await r.json());stale=false;
  }catch{stale=true}finally{loading=false;render()}
}
$('#day-tabs').innerHTML=days.map(d=>'<button data-day="'+d+'">'+dateLabel(d)+'</button>').join('');
$('#day-tabs').onclick=e=>{if(e.target.dataset.day){day=e.target.dataset.day;pinned=true;render()}};
$('#rank-tabs').innerHTML=Object.entries(divNames).map(([k,n])=>'<button data-div="'+k+'" aria-pressed="'+(division===k)+'">'+n+'</button>').join('');
$('#rank-tabs').onclick=e=>{if(!e.target.dataset.div)return;division=e.target.dataset.div;document.querySelectorAll('[data-div]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.div===division));showRanks()};
$('#std-tabs').innerHTML=Object.entries(divNames).map(([k,n])=>'<button data-std="'+k+'" aria-pressed="'+(stdDiv===k)+'">'+n+' <small>'+teamsIn(k).length+'팀</small></button>').join('');
$('#std-tabs').onclick=e=>{const b=e.target.closest('[data-std]');if(!b)return;stdDiv=b.dataset.std;document.querySelectorAll('[data-std]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.std===stdDiv));showStandings()};
$('#scoreboards').onclick=e=>{const b=e.target.closest('[data-open]');if(b)showCourt(Number(b.dataset.open))};
$('#court-dialog .close').onclick=()=>$('#court-dialog').close();
document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();refresh()}});
tick();render();refresh();setInterval(tick,1000);setInterval(refresh,12000);
