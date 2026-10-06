/**
 * InvoiceReady v1.0 - Versioned Rule Registry
 * Manages published and historical rule packs for UAE (AE) and Philippines (PH).
 * Supports AE-2026.1, AE-2026.2, PH-2026.1, PH-2026.2.
 */

import { RegulatoryRule, JurisdictionCode, RulePackConfiguration } from '../engine/types';
import { UAE_RULES, UAE_RULE_PACK_VERSION } from './packs/uae2026';
import { UAE_RULES_V2, UAE_RULE_PACK_2_VERSION, UAE_PACK_2_CONFIG } from './packs/uae2026_2';
import { PH_RULES, PH_RULE_PACK_VERSION } from './packs/ph2026';
import { PH_RULES_V2, PH_RULE_PACK_2_VERSION, PH_PACK_2_CONFIG } from './packs/ph2026_2';
import { REGULATORY_SOURCES } from './sourcesRegistry';

export class RuleRegistry {
  // Current active default rule packs
  private static activePacks: Record<JurisdictionCode, string> = {
    AE: UAE_RULE_PACK_2_VERSION, // Default to reconciled AE-2026.2
    PH: PH_RULE_PACK_2_VERSION, // Default to reconciled PH-2026.2
  };

  private static packRules: Record<string, RegulatoryRule[]> = {
    [UAE_RULE_PACK_VERSION]: UAE_RULES,
    [UAE_RULE_PACK_2_VERSION]: UAE_RULES_V2,
    [PH_RULE_PACK_VERSION]: PH_RULES,
    [PH_RULE_PACK_2_VERSION]: PH_RULES_V2,
  };

  private static packConfigs: Record<string, RulePackConfiguration> = {
    [UAE_RULE_PACK_2_VERSION]: UAE_PACK_2_CONFIG,
    [PH_RULE_PACK_2_VERSION]: PH_PACK_2_CONFIG,
  };

  public static getActivePackVersion(jurisdiction: JurisdictionCode): string {
    return this.activePacks[jurisdiction] || '1.0.0';
  }

  public static getPackVersion(jurisdiction: JurisdictionCode): string {
    return this.getActivePackVersion(jurisdiction);
  }

  public static getRulesForJurisdiction(
    jurisdiction: JurisdictionCode,
    version?: string
  ): RegulatoryRule[] {
    const targetVersion = version || this.getActivePackVersion(jurisdiction);
    return this.packRules[targetVersion] || this.packRules[this.getActivePackVersion(jurisdiction)] || [];
  }

  public static getPackConfig(packVersion: string): RulePackConfiguration | undefined {
    return this.packConfigs[packVersion];
  }

  public static getRuleById(ruleId: string, version?: string): RegulatoryRule | undefined {
    for (const [packVer, list] of Object.entries(this.packRules)) {
      if (version && packVer !== version) continue;
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
    description: string;
  }[] {
    return [
      {
        jurisdiction: 'AE',
        version: UAE_RULE_PACK_2_VERSION,
        rulesCount: UAE_RULES_V2.length,
        sourcesCount: Object.values(REGULATORY_SOURCES).filter((s) => s.jurisdiction === 'AE').length,
        status: 'PUBLISHED',
        description: 'Reconciled AE-2026.2 under Ministerial Decision 145/2024 (ASP: Oct 30, 2026; Live: Jan 1, 2027)',
      },
      {
        jurisdiction: 'AE',
        version: UAE_RULE_PACK_VERSION,
        rulesCount: UAE_RULES.length,
        sourcesCount: Object.values(REGULATORY_SOURCES).filter((s) => s.jurisdiction === 'AE').length,
        status: 'SUPERSEDED',
        description: 'Baseline AE-2026.1 (Preserved immutably per Requirement 21)',
      },
      {
        jurisdiction: 'PH',
        version: PH_RULE_PACK_2_VERSION,
        rulesCount: PH_RULES_V2.length,
        sourcesCount: Object.values(REGULATORY_SOURCES).filter((s) => s.jurisdiction === 'PH').length,
        status: 'PUBLISHED',
        description: 'Reconciled PH-2026.2 under RR 26-2025 and RMC 98-2026 (Transition Stamped-OR Treatment)',
      },
      {
        jurisdiction: 'PH',
        version: PH_RULE_PACK_VERSION,
        rulesCount: PH_RULES.length,
        sourcesCount: Object.values(REGULATORY_SOURCES).filter((s) => s.jurisdiction === 'PH').length,
        status: 'SUPERSEDED',
        description: 'Baseline PH-2026.1 (Preserved immutably per Requirement 27)',
      },
    ];
  }
}
