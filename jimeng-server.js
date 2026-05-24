const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const https = require("https");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

const HOST = "visual.volcengineapi.com";
const REGION = "cn-north-1";
const SERVICE = "cv";

function sign(method, path, query, headers, body, ak, sk) {
  const now = new Date();
  const date = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 8);
  const datetime = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";

  const sortedQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join("&");

  const sortedHeaders = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();

  const canonicalHeaders =
    sortedHeaders.map((k) => `${k}:${headers[k]}\n`).join("") ;

  const signedHeaders = sortedHeaders.join(";");

  const bodyHash = crypto
    .createHash("sha256")
    .update(typeof body === "string" ? body : JSON.stringify(body))
    .digest("hex");

  const canonicalRequest = [
    method,
    path,
    sortedQuery,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credentialScope = `${date}/${REGION}/${SERVICE}/request`;
  const stringToSign = [
    "HMAC-SHA256",
    datetime,
    credentialScope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  function hmac(key, data) {
    return crypto.createHmac("sha256", key).update(data).digest();
  }

  const signingKey = hmac(
    hmac(hmac(hmac("aws4_request", date), REGION), SERVICE),
    "request"
  );

  const signature = hmac(signingKey, stringToSign).toString("hex");

  const authorization = `HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { authorization, datetime, date };
}

async function callJimeng(ak, sk, action, payload) {
  const bodyStr = JSON.stringify(payload);
  const query = { Action: action, Version: "2022-08-31" };
  const headers = {
    "Content-Type": "application/json",
    Host: HOST,
  };

  const { authorization, datetime } = sign(
    "POST",
    "/",
    query,
    { ...headers, "X-Date": datetime ?? new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z" },
    bodyStr,
    ak,
    sk
  );

  // Redo with actual datetime
  const now = new Date();
  const dt =
    now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dt8 = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 8);

  const hdrs = {
    "Content-Type": "application/json",
    Host: HOST,
    "X-Date": dt,
  };

  const sortedQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join("&");

  const sortedHdrKeys = Object.keys(hdrs)
    .map((k) => k.toLowerCase())
    .sort();

  const canonicalHeaders = sortedHdrKeys.map((k) => `${k}:${hdrs[k]}\n`).join("");
  const signedHeaders = sortedHdrKeys.join(";");

  const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");

  const canonicalRequest = [
    "POST",
    "/",
    sortedQuery,
    canonicalHeaders,
    signedHeaders,
    bodyHash,
  ].join("\n");

  const credentialScope = `${dt8}/${REGION}/${SERVICE}/request`;
  const stringToSign = [
    "HMAC-SHA256",
    dt,
    credentialScope,
    crypto.createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  function hmac(key, data) {
    return crypto.createHmac("sha256", key).update(data).digest();
  }

  const signingKey = hmac(
    hmac(hmac(hmac(sk, dt8), REGION), SERVICE),
    "request"
  );

  const signature = hmac(signingKey, stringToSign).toString("hex");

  const auth = `HMAC-SHA256 Credential=${ak}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return new Promise((resolve, reject) => {
    const qs = `?${sortedQuery}`;
    const options = {
      hostname: HOST,
      path: `/${qs}`,
      method: "POST",
      headers: {
        ...hdrs,
        Authorization: auth,
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });
}

app.post("/api/submit", async (req, res) => {
  const { ak, sk, prompt, imageBase64, pro, aspectRatio } = req.body;
  if (!ak || !sk) return res.status(400).json({ error: "Missing AK/SK" });

  const payload = {
    req_key: pro ? "jimeng_ti2v_v30_pro" : "jimeng_i2v_first_v30_1080",
    prompt,
    binary_data_base64: [imageBase64],
    seed: -1,
    aspect_ratio: aspectRatio || "16:9",
    frames: pro ? 241 : 121,
  };

  try {
    const result = await callJimeng(ak, sk, "CVSync2AsyncSubmitTask", payload);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/result", async (req, res) => {
  const { ak, sk, taskId } = req.body;
  if (!ak || !sk || !taskId) return res.status(400).json({ error: "Missing params" });

  try {
    const result = await callJimeng(ak, sk, "CVSync2AsyncGetResult", {
      req_key: "jimeng_i2v_first_v30_1080",
      task_id: taskId,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => console.log(`Jimeng server running on http://localhost:${PORT}`));
