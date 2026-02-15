const PEPPER = ["v", "e", "i", "-", "l", "e", "g", "e", "n", "d", "-", "k", "2", "0", "2", "6"].join("");
const SEED_KEY = "__wei_seed_obf";

type EncryptedPayload = {
  v: number;
  s: string;
  i: string;
  d: string;
  t: number;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function getFingerprint(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown";
  return [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    `${navigator.hardwareConcurrency ?? 0}`,
    tz,
  ].join("|");
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getInstallSeed(): string {
  const raw = localStorage.getItem(SEED_KEY);
  if (raw) {
    try {
      const restored = raw.split("").reverse().join("");
      return atob(restored);
    } catch {
      localStorage.removeItem(SEED_KEY);
    }
  }
  const seed = bytesToBase64(randomBytes(24));
  const obf = btoa(seed).split("").reverse().join("");
  localStorage.setItem(SEED_KEY, obf);
  return seed;
}

async function deriveAesKey(salt: Uint8Array): Promise<CryptoKey> {
  const source = `${PEPPER}|${getFingerprint()}|${getInstallSeed()}`;
  const sourceBytes = new TextEncoder().encode(source);
  const baseKey = await crypto.subtle.importKey("raw", sourceBytes, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: 220000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function saveEncryptedJSON(key: string, value: unknown): Promise<void> {
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const aesKey = await deriveAesKey(salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    aesKey,
    toArrayBuffer(plain),
  );
  const payload: EncryptedPayload = {
    v: 2,
    s: bytesToBase64(salt),
    i: bytesToBase64(iv),
    d: bytesToBase64(new Uint8Array(encrypted)),
    t: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(payload));
}

export async function loadEncryptedJSON<T>(key: string): Promise<T | null> {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  let parsed: EncryptedPayload;
  try {
    parsed = JSON.parse(raw) as EncryptedPayload;
  } catch {
    return null;
  }
  if (!parsed || parsed.v !== 2 || !parsed.s || !parsed.i || !parsed.d) {
    return null;
  }
  try {
    const salt = base64ToBytes(parsed.s);
    const iv = base64ToBytes(parsed.i);
    const data = base64ToBytes(parsed.d);
    const aesKey = await deriveAesKey(salt);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      aesKey,
      toArrayBuffer(data),
    );
    const text = new TextDecoder().decode(plain);
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function removeEncryptedJSON(key: string): void {
  localStorage.removeItem(key);
}
