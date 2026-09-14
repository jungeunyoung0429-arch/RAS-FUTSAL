import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "ras2026";

/* ── 접속 코드 ───────────────────────────────────────────────
   아래 "2026" 을 바꾸면 새 코드가 됩니다. 바꾼 뒤 GitHub에 올리면
   Vercel이 자동으로 다시 배포하므로 별도 작업이 필요 없습니다.

   링크: https://ras-futsal.vercel.app/staff?t=2026
────────────────────────────────────────────────────────── */
const TOKENS = {
  "2026": 0,   // 접속 코드 — 기록원과 지원단이 함께 씁니다
};
const LABEL = { 0: "본부 · 전체 구장", 1: "A구장", 2: "B구장", 3: "C구장", 4: "D구장" };

const EMPTY = { scores: {}, logs: {}, shoes: {} };

async function read() {
  const d = await redis.get(KEY);
  if (!d) return { ...EMPTY };
  return { scores: d.scores || {}, logs: d.logs || {}, shoes: d.shoes || {} };
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
    // 풋살화 '신청'만 학생이 토큰 없이 보낼 수 있습니다.
    const isOpenShoe = body.type === "shoe" && body.request === true;
    if (!isStaff && !isOpenShoe) {
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
        const L = body.log;
        if (L && (L.note || L.video || (L.mvp && L.mvp.no) ||
            (L.ref && (L.ref.main || L.ref.asst || L.ref.rec)))) {
          data.logs[body.id] = body.log;
        } else {
          delete data.logs[body.id];
        }
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
    } else {
      return res.status(400).json({ ok: false, msg: "type" });
    }

    await redis.set(KEY, data);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ ok: false });
}
