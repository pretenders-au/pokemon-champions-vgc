import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { normalizeImageBlob } from './imageLoading';

export async function pickImage(): Promise<Blob | null> {
  const blob = await rawPickImage();
  // Normalize at pickup so scan, crop previews, and retries all get a
  // browser-displayable blob (HEIC -> PNG).
  return blob && (await normalizeImageBlob(blob));
}

async function rawPickImage(): Promise<Blob | null> {
  if (Capacitor.isNativePlatform()) {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      quality: 90,
    });
    if (!photo.webPath) return null;
    return await (await fetch(photo.webPath)).blob();
  }
  return await new Promise<Blob | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export async function takePhoto(): Promise<Blob | null> {
  const blob = await rawTakePhoto();
  return blob && (await normalizeImageBlob(blob));
}

async function rawTakePhoto(): Promise<Blob | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 90,
      });
      if (!photo.webPath) return null;
      return await (await fetch(photo.webPath)).blob();
    } catch {
      return null; // user cancelled or denied permission
    }
  }
  return await new Promise<Blob | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment'); // hint the rear camera on mobile web
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
