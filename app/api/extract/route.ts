import { NextRequest, NextResponse } from 'next/server';
import { GeminiExtractor } from '@/src/services/geminiExtractor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, rawText, mimeType, scanId } = body;

    if (!fileName || !rawText) {
      return NextResponse.json(
        { error: 'Missing required extraction parameters: fileName and rawText.' },
        { status: 400 }
      );
    }

    const result = await GeminiExtractor.extractInvoice(
      fileName,
      rawText,
      mimeType || 'application/pdf',
      scanId || `scan_${Date.now().toString(36)}`
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /extract error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal error in extraction route' },
      { status: 500 }
    );
  }
}
