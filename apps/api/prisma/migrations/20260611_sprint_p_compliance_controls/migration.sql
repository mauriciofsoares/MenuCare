ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE extracted_rules
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

ALTER TABLE rule_validation_events
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

UPDATE contracts
SET tenant_id = COALESCE(tenant_id, 'demo-tenant')
WHERE tenant_id IS NULL;

UPDATE extracted_rules rule
SET tenant_id = COALESCE(rule.tenant_id, contract.tenant_id, 'demo-tenant')
FROM contracts contract
WHERE contract.id = rule.contract_id
  AND rule.tenant_id IS NULL;

UPDATE rule_validation_events event
SET tenant_id = COALESCE(event.tenant_id, rule.tenant_id, 'demo-tenant')
FROM extracted_rules rule
WHERE rule.id = event.rule_id
  AND event.tenant_id IS NULL;

CREATE TABLE compliance_controls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contract_id TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  contract_rule_id TEXT NOT NULL REFERENCES extracted_rules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  operational_description TEXT NOT NULL,
  frequency VARCHAR(40) NOT NULL,
  responsible TEXT NOT NULL,
  expected_evidence TEXT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX compliance_controls_company_rule_uidx
  ON compliance_controls (company_name, contract_rule_id);

CREATE INDEX compliance_controls_tenant_status_idx
  ON compliance_controls (tenant_id, status, created_at DESC);

CREATE INDEX compliance_controls_tenant_contract_idx
  ON compliance_controls (tenant_id, contract_id);

CREATE TABLE compliance_control_executions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  control_id TEXT NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,
  execution_date DATE NOT NULL,
  status VARCHAR(40) NOT NULL,
  evidence_summary TEXT NOT NULL,
  evidence_reference TEXT,
  executed_by TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX compliance_control_executions_tenant_control_idx
  ON compliance_control_executions (tenant_id, control_id, execution_date DESC);

CREATE TABLE compliance_control_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  control_id TEXT NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,
  previous_status TEXT NOT NULL,
  next_status TEXT NOT NULL,
  description TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX compliance_control_events_tenant_control_idx
  ON compliance_control_events (tenant_id, control_id, created_at DESC);