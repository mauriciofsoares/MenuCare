UPDATE compliance_controls
SET status = UPPER(status)
WHERE status IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'compliance_controls_status_check'
  ) THEN
    ALTER TABLE compliance_controls
      ADD CONSTRAINT compliance_controls_status_check
      CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'NON_COMPLIANT', 'COMPLETED'));
  END IF;
END $$;

ALTER TABLE compliance_control_events
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS evidence_reference TEXT;

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

UPDATE compliance_findings
SET status = UPPER(status),
    severity = UPPER(severity)
WHERE status IS NOT NULL OR severity IS NOT NULL;

CREATE TABLE IF NOT EXISTS compliance_finding_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  finding_id TEXT NOT NULL REFERENCES compliance_findings(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  next_status TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_reference TEXT,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_finding_events_tenant_finding_idx
  ON compliance_finding_events (tenant_id, finding_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'compliance_findings_status_check'
  ) THEN
    ALTER TABLE compliance_findings
      ADD CONSTRAINT compliance_findings_status_check
      CHECK (status IN ('OPEN', 'IN_ANALYSIS', 'RESOLVED', 'ACCEPTED_RISK'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'compliance_findings_severity_check'
  ) THEN
    ALTER TABLE compliance_findings
      ADD CONSTRAINT compliance_findings_severity_check
      CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
  END IF;
END $$;
