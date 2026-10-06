/**
 * InvoiceReady v1.0 - Deterministic Rule & Findings Engine
 * Executes applicable rules against Normalized Canonical Invoice and Evidence (TSD-010 to TSD-013, Section 21, 22).
 */

import {
  CanonicalInvoice,
  BusinessProfile,
  SystemProfile,
  ExtractedFieldEvidence,
  RegulatoryRule,
  RuleValidationResult,
  Finding,
  RemediationAction,
  RuleState,
} from './types';
import { REGULATORY_SOURCES } from '../rules/sourcesRegistry';

export class RuleEngine {
  public static executeRules(
    applicableRules: RegulatoryRule[],
    invoice: CanonicalInvoice,
    profile: BusinessProfile,
    system: SystemProfile,
    evidenceMap: Record<string, ExtractedFieldEvidence>
  ): {
    validationResults: RuleValidationResult[];
    findings: Finding[];
    remediationActions: RemediationAction[];
  } {
    const validationResults: RuleValidationResult[] = [];
    const findings: Finding[] = [];
    const remediationActions: RemediationAction[] = [];

    for (const rule of applicableRules) {
      const evaluation = rule.evaluateRule(invoice, profile, system, evidenceMap);

      let scoreAwarded = 0;
      if (evaluation.state === 'PASS') {
        scoreAwarded = rule.points_allocated;
      } else if (evaluation.state === 'PARTIAL') {
        const ratio = evaluation.partial_score_ratio ?? 0.5;
        scoreAwarded = Math.round(rule.points_allocated * ratio * 10) / 10;
      } else {
        scoreAwarded = 0;
      }

      const valResult: RuleValidationResult = {
        rule_id: rule.rule_id,
        pack_version: rule.pack_version,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        state: evaluation.state,
        score_awarded: scoreAwarded,
        points_possible: rule.points_allocated,
        message: evaluation.message,
        evidence_fields: evaluation.evidence_fields,
        source_id: rule.source_id,
        source_locator: rule.source_locator,
        is_critical_gate: rule.is_critical_gate,
        failure_score_cap: rule.failure_score_cap,
        why_it_matters: evaluation.why_it_matters,
        recommended_action: evaluation.recommended_action,
        implementation_steps: evaluation.implementation_steps,
      };

      validationResults.push(valResult);

      // Collect evidence values for finding snapshot
      const evidenceSnapshot: Record<string, any> = {};
      for (const field of evaluation.evidence_fields) {
        if (evidenceMap[field]) {
          evidenceSnapshot[field] = evidenceMap[field].normalized_value;
        } else {
          // Drill into invoice object if field path exists
          const pathParts = field.split('.');
          let curr: any = invoice;
          for (const p of pathParts) {
            if (curr && typeof curr === 'object') {
              curr = curr[p];
            } else {
              curr = null;
              break;
            }
          }
          evidenceSnapshot[field] = curr;
        }
      }

      const sourceDoc = REGULATORY_SOURCES[rule.source_id];

      // Create finding if rule failed or partial
      if (evaluation.state === 'FAIL' || evaluation.state === 'PARTIAL') {
        const findingId = `FINDING-${rule.rule_id}-${Date.now().toString(36).slice(-4)}`;

        const finding: Finding = {
          finding_id: findingId,
          rule_id: rule.rule_id,
          severity: rule.severity,
          title: rule.title,
          description: evaluation.message,
          category: rule.category,
          state: evaluation.state,
          evidence: {
            fields: evaluation.evidence_fields,
            values: evidenceSnapshot,
          },
          impact:
            rule.severity === 'CRITICAL'
              ? 'Blocks legal compliance; causes immediate tax clearance rejection or statutory penalties.'
              : rule.severity === 'HIGH'
              ? 'Prevents buyer VAT deduction or triggers automated tax authority audit flags.'
              : 'Non-conformity with data dictionary standards or electronic formatting guidelines.',
          why_it_matters: evaluation.why_it_matters,
          recommended_action: evaluation.recommended_action,
          implementation_steps: evaluation.implementation_steps,
          regulatory_source: {
            authority: sourceDoc?.authority || 'Tax Authority',
            document_title: sourceDoc?.document_title || rule.source_id,
            document_number: sourceDoc?.document_number || '',
            locator: rule.source_locator,
            url: sourceDoc?.url || '',
          },
          pack_version: rule.pack_version,
        };

        findings.push(finding);

        // Map to remediation plan action
        let priority: 'P0' | 'P1' | 'P2' = 'P2';
        let effort: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        let role: 'FINANCE' | 'IT_DEVELOPER' | 'BILLING_OPS' | 'LEGAL_TAX' = 'BILLING_OPS';
        let timelineDays = 7;

        if (rule.severity === 'CRITICAL') {
          priority = 'P0';
          timelineDays = 3;
          if (rule.category === 'STRUCTURED_DATA_CAPABILITY' || rule.category === 'TRANSMISSION_SYSTEM_READINESS') {
            effort = 'HIGH';
            role = 'IT_DEVELOPER';
            timelineDays = 30;
          } else {
            effort = 'MEDIUM';
            role = 'BILLING_OPS';
          }
        } else if (rule.severity === 'HIGH') {
          priority = 'P1';
          timelineDays = 14;
          effort = rule.category === 'TAX_VAT_CALCULATION' ? 'MEDIUM' : 'LOW';
          role = 'FINANCE';
        }

        const action: RemediationAction = {
          action_id: `ACT-${rule.rule_id}`,
          finding_id: findingId,
          rule_id: rule.rule_id,
          title: `Remediate: ${rule.title}`,
          category: rule.category,
          priority,
          effort,
          problem: evaluation.message,
          why_it_matters: evaluation.why_it_matters,
          what_to_change: evaluation.recommended_action,
          suggested_implementation: evaluation.implementation_steps,
          owner_role: role,
          estimated_timeline_days: timelineDays,
        };

        remediationActions.push(action);
      }
    }

    return { validationResults, findings, remediationActions };
  }
}
