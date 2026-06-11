ALTER TABLE extracted_rules
ADD COLUMN IF NOT EXISTS source_page INTEGER;

ALTER TABLE extracted_rules
ADD COLUMN IF NOT EXISTS evidence_confidence NUMERIC(4,3);