// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';

vi.mock('./correctionStore', () => ({ MAX_SAMPLES: 200, countSamples: vi.fn(), listSamples: vi.fn(), clearSamples: vi.fn() }));
vi.mock('./mediaProjectionSource', () => ({ ScreenCapture: { shareFile: vi.fn(async () => {}) } }));

import ScanCorrectionsExport from './ScanCorrectionsExport';
import { countSamples, listSamples, clearSamples } from './correctionStore';
import { ScreenCapture } from './mediaProjectionSource';

const samples = [{ key: 'aa', id: 25, predicted: 26, png: 'UE5H' }, { key: 'bb', id: 6, predicted: null, png: 'UE5H' }];
const readText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

beforeEach(() => {
  vi.mocked(countSamples).mockResolvedValue(2);
  vi.mocked(listSamples).mockResolvedValue(samples);
  vi.mocked(clearSamples).mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { share?: unknown }).share;
});

describe('ScanCorrectionsExport', () => {
  it('shows nothing while there is nothing to export', async () => {
    vi.mocked(countSamples).mockResolvedValue(0);
    const { container } = render(<ScanCorrectionsExport />);
    await waitFor(() => expect(countSamples).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('shows nothing when the browser has no usable storage', async () => {
    vi.mocked(countSamples).mockRejectedValue(new Error('no indexedDB'));
    const { container } = render(<ScanCorrectionsExport />);
    await waitFor(() => expect(countSamples).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('shares the export through the ScreenCapture plugin on Android, where a download has nowhere to go', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ScanCorrectionsExport />);
    fireEvent.click(await screen.findByRole('button', { name: /export/i }));
    await waitFor(() => expect(ScreenCapture.shareFile).toHaveBeenCalled());
    const [{ name, text }] = vi.mocked(ScreenCapture.shareFile).mock.lastCall!;
    expect(name).toMatch(/^scan-corrections-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(text)).toEqual({ version: 1, samples });
    expect(click).not.toHaveBeenCalled();
  });

  it('shares the export as a file through the share sheet on iOS', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios');
    const share = vi.fn(async (_data: ShareData) => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ScanCorrectionsExport />);
    fireEvent.click(await screen.findByRole('button', { name: /export/i }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    const [file] = share.mock.lastCall![0].files!;
    expect(file.name).toMatch(/^scan-corrections-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(await readText(file))).toEqual({ version: 1, samples });
    expect(click).not.toHaveBeenCalled();
  });

  it('tells the user when the Android share fails', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
    vi.mocked(ScreenCapture.shareFile).mockRejectedValueOnce(new Error('could not write the file'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ScanCorrectionsExport />);
    fireEvent.click(await screen.findByRole('button', { name: /export/i }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not export the scan corrections: could not write the file'));
  });

  it('tells the user when the iOS share fails, but not when they only dismissed the sheet', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios');
    const share = vi.fn<(data: ShareData) => Promise<void>>()
      .mockRejectedValueOnce(Object.assign(new Error('Abort due to cancellation of share.'), { name: 'AbortError' }))
      .mockRejectedValueOnce(Object.assign(new Error('not allowed'), { name: 'NotAllowedError' }));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ScanCorrectionsExport />);
    const button = await screen.findByRole('button', { name: /export/i });
    fireEvent.click(button);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(alert.mock.calls).toEqual([['Could not export the scan corrections: not allowed']]);
  });

  it('tells the user when the iOS WebView has no share sheet to offer', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('ios');
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ScanCorrectionsExport />);
    fireEvent.click(await screen.findByRole('button', { name: /export/i }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Could not export the scan corrections: /)));
  });

  it('tells the user when the saved samples cannot be read', async () => {
    vi.mocked(listSamples).mockRejectedValueOnce(new Error('db gone'));
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ScanCorrectionsExport />);
    fireEvent.click(await screen.findByRole('button', { name: /export/i }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not export the scan corrections: db gone'));
  });

  it('counts again when the app comes back into view, since the overlay saves corrections from another WebView', async () => {
    vi.mocked(countSamples).mockResolvedValue(0);
    render(<ScanCorrectionsExport />);
    await waitFor(() => expect(countSamples).toHaveBeenCalled());
    vi.mocked(countSamples).mockResolvedValue(1);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await screen.findByText('1 scan correction saved on this device')).toBeTruthy();
  });

  it('counts a single sample in the singular', async () => {
    vi.mocked(countSamples).mockResolvedValue(1);
    render(<ScanCorrectionsExport />);
    expect(await screen.findByText('1 scan correction saved on this device')).toBeTruthy();
  });

  it('says when the store is full, since further corrections are dropped until it is cleared', async () => {
    vi.mocked(countSamples).mockResolvedValue(200);
    render(<ScanCorrectionsExport />);
    expect(await screen.findByText(/200 scan corrections saved on this device \(full: export, then clear/)).toBeTruthy();
  });

  it('exports every saved sample as one JSON download', async () => {
    let exported: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { exported = blob as Blob; return 'blob:x'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ScanCorrectionsExport />);
    fireEvent.click(await screen.findByRole('button', { name: /export/i }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(screen.getByText('2 scan corrections saved on this device')).toBeTruthy();
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.href).toBe('blob:x');
    expect(link.download).toMatch(/^scan-corrections-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(await readText(exported as Blob))).toEqual({ version: 1, samples });
  });

  it('clears the saved samples only after asking', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ScanCorrectionsExport />);
    fireEvent.click(await screen.findByRole('button', { name: /clear/i }));
    expect(clearSamples).not.toHaveBeenCalled();

    ask.mockReturnValue(true);
    vi.mocked(countSamples).mockResolvedValue(0);
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /export/i })).toBeNull());
    expect(clearSamples).toHaveBeenCalledTimes(1);
  });
});
