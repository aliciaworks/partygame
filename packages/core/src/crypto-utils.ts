const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padding);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeUtf8(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function decodeUtf8(value: Uint8Array): string {
  return textDecoder.decode(value);
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encodeUtf8(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createHmacHexSignature(message: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, toArrayBuffer(encodeUtf8(message)));
  return bytesToHex(new Uint8Array(signature));
}

export async function verifyHmacSignature(message: string, signatureHex: string, secret: string): Promise<boolean> {
  const expected = await createHmacHexSignature(message, secret);
  if (expected.length !== signatureHex.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ signatureHex.charCodeAt(index);
  }

  return diff === 0;
}

export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  return amount * 60 * 60 * 24;
}

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseDurationToSeconds(expiresIn);
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload = { ...payload, iat: now, exp };
  const signingInput = `${base64UrlEncode(encodeUtf8(JSON.stringify(header)))}.${base64UrlEncode(
    encodeUtf8(JSON.stringify(fullPayload))
  )}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, toArrayBuffer(encodeUtf8(signingInput)));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyJwt<T extends object>(
  token: string,
  secret: string
): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  let header: { alg?: string; typ?: string };
  let payload: T & { iat?: number; exp?: number };

  try {
    header = JSON.parse(decodeUtf8(base64UrlDecode(headerPart)));
    payload = JSON.parse(decodeUtf8(base64UrlDecode(payloadPart)));
  } catch {
    return null;
  }

  if (header.alg !== "HS256") {
    return null;
  }

  const signingInput = `${headerPart}.${payloadPart}`;
  const key = await importHmacKey(secret);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, toArrayBuffer(encodeUtf8(signingInput))));
  const received = base64UrlDecode(signaturePart);

  if (expected.length !== received.length) {
    return null;
  }

  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected[index] ^ received[index];
  }

  if (diff !== 0) {
    return null;
  }

  const expiresAt = typeof payload.exp === "number" ? payload.exp : 0;
  if (!expiresAt || Math.floor(Date.now() / 1000) >= expiresAt) {
    return null;
  }

  return payload;
}