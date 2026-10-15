import fs from "node:fs";

const directory = new URL("../../api-server/.coach-data/", import.meta.url);
const marker = JSON.parse(fs.readFileSync(new URL("cloud-cutover.json", directory), "utf8"));
const address = new URL(marker.url);
if (address.protocol !== "https:" || address.username || address.password || address.search || address.hash) throw new Error("Confirmed HTTPS cloud gateway required");
const token = fs.readFileSync(new URL("owner-token", directory), "utf8").trim();
if (!/^[A-Za-z0-9._~+-]{32,256}$/.test(token) || token.startsWith("sk-")) throw new Error("Private gateway owner token required, not an OpenAI key");
const configuration = { format: "gym-beam-coach-connection", version: 1, url: address.toString().replace(/\/$/, ""), token };
const path = new URL("gym-beam-coach-connection.json", directory);
if (fs.existsSync(path)) {
  if (fs.readFileSync(path, "utf8") !== JSON.stringify(configuration, null, 2)) throw new Error("Existing private connection file differs; review it before replacing");
} else fs.writeFileSync(path, JSON.stringify(configuration, null, 2), { flag: "wx", mode: 0o600 });
console.log("Private connection file ready: artifacts/api-server/.coach-data/gym-beam-coach-connection.json. Keep it private; do not publish or send to chat.");
