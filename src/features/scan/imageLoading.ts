import type { RgbaImage } from './types';

async function decodeViaImg(blob: Blob): Promise<RgbaImage> {
  // Decode via an <img> element rather than createImageBitmap: Safari/WebKit
  // rejects some blobs from createImageBitmap with "The string did not match the
  // expected pattern", and the <img> path works across browsers.
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode the selected image'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { data, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ISO BMFF brands that mean "HEIF family" — covers iPhone .heic photos.
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'];

export async function isHeicBlob(blob: Blob): Promise<boolean> {
  // Sniff magic bytes ('ftyp' + brand) — blob.type is often empty for picked files.
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (head.length < 12) return false;
  const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
  return ascii(4, 8) === 'ftyp' && HEIC_BRANDS.includes(ascii(8, 12));
}

export async function blobToRgbaImage(blob: Blob): Promise<RgbaImage> {
  try {
    return await decodeViaImg(blob);
  } catch (err) {
    // Chromium/Firefox can't decode HEIC (iPhone photos); convert via wasm and
    // retry. Dynamic import keeps the decoder out of the main bundle.
    if (!(await isHeicBlob(blob))) throw err;
    const { default: heic2any } = await import('heic2any');
    const png = (await heic2any({ blob, toType: 'image/png' })) as Blob;
    return await decodeViaImg(png);
  }
}
