-- =========================================
-- Animal_Shelter schema – Postgres versija
-- =========================================

BEGIN;

-- =========================================
-- APP_USER
-- =========================================
CREATE TABLE IF NOT EXISTS app_user (
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL,

    CONSTRAINT app_user_pkey
        PRIMARY KEY (name)
);

COMMIT;