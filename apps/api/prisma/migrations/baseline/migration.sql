-- Sprint D baseline migration (manual fallback)
-- Prisma migrate command failed due SSL certificate chain while downloading engines.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core
CREATE TABLE IF NOT EXISTS "Tenant" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_tenant_email ON "User" (tenant_id, email);

-- Auth / Identity
CREATE TABLE IF NOT EXISTS company_locale_preferences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  locale TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_operational_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  source_profile TEXT NOT NULL,
  contract_mode TEXT NOT NULL,
  compliance_mode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS first_access_invites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_password_overrides (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invite_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  invite_token TEXT NOT NULL,
  invite_email TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  access_profile TEXT NOT NULL,
  role_key TEXT NOT NULL,
  user_name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  auth_flow_id TEXT NOT NULL DEFAULT 'unknown',
  device_fingerprint TEXT NOT NULL DEFAULT 'unknown',
  device_label TEXT NOT NULL DEFAULT 'unknown',
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  replaced_by_session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS extracted_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rule_validation_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  next_status TEXT NOT NULL,
  note TEXT,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Menus / Evaluations
CREATE TABLE IF NOT EXISTS menu_pdf_imports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  reference_date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  financial_goal NUMERIC(12,2) NOT NULL,
  meal_cost NUMERIC(12,2) NOT NULL,
  exceeded_value NUMERIC(12,2) NOT NULL,
  exceeded_percent NUMERIC(8,2) NOT NULL,
  validation_status TEXT NOT NULL,
  recipes_json TEXT NOT NULL,
  imported_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_operational_cardapios (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  entry_label TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  reference_date DATE NOT NULL,
  meal_type TEXT NOT NULL,
  financial_goal NUMERIC(12,2) NOT NULL,
  meal_cost NUMERIC(12,2) NOT NULL,
  exceeded_value NUMERIC(12,2) NOT NULL,
  exceeded_percent NUMERIC(8,2) NOT NULL,
  validation_status TEXT NOT NULL,
  recipes_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_import_rule_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  menu_import_id TEXT NOT NULL,
  rule_id TEXT,
  rule_title TEXT NOT NULL,
  result_status TEXT NOT NULL,
  evidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_import_adjustment_suggestions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  menu_import_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_reference TEXT,
  suggestion_text TEXT NOT NULL,
  estimated_financial_impact NUMERIC(12,2) NOT NULL,
  estimated_nutritional_impact TEXT NOT NULL,
  priority_level TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_adjusted_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  menu_import_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  target_month TEXT,
  planning_months_ahead INT,
  adjusted_meal_cost NUMERIC(12,2) NOT NULL,
  total_financial_impact NUMERIC(12,2) NOT NULL,
  nutritional_impact_summary TEXT NOT NULL,
  commemorative_context_json TEXT,
  applied_suggestions_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_commemorative_dates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  reference_date DATE NOT NULL,
  date_year INT NOT NULL,
  title TEXT NOT NULL,
  noble_dish_hint TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_evaluation_imports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  reference_date DATE NOT NULL,
  score NUMERIC(4,2) NOT NULL,
  evaluations_count INT NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_combination_intelligence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  combination_key TEXT NOT NULL,
  recipes_json TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  average_rating NUMERIC(4,2) NOT NULL,
  evaluations_count INT NOT NULL,
  mapped_records INT NOT NULL,
  last_reference_date DATE NOT NULL,
  trend TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_monthly_cycle_summaries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  summary_month TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  financial_goal NUMERIC(12,2) NOT NULL,
  days_parsed INT NOT NULL,
  imports_processed INT NOT NULL,
  above_goal_days INT NOT NULL,
  within_goal_days INT NOT NULL,
  total_meal_cost NUMERIC(12,2) NOT NULL,
  total_goal NUMERIC(12,2) NOT NULL,
  total_suggestions INT NOT NULL,
  total_estimated_financial_impact NUMERIC(12,2) NOT NULL,
  total_contractual_estimated_financial_impact NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_goal_estimated_financial_impact NUMERIC(12,2) NOT NULL DEFAULT 0,
  processed_imports_json TEXT NOT NULL DEFAULT '[]',
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_next_menu_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  menu_import_id TEXT NOT NULL,
  decision_status TEXT NOT NULL,
  justification TEXT NOT NULL,
  proposal_json TEXT NOT NULL,
  governance_blocks_approval BOOLEAN NOT NULL,
  historical_non_blocking BOOLEAN NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recipes
CREATE TABLE IF NOT EXISTS recipe_library_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  source_reference TEXT,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  food_group TEXT NOT NULL,
  cost_per_capita NUMERIC(12,2),
  serving_yield NUMERIC(12,2),
  preparation_method TEXT,
  nutritional_info_json TEXT,
  compatible_diets_json TEXT,
  allergens_json TEXT,
  ai_classification_json TEXT NOT NULL,
  ai_provider TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  ingredient_group TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_item_ingredients (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  quantity NUMERIC(12,2),
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_import_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  imported_count INT NOT NULL,
  classified_count INT NOT NULL,
  warnings_json TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_classification_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  previous_classification_json TEXT NOT NULL,
  next_classification_json TEXT NOT NULL,
  reason TEXT,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compliance
CREATE TABLE IF NOT EXISTS non_conformities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  origin TEXT NOT NULL,
  impact TEXT NOT NULL,
  owner TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS non_conformity_action_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  non_conformity_id TEXT NOT NULL,
  description TEXT NOT NULL,
  owner TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS non_conformity_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  non_conformity_id TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  next_status TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS non_conformity_action_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  non_conformity_id TEXT NOT NULL,
  action_plan_id TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  next_status TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compliance_export_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  export_id TEXT NOT NULL UNIQUE,
  company_name TEXT NOT NULL,
  export_type TEXT NOT NULL,
  non_conformity_id TEXT,
  action_plan_id TEXT,
  filter_export_id TEXT,
  filter_non_conformity_id TEXT,
  filter_action_plan_id TEXT,
  filter_sort_order TEXT,
  filter_export_scope TEXT,
  filter_actor TEXT,
  filter_from DATE,
  filter_to DATE,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Governance support models from current schema
CREATE TABLE IF NOT EXISTS recommendation_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  priority_order_json TEXT NOT NULL,
  levels_json TEXT NOT NULL,
  blocking_criteria_json TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendation_previews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  menu_import_id TEXT NOT NULL,
  proposal_json TEXT NOT NULL,
  governance_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  menu_import_id TEXT,
  source_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_state_json TEXT,
  next_state_json TEXT,
  actor_id TEXT,
  actor_name TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_preparation_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NULL,
  company_name TEXT NOT NULL,
  module_key TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Progressive migration for legacy company scope tables
ALTER TABLE IF EXISTS company_locale_preferences ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS company_operational_profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS first_access_invites ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS auth_password_overrides ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS invite_audit_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS auth_refresh_sessions ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS extracted_rules ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS rule_validation_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_pdf_imports ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_operational_cardapios ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_import_rule_audits ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_import_adjustment_suggestions ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_adjusted_versions ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_commemorative_dates ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_evaluation_imports ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_combination_intelligence ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_monthly_cycle_summaries ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS menu_next_menu_decisions ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS recipe_library_items ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS recipe_ingredients ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS recipe_item_ingredients ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS recipe_import_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS recipe_classification_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS non_conformities ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS non_conformity_action_plans ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS non_conformity_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS non_conformity_action_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS compliance_export_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS recommendation_policies ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS recommendation_previews ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS recommendations ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS audit_records ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;
ALTER TABLE IF EXISTS ai_preparation_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NULL;

-- Critical FKs from gap analysis
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_tenant') THEN
    ALTER TABLE "User" ADD CONSTRAINT fk_user_tenant FOREIGN KEY (tenant_id) REFERENCES "Tenant"(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_extracted_rules_contract') THEN
    ALTER TABLE extracted_rules ADD CONSTRAINT fk_extracted_rules_contract FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_rule_validation_events_rule') THEN
    ALTER TABLE rule_validation_events ADD CONSTRAINT fk_rule_validation_events_rule FOREIGN KEY (rule_id) REFERENCES extracted_rules(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_nc_action_plans_nc') THEN
    ALTER TABLE non_conformity_action_plans ADD CONSTRAINT fk_nc_action_plans_nc FOREIGN KEY (non_conformity_id) REFERENCES non_conformities(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_nc_events_nc') THEN
    ALTER TABLE non_conformity_events ADD CONSTRAINT fk_nc_events_nc FOREIGN KEY (non_conformity_id) REFERENCES non_conformities(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_nc_action_events_nc') THEN
    ALTER TABLE non_conformity_action_events ADD CONSTRAINT fk_nc_action_events_nc FOREIGN KEY (non_conformity_id) REFERENCES non_conformities(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_nc_action_events_action_plan') THEN
    ALTER TABLE non_conformity_action_events ADD CONSTRAINT fk_nc_action_events_action_plan FOREIGN KEY (action_plan_id) REFERENCES non_conformity_action_plans(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_menu_rule_audits_import') THEN
    ALTER TABLE menu_import_rule_audits ADD CONSTRAINT fk_menu_rule_audits_import FOREIGN KEY (menu_import_id) REFERENCES menu_pdf_imports(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_menu_suggestions_import') THEN
    ALTER TABLE menu_import_adjustment_suggestions ADD CONSTRAINT fk_menu_suggestions_import FOREIGN KEY (menu_import_id) REFERENCES menu_pdf_imports(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_menu_adjusted_versions_import') THEN
    ALTER TABLE menu_adjusted_versions ADD CONSTRAINT fk_menu_adjusted_versions_import FOREIGN KEY (menu_import_id) REFERENCES menu_pdf_imports(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_menu_next_decisions_import') THEN
    ALTER TABLE menu_next_menu_decisions ADD CONSTRAINT fk_menu_next_decisions_import FOREIGN KEY (menu_import_id) REFERENCES menu_pdf_imports(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_recipe_item_ingredients_recipe') THEN
    ALTER TABLE recipe_item_ingredients ADD CONSTRAINT fk_recipe_item_ingredients_recipe FOREIGN KEY (recipe_id) REFERENCES recipe_library_items(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_recipe_item_ingredients_ingredient') THEN
    ALTER TABLE recipe_item_ingredients ADD CONSTRAINT fk_recipe_item_ingredients_ingredient FOREIGN KEY (ingredient_id) REFERENCES recipe_ingredients(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_recipe_classification_events_recipe') THEN
    ALTER TABLE recipe_classification_events ADD CONSTRAINT fk_recipe_classification_events_recipe FOREIGN KEY (recipe_id) REFERENCES recipe_library_items(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_auth_refresh_sessions_user') THEN
    ALTER TABLE auth_refresh_sessions ADD CONSTRAINT fk_auth_refresh_sessions_user FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
