import { NextRequest, NextResponse } from 'next/server';
import { GeminiExtractor } from '@/src/services/geminiExtractor';
import { verifyServerAuth } from '@/src/auth/serverAuth';
import { ScanService } from '@/src/services/scanService';
import { DocumentParser } from '@/src/services/documentParser';
import { getSupabase } from '@/src/services/supabaseClient';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyServerAuth(req);
    if (!['ANALYST', 'ADMIN', 'OWNER'].includes(auth.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role permissions for extraction' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { scanId, documentId } = body;

    if (!scanId || !documentId) {
      return NextResponse.json(
        { error: 'Missing required parameters: scanId and documentId are mandatory for secure extraction.' },
        { status: 400 }
      );
    }

    // 1. Authoritative Scan Verification & Tenant Ownership
    const scan = await ScanService.getScan(scanId, auth.organizationId);
    if (!scan) {
      return NextResponse.json({ error: 'Scan session not found or does not belong to authorized organization' }, { status: 404 });
    }

    if (scan.organization_id !== auth.organizationId) {
      return NextResponse.json({ error: 'Forbidden: Cross-tenant resource access denied' }, { status: 403 });
    }

    // 2. Authoritative Document Record Verification & Tenant Ownership
    const supabase = getSupabase();
    let expectedHash = scan.document_hash;
    let storagePath = scan.storage_path;
    let fileName = scan.document_name || 'invoice.pdf';
    let mimeType = scan.document_mime_type || 'application/pdf';

    const { data: docRecord } = await supabase
      .from('scan_documents')
      .select('*')
      .eq('document_id', documentId)
      .eq('session_id', scanId)
      .eq('organization_id', auth.organizationId)
      .single();

    if (docRecord) {
      expectedHash = docRecord.sha256_hash;
      storagePath = docRecord.storage_path;
      fileName = docRecord.file_name;
      mimeType = docRecord.mime_type;
    } else if (documentId !== scanId && documentId !== scan.scan_id) {
      return NextResponse.json(
        { error: 'Document record not found or not associated with this scan and organization.' },
        { status: 404 }
      );
    }

    // 3. Security Inspection Status Verification
    if (scan.status !== 'SECURITY_PASSED' && scan.status !== 'COMPLETED' && scan.status !== 'REVIEW_REQUIRED') {
      return NextResponse.json({ error: 'Forbidden: Document has not passed security and malware inspection.' }, { status: 400 });
    }

    // 4. Storage Path Verification
    if (!storagePath) {
      return NextResponse.json({ error: 'No durable storage path recorded for document.' }, { status: 404 });
    }

    const tenantPrefix = `${auth.organizationId}/${scanId}/`;
    if (!storagePath.startsWith(tenantPrefix)) {
      return NextResponse.json({ error: 'Forbidden: Storage path violates tenant isolation boundaries.' }, { status: 403 });
    }

    // 5. Download Stored File Bytes from Durable Private Storage
    const { data: fileBlob, error: downloadErr } = await supabase.storage.from('invoices').download(storagePath);
    if (downloadErr || !fileBlob) {
      return NextResponse.json(
        { error: `Failed to retrieve document bytes from private storage: ${downloadErr?.message || 'Object not found'}` },
        { status: 404 }
      );
    }

    const arrayBuf = await fileBlob.arrayBuffer();
    const fileBytes = Buffer.from(arrayBuf);
    if (fileBytes.length === 0) {
      return NextResponse.json({ error: 'Retrieved document payload is empty.' }, { status: 422 });
    }

    // 6. SHA-256 Byte Integrity Verification
    const computedHash = crypto.createHash('sha256').update(fileBytes).digest('hex');
    if (expectedHash && computedHash !== expectedHash) {
      return NextResponse.json(
        {
          error: 'Integrity verification failed: Stored file SHA-256 does not match recorded document hash.',
          computed_hash: computedHash,
          expected_hash: expectedHash,
        },
        { status: 422 }
      );
    }

    // 7. Parse Document Text
    const rawText = await DocumentParser.extractDocumentText(
      fileBytes,
      fileName,
      mimeType
    );

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Document extraction failed: No readable textual content extracted from stored document.' },
        { status: 422 }
      );
    }

    // 8. Canonical Field Extraction with Gemini
    const result = await GeminiExtractor.extractInvoice(
      fileName,
      rawText,
      mimeType,
      scanId
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API /extract error:', err);
    const status = err.message?.includes('Unauthorized') ? 401 : err.message?.includes('Forbidden') ? 403 : 500;
    return NextResponse.json(
      { error: err.message || 'Internal error in extraction route' },
      { status }
    );
  }
}
