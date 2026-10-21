
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  // Require the exact configured frontend origin.
  const allowedOrigin = process.env.SAFEHER_ALLOWED_ORIGIN;
  const origin = req.headers.origin;

  if (!allowedOrigin) {
    return res.status(503).json({
      ok: false,
      error: "SMS is disabled until SAFEHER_ALLOWED_ORIGIN is configured.",
    });
  }

  if (origin !== allowedOrigin) {
    return res.status(403).json({
      ok: false,
      error: "Request origin is not allowed.",
    });
  }

  const ip = String(
    req.headers["x-forwarded-for"] ||
      req.socket?.remoteAddress ||
      "unknown"
  )
    .split(",")[0]
    .trim();

  if (!allowRequest(ip)) {
    return res.status(429).json({
      ok: false,
      error: "Too many notification attempts. Try again later.",
    });
  }

  const { recipients, contacts, message } = req.body || {};
  const supplied =
    Array.isArray(recipients) && recipients.length
      ? recipients
      : contacts;

  if (
    !Array.isArray(supplied) ||
    !supplied.length ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    return res.status(400).json({
      ok: false,
      error: "Recipients and message are required.",
    });
  }

  if (message.length > 3000) {
    return res.status(413).json({
      ok: false,
      error: "Emergency message is too long.",
    });
  }

  const apiKey = process.env.TEXTBEE_API_KEY;

  if (!apiKey || /^(replace_|your_|changeme)/i.test(apiKey.trim())) {
    return res.status(503).json({
      ok: false,
      error: "TextBee is not configured on the server.",
    });
  }

  const allowlistRaw =
    process.env.SAFEHER_ALLOWED_RECIPIENTS || "";
  const deviceId = String(process.env.TEXTBEE_DEVICE_ID || "").trim();

  const allowlist = new Set(
    allowlistRaw.split(",").map(normalizePhone).filter(Boolean)
  );

  if (!allowlist.size) {
    return res.status(503).json({
      ok: false,
      error:
        "SMS sending is disabled. Configure SAFEHER_ALLOWED_RECIPIENTS for a controlled pilot.",
    });
  }

  const uniqueRecipients = [];
  const seen = new Set();

  for (const item of supplied.slice(0, 5)) {
    const phone = normalizePhone(
      typeof item === "string" ? item : item?.phone
    );

    if (!phone || !allowlist.has(phone) || seen.has(phone)) {
      continue;
    }

    seen.add(phone);
    uniqueRecipients.push({
      phone,
      name: String(item?.name || "Trusted contact").slice(0, 80),
    });
  }

  if (!uniqueRecipients.length) {
    return res.status(403).json({
      ok: false,
      error:
        "No valid recipient is on the server-side allowed-recipient list.",
    });
  }

  try {
    const response = await fetch(
      "https://api.textbee.dev/api/v1/gateway/send-sms",
      {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: uniqueRecipients.map((item) => item.phone),
          message: message.trim(),
          ...(deviceId ? { deviceId } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    let payload;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      // Do not expose provider responses, phone numbers, or secrets.
      console.error("TextBee SMS submission failed", {
        httpStatus: response.status,
      });

      return res.status(502).json({
        ok: false,
        error:
          "TextBee could not accept the SMS request. Check the device, API key, and message allowance.",
      });
    }

    const data = payload?.data || {};

    if (data.success === false) {
      console.error("TextBee rejected the SMS batch.");

      return res.status(502).json({
        ok: false,
        error: "TextBee did not accept the emergency SMS request.",
      });
    }

    // TextBee can warn that the phone's SMS permission is disabled.
    // Do not report this as a successful send.
    if (data.warning?.code === "SMS_PERMISSION_MISSING") {
      console.error("TextBee reports that SMS permission may be disabled.");

      return res.status(502).json({
        ok: false,
        error:
          "TextBee reports that SMS permission may be disabled on the Android phone. Check TextBee app permissions.",
      });
    }

    const acceptedCount = Math.min(
      uniqueRecipients.length,
      Math.max(
        0,
        Number(
          data.successCount ??
            data.recipientCount ??
            uniqueRecipients.length
        ) || 0
      )
    );

    const failedCount =
      data.failureCount != null
        ? Math.min(
            uniqueRecipients.length,
            Math.max(0, Number(data.failureCount) || 0)
          )
        : uniqueRecipients.length - acceptedCount;

    const results = uniqueRecipients.map((_, index) => ({
      status: index < acceptedCount ? "accepted" : "failed",
    }));

    return res.status(acceptedCount > 0 ? 200 : 502).json({
      ok: acceptedCount > 0,
      acceptedCount,
      failedCount,
      smsBatchId: typeof data.smsBatchId === "string" ? data.smsBatchId : undefined,
      message: "TextBee acceptance does not confirm carrier delivery. Check TextBee message history for delivery status.",
      results,
    });
  } catch (error) {
    console.error("TextBee request failed", {
      errorName: error?.name || "UnknownError",
    });

    return res.status(502).json({
      ok: false,
      error:
        "Could not reach TextBee. Check the internet connection and try again.",
    });
  }
}
