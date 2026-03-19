-- =========================================
-- Animal_Shelter schema – Postgres versija
-- =========================================

BEGIN;

-- =========================================
-- APP_USER
-- =========================================
CREATE TABLE IF NOT EXISTS app_user (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    username       TEXT NOT NULL UNIQUE,
    email          TEXT UNIQUE,

    password_hash  TEXT NOT NULL,

    role           TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('admin', 'shelter', 'volunteer', 'user')),

    is_active      BOOLEAN NOT NULL DEFAULT TRUE,

    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS app_user_role_idx ON app_user(role);
CREATE INDEX IF NOT EXISTS app_user_active_idx ON app_user(is_active);


-- =========================================
-- SHELTER
-- =========================================
CREATE TABLE IF NOT EXISTS shelter (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name        TEXT NOT NULL UNIQUE,
    description TEXT,

    email       TEXT,
    phone       TEXT,
    website     TEXT,

    address     TEXT,
    city        TEXT,
    postal_code TEXT,
    country     TEXT DEFAULT 'Lithuania',

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,

    created_by  BIGINT REFERENCES app_user(id),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shelter_active_idx ON shelter(is_active);
CREATE INDEX IF NOT EXISTS shelter_verified_idx ON shelter(is_verified);


-- =========================================
-- ANIMAL
-- =========================================
CREATE TABLE IF NOT EXISTS animal (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    shelter_id BIGINT NOT NULL
        REFERENCES shelter(id) ON DELETE RESTRICT,

    name        TEXT,
    code        TEXT UNIQUE,
    species     TEXT NOT NULL CHECK (species IN ('dog','cat','other')),
    breed       TEXT,

    sex         TEXT CHECK (sex IN ('male','female','unknown')) DEFAULT 'unknown',
    birth_date  DATE,
    color       TEXT,

    description TEXT,

    status      TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available','reserved','adopted','foster','medical_hold','lost')),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS animal_shelter_idx ON animal(shelter_id);
CREATE INDEX IF NOT EXISTS animal_status_idx ON animal(status);


-- =========================================
-- ANIMAL_IMAGE
-- =========================================
CREATE TABLE IF NOT EXISTS animal_image (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    animal_id BIGINT NOT NULL
        REFERENCES animal(id) ON DELETE CASCADE,

    url TEXT NOT NULL,          -- pvz /uploads/animals/123/1.jpg arba https://cdn...
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS animal_image_animal_idx ON animal_image(animal_id);


-- =========================================
-- VISIT
-- =========================================
CREATE TABLE IF NOT EXISTS visit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    animal_id  BIGINT NOT NULL REFERENCES animal(id) ON DELETE RESTRICT,
    user_id    BIGINT NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,

    -- pasirinktas laikas
    start_at   TIMESTAMPTZ NOT NULL,
    end_at     TIMESTAMPTZ NOT NULL,

    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled','cancelled','completed','no_show')),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT visit_time_ok CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS visit_animal_idx ON visit(animal_id);
CREATE INDEX IF NOT EXISTS visit_user_idx ON visit(user_id);
CREATE INDEX IF NOT EXISTS visit_start_idx ON visit(start_at);


-- =========================================
-- VISIT_TASK 
-- =========================================
CREATE TABLE IF NOT EXISTS visit_task (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    visit_id BIGINT NOT NULL
        REFERENCES visit(id) ON DELETE CASCADE,

    task_type TEXT NOT NULL
        CHECK (task_type IN ('feed','walk','clean','groom','training','other')),

    description  TEXT,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    social_hrs NUMERIC(5,2) NOT NULL CHECK (social_hrs >= 0),
    points     INT CHECK (points >= 0),
    awarded_by BIGINT REFERENCES app_user(id) ON DELETE RESTRICT,
    awarded_at TIMESTAMPTZ,
    award_note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- jei yra points, privalo būti awarded_by ir awarded_at
    CONSTRAINT award_fields_ok CHECK (
        (points IS NULL AND awarded_by IS NULL AND awarded_at IS NULL)
        OR
        (points IS NOT NULL AND awarded_by IS NOT NULL AND awarded_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS visit_task_visit_idx ON visit_task(visit_id);
CREATE INDEX IF NOT EXISTS visit_task_awarded_by_idx ON visit_task(awarded_by);


COMMIT;