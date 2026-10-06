/**
 * InvoiceReady v1.0 - Readiness Scoring Engine
 * Evaluates 100-point dimensional weighted score and enforces Critical Gates (PRD-060, Sections 17-20).
 */

import {
  RuleValidationResult,
  Finding,
  Scorecard,
  ScoreClassification,
  DimensionScore,
  RuleCategory,
} from './types';

export const DIMENSION_METADATA: Record<RuleCategory, { label: string; defaultWeight: number }> = {
  INVOICE_STRUCTURE: { label: 'Invoice Structure & Document Type', defaultWeight: 20 },
  SELLER_IDENTITY: { label: 'Seller Registration & Identification', defaultWeight: 15 },
  BUYER_IDENTITY: { label: 'Buyer Registration & Identification', defaultWeight: 10 },
  TAX_VAT_CALCULATION: { label: 'Tax / VAT Calculations & Currencies', defaultWeight: 20 },
  NUMBERING_DATES: { label: 'Invoice Numbering, Series & Dates', defaultWeight: 10 },
  LINE_MASTER_DATA: { label: 'Line Item Details & Master Data', defaultWeight: 10 },
  STRUCTURED_DATA_CAPABILITY: { label: 'Structured Electronic Data Capability', defaultWeight: 10 },
  TRANSMISSION_SYSTEM_READINESS: { label: 'Electronic Transmission & ASP Readiness', defaultWeight: 5 },
};

export class ScoringEngine {
  public static calculateScorecard(
    results: RuleValidationResult[],
    findings: Finding[],
    totalApplicableRules: number
  ): Scorecard {
    // 1. Group results by dimension
    const dimensionResultsMap: Record<RuleCategory, RuleValidationResult[]> = {
      INVOICE_STRUCTURE: [],
      SELLER_IDENTITY: [],
      BUYER_IDENTITY: [],
      TAX_VAT_CALCULATION: [],
      NUMBERING_DATES: [],
      LINE_MASTER_DATA: [],
      STRUCTURED_DATA_CAPABILITY: [],
      TRANSMISSION_SYSTEM_READINESS: [],
    };

    for (const res of results) {
      if (dimensionResultsMap[res.category]) {
        dimensionResultsMap[res.category].push(res);
      }
    }

    // 2. Calculate dimension scores
    const dimensions: DimensionScore[] = [];
    let totalWeightedScore = 0;
    let totalWeightAccumulated = 0;

    for (const [categoryKey, meta] of Object.entries(DIMENSION_METADATA) as [RuleCategory, { label: string; defaultWeight: number }][]) {
      const categoryResults = dimensionResultsMap[categoryKey];
      const applicableCount = categoryResults.length;
      const passedCount = categoryResults.filter((r) => r.state === 'PASS').length;
      const failedCount = categoryResults.filter((r) => r.state === 'FAIL').length;

      let pointsEarnedInCat = 0;
      let pointsPossibleInCat = 0;

      for (const r of categoryResults) {
        pointsEarnedInCat += r.score_awarded;
        pointsPossibleInCat += r.points_possible;
      }

      const ratio = pointsPossibleInCat > 0 ? pointsEarnedInCat / pointsPossibleInCat : 1.0;
      const dimensionContribution = Math.round(ratio * meta.defaultWeight * 10) / 10;

      // Only add to total score if there are applicable rules in this dimension
      if (applicableCount > 0) {
        totalWeightedScore += dimensionContribution;
        totalWeightAccumulated += meta.defaultWeight;
      }

      dimensions.push({
        dimension: categoryKey,
        label: meta.label,
        weight: meta.defaultWeight,
        points_earned: dimensionContribution,
        percentage: Math.round(ratio * 100),
        applicable_rules_count: applicableCount,
        passed_rules_count: passedCount,
        failed_rules_count: failedCount,
      });
    }

    // Normalize to 100 if certain dimensions had no applicable rules
    const rawCalculatedScore =
      totalWeightAccumulated > 0
        ? Math.round((totalWeightedScore / totalWeightAccumulated) * 100)
        : 100;

    // 3. Evaluate Critical Gates (Section 19)
    let criticalGateTriggered = false;
    let lowestCap: number | undefined = undefined;
    let gateReason: string | undefined = undefined;

    for (const res of results) {
      if (res.is_critical_gate && (res.state === 'FAIL' || res.state === 'PARTIAL')) {
        if (res.failure_score_cap !== undefined) {
          if (lowestCap === undefined || res.failure_score_cap < lowestCap) {
            lowestCap = res.failure_score_cap;
            gateReason = `Capped at ${res.failure_score_cap} due to critical failure in "${res.title}".`;
            criticalGateTriggered = true;
          }
        }
      }
    }

    const overallScore =
      criticalGateTriggered && lowestCap !== undefined && rawCalculatedScore > lowestCap
        ? lowestCap
        : rawCalculatedScore;

    // 4. Score Classification (Section 20)
    let classification: ScoreClassification = 'NOT_READY';
    if (overallScore >= 90) {
      classification = 'READY';
    } else if (overallScore >= 75) {
      classification = 'MOSTLY_READY';
    } else if (overallScore >= 60) {
      classification = 'NEEDS_ATTENTION';
    } else if (overallScore >= 40) {
      classification = 'SIGNIFICANT_GAPS';
    } else {
      classification = 'NOT_READY';
    }

    // 5. Findings summary
    const findingsBySeverity = {
      critical: findings.filter((f) => f.severity === 'CRITICAL').length,
      high: findings.filter((f) => f.severity === 'HIGH').length,
      medium: findings.filter((f) => f.severity === 'MEDIUM').length,
      low: findings.filter((f) => f.severity === 'LOW').length,
      info: findings.filter((f) => f.severity === 'INFO').length,
    };

    const rulesSummary = {
      total: results.length,
      applicable: totalApplicableRules,
      passed: results.filter((r) => r.state === 'PASS').length,
      partial: results.filter((r) => r.state === 'PARTIAL').length,
      failed: results.filter((r) => r.state === 'FAIL').length,
      not_applicable: results.filter((r) => r.state === 'NOT_APPLICABLE').length,
      unknown: results.filter((r) => r.state === 'UNKNOWN').length,
    };

    return {
      overall_score: overallScore,
      raw_calculated_score: rawCalculatedScore,
      classification,
      critical_gate_triggered: criticalGateTriggered,
      critical_gate_cap: lowestCap,
      critical_gate_reason: gateReason,
      dimensions,
      rules_summary: rulesSummary,
      findings_by_severity: findingsBySeverity,
    };
  }
}
