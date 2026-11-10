/**
 * WebSerial ESC/POS silent thermal print dispatcher.
 * Requires Chromium + HTTPS (or localhost). Types: @types/w3c-web-serial.
 */

export async function requestThermalPort(): Promise<SerialPort> {
  if (!("serial" in navigator)) {
    throw new Error("WebSerial is not available in this browser");
  }
  return navigator.serial.requestPort();
}

export async function printSilentReceipt(
  port: SerialPort,
  escPosBytes: Uint8Array,
): Promise<void> {
  await port.open({ baudRate: 9600 });
  try {
    const writer = port.writable?.getWriter();
    if (!writer) throw new Error("Serial port is not writable");
    await writer.write(escPosBytes);
    writer.releaseLock();
  } finally {
    await port.close();
  }
}

export function encodeSimpleReceipt(lines: string[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: number[] = [0x1b, 0x40]; // init
  for (const line of lines) {
    chunks.push(...enc.encode(line), 0x0a);
  }
  chunks.push(0x1d, 0x56, 0x00); // partial cut
  return new Uint8Array(chunks);
}
