-- =========================================
-- Animal_Shelter schema – Postgres versija
-- =========================================

BEGIN;

-- =========================================
-- APP_USER
-- =========================================
CREATE TABLE IF NOT EXISTS app_user (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    name           TEXT NOT NULL,
    surname        TEXT NOT NULL,

    username       TEXT NOT NULL UNIQUE,
    email          TEXT UNIQUE,

    password_hash  TEXT NOT NULL,

    role           TEXT NOT NULL DEFAULT 'volunteer'
        CHECK (role IN ('admin', 'shelter', 'volunteer')),

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

    email       TEXT UNIQUE,
    phone       TEXT,
    website     TEXT,

    address     TEXT,
    city        TEXT,
    postal_code TEXT,
    country     TEXT DEFAULT 'Lithuania',

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN NOT NULL DEFAULT FALSE,

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
-- ANIMAL_FAVORITE
-- =========================================
CREATE TABLE animal_favorite (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    animal_id BIGINT NOT NULL REFERENCES animal(id) ON DELETE CASCADE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_animal_favorite_user_animal UNIQUE (user_id, animal_id)
);

CREATE INDEX idx_animal_favorite_user_id
    ON animal_favorite(user_id);

CREATE INDEX idx_animal_favorite_animal_id
    ON animal_favorite(animal_id);


-- =========================================
-- ANIMAL_FOSTER
-- Trumpalaikė gyvūno globa
-- =========================================
CREATE TABLE IF NOT EXISTS animal_foster (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    animal_id BIGINT NOT NULL
        REFERENCES animal(id) ON DELETE CASCADE,

    user_id BIGINT NOT NULL
        REFERENCES app_user(id) ON DELETE CASCADE,

    -- kontaktiniai duomenys tuo metu, kai pateikiamas prašymas
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,

    start_date DATE,
    end_date DATE,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'approved',
            'rejected',
            'active',
            'completed',
            'cancelled'
        )),

    note TEXT,
    admin_note TEXT,

    approved_by BIGINT REFERENCES app_user(id),
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT animal_foster_date_ok
        CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS animal_foster_animal_idx
    ON animal_foster(animal_id);

CREATE INDEX IF NOT EXISTS animal_foster_user_idx
    ON animal_foster(user_id);

CREATE INDEX IF NOT EXISTS animal_foster_status_idx
    ON animal_foster(status);

CREATE INDEX IF NOT EXISTS animal_foster_start_date_idx
    ON animal_foster(start_date);


-- =========================================
-- VISIT
-- =========================================
CREATE TABLE IF NOT EXISTS visit (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    shelter_id  BIGINT NOT NULL REFERENCES shelter(id) ON DELETE RESTRICT,
    user_id     BIGINT NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,

    -- pasirinktas laikas
    start_at   TIMESTAMPTZ NOT NULL,
    end_at     TIMESTAMPTZ NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','scheduled','cancelled','completed','no_show')),

    is_under_16 BOOLEAN NOT NULL DEFAULT FALSE,

    social_hrs NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (social_hrs >= 0),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT visit_time_ok CHECK (end_at > start_at),

    is_group BOOLEAN NOT NULL DEFAULT FALSE,
    group_size INTEGER
);

CREATE INDEX IF NOT EXISTS visit_shelter_idx ON visit(shelter_id);
CREATE INDEX IF NOT EXISTS visit_user_idx ON visit(user_id);
CREATE INDEX IF NOT EXISTS visit_start_idx ON visit(start_at);



-- =========================================
-- NEWS
-- =========================================

CREATE TABLE IF NOT EXISTS news (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    shelter_id BIGINT REFERENCES shelter(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES app_user(id),

    title TEXT NOT NULL,

    web_url TEXT NOT NULL,
    image_url TEXT,

    is_published BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_news_shelter_id ON news(shelter_id);
CREATE INDEX idx_news_created_at ON news(created_at DESC);
CREATE INDEX idx_news_is_published ON news(is_published);


-- =========================================
-- EVENTS
-- =========================================
CREATE TABLE event (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    shelter_id BIGINT REFERENCES shelter(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES app_user(id),

    title       TEXT NOT NULL,
    summary     TEXT,
    description TEXT,

    location TEXT,
    city TEXT,

    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,

    image_url TEXT,

    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);


COMMIT;