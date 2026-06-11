DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'menucare') THEN
    CREATE ROLE menucare LOGIN PASSWORD 'menucare';
  END IF;
END
$$;
