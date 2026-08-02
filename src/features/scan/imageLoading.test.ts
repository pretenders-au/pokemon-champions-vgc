import { describe, expect, it } from 'vitest';
import { isHeicBlob } from './imageLoading';

function bmff(brand: string): Blob {
  const head = new Uint8Array(12);
  head.set([0, 0, 0, 24]); // box size
  new TextEncoder().encodeInto('ftyp' + brand, head.subarray(4));
  return new Blob([head]);
}

describe('isHeicBlob', () => {
  it('detects HEIF-family brands', async () => {
    expect(await isHeicBlob(bmff('heic'))).toBe(true);
    expect(await isHeicBlob(bmff('mif1'))).toBe(true);
  });

  it('rejects non-HEIC files', async () => {
    expect(await isHeicBlob(bmff('isom'))).toBe(false); // plain mp4
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])]);
    expect(await isHeicBlob(png)).toBe(false);
  });

  it('rejects blobs shorter than the header', async () => {
    expect(await isHeicBlob(new Blob([new Uint8Array(4)]))).toBe(false);
  });
});
