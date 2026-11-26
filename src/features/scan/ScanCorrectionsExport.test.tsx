// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';

vi.mock('./correctionStore', () => ({ MAX_SAMPLES: 200, countSamples: vi.fn(), listSamples: vi.fn(), clearSamples: vi.fn() }));

import ScanCorrectionsExport from './ScanCorrectionsExport';
import { countSamples, listSamples, clearSamples } from './correctionStore';

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
afterEach(() => { vi.restoreAllMocks(); });

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

  it('shows nothing in the native shells, where a download has nowhere to go', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const { container } = render(<ScanCorrectionsExport />);
    await waitFor(() => expect(countSamples).toHaveBeenCalled());
    expect(container.textContent).toBe('');
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
