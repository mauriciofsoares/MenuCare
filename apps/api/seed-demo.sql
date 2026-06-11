INSERT INTO "Tenant" (id, name)
VALUES ('demo-tenant', 'Hospital Sao Marcelino Champagnat')
ON CONFLICT (id) DO NOTHING;

INSERT INTO "User" (id, tenant_id, name, email, password_hash, status)
VALUES ('demo-admin', 'demo-tenant', 'Administrador MenuCare', 'admin@menucare.local', 'seed:seed', 'active')
ON CONFLICT (tenant_id, email) DO NOTHING;
