BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "Tenant" (id, name, "createdAt", "updatedAt")
VALUES ('demo-tenant', 'Hospital Sao Marcelino Champagnat', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "User" (id, tenant_id, name, email, password_hash, status, "createdAt", "updatedAt")
VALUES (
  'demo-admin',
  'demo-tenant',
  'Administrador MenuCare',
  'admin@menucare.local',
  'managed-by-demo-login',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS sites_tenant_name_uidx
  ON sites (tenant_id, name);

CREATE INDEX IF NOT EXISTS sites_tenant_active_idx
  ON sites (tenant_id, is_active);

CREATE TABLE IF NOT EXISTS user_site_accesses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tenant_id TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_site_accesses_tenant_user_site_uidx
  ON user_site_accesses (tenant_id, user_id, site_id);

CREATE INDEX IF NOT EXISTS user_site_accesses_tenant_user_active_idx
  ON user_site_accesses (tenant_id, user_id, is_active);

CREATE INDEX IF NOT EXISTS user_site_accesses_tenant_site_active_idx
  ON user_site_accesses (tenant_id, site_id, is_active);

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS site_id TEXT;
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS site_id TEXT;
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS rule_type TEXT;
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS periodicity TEXT;
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS quantity NUMERIC(12,3);
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS unit_measure TEXT;
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS calculation_basis TEXT;
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS applicability TEXT;
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS origin_group_text TEXT;
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS detected_units_json TEXT;
ALTER TABLE extracted_rules ADD COLUMN IF NOT EXISTS source_item TEXT;
ALTER TABLE rule_validation_events ADD COLUMN IF NOT EXISTS site_id TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS site_id TEXT;

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

UPDATE compliance_controls control
SET tenant_id = COALESCE(control.tenant_id, contract.tenant_id, 'demo-tenant')
FROM contracts contract
WHERE contract.id = control.contract_id
  AND control.tenant_id IS NULL;

-- Backfill nao destrutivo: cria um Site inicial por tenant/company_name apenas
-- para preservar compatibilidade com contratos legados. company_name continua
-- sendo snapshot textual e nao passa a ser chave de seguranca.
INSERT INTO sites (tenant_id, name)
SELECT DISTINCT COALESCE(tenant_id, 'demo-tenant'), company_name
FROM contracts
WHERE company_name IS NOT NULL
UNION
SELECT 'demo-tenant', 'Hospital Sao Marcelino Champagnat'
ON CONFLICT (tenant_id, name) DO NOTHING;

UPDATE contracts contract
SET site_id = site.id
FROM sites site
WHERE site.tenant_id = COALESCE(contract.tenant_id, 'demo-tenant')
  AND site.name = contract.company_name
  AND contract.site_id IS NULL;

UPDATE extracted_rules rule
SET site_id = contract.site_id
FROM contracts contract
WHERE contract.id = rule.contract_id
  AND rule.site_id IS NULL;

UPDATE rule_validation_events event
SET site_id = rule.site_id
FROM extracted_rules rule
WHERE rule.id = event.rule_id
  AND event.site_id IS NULL;

UPDATE compliance_controls control
SET site_id = contract.site_id
FROM contracts contract
WHERE contract.id = control.contract_id
  AND control.site_id IS NULL;

INSERT INTO user_site_accesses (tenant_id, user_id, site_id, role)
SELECT site.tenant_id, "User".id, site.id, 'client_admin'
FROM sites site
JOIN "User" ON "User".tenant_id = site.tenant_id
ON CONFLICT (tenant_id, user_id, site_id) DO NOTHING;

ALTER TABLE contracts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE extracted_rules ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rule_validation_events ALTER COLUMN tenant_id SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_contracts_site') THEN
    ALTER TABLE contracts
      ADD CONSTRAINT fk_contracts_site
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_extracted_rules_site') THEN
    ALTER TABLE extracted_rules
      ADD CONSTRAINT fk_extracted_rules_site
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_rule_validation_events_site') THEN
    ALTER TABLE rule_validation_events
      ADD CONSTRAINT fk_rule_validation_events_site
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compliance_controls')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_compliance_controls_site') THEN
    ALTER TABLE compliance_controls
      ADD CONSTRAINT fk_compliance_controls_site
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contracts_tenant_site_created_idx
  ON contracts (tenant_id, site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS extracted_rules_tenant_site_status_idx
  ON extracted_rules (tenant_id, site_id, status);

CREATE INDEX IF NOT EXISTS rule_validation_events_tenant_site_created_idx
  ON rule_validation_events (tenant_id, site_id, created_at DESC);

COMMIT;
