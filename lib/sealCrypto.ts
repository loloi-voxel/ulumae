const SEAL_ENCRYPTION_ITERATIONS = 250_000;
const SEAL_IV_BYTES = 12;
const SEAL_SALT_BYTES = 16;

const textEncoder = new TextEncoder();

export interface EncryptedSealPayload {
  bytes: Uint8Array;
  ivBase64: string;
  saltBase64: string;
  iterations: number;
  algorithm: 'AES-GCM';
  keyLength: 256;
  originalByteLength: number;
}

function toUint8Array(value: Uint8Array | Buffer | string) {
  if (typeof value === 'string') {
    return textEncoder.encode(value);
  }

  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function toBase64(value: Uint8Array) {
  return Buffer.from(value).toString('base64');
}

async function deriveAesKey(password: string, salt: Uint8Array) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new Uint8Array(salt),
      iterations: SEAL_ENCRYPTION_ITERATIONS,
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSealPayload(
  value: Uint8Array | Buffer | string,
  password: string
): Promise<EncryptedSealPayload> {
  const plainBytes = toUint8Array(value);
  const salt = crypto.getRandomValues(new Uint8Array(SEAL_SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(SEAL_IV_BYTES));
  const key = await deriveAesKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    new Uint8Array(plainBytes),
  );

  return {
    bytes: new Uint8Array(encrypted),
    ivBase64: toBase64(iv),
    saltBase64: toBase64(salt),
    iterations: SEAL_ENCRYPTION_ITERATIONS,
    algorithm: 'AES-GCM',
    keyLength: 256,
    originalByteLength: plainBytes.byteLength,
  };
}
