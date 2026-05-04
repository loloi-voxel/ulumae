    // lib/arweave/storageEstimate.ts
// Safe côté client — aucune dépendance Node.js

export interface PreservationEstimate {
  sizeBytes: number;
  costUsd: number;
  endowmentYears: number;
  nodeCount: number;
}

export function estimateStorageCost(sizeBytes: number): PreservationEstimate {
  const sizeGB = sizeBytes / (1024 * 1024 * 1024);
  return {
    sizeBytes,
    costUsd: Math.max(25, Number((sizeGB * 4.5).toFixed(2))),
    endowmentYears: 200,
    nodeCount: 847,
  };
}