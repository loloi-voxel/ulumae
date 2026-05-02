const ALLOW_MOCK =
  process.env.NODE_ENV !== 'production' &&
  process.env.ARWEAVE_ALLOW_MOCK === 'true';

const CONTENT_GATEWAYS = [
  'https://gateway.irys.xyz',
  'https://arweave.net',
  'https://g8way.io',
];

const DEFAULT_DEVNET_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const DEFAULT_MAINNET_TOKEN = 'ethereum';

export type ArweaveTransactionStatus =
  | 'pending'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'failed'
  | 'not_found';

export interface ArweaveTag {
  name: string;
  value: string;
}

export interface ArweaveTransaction {
  txId: string;
  status: ArweaveTransactionStatus;
  gatewayUrls: string[];
  fileCount: number;
  totalBytes: number;
  confirmedAt: string | null;
  createdAt: string;
}

export interface UploadProgress {
  stage: 'encrypting' | 'bundling' | 'uploading' | 'confirming';
  progress: number;
  message: string;
}

export interface PreservationEstimate {
  sizeBytes: number;
  costUsd: number;
  endowmentYears: number;
  nodeCount: number;
}

export interface UploadToArweaveOptions {
  contentType: string;
  fileName?: string | null;
  tags?: ArweaveTag[];
}

function safeEnv(name: string) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function assertMockAllowed(callerName: string) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `[arweaveService] ${callerName} cannot use the local mock in production.`
    );
  }

  if (!ALLOW_MOCK) {
    throw new Error(
      `[arweaveService] ${callerName} requires the real Irys uploader. ` +
        'Install the Irys packages and configure WALLET_PRIVATE_KEY, or set ARWEAVE_ALLOW_MOCK=true locally.'
    );
  }
}

function generateMockTxId() {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  return Array.from({ length: 43 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function normalizeUploadTags(
  options: UploadToArweaveOptions
): ArweaveTag[] {
  const tags = [...(options.tags || [])];
  const hasContentType = tags.some((tag) => tag.name === 'Content-Type');

  if (!hasContentType) {
    tags.push({
      name: 'Content-Type',
      value: options.contentType,
    });
  }

  if (options.fileName) {
    tags.push({
      name: 'Original-File-Name',
      value: options.fileName,
    });
  }

  return tags;
}

function createMockTransaction(totalBytes: number, fileCount: number): ArweaveTransaction {
  const txId = generateMockTxId();
  const createdAt = new Date().toISOString();

  return {
    txId,
    status: 'confirmed',
    gatewayUrls: getGatewayUrls(txId),
    fileCount,
    totalBytes,
    confirmedAt: createdAt,
    createdAt,
  };
}

async function getIrysUploader() {
  const privateKey = safeEnv('WALLET_PRIVATE_KEY');
  if (!privateKey) {
    throw new Error('Missing WALLET_PRIVATE_KEY for Irys uploads.');
  }

  const [{ Uploader }, ethereumSdk] = await Promise.all([
    import('@irys/upload'),
    import('@irys/upload-ethereum'),
  ]);

  const network = safeEnv('IRYS_NETWORK').toLowerCase() || 'mainnet';
  const token = safeEnv('IRYS_TOKEN').toLowerCase() || DEFAULT_MAINNET_TOKEN;
  const providerUrl = safeEnv('IRYS_RPC_URL');

  const tokenMap: Record<string, unknown> = {
    ethereum: (ethereumSdk as Record<string, unknown>).Ethereum,
    'base-eth': (ethereumSdk as Record<string, unknown>).BaseEth,
    arbitrum: (ethereumSdk as Record<string, unknown>).Arbitrum,
    avalanche: (ethereumSdk as Record<string, unknown>).Avalanche,
    bnb: (ethereumSdk as Record<string, unknown>).BNB,
    chainlink: (ethereumSdk as Record<string, unknown>).Chainlink,
    'linea-eth': (ethereumSdk as Record<string, unknown>).LineaEth,
    'scroll-eth': (ethereumSdk as Record<string, unknown>).ScrollEth,
    matic: (ethereumSdk as Record<string, unknown>).Polygon,
    'usdc-eth': (ethereumSdk as Record<string, unknown>).USDCEth,
    'usdc-polygon': (ethereumSdk as Record<string, unknown>).USDCPolygon,
  };

  const tokenUploader = tokenMap[token];
  if (!tokenUploader) {
    throw new Error(
      `Unsupported IRYS_TOKEN "${token}". Add the matching uploader mapping before using it.`
    );
  }

  let builder = await (Uploader as any)(tokenUploader).withWallet(privateKey);

  if (network === 'devnet') {
    builder = await builder
      .withRpc(providerUrl || DEFAULT_DEVNET_RPC_URL)
      .devnet();
  }

  return builder;
}

async function resolveGatewayStatus(url: string) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
    });

    if (response.ok) {
      return {
        status: 'confirmed' as const,
        confirmedAt: response.headers.get('last-modified') || new Date().toISOString(),
      };
    }

    if (response.status === 404) {
      return {
        status: 'submitted' as const,
        confirmedAt: null,
      };
    }

    return {
      status: 'pending' as const,
      confirmedAt: null,
    };
  } catch {
    return null;
  }
}

