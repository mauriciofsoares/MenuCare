UPDATE compliance_controls
SET status = CASE UPPER(status)
  WHEN 'ACTIVE' THEN 'ACTIVE'
  WHEN 'DRAFT' THEN 'DRAFT'
  WHEN 'INACTIVE' THEN 'PAUSED'
  WHEN 'PAUSED' THEN 'PAUSED'
  WHEN 'NON_COMPLIANT' THEN 'NON_COMPLIANT'
  WHEN 'COMPLETED' THEN 'COMPLETED'
  ELSE 'DRAFT'
END
WHERE status IS NOT NULL;

CREATE TABLE IF NOT EXISTS compliance_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  control_id TEXT NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,
  execution_id TEXT REFERENCES compliance_control_executions(id) ON DELETE SET NULL,
  severity VARCHAR(40) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(40) NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_findings_tenant_control_idx
  ON compliance_findings (tenant_id, control_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS compliance_findings_tenant_status_idx
  ON compliance_findings (tenant_id, status, detected_at DESC);

CREATE TABLE IF NOT EXISTS evidence_references (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id TEXT NOT NULL,
  rule_id TEXT REFERENCES extracted_rules(id) ON DELETE CASCADE,
  control_id TEXT REFERENCES compliance_controls(id) ON DELETE CASCADE,
  execution_id TEXT REFERENCES compliance_control_executions(id) ON DELETE CASCADE,
  source_type VARCHAR(40) NOT NULL,
  page INTEGER,
  section TEXT,
  excerpt TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evidence_references_tenant_entity_idx
  ON evidence_references (tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS evidence_references_tenant_source_idx
  ON evidence_references (tenant_id, source_type, created_at DESC);
