-- Initial schema migration compatible with Django models
-- This assumes Django tables already exist. If starting fresh, run Django migrations first.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Note: The following tables are created by Django and should already exist:
-- - investigation_user (Django's custom user model)
-- - investigation_investigation
-- - investigation_investigationmember
-- - investigation_entity
-- - investigation_link
-- - investigation_tag
-- - investigation_entity_tags (many-to-many)
-- - investigation_comment
-- - investigation_attachment

-- If starting fresh (no Django), uncomment and use the following schema:

-- CREATE TABLE IF NOT EXISTS investigation_user (
--     id SERIAL PRIMARY KEY,
--     password VARCHAR(128) NOT NULL,
--     last_login TIMESTAMP WITH TIME ZONE,
--     is_superuser BOOLEAN NOT NULL DEFAULT false,
--     username VARCHAR(150) NOT NULL UNIQUE,
--     first_name VARCHAR(150),
--     last_name VARCHAR(150),
--     email VARCHAR(254) NOT NULL UNIQUE,
--     is_staff BOOLEAN NOT NULL DEFAULT false,
--     is_active BOOLEAN NOT NULL DEFAULT true,
--     date_joined TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--     avatar VARCHAR(100),
--     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
-- );

-- CREATE TABLE IF NOT EXISTS investigation_investigation (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     code VARCHAR(8) NOT NULL UNIQUE,
--     title VARCHAR(200) NOT NULL,
--     description TEXT,
--     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--     created_by_id INTEGER NOT NULL REFERENCES investigation_user(id) ON DELETE CASCADE,
--     is_active BOOLEAN NOT NULL DEFAULT true
-- );

-- CREATE INDEX idx_investigation_code ON investigation_investigation(code);
-- CREATE INDEX idx_investigation_created_by ON investigation_investigation(created_by_id);

-- CREATE TABLE IF NOT EXISTS investigation_investigationmember (
--     id SERIAL PRIMARY KEY,
--     investigation_id UUID NOT NULL REFERENCES investigation_investigation(id) ON DELETE CASCADE,
--     user_id INTEGER NOT NULL REFERENCES investigation_user(id) ON DELETE CASCADE,
--     role VARCHAR(10) NOT NULL DEFAULT 'member',
--     joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--     last_seen TIMESTAMP WITH TIME ZONE,
--     UNIQUE(investigation_id, user_id)
-- );

-- CREATE INDEX idx_member_investigation ON investigation_investigationmember(investigation_id);
-- CREATE INDEX idx_member_user ON investigation_investigationmember(user_id);

-- CREATE TABLE IF NOT EXISTS investigation_tag (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     investigation_id UUID NOT NULL REFERENCES investigation_investigation(id) ON DELETE CASCADE,
--     name VARCHAR(50) NOT NULL,
--     color VARCHAR(7),
--     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--     UNIQUE(investigation_id, name)
-- );

-- CREATE INDEX idx_tag_investigation ON investigation_tag(investigation_id);

-- CREATE TABLE IF NOT EXISTS investigation_entity (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     investigation_id UUID NOT NULL REFERENCES investigation_investigation(id) ON DELETE CASCADE,
--     entity_type VARCHAR(10) NOT NULL,
--     title VARCHAR(200) NOT NULL,
--     description TEXT,
--     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--     created_by_id INTEGER NOT NULL REFERENCES investigation_user(id) ON DELETE CASCADE,
--     role VARCHAR(100),
--     location VARCHAR(200),
--     address VARCHAR(255),
--     event_date TIMESTAMP WITH TIME ZONE,
--     event_end_date TIMESTAMP WITH TIME ZONE,
--     is_timeslot BOOLEAN NOT NULL DEFAULT false,
--     evidence_type VARCHAR(20),
--     photo VARCHAR(100)
-- );

-- CREATE INDEX idx_entity_investigation ON investigation_entity(investigation_id);
-- CREATE INDEX idx_entity_type ON investigation_entity(entity_type);
-- CREATE INDEX idx_entity_created_by ON investigation_entity(created_by_id);

-- CREATE TABLE IF NOT EXISTS investigation_entity_tags (
--     id SERIAL PRIMARY KEY,
--     entity_id UUID NOT NULL REFERENCES investigation_entity(id) ON DELETE CASCADE,
--     tag_id UUID NOT NULL REFERENCES investigation_tag(id) ON DELETE CASCADE,
--     UNIQUE(entity_id, tag_id)
-- );

-- CREATE INDEX idx_entity_tags_entity ON investigation_entity_tags(entity_id);
-- CREATE INDEX idx_entity_tags_tag ON investigation_entity_tags(tag_id);

-- CREATE TABLE IF NOT EXISTS investigation_link (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     investigation_id UUID NOT NULL REFERENCES investigation_investigation(id) ON DELETE CASCADE,
--     from_entity_id UUID NOT NULL REFERENCES investigation_entity(id) ON DELETE CASCADE,
--     to_entity_id UUID NOT NULL REFERENCES investigation_entity(id) ON DELETE CASCADE,
--     title VARCHAR(100) NOT NULL,
--     description TEXT,
--     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--     created_by_id INTEGER NOT NULL REFERENCES investigation_user(id) ON DELETE CASCADE,
--     UNIQUE(investigation_id, from_entity_id, to_entity_id)
-- );

-- CREATE INDEX idx_link_investigation ON investigation_link(investigation_id);
-- CREATE INDEX idx_link_from_entity ON investigation_link(from_entity_id);
-- CREATE INDEX idx_link_to_entity ON investigation_link(to_entity_id);

-- CREATE TABLE IF NOT EXISTS investigation_comment (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     entity_id UUID NOT NULL REFERENCES investigation_entity(id) ON DELETE CASCADE,
--     author_id INTEGER NOT NULL REFERENCES investigation_user(id) ON DELETE CASCADE,
--     content TEXT NOT NULL,
--     created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
-- );

-- CREATE INDEX idx_comment_entity ON investigation_comment(entity_id);
-- CREATE INDEX idx_comment_author ON investigation_comment(author_id);

-- CREATE TABLE IF NOT EXISTS investigation_attachment (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     entity_id UUID NOT NULL REFERENCES investigation_entity(id) ON DELETE CASCADE,
--     file VARCHAR(100) NOT NULL,
--     filename VARCHAR(255) NOT NULL,
--     file_type VARCHAR(50),
--     uploaded_by_id INTEGER NOT NULL REFERENCES investigation_user(id) ON DELETE CASCADE,
--     uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
-- );

-- CREATE INDEX idx_attachment_entity ON investigation_attachment(entity_id);
-- CREATE INDEX idx_attachment_uploaded_by ON investigation_attachment(uploaded_by_id);

-- This migration is a no-op if Django tables already exist
-- It's here for documentation and for fresh Rust-only installations
