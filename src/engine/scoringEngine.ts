/**
 * InvoiceReady v1.0 - Readiness Scoring Engine (Remediated)
 * Conforms to PRD-060, Sections 17-20, and Requirements 46, 47, 48.
 * Pulls dimension weights and score caps from the versioned rule pack configuration.
 * Enforces explicit semantics for PASS, FAIL, PARTIAL, NOT_APPLICABLE, UNKNOWN, REVIEW_REQUIRED.
 * Blocks definitive compliance score when critical evidence is in REVIEW_REQUIRED or UNKNOWN.
 */

import {
  RuleValidationResult,
  Finding,
  Scorecard,
  ScoreClassification,
  DimensionScore,
  RuleCategory,
  RulePackConfiguration,
} from './types';
import { RuleRegistry } from '../rules/ruleRegistry';

export class ScoringEngine {
  public static calculateScorecard(
    results: RuleValidationResult[],
    findings: Finding[],
    totalApplicableRules: number,
    packConfig?: RulePackConfiguration
  ): Scorecard {
    // 1. Resolve configuration (Requirement 48)
    const dimensionWeights: Record<RuleCategory, number> =
      packConfig?.dimension_weights || {
        INVOICE_STRUCTURE: 20,
        SELLER_IDENTITY: 15,
        BUYER_IDENTITY: 10,
        TAX_VAT_CALCULATION: 20,
        NUMBERING_DATES: 10,
        LINE_MASTER_DATA: 10,
        STRUCTURED_DATA_CAPABILITY: 10,
        TRANSMISSION_SYSTEM_READINESS: 5,
      };

    const criticalGateCaps: Record<string, number> = packConfig?.critical_gate_caps || {
      'AE-RULE-STRUCTURED-XML': 69,
      'AE-RULE-SELLER-TRN': 60,
      'PH-RULE-VAT-BREAKDOWN': 65,
      'PH-RULE-SELLER-TIN': 60,
    };

    // 2. Group results by dimension
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

    // 3. Check for REVIEW_REQUIRED or UNKNOWN on critical rules (Requirement 47)
    let criticalReviewRequired = false;
    let reviewBlockedReason: string | undefined = undefined;

    for (const res of results) {
      if (res.is_critical_gate && (res.state === 'REVIEW_REQUIRED' || res.state === 'UNKNOWN')) {
        criticalReviewRequired = true;
        reviewBlockedReason = `Definitive compliance scoring blocked: Critical requirement "${res.title}" has unresolved extraction evidence (${res.state}). Manual evidence verification required.`;
        break;
      }
    }

    // 4. Calculate dimension scores
    const dimensions: DimensionScore[] = [];
    let totalWeightedScore = 0;
    let totalWeightAccumulated = 0;

    for (const [categoryKey, defaultWeight] of Object.entries(dimensionWeights) as [RuleCategory, number][]) {
      const categoryResults = dimensionResultsMap[categoryKey] || [];
      const applicableCount = categoryResults.filter((r) => r.state !== 'NOT_APPLICABLE').length;
      const passedCount = categoryResults.filter((r) => r.state === 'PASS').length;
      const failedCount = categoryResults.filter((r) => r.state === 'FAIL').length;
      const reviewCount = categoryResults.filter((r) => r.state === 'REVIEW_REQUIRED').length;

      let pointsEarnedInCat = 0;
      let pointsPossibleInCat = 0;

      for (const r of categoryResults) {
        if (r.state === 'NOT_APPLICABLE') continue; // Excluded from scoring (Section 18)

        pointsPossibleInCat += r.points_possible;

        if (r.state === 'PASS') {
          pointsEarnedInCat += r.points_possible;
        } else if (r.state === 'PARTIAL') {
          pointsEarnedInCat += r.score_awarded;
        } else if (r.state === 'FAIL' || r.state === 'UNKNOWN') {
          pointsEarnedInCat += 0;
        } else if (r.state === 'REVIEW_REQUIRED') {
          // Zero points awarded while review is pending
          pointsEarnedInCat += 0;
        }
      }

      const ratio = pointsPossibleInCat > 0 ? pointsEarnedInCat / pointsPossibleInCat : 1.0;
      const dimensionContribution = Math.round(ratio * defaultWeight * 10) / 10;

      if (applicableCount > 0) {
        totalWeightedScore += dimensionContribution;
        totalWeightAccumulated += defaultWeight;
      }

      const dimensionLabels: Record<RuleCategory, string> = {
        INVOICE_STRUCTURE: 'Invoice Structure & Document Type',
        SELLER_IDENTITY: 'Seller Registration & Identification',
        BUYER_IDENTITY: 'Buyer Registration & Identification',
        TAX_VAT_CALCULATION: 'Tax / VAT Calculations & Currencies',
        NUMBERING_DATES: 'Invoice Numbering, Series & Dates',
        LINE_MASTER_DATA: 'Line Item Details & Master Data',
        STRUCTURED_DATA_CAPABILITY: 'Structured Electronic Data Capability',
        TRANSMISSION_SYSTEM_READINESS: 'Electronic Transmission & ASP Readiness',
      };

      dimensions.push({
        dimension: categoryKey,
        label: dimensionLabels[categoryKey] || categoryKey,
        weight: defaultWeight,
        points_earned: dimensionContribution,
        percentage: Math.round(ratio * 100),
        applicable_rules_count: applicableCount,
        passed_rules_count: passedCount,
        failed_rules_count: failedCount,
        review_required_count: reviewCount,
      });
    }

    const rawCalculatedScore =
      totalWeightAccumulated > 0
        ? Math.round((totalWeightedScore / totalWeightAccumulated) * 100)
        : 100;

    // 5. Evaluate Critical Gates (Requirement 48 & Section 19)
    let criticalGateTriggered = false;
    let lowestCap: number | undefined = undefined;
    let gateReason: string | undefined = undefined;

    for (const res of results) {
      if (res.is_critical_gate && (res.state === 'FAIL' || res.state === 'PARTIAL')) {
        const configuredCap = criticalGateCaps[res.rule_id] ?? res.failure_score_cap;
        if (configuredCap !== undefined) {
          if (lowestCap === undefined || configuredCap < lowestCap) {
            lowestCap = configuredCap;
            gateReason = `Capped at ${configuredCap}/100 due to non-negotiable statutory failure in "${res.title}".`;
            criticalGateTriggered = true;
          }
        }
      }
    }

    let finalScore: number | null = rawCalculatedScore;
    if (criticalGateTriggered && lowestCap !== undefined && rawCalculatedScore > lowestCap) {
      finalScore = lowestCap;
    }

    // If critical evidence review is required, do NOT award a definitive compliance score (Requirement 47)
    let classification: ScoreClassification = 'NOT_READY';
    if (criticalReviewRequired) {
      classification = 'REVIEW_REQUIRED';
      finalScore = null; // Blocked until user confirms evidence
    } else if (finalScore !== null) {
      if (finalScore >= 90) {
        classification = 'READY';
      } else if (finalScore >= 75) {
        classification = 'MOSTLY_READY';
      } else if (finalScore >= 60) {
        classification = 'NEEDS_ATTENTION';
      } else if (finalScore >= 40) {
        classification = 'SIGNIFICANT_GAPS';
      } else {
        classification = 'NOT_READY';
      }
    }

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
      review_required: results.filter((r) => r.state === 'REVIEW_REQUIRED').length,
    };

    return {
      overall_score: finalScore,
      raw_calculated_score: rawCalculatedScore,
      classification,
      definitive_score_blocked: criticalReviewRequired,
      critical_gate_triggered: criticalGateTriggered,
      critical_gate_cap: lowestCap,
      critical_gate_reason: reviewBlockedReason || gateReason,
      dimensions,
      rules_summary: rulesSummary,
      findings_by_severity: findingsBySeverity,
    };
  }
}
