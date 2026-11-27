import crypto from "node:crypto";
import { all, get, newId, nowIso, run } from "@/lib/db";

type Jwk = { kty: string; crv: string; x: string; y: string; d: string };

type VapidKeys = { publicKey: string; privateKey: Jwk };

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

const b64url = (buffer: Buffer) => buffer.toString("base64url");

function rawPublicKey(publicKey: crypto.KeyObject): Buffer {
  const jwk = publicKey.export({ format: "jwk" }) as Jwk;
  return Buffer.concat([Buffer.from([0x04]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
}

export async function getVapidKeys(): Promise<VapidKeys> {
  const row = await get<{ value: string }>("SELECT value FROM app_keys WHERE name = 'vapid'");
  if (row?.value) {
    try {
      const stored = JSON.parse(row.value) as VapidKeys;
      if (stored.privateKey?.d && stored.publicKey) return stored;
    } catch {
      // fall through and regenerate
    }
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const value: VapidKeys = { privateKey: privateKey.export({ format: "jwk" }) as Jwk, publicKey: b64url(rawPublicKey(publicKey)) };
  await run(
    "INSERT INTO app_keys (name, value, created_at) VALUES ('vapid', ?, ?) ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value",
    [JSON.stringify(value), nowIso()],
  );
  return value;
}

function vapidHeaders(endpoint: string, keys: VapidKeys): Record<string, string> {
  const header = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: "mailto:clinic@example.com",
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), {
    key: crypto.createPrivateKey({ key: keys.privateKey, format: "jwk" }),
    dsaEncoding: "ieee-p1363",
  });
  return {
    Authorization: `vapid t=${signingInput}.${b64url(signature)}, k=${keys.publicKey}`,
  };
}

function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
  return Buffer.from(crypto.hkdfSync("sha256", ikm, salt, info, length));
}

function encryptPayload(payload: Buffer, p256dh: string, auth: string): Buffer {
  const uaPublic = Buffer.from(p256dh, "base64url");
  const authSecret = Buffer.from(auth, "base64url");

  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = hkdf(ecdhSecret, authSecret, keyInfo, 32);

  const salt = crypto.randomBytes(16);
  const cek = hkdf(ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = hkdf(ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const record = Buffer.concat([payload, Buffer.from([0x02])]);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, ciphertext]);
}

async function sendOne(sub: SubscriptionRow, payload: string, keys: VapidKeys): Promise<boolean> {
  const body = encryptPayload(Buffer.from(payload, "utf8"), sub.p256dh, sub.auth);
  const response = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      ...vapidHeaders(sub.endpoint, keys),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: new Uint8Array(body),
  });
  if (response.status === 404 || response.status === 410) {
    await run("DELETE FROM push_subscriptions WHERE id = ?", [sub.id]);
    return false;
  }
  return response.ok;
}

export async function sendPushToPatient(patientId: string, message: { title: string; body: string; url?: string }): Promise<number> {
  const subs = await all<SubscriptionRow>("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE patient_id = ?", [patientId]);
  if (subs.length === 0) return 0;
  const keys = await getVapidKeys();
  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url ?? "/",
    tag: `portal-${patientId}`,
  });
  let sent = 0;
  for (const sub of subs) {
    try {
      if (await sendOne(sub, payload, keys)) sent += 1;
    } catch {
      // a broken endpoint must not break the others
    }
  }
  return sent;
}

export async function subscribePatient(
  patientId: string,
  data: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null },
): Promise<boolean> {
  const endpoint = typeof data.endpoint === "string" ? data.endpoint : "";
  const p256dh = typeof data.keys?.p256dh === "string" ? data.keys.p256dh : "";
  const auth = typeof data.keys?.auth === "string" ? data.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return false;
  await run(
    `INSERT INTO push_subscriptions (id, patient_id, endpoint, p256dh, auth, created_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT (endpoint) DO UPDATE SET patient_id = EXCLUDED.patient_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [newId(), patientId, endpoint, p256dh, auth, nowIso()],
  );
  return true;
}
