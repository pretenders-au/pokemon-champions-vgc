import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/design-system/arena';
import { clearSamples, countSamples, listSamples, type CorrectionsExport } from './correctionStore';

/**
 * "N scan corrections saved on this device · Export · Clear" — hands the samples that
 * recordCorrections saved to scripts/import-scan-corrections.ts as one JSON file.
 *
 * Renders nothing until there is something to export, and nothing in the native shells:
 * their WebViews have no handler for a file download.
 */
const ScanCorrectionsExport: React.FC = () => {
  const [count, setCount] = useState(0);
  const refresh = () => { countSamples().then(setCount, () => setCount(0)); };
  useEffect(refresh, []);

  if (count === 0 || Capacitor.isNativePlatform()) return null;
  const saved = `${count} scan correction${count === 1 ? '' : 's'} saved on this device`;

  const exportAll = async () => {
    const data: CorrectionsExport = { version: 1, samples: await listSamples() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `scan-corrections-${new Date().toLocaleDateString('en-CA')}.json`; // en-CA: local YYYY-MM-DD
    link.click();
    // Not straight away: some browsers start reading the blob only after the click returns.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const clearAll = async () => {
    if (!window.confirm(`Delete the ${saved}?`)) return;
    await clearSamples();
    refresh();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-3)' }}>
      <span>{saved}</span>
      <Button variant="secondary" size="sm" onClick={exportAll}>Export</Button>
      <Button variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
    </div>
  );
};

export default ScanCorrectionsExport;
