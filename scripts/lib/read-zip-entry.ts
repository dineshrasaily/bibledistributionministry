/**
 * Minimal, dependency-free zip reader: finds one entry through the central
 * directory and returns its bytes. Supports "stored" (0) and "deflate" (8)
 * entries, which is all the eBible.org archives use. No zip64.
 */
import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

export type ZipEntry = { name: string; read: () => Buffer };

function findEndOfCentralDirectory(zip: Buffer): number {
  // The EOCD record is 22 bytes plus an optional comment of up to 64 KiB.
  const min = Math.max(0, zip.length - 22 - 0xffff);
  for (let i = zip.length - 22; i >= min; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error("Not a zip file (no end of central directory)");
}

export function listZipEntries(zip: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(zip);
  const count = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (zip.readUInt32LE(offset) !== CENTRAL_SIG) {
      throw new Error("Corrupt zip central directory");
    }
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.push({
      name,
      read: () => {
        if (zip.readUInt32LE(localOffset) !== LOCAL_SIG) {
          throw new Error(`Corrupt local header for ${name}`);
        }
        const localName = zip.readUInt16LE(localOffset + 26);
        const localExtra = zip.readUInt16LE(localOffset + 28);
        const start = localOffset + 30 + localName + localExtra;
        const data = zip.subarray(start, start + compressedSize);
        if (method === 0) return Buffer.from(data);
        if (method === 8) return inflateRawSync(data);
        throw new Error(`Unsupported zip compression method ${method}`);
      },
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** The bytes of the first entry whose name matches `test`. */
export function readZipEntry(
  zip: Buffer,
  test: (name: string) => boolean,
): { name: string; data: Buffer } {
  const entry = listZipEntries(zip).find((e) => test(e.name));
  if (!entry) throw new Error("Zip entry not found");
  return { name: entry.name, data: entry.read() };
}
