/**
 * Écrit la durée réelle dans l'en-tête d'un blob WebM produit par MediaRecorder
 * (MediaRecorder laisse la durée à "inconnu", ce qui casse la barre de lecture).
 * Implémentation EBML minimale : on cherche le Segment > Info > Duration.
 */
class Reader {
  view: DataView;
  pos = 0;
  constructor(buf: ArrayBuffer) {
    this.view = new DataView(buf);
  }
  get eof() {
    return this.pos >= this.view.byteLength;
  }
  readVint(): { value: number; length: number; start: number } | null {
    if (this.eof) return null;
    const start = this.pos;
    const first = this.view.getUint8(this.pos);
    let length = 1;
    for (let mask = 0x80; length <= 8; length++, mask >>= 1) {
      if (first & mask) break;
    }
    if (length > 8) return null;
    let value = first & (0xff >> length);
    for (let i = 1; i < length; i++) {
      value = value * 256 + this.view.getUint8(this.pos + i);
    }
    this.pos += length;
    return { value, length, start };
  }
  readId(): { value: number; length: number } | null {
    if (this.eof) return null;
    const first = this.view.getUint8(this.pos);
    let length = 1;
    for (let mask = 0x80; length <= 4; length++, mask >>= 1) {
      if (first & mask) break;
    }
    if (length > 4) return null;
    let value = 0;
    for (let i = 0; i < length; i++) value = value * 256 + this.view.getUint8(this.pos + i);
    this.pos += length;
    return { value, length };
  }
}

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_DURATION = 0x4489;
const ID_TIMECODE_SCALE = 0x2ad7b1;

export async function fixWebmDuration(blob: Blob, durationMs: number): Promise<Blob> {
  try {
    const buf = await blob.arrayBuffer();
    const r = new Reader(buf);
    let timecodeScale = 1000000;

    const findDuration = (end: number): number | null => {
      while (r.pos < end) {
        const id = r.readId();
        if (!id) return null;
        const size = r.readVint();
        if (!size) return null;
        const contentStart = r.pos;
        const unknownSize = size.value >= Math.pow(2, 7 * size.length) - 1;
        const contentEnd = unknownSize ? end : Math.min(end, contentStart + size.value);

        if (id.value === ID_SEGMENT || id.value === ID_INFO) {
          const found = findDuration(contentEnd);
          if (found !== null) return found;
          r.pos = contentEnd;
          continue;
        }
        if (id.value === ID_TIMECODE_SCALE) {
          let v = 0;
          for (let i = 0; i < size.value; i++) v = v * 256 + r.view.getUint8(contentStart + i);
          timecodeScale = v || timecodeScale;
        }
        if (id.value === ID_DURATION) return contentStart;
        r.pos = contentEnd;
      }
      return null;
    };

    const offset = findDuration(buf.byteLength);
    if (offset === null) return blob;

    const out = new Uint8Array(buf.slice(0));
    const view = new DataView(out.buffer);
    const scaledDuration = (durationMs * 1e6) / timecodeScale;
    // Duration est un float (4 ou 8 octets) — MediaRecorder écrit 8 octets
    view.setFloat64(offset, scaledDuration);
    return new Blob([out], { type: blob.type });
  } catch {
    return blob;
  }
}
