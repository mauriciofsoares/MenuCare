CREATE TABLE IF NOT EXISTS contract_pages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  site_id TEXT NULL,
  contract_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  raw_text TEXT NULL,
  text_quality TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contract_pages_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON DELETE CASCADE,
  CONSTRAINT contract_pages_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  CONSTRAINT contract_pages_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_pages_tenant_contract_page_key
  ON contract_pages(tenant_id, contract_id, page_number);

CREATE INDEX IF NOT EXISTS contract_pages_tenant_contract_page_idx
  ON contract_pages(tenant_id, contract_id, page_number);

CREATE INDEX IF NOT EXISTS contract_pages_tenant_site_contract_idx
  ON contract_pages(tenant_id, site_id, contract_id);

CREATE TABLE IF NOT EXISTS contract_blocks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  site_id TEXT NULL,
  contract_id TEXT NOT NULL,
  contract_page_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  block_index INTEGER NOT NULL,
  block_type TEXT NOT NULL,
  source_item TEXT NULL,
  raw_text TEXT NULL,
  normalized_text TEXT NULL,
  normalized_table_markdown TEXT NULL,
  normalized_table_json TEXT NULL,
  detected_units_json TEXT NULL,
  is_relevant_for_extraction BOOLEAN NOT NULL DEFAULT FALSE,
  discard_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contract_blocks_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON DELETE CASCADE,
  CONSTRAINT contract_blocks_site_id_fkey
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  CONSTRAINT contract_blocks_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT contract_blocks_contract_page_id_fkey
    FOREIGN KEY (contract_page_id) REFERENCES contract_pages(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_blocks_tenant_contract_page_block_key
  ON contract_blocks(tenant_id, contract_id, page_number, block_index);

CREATE INDEX IF NOT EXISTS contract_blocks_tenant_contract_page_block_idx
  ON contract_blocks(tenant_id, contract_id, page_number, block_index);

CREATE INDEX IF NOT EXISTS contract_blocks_tenant_contract_page_idx
  ON contract_blocks(tenant_id, contract_id, page_number);

CREATE INDEX IF NOT EXISTS contract_blocks_tenant_site_relevant_idx
  ON contract_blocks(tenant_id, site_id, is_relevant_for_extraction);

CREATE INDEX IF NOT EXISTS contract_blocks_tenant_contract_type_idx
  ON contract_blocks(tenant_id, contract_id, block_type);

ALTER TABLE extracted_rules
  ADD COLUMN IF NOT EXISTS source_block_id TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'extracted_rules_source_block_id_fkey'
  ) THEN
    ALTER TABLE extracted_rules
      ADD CONSTRAINT extracted_rules_source_block_id_fkey
      FOREIGN KEY (source_block_id) REFERENCES contract_blocks(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS extracted_rules_tenant_source_block_idx
  ON extracted_rules(tenant_id, source_block_id);
