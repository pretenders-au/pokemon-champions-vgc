import { registerPlugin, Capacitor } from '@capacitor/core';
import type { CaptureSource, CapturedFrame } from './captureSource';

export interface ScreenCapturePlugin {
  hasOverlayPermission(): Promise<{ granted: boolean }>;
  requestOverlayPermission(): Promise<void>;
  startSession(): Promise<{ started: boolean }>;
  isSessionActive(): Promise<{ active: boolean }>;
  stopSession(): Promise<void>;
  capture(): Promise<{ pngBase64: string; width: number; height: number }>;
  bringToFront(): Promise<void>;
  /** Writes `text` to a cache file called `name` and opens the share sheet for it. */
  shareFile(options: { name: string; text: string }): Promise<void>;
  addListener(eventName: 'overlayTap', cb: () => void): Promise<{ remove: () => Promise<void> }>;
}

export const ScreenCapture = registerPlugin<ScreenCapturePlugin>('ScreenCapture');

export function isAndroidNative(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();
}

export function base64ToBlob(b64: string, type = 'image/png'): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export const mediaProjectionSource: CaptureSource = {
  kind: 'mediaProjection',
  async isAvailable() {
    if (!isAndroidNative()) return false;
    return (await ScreenCapture.hasOverlayPermission()).granted;
  },
  async capture(): Promise<CapturedFrame | null> {
    const { pngBase64 } = await ScreenCapture.capture();
    if (!pngBase64) return null;
    return { blob: base64ToBlob(pngBase64), sourceKind: 'mediaProjection', capturedAt: Date.now() };
  },
};
