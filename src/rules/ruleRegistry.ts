/**
 * InvoiceReady v1.0 - Versioned Rule Registry
 * Manages published rule packs for UAE (AE) and Philippines (PH)
 */

import { RegulatoryRule, JurisdictionCode } from '../engine/types';
import { UAE_RULES, UAE_RULE_PACK_VERSION } from './packs/uae2026';
import { PH_RULES, PH_RULE_PACK_VERSION } from './packs/ph2026';
import { REGULATORY_SOURCES } from './sourcesRegistry';

export class RuleRegistry {
  private static rulesByJurisdiction: Record<JurisdictionCode, RegulatoryRule[]> = {
    AE: UAE_RULES,
    PH: PH_RULES,
  };

  private static packVersions: Record<JurisdictionCode, string> = {
    AE: UAE_RULE_PACK_VERSION,
    PH: PH_RULE_PACK_VERSION,
  };

  public static getPackVersion(jurisdiction: JurisdictionCode): string {
    return this.packVersions[jurisdiction] || '1.0.0';
  }

  public static getRulesForJurisdiction(jurisdiction: JurisdictionCode): RegulatoryRule[] {
    return this.rulesByJurisdiction[jurisdiction] || [];
  }

  public static getRuleById(ruleId: string): RegulatoryRule | undefined {
    for (const list of Object.values(this.rulesByJurisdiction)) {
      const match = list.find((r) => r.rule_id === ruleId);
      if (match) return match;
    }
    return undefined;
  }

  public static getAllPacks(): {
    jurisdiction: JurisdictionCode;
    version: string;
    rulesCount: number;
    sourcesCount: number;
    status: string;
  }[] {
    return [
      {
        jurisdiction: 'AE',
        version: UAE_RULE_PACK_VERSION,
        rulesCount: UAE_RULES.length,
        sourcesCount: Object.values(REGULATORY_SOURCES).filter((s) => s.jurisdiction === 'AE').length,
        status: 'PUBLISHED',
      },
      {
        jurisdiction: 'PH',
        version: PH_RULE_PACK_VERSION,
        rulesCount: PH_RULES.length,
        sourcesCount: Object.values(REGULATORY_SOURCES).filter((s) => s.jurisdiction === 'PH').length,
        status: 'PUBLISHED',
      },
    ];
  }
}
