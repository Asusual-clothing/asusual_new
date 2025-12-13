const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

const PIXEL_ID = process.env.FB_PIXEL_ID;
const CAPI_TOKEN = process.env.FB_CAPI_TOKEN;
const CAPI_URL = PIXEL_ID && CAPI_TOKEN ? `https://graph.facebook.com/v17.0/${PIXEL_ID}/events` : null;
let fetchImpl = typeof fetch === "function" ? fetch : null;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function getFetch() {
  if (fetchImpl) return fetchImpl;

  try {
    const importedFetch = await import("node-fetch");
    fetchImpl = importedFetch.default || importedFetch;
    return fetchImpl;
  } catch (err) {
    console.error(
      "CAPI send failed: fetch is unavailable. Upgrade Node.js to 18+ or install node-fetch.",
      err?.message || err
    );
    return null;
  }
}

async function sendCapiEvent({
  event_name,
  event_id = uuidv4(),
  contents = [],
  value = 0,
  currency = "INR",
  user = {},
  sourceUrl = "",
  ip = "",
  ua = ""
}) {
  if (!CAPI_URL || !CAPI_TOKEN) return;
  const fetchClient = await getFetch();
  if (!fetchClient) return;

  const user_data = {};
  if (user.email) user_data.em = [sha256(String(user.email).trim().toLowerCase())];
  if (user.phone) user_data.ph = [sha256(String(user.phone).replace(/\D/g, ""))];
  if (ip) user_data.client_ip_address = ip;
  if (ua) user_data.client_user_agent = ua;

  const event = {
    event_name,
    event_time: Math.floor(Date.now() / 1000),
    event_id,
    action_source: "website",
    contents,
    value,
    currency,
  };

  if (sourceUrl) event.event_source_url = sourceUrl;
  if (Object.keys(user_data).length > 0) event.user_data = user_data;

  try {
    await fetchClient(`${CAPI_URL}?access_token=${encodeURIComponent(CAPI_TOKEN)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event] })
    });
  } catch (e) {
    console.error("CAPI send failed", e?.message || e);
  }

  return event_id;
}

module.exports = { sendCapiEvent };
