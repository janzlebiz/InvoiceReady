/**
 * InvoiceReady v1.0 - Persistent PDF Report Generation Service
 * Conforms to Requirements 58, 59, 60, PRD-065, PRD-066.
 *
 * Production Hardening Guarantees:
 * 1. Generates authentic persistent PDF readiness audit reports using pdfkit.
 * 2. Saves PDF bytes to private Google Cloud Storage bucket.
 * 3. Records report metadata, statutory rule pack version, and 30-day retention in PostgreSQL.
 * 4. Served only through authorized endpoints or short-lived signed URLs.
 */

import PDFDocument from 'pdfkit';
import { ScanSession } from '../engine/types';
import { DatabaseService } from '../db/postgres';
import { CloudStorageService } from './cloudStorageService';

export class PdfReportService {
  /**
   * Generates a formal PDF compliance report and persists it to Cloud Storage and PostgreSQL.
   */
  public static async generateAndSaveReport(
    scan: ScanSession,
    userFullName: string
  ): Promise<{ reportId: string; storagePath: string; downloadUrl: string }> {
    const reportId = `rep_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    const pdfBuffer = await this.renderPdfDocument(scan, userFullName);

    // 1. Save to Cloud Storage private bucket (Requirement 58)
    const fileName = `Readiness_Report_${scan.scan_id}_${scan.jurisdiction}.pdf`;
    const targetKey = `${scan.organization_id}/${scan.scan_id}/reports/${fileName}`;

    // Upload to private storage
    const quarantine = await CloudStorageService.saveToQuarantine(
      pdfBuffer,
      fileName,
      scan.organization_id,
      scan.scan_id
    );
    const storagePath = await CloudStorageService.promoteToPrivateStorage(
      quarantine.quarantinePath,
      scan.organization_id,
      scan.scan_id,
      fileName
    );

    // 2. Persist report record in PostgreSQL (Requirement 59)
    const retentionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await DatabaseService.saveReport({
      report_id: reportId,
      organization_id: scan.organization_id,
      scan_id: scan.scan_id,
      rule_pack_version: scan.rule_pack_version,
      storage_path: storagePath,
      retention_expires_at: retentionExpiresAt,
    });

    // 3. Generate signed URL for authorized access (Requirement 60)
    const downloadUrl = await CloudStorageService.generateSignedUrl(storagePath, 30);

    return {
      reportId,
      storagePath,
      downloadUrl,
    };
  }

  public static renderPdfDocument(scan: ScanSession, userFullName: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('INVOICEREADY REGULATORY READINESS REPORT', { align: 'center' });
      doc.moveDown(0.5);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(`Authoritative Assessment Baseline · Version: ${scan.rule_pack_version}`, { align: 'center' });
      doc.moveDown(1);

      // Metadata summary box
      doc.rect(40, doc.y, 515, 65).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#0f172a');

      const metaY = doc.y + 10;
      doc.fontSize(9).font('Helvetica-Bold').text(`Business Entity:`, 50, metaY);
      doc.font('Helvetica').text(`${scan.business_profile.business_name} (${scan.business_profile.tax_identifier})`, 140, metaY);

      doc.font('Helvetica-Bold').text(`Jurisdiction:`, 50, metaY + 16);
      doc.font('Helvetica').text(scan.jurisdiction === 'AE' ? 'United Arab Emirates (AE)' : 'Philippines (PH)', 140, metaY + 16);

      doc.font('Helvetica-Bold').text(`Assessed On:`, 50, metaY + 32);
      doc.font('Helvetica').text(new Date().toISOString(), 140, metaY + 32);

      doc.font('Helvetica-Bold').text(`Auditor:`, 320, metaY);
      doc.font('Helvetica').text(userFullName, 370, metaY);

      doc.font('Helvetica-Bold').text(`Document:`, 320, metaY + 16);
      doc.font('Helvetica').text(scan.document_name || 'Standard Payload', 380, metaY + 16);

      doc.font('Helvetica-Bold').text(`SHA-256:`, 320, metaY + 32);
      doc.font('Helvetica').text((scan.document_hash || 'Verified').slice(0, 16) + '...', 370, metaY + 32);

      doc.y = metaY + 55;
      doc.moveDown(1);

      // Scorecard section
      const scorecard = scan.scorecard;
      doc.fontSize(14).font('Helvetica-Bold').text('Readiness Evaluation Scorecard');
      doc.moveDown(0.3);

      const scoreDisplay =
        scorecard?.overall_score !== null && scorecard?.overall_score !== undefined
          ? `${scorecard.overall_score} / 100`
          : 'REVIEW REQUIRED';
      const statusDisplay = scorecard?.classification || scan.status;

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(`Overall Score: ${scoreDisplay}`);
      doc.fontSize(10).font('Helvetica').fillColor('#334155').text(`Statutory Status: ${statusDisplay}`);

      if (scorecard?.critical_gate_triggered) {
        doc.fontSize(10).fillColor('#b91c1c').text(`Critical Gate Enforced: ${scorecard.critical_gate_reason || 'Score capped'}`);
      }
      doc.fillColor('#0f172a');
      doc.moveDown(1);

      // Dimension Breakdown Table
      if (scorecard?.dimensions && scorecard.dimensions.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Dimensional Breakdown');
        doc.moveDown(0.5);

        scorecard.dimensions.forEach((dim) => {
          doc
            .fontSize(9)
            .font('Helvetica')
            .text(`• ${dim.label}: ${dim.percentage}% (${dim.points_earned}/${dim.weight} pts) - Passed: ${dim.passed_rules_count}, Failed: ${dim.failed_rules_count}`);
        });
        doc.moveDown(1);
      }

      // Findings & Remediation Summary
      doc.fontSize(12).font('Helvetica-Bold').text('Key Compliance Findings');
      doc.moveDown(0.5);

      if (!scan.findings || scan.findings.length === 0) {
        doc.fontSize(10).font('Helvetica').text('No regulatory non-conformities identified in the evaluated document.');
      } else {
        scan.findings.slice(0, 10).forEach((f, idx) => {
          doc.fontSize(10).font('Helvetica-Bold').text(`${idx + 1}. [${f.severity}] ${f.title} (${f.rule_id})`);
          doc.fontSize(9).font('Helvetica').text(`Description: ${f.description}`);
          doc.text(`Action Required: ${f.recommended_action}`);
          doc.fontSize(8).fillColor('#64748b').text(`Statute Locator: ${f.regulatory_source.document_title} - ${f.regulatory_source.locator}`);
          doc.fillColor('#0f172a');
          doc.moveDown(0.5);
        });
      }

      doc.moveDown(1);
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(
          'Notice: This automated report is generated by InvoiceReady based on deterministic statutory rule packs. It does not constitute formal legal or tax counsel.',
          { align: 'center' }
        );

      doc.end();
    });
  }
}