export function getGatewayUrls(txId: string): string[] {
  return CONTENT_GATEWAYS.map((gateway) => `${gateway}/${txId}`);
}

export async function uploadBufferToArweave(
  buffer: Uint8Array | Buffer | string,
  options: UploadToArweaveOptions
): Promise<ArweaveTransaction> {
  const normalizedBuffer =
    typeof buffer === 'string' ? Buffer.from(buffer, 'utf8') : Buffer.from(buffer);

  if (ALLOW_MOCK) {
    return createMockTransaction(normalizedBuffer.byteLength, 1);
  }

  const irysUploader = await getIrysUploader();
  const tags = normalizeUploadTags(options);
  const receipt = await irysUploader.upload(normalizedBuffer, { tags });
  const txId = typeof receipt?.id === 'string' ? receipt.id : '';

  if (!txId) {
    throw new Error('Irys upload completed without returning a transaction id.');
  }

  const createdAt = new Date().toISOString();

  return {
    txId,
    status: 'confirmed',
    gatewayUrls: getGatewayUrls(txId),
    fileCount: 1,
    totalBytes: normalizedBuffer.byteLength,
    confirmedAt: createdAt,
    createdAt,
  };
}

export async function uploadToArweave(
  memorialId: string,
  data: unknown
): Promise<ArweaveTransaction> {
  const body = Buffer.from(JSON.stringify(data, null, 2), 'utf8');

  return uploadBufferToArweave(body, {
    contentType: 'application/json',
    fileName: `${memorialId}.json`,
    tags: [
      { name: 'App-Name', value: 'ULUMAE' },
      { name: 'Memorial-Id', value: memorialId },
      { name: 'Seal-Type', value: 'memorial-json' },
    ],
  });
}

export async function checkTransactionStatus(
  txId: string
): Promise<ArweaveTransaction> {
  if (ALLOW_MOCK) {
    assertMockAllowed('checkTransactionStatus');
    return {
      txId,
      status: 'confirmed',
      gatewayUrls: getGatewayUrls(txId),
      fileCount: 1,
      totalBytes: 0,
      confirmedAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date(Date.now() - 120_000).toISOString(),
    };
  }

  const gatewayUrls = getGatewayUrls(txId);

  for (const gatewayUrl of gatewayUrls) {
    const result = await resolveGatewayStatus(gatewayUrl);
    if (!result) {
      continue;
    }

    return {
      txId,
      status: result.status,
      gatewayUrls,
      fileCount: 1,
      totalBytes: 0,
      confirmedAt: result.confirmedAt,
      createdAt: result.confirmedAt || new Date().toISOString(),
    };
  }

  return {
    txId,
    status: 'pending',
    gatewayUrls,
    fileCount: 1,
    totalBytes: 0,
    confirmedAt: null,
    createdAt: new Date().toISOString(),
  };
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

export function simulateUploadProgress(
  onProgress: (progress: UploadProgress) => void,
  durationMs: number = 8000
): () => void {
  const stages: UploadProgress[] = [
    { stage: 'encrypting', progress: 0, message: 'Encrypting memorial data...' },
    { stage: 'encrypting', progress: 100, message: 'Encryption complete.' },
    { stage: 'bundling', progress: 0, message: 'Preparing blockchain bundle...' },
    { stage: 'bundling', progress: 100, message: 'Bundle ready.' },
    { stage: 'uploading', progress: 0, message: 'Uploading to Irys and Arweave...' },
    { stage: 'uploading', progress: 100, message: 'Upload complete.' },
    { stage: 'confirming', progress: 0, message: 'Waiting for confirmation...' },
    { stage: 'confirming', progress: 100, message: 'Permanently preserved.' },
  ];

  let cancelled = false;
  const interval = durationMs / stages.length;

  stages.forEach((stage, index) => {
    setTimeout(() => {
      if (!cancelled) {
        onProgress(stage);
      }
    }, interval * index);
  });

  return () => {
    cancelled = true;
  };
}
