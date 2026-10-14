import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "ras2026";

const TOKENS = {
  "2026": 0,
};
const LABEL = { 0: "본부 · 전체 구장", 1: "A구장", 2: "B구장", 3: "C구장", 4: "D구장" };

const EMPTY = { scores: {}, logs: {}, shoes: {}, refs: {}, days: {} };

async function read() {
  const d = await redis.get(KEY);
  if (!d) return { ...EMPTY };
  return {
    scores: d.scores || {}, logs: d.logs || {}, shoes: d.shoes || {},
    refs: d.refs || {}, days: d.days || {}
  };
}

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

    const data = await read();

    if (body.type === "match") {
      if (!body.id) return res.status(400).json({ ok: false, msg: "id" });
      if (body.score === null) {
        delete data.scores[body.id];
        delete data.logs[body.id];
      } else {
        data.scores[body.id] = body.score;
        if (hasLog(body.log)) data.logs[body.id] = body.log;
        else delete data.logs[body.id];
      }
    } else if (body.type === "shoe") {
      if (!body.id) return res.status(400).json({ ok: false, msg: "id" });
      if (body.remove) {
        if (!isStaff) return res.status(403).json({ ok: false, msg: "token" });
        delete data.shoes[body.id];
      } else if (body.request) {
        data.shoes[body.id] = { ...body.value, status: "신청" };
      } else {
        const cur = data.shoes[body.id];
        if (!cur) return res.status(404).json({ ok: false, msg: "notfound" });
        data.shoes[body.id] = { ...cur, status: body.status };
      }
    } else if (body.type === "ref") {
      if (!body.id) return res.status(400).json({ ok: false, msg: "id" });
      if (body.remove) {
        const cur = data.refs[body.id];
        if (!cur) return res.status(404).json({ ok: false, msg: "notfound" });
        if (!isStaff && cur.name !== (body.value && body.value.name)) {
          return res.status(403).json({ ok: false, msg: "name" });
        }
        delete data.refs[body.id];
      } else {
        if (data.refs[body.id] && !isStaff) {
          return res.status(409).json({ ok: false, msg: "taken" });
        }
        data.refs[body.id] = { ...body.value, at: new Date().toISOString() };
      }
    } else if (body.type === "day") {
      if (!isStaff) return res.status(403).json({ ok: false, msg: "token" });
      if (!body.id) return res.status(400).json({ ok: false, msg: "id" });
      if (body.remove) {
        delete data.days[body.id];
      } else {
        data.days[body.id] = { ...body.value, at: new Date().toISOString() };
      }
    } else {
      return res.status(400).json({ ok: false, msg: "type" });
    }

    await redis.set(KEY, data);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false });
}
