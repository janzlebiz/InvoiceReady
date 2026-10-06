/**
 * InvoiceReady v1.0 - Applicability Engine
 * Evaluates business profile and system profile BEFORE invoice validation (TSD-020, Section 16).
 * Outputs applicable_rules[], not_applicable_rules[], unknown_rules[].
 */

import { BusinessProfile, SystemProfile, RegulatoryRule } from './types';
import { RuleRegistry } from '../rules/ruleRegistry';

export interface ApplicabilityDetermination {
  jurisdiction: string;
  pack_version: string;
  applicable_rules: RegulatoryRule[];
  not_applicable_rules: { rule: RegulatoryRule; reason: string }[];
  unknown_rules: { rule: RegulatoryRule; reason: string }[];
  evaluated_at: string;
}

export class ApplicabilityEngine {
  public static determineApplicability(
    profile: BusinessProfile,
    system: SystemProfile
  ): ApplicabilityDetermination {
    const allRules = RuleRegistry.getRulesForJurisdiction(profile.country);
    const packVersion = RuleRegistry.getPackVersion(profile.country);

    const applicable_rules: RegulatoryRule[] = [];
    const not_applicable_rules: { rule: RegulatoryRule; reason: string }[] = [];
    const unknown_rules: { rule: RegulatoryRule; reason: string }[] = [];

    for (const rule of allRules) {
      try {
        const isApplicable = rule.evaluateApplicability(profile, system);
        if (isApplicable) {
          applicable_rules.push(rule);
        } else {
          let reason = 'Excluded by business questionnaire criteria.';
          if (!profile.vat_registered && rule.category === 'TAX_VAT_CALCULATION') {
            reason = 'Business is not VAT registered.';
          } else if (
            profile.country === 'AE' &&
            !profile.transaction_types.includes('B2B') &&
            rule.rule_id === 'AE-RULE-BUYER-TRN'
          ) {
            reason = 'Applies strictly to B2B / B2G transactions; business conducts only B2C sales.';
          }
          not_applicable_rules.push({ rule, reason });
        }
      } catch (err: any) {
        unknown_rules.push({
          rule,
          reason: `Evaluation error during applicability check: ${err.message}`,
        });
      }
    }

    return {
      jurisdiction: profile.country,
      pack_version: packVersion,
      applicable_rules,
      not_applicable_rules,
      unknown_rules,
      evaluated_at: new Date().toISOString(),
    };
  }
}
