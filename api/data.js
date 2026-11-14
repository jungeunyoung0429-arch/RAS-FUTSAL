import { Redis } from "@upstash/redis";

// 원문(JSON 문자열)을 그대로 주고받는다 — 저장할 때 「읽은 그대로인지」 비교하기 위해.
const redis = Redis.fromEnv({ automaticDeserialization: false });
const KEY = "ras2026";

// 4구장 기록·투표·심판 신청이 동시에 들어와도 서로 덮어쓰지 않도록,
// 읽은 원문이 그대로일 때만 저장한다(바뀌었으면 다시 읽고 다시 고친다).
const CAS = `local cur = redis.call('GET', KEYS[1])
if (cur or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;

export const TOKENS = {
  "2026": 0,
};
const LABEL = { 0: "본부 · 전체 구장", 1: "A구장", 2: "B구장", 3: "C구장", 4: "D구장" };

function shape(d) {
  if (!d) return { scores: {}, logs: {}, shoes: {}, refs: {}, days: {} };
  return {
    scores: d.scores || {}, logs: d.logs || {}, shoes: d.shoes || {},
    refs: d.refs || {}, days: d.days || {}
  };
}

async function readRaw() {
  const raw = await redis.get(KEY);
  const text = raw == null ? "" : (typeof raw === "string" ? raw : JSON.stringify(raw));
  return { text, data: shape(text ? JSON.parse(text) : null) };
}

async function read() {
  return (await readRaw()).data;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function hasLog(L) {
  if (!L || typeof L !== "object") return false;
  if (Array.isArray(L.goals) && L.goals.length) return true;
  if (Array.isArray(L.cards) && L.cards.length) return true;
  if (Array.isArray(L.fouls) && L.fouls.some(n => n > 0)) return true;
  if (L.fair && Object.values(L.fair).some(
      f => f && (f.argue !== undefined || f.own > 0))) return true;
  if (L.mvp && (L.mvp.no || L.mvp.name || L.mvp.team)) return true;
  if (L.ref && (L.ref.main || L.ref.asst || L.ref.rec)) return true;
  if (L.note || L.video) return true;
  return false;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const t = req.query.t;
    const data = await read();
    if (t !== undefined) {
      const court = TOKENS[t];
      data.auth = court === undefined
        ? { ok: false }
        : { ok: true, court, label: LABEL[court] };
    }
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch (e) {
      return res.status(400).json({ ok: false, msg: "body" });
    }

    const isStaff = TOKENS[body.token] !== undefined;
    const isOpenShoe = body.type === "shoe" && body.request === true;
    const isOpenRef = body.type === "ref" && body.request === true;
    if (!isStaff && !isOpenShoe && !isOpenRef) {
      return res.status(403).json({ ok: false, msg: "token" });
    }

    // 바꾸는 부분만 함수로 두고, 저장이 겹치면 최신본을 다시 읽어 다시 적용한다.
    const apply = (data) => {
    if (body.type === "match") {
      if (!body.id) return { status: 400, msg: "id" };
      if (body.score === null) {
        delete data.scores[body.id];
        delete data.logs[body.id];
      } else {
        data.scores[body.id] = body.score;
        if (hasLog(body.log)) data.logs[body.id] = body.log;
        else delete data.logs[body.id];
      }
    } else if (body.type === "shoe") {
      if (!body.id) return { status: 400, msg: "id" };
      if (body.remove) {
        if (!isStaff) return { status: 403, msg: "token" };
        delete data.shoes[body.id];
      } else if (body.request) {
        data.shoes[body.id] = { ...body.value, status: "신청" };
      } else {
        const cur = data.shoes[body.id];
        if (!cur) return { status: 404, msg: "notfound" };
        data.shoes[body.id] = { ...cur, status: body.status };
      }
    } else if (body.type === "ref") {
      if (!body.id) return { status: 400, msg: "id" };
      if (body.remove) {
        const cur = data.refs[body.id];
        if (!cur) return { status: 404, msg: "notfound" };
        if (!isStaff && cur.name !== (body.value && body.value.name)) {
          return { status: 403, msg: "name" };
        }
        delete data.refs[body.id];
      } else {
        if (data.refs[body.id] && !isStaff) {
          return { status: 409, msg: "taken" };
        }
        data.refs[body.id] = { ...body.value, at: new Date().toISOString() };
      }
    } else if (body.type === "day") {
      if (!isStaff) return { status: 403, msg: "token" };
      if (!body.id) return { status: 400, msg: "id" };
      if (body.remove) {
        delete data.days[body.id];
      } else {
        data.days[body.id] = { ...body.value, at: new Date().toISOString() };
      }
    } else {
      return { status: 400, msg: "type" };
    }
    return null;
    };

    for (let i = 0; i < 12; i++) {
      const { text, data } = await readRaw();
      const err = apply(data);
      if (err) return res.status(err.status).json({ ok: false, msg: err.msg });
      const saved = await redis.eval(CAS, [KEY], [text, JSON.stringify(data)]);
      if (Number(saved) === 1) return res.status(200).json({ ok: true });
      await sleep(20 + Math.random() * 60 * (i + 1));
    }
    return res.status(503).json({ ok: false, msg: "busy" });
  }

  return res.status(405).json({ ok: false });
}
