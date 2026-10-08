/** True when a PDF has an encryption dictionary, so it needs a password to open. */
export function pdfNeedsPassword(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false;
  const head = bytes.subarray(0, Math.min(bytes.byteLength, 1_000_000));
  const tail =
    bytes.byteLength > 65_536 ? bytes.subarray(bytes.byteLength - 65_536) : bytes;
  return hasEncryptToken(head) || hasEncryptToken(tail);
}

function hasEncryptToken(bytes: Uint8Array): boolean {
  const needle = [0x2f, 0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74]; // /Encrypt
  outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

export function withoutSourcePassword<T extends Record<string, unknown>>(row: T): T {
  if (!("source_password" in row)) return row;
  const copy = { ...row };
  delete copy.source_password;
  return copy;
}
