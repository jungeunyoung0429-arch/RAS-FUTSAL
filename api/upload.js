import { put, del } from "@vercel/blob";
import { TOKENS } from "./data.js";

// 사진 올리기(/photo)와 기록 화면 사진 승인(/record)이 부르는 사진 저장 창구.
// 올리기: { data: "data:image/jpeg;base64,...", type, school } → { ok, url }
// 지우기: { action: "del", url, token } → 접속 코드가 맞을 때만
// Vercel 프로젝트에 Blob 저장소가 연결돼 있어야 한다(환경변수 BLOB_READ_WRITE_TOKEN).
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, msg: "method" });
  }
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ ok: false, msg: "body" });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ ok: false, msg: "사진 저장소가 아직 연결되지 않았습니다" });
  }

  try {
    if (body.action === "del") {
      if (TOKENS[body.token] === undefined) return res.status(403).json({ ok: false, msg: "token" });
      let host = "";
      try { host = new URL(String(body.url)).hostname; } catch (e) { /* 아래에서 거절 */ }
      if (!host.endsWith(".blob.vercel-storage.com")) return res.status(400).json({ ok: false, msg: "url" });
      await del(body.url);
      return res.status(200).json({ ok: true });
    }

    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ""));
    if (!m) return res.status(400).json({ ok: false, msg: "사진 형식을 읽지 못했습니다" });
    const buf = Buffer.from(m[2], "base64");
    if (!buf.length || buf.length > MAX_BYTES) return res.status(413).json({ ok: false, msg: "사진이 너무 큽니다" });

    const name = "photos/" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8) + "." + TYPES[m[1]];
    const blob = await put(name, buf, { access: "public", contentType: m[1] });
    return res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: "사진 저장 실패" });
  }
}
