export type RandomBytes = (length: number) => Uint8Array;

export type IdGeneratorOptions = {
  randomBytes?: RandomBytes;
};

function defaultRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function byteToHex(byte: number): string {
  return byte.toString(16).padStart(2, '0');
}

export function createGameId(options: IdGeneratorOptions = {}): string {
  const bytes = (options.randomBytes ?? defaultRandomBytes)(16);

  if (bytes.length !== 16) {
    throw new Error('createGameId requires exactly 16 random bytes.');
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, byteToHex);
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}
