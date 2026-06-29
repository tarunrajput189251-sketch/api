const http = require("http");
const fs = require("fs");
const { randomBytes } = require("crypto");

const PORT = process.env.PORT || 3007;
const ADMIN_SECRET = process.env.ADMIN_SECRET || randomBytes(16).toString("hex");
const LICENSES_FILE = process.env.LICENSES_FILE || "licenses.json";

function loadLicenses() {
  try { return JSON.parse(fs.readFileSync(LICENSES_FILE, "utf8")); }
  catch { return {}; }
}

function saveLicenses(data) {
  fs.writeFileSync(LICENSES_FILE, JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 1e5) { reject(new Error("too large")); req.destroy(); } });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "POST" && url === "/api/verify") {
    const body = JSON.parse(await readBody(req));
    const licenses = loadLicenses();
    const entry = licenses[body.clientId];

    if (!entry || !entry.active) {
      send(res, 403, { ok: false, message: "License not active" });
      return;
    }

    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url === "/api/admin/revoke") {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${ADMIN_SECRET}`) {
      send(res, 401, { message: "Unauthorized" });
      return;
    }

    const body = JSON.parse(await readBody(req));
    const licenses = loadLicenses();
    if (licenses[body.clientId]) {
      licenses[body.clientId].active = false;
      saveLicenses(licenses);
    }
    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url === "/api/admin/add") {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${ADMIN_SECRET}`) {
      send(res, 401, { message: "Unauthorized" });
      return;
    }

    const body = JSON.parse(await readBody(req));
    const licenses = loadLicenses();
    licenses[body.clientId] = { active: true, createdAt: new Date().toISOString(), note: body.note || "" };
    saveLicenses(licenses);
    send(res, 200, { ok: true });
    return;
  }

  send(res, 404, { message: "Not found" });
});

server.listen(PORT, () => {
  console.log(`License server running on http://0.0.0.0:${PORT}`);
  console.log(`Admin secret: ${ADMIN_SECRET}`);
  console.log(`Save this — you'll need it to manage licenses.`);
});
