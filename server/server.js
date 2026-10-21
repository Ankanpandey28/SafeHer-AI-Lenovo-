import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.disable("x-powered-by");
app.use(cors({
  origin: process.env.SAFEHER_ALLOWED_ORIGIN || false,
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json({ limit: "8kb" }));

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestWindows = new Map();
function normalizePhone(value) {
  const phone = String(value || "").trim();
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
function allowRequest(ip) {
  const now = Date.now();
  const current = requestWindows.get(ip);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false;
  current.count += 1;
  return true;
}
app.get("/api/health", (_, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, service: "SafeHer TextBee SMS Bridge", smsConfigured: Boolean(
    process.env.TEXTBEE_API_KEY && !/^(replace_|your_|changeme)/i.test(process.env.TEXTBEE_API_KEY.trim()) && process.env.SAFEHER_ALLOWED_RECIPIENTS
  ) });
});
app.post("/api/sos", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!process.env.SAFEHER_ALLOWED_ORIGIN || req.headers.origin !== process.env.SAFEHER_ALLOWED_ORIGIN) {
    return res.status(403).json({ ok: false, error: "Request origin is not allowed." });
  }
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  if (!allowRequest(ip)) return res.status(429).json({ ok: false, error: "Too many notification attempts. Try again later." });

  const { recipients, contacts, message } = req.body || {};
  const supplied = Array.isArray(recipients) && recipients.length ? recipients : contacts;
  if (!Array.isArray(supplied) || !supplied.length || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, error: "Recipients and message are required." });
  }
  if (message.length > 3000) return res.status(413).json({ ok: false, error: "Emergency message is too long." });

  const apiKey = String(process.env.TEXTBEE_API_KEY || "").trim();
  if (!apiKey || /^(replace_|your_|changeme)/i.test(apiKey)) {
    return res.status(503).json({ ok: false, error: "TextBee is not configured on the server." });
  }
  const allowlist = new Set((process.env.SAFEHER_ALLOWED_RECIPIENTS || "")
    .split(",").map(normalizePhone).filter(Boolean));
  if (!allowlist.size) return res.status(503).json({ ok: false, error: "SMS is disabled until SAFEHER_ALLOWED_RECIPIENTS is configured." });

  const seen = new Set();
  const validRecipients = [];
  for (const item of supplied.slice(0, 5)) {
    const phone = normalizePhone(typeof item === "string" ? item : item?.phone);
    if (phone && allowlist.has(phone) && !seen.has(phone)) { seen.add(phone); validRecipients.push(phone); }
  }
  if (!validRecipients.length) return res.status(403).json({ ok: false, error: "No valid recipient is on the server-side allowed-recipient list." });

  try {
    const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients: validRecipients,
        message: message.trim(),
        ...(process.env.TEXTBEE_DEVICE_ID?.trim() ? { deviceId: process.env.TEXTBEE_DEVICE_ID.trim() } : {})
      }),
      signal: AbortSignal.timeout(15000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.data?.success === false) {
      console.error("TextBee rejected SMS request", { httpStatus: response.status });
      return res.status(502).json({ ok: false, error: "TextBee did not accept the SMS request. Check API key, Android device status, permissions, and message limits." });
    }
    const data = payload?.data || {};
    if (data.warning?.code === "SMS_PERMISSION_MISSING") {
      return res.status(502).json({ ok: false, error: "TextBee reports that SMS permission may be disabled on the Android phone." });
    }
    const acceptedCount = Math.min(validRecipients.length, Math.max(0, Number(data.successCount ?? data.recipientCount ?? validRecipients.length) || 0));
    const failedCount = data.failureCount == null ? validRecipients.length - acceptedCount : Math.min(validRecipients.length, Math.max(0, Number(data.failureCount) || 0));
    return res.status(acceptedCount ? 200 : 502).json({
      ok: acceptedCount > 0, acceptedCount, failedCount,
      smsBatchId: typeof data.smsBatchId === "string" ? data.smsBatchId : undefined,
      message: "TextBee acceptance does not confirm carrier delivery. Check TextBee message history for delivery status."
    });
  } catch (error) {
    console.error("TextBee request failed", { errorName: error?.name || "UnknownError" });
    return res.status(502).json({ ok: false, error: "Could not reach TextBee. Check the server internet connection and try again." });
  }
});
const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`SafeHer TextBee SMS bridge listening on port ${port}`));
