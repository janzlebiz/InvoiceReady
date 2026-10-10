/**
 * InvoiceReady v1.0 - PostgreSQL Database Entity Models
 * Matches DDL defined in /src/db/schema.sql
 */

import {
  JurisdictionCode,
  AccountingSystemChoice,
  ScanStatus,
  RuleCategory,
  RuleSeverity,
  RuleState,
  ScoreClassification,
} from '../engine/types';

export interface DbOrganization {
  organization_id: string;
  name: string;
  country_code: JurisdictionCode;
  created_at: string;
  updated_at: string;
}

export interface DbUser {
  user_id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface DbOrganizationUser {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER';
  joined_at: string;
}

export interface DbScan {
  scan_id: string;
  organization_id: string;
  jurisdiction: JurisdictionCode;
  status: ScanStatus;
  created_by?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface DbDocument {
  document_id: string;
  organization_id: string;
  scan_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  sha256_hash: string;
  retention_expires_at: string;
  created_at: string;
}

export interface DbInvoice {
  invoice_id: string;
  organization_id: string;
  scan_id: string;
  document_id: string;
  invoice_number: string | null;
  document_type: string;
  issue_date: string | null;
  supply_date?: string | null;
  due_date?: string | null;
  invoice_currency: string;
  tax_currency: string;
  exchange_rate?: number;
  qr_code_data?: string;
  created_at: string;
}

export interface DbRuleSource {
  source_id: string;
  jurisdiction: JurisdictionCode;
  authority: string;
  document_title: string;
  document_number: string;
  publication_date: string;
  effective_date: string;
  url: string;
  source_hash: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'REPEALED' | 'DRAFT';
}

export interface DbRulePack {
  pack_id: string;
  jurisdiction: JurisdictionCode;
  version: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  published_at: string;
}

export interface DbRule {
  rule_id: string;
  pack_id: string;
  jurisdiction: JurisdictionCode;
  title: string;
  description: string;
  category: RuleCategory;
  severity: RuleSeverity;
  effective_from: string;
  effective_until?: string | null;
  source_id: string;
  source_locator: string;
  is_critical_gate: boolean;
  failure_score_cap?: number;
}

export interface DbScorecard {
  scorecard_id: string;
  organization_id: string;
  scan_id: string;
  overall_score: number;
  raw_calculated_score: number;
  classification: ScoreClassification;
  critical_gate_triggered: boolean;
  critical_gate_cap?: number;
  dimension_scores: any;
  created_at: string;
}

export interface DbFinding {
  finding_id: string;
  organization_id: string;
  scan_id: string;
  rule_id: string;
  severity: RuleSeverity;
  title: string;
  description: string;
  impact: string;
  why_it_matters: string;
  recommended_action: string;
  implementation_steps: string[];
  evidence_snapshot: any;
}

export interface DbAuditLog {
  log_id: string;
  organization_id: string;
  actor_id: string;
  action: string;
  resource_id: string;
  result: 'SUCCESS' | 'FAILURE';
  ip_address: string;
  metadata?: any;
  timestamp: string;
}
