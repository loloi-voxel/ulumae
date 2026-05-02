import { NextRequest, NextResponse } from 'next/server';

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      error:
        'Direct Arweave uploads have been replaced by the Seal Forever workflow. Start the process from the preservation page or POST to /api/seal/start.',
    },
    { status: 410 }
  );
}
