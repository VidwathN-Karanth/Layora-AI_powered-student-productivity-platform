import 'server-only';

/**
 * A minimal ZIP writer, streamed.
 *
 * The department's resumes live in each student's own Google Drive, so a
 * "download everyone's CV" button means fetching a few dozen files and handing
 * back one archive. Two constraints shaped this:
 *
 *  - It streams. A serverless function that buffers sixty PDFs in memory
 *    before answering is one cohort away from being killed, and a buffered
 *    response is capped far below the size of a year's worth of CVs. Entries
 *    are written out as each file arrives.
 *  - Nothing is compressed. PDFs are already compressed, so deflate would cost
 *    CPU on every byte to save almost none — and store mode (method 0) lets the
 *    sizes and CRC be written in the local header, which is what keeps this
 *    small enough to be worth owning rather than pulling in a dependency.
 *
 * The output is a standard ZIP: local headers, then a central directory, then
 * the end-of-central-directory record. No ZIP64, so it is good to 4GB and
 * 65535 files — several orders of magnitude past a cohort of CVs.
 */

/** CRC-32 (IEEE), table built once per process. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A name safe to write into an archive and to unpack anywhere.
 *
 * Path separators and `..` are stripped rather than escaped: an entry named
 * `../../etc/passwd` is a directory-traversal payload in some unzip tools, and
 * these names are built from student-supplied file names.
 */
export function safeEntryName(name: string, fallback: string): string {
  const cleaned = (name || '')
    .replace(/[\\/]+/g, '-')
    .replace(/\.\.+/g, '.')
    // Control characters and the set Windows refuses in a file name.
    .replace(/[\x00-\x1f<>:"|?*]/g, '')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

/** MS-DOS date/time, which is what a ZIP header stores. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time:
      (Math.min(date.getHours(), 23) << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((Math.max(date.getFullYear(), 1980) - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

export interface ZipEntry {
  /** The name inside the archive. Run it through `safeEntryName` first. */
  name: string;
  content: Uint8Array;
  modified?: Date;
}

interface DirectoryRecord {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
}

/**
 * Streams `entries` out as a ZIP archive.
 *
 * The source is an async iterable so a caller can yield each file as its
 * download finishes — one slow Drive fetch then delays only its own entry
 * rather than the whole response.
 */
export function zipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const directory: DirectoryRecord[] = [];
  let offset = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const push = (bytes: Uint8Array) => {
        controller.enqueue(bytes);
        offset += bytes.length;
      };

      try {
        for await (const entry of entries) {
          const name = new TextEncoder().encode(entry.name);
          const { time, date } = dosDateTime(entry.modified || new Date());
          const crc = crc32(entry.content);
          const size = entry.content.length;

          directory.push({ name, crc, size, offset, time, date });

          push(
            new Uint8Array([
              ...u32(0x04034b50), // local file header
              ...u16(20), // version needed
              ...u16(0x0800), // flags: UTF-8 names
              ...u16(0), // method: store
              ...u16(time),
              ...u16(date),
              ...u32(crc),
              ...u32(size),
              ...u32(size),
              ...u16(name.length),
              ...u16(0), // extra field length
            ])
          );
          push(name);
          push(entry.content);
        }

        const directoryStart = offset;
        for (const record of directory) {
          push(
            new Uint8Array([
              ...u32(0x02014b50), // central directory header
              ...u16(20), // version made by
              ...u16(20), // version needed
              ...u16(0x0800),
              ...u16(0),
              ...u16(record.time),
              ...u16(record.date),
              ...u32(record.crc),
              ...u32(record.size),
              ...u32(record.size),
              ...u16(record.name.length),
              ...u16(0), // extra
              ...u16(0), // comment
              ...u16(0), // disk number
              ...u16(0), // internal attributes
              ...u32(0), // external attributes
              ...u32(record.offset),
            ])
          );
          push(record.name);
        }

        push(
          new Uint8Array([
            ...u32(0x06054b50), // end of central directory
            ...u16(0),
            ...u16(0),
            ...u16(directory.length),
            ...u16(directory.length),
            ...u32(offset - directoryStart),
            ...u32(directoryStart),
            ...u16(0), // comment length
          ])
        );

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
