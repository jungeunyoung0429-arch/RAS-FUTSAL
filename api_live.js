import { Redis } from "@upstash/redis";

// 라이브 센터(/live)가 12초마다 읽는 공개용 기록.
// api/data.js 와 같은 Redis 키를 읽고, 점수·득점·중계 정보만 내보낸다(이름표·심판·설문 등은 내보내지 않음).
const KEY = "ras2026";

export function shape(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const rawScores = src.scores || {};
  const rawLogs = src.logs || {};
  // 기권(몰수) 경기 보정은 live.js 의 forfeit 표에서 한다.

  const scores = {}, goals = {}, streams = {}, courts = {}, mvps = {};
  for (const [id, pair] of Object.entries(rawScores)) {
    if (/^M\d+$/.test(id) && Array.isArray(pair) && pair.length === 2 &&
        pair.every(n => n !== null && n !== "" && Number.isInteger(Number(n)) && Number(n) >= 0)) {
      scores[id] = pair.map(Number);
    }
  }
  for (const [id, log] of Object.entries(rawLogs)) {
    if (!/^M\d+$/.test(id)) continue;
    if (Array.isArray(log?.goals)) {
      goals[id] = log.goals
        .filter(g => g && (g.t === 1 || g.t === 2))
        .map(g => ({ t: g.t, name: String(g.name ?? "").slice(0, 80), min: String(g.min ?? "").slice(0, 9) }));
    }
    // MVP — 이름과 소속 팀만 내보낸다
    const mv = log && log.mvp;
    if (mv && typeof mv === "object") {
      const name = String(mv.name ?? "").trim().slice(0, 40);
      const team = String(mv.team ?? "").trim().slice(0, 30);
      if (name) mvps[id] = { name, team };
    }
  }
  for (const [key, val] of Object.entries(src.days || {})) {
    if (!/^\d{1,2}\/\d{1,2}\|_live$/.test(key) || !val) continue;
    const slots = [];
    for (const i of [1, 2]) {
      const id = val["v" + i], time = val["t" + i];
      if (typeof id === "string" && /^[\w-]{11}$/.test(id)) {
        slots.push({ id, time: /^\d{1,2}:\d{2}$/.test(time) ? time : "00:00" });
      }
    }
    if (slots.length) streams[key.split("|")[0]] = slots;
  }
  // 구장별 라이브: days["11/14|_live_c1"] = { v: 영상ID } 또는 { u: 채널 라이브 주소 } (record.html 에서 입력)
  for (const [key, val] of Object.entries(src.days || {})) {
    const m = key.match(/^(\d{1,2}\/\d{1,2})\|_live_c([1-4])$/);
    if (!m || !val) continue;
    let link = null;
    if (typeof val.v === "string" && /^[\w-]{11}$/.test(val.v)) link = { id: val.v };
    else if (typeof val.u === "string" && /^https:\/\/(www\.)?youtube\.com\/(@[^\/\s?#"<>]{1,100}|channel\/[\w-]{1,40})\/live$/.test(val.u)) link = { url: val.u };
    if (link) (courts[m[1]] ||= {})[m[2]] = link;
  }
  return { scores, goals, mvps, streams, courts, updated: new Date().toISOString() };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).end();
  }
  try {
    const raw = await Redis.fromEnv().get(KEY);
    return res.status(200).json(shape(raw || {}));
  } catch (e) {
    return res.status(503).json({ error: "경기 기록 연결 지연" });
  }
}
