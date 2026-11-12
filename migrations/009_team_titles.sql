-- Existing installations only; apply once after a backup.
-- Fresh installations already include this column in database/schema.sql.
ALTER TABLE users ADD COLUMN team_title VARCHAR(32) DEFAULT NULL;
