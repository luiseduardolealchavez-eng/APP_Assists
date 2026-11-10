import { pool } from "./db";

//Migración idempotente para bases ya creadas (init.sql solo corre con un volumen nuevo).
let ready: Promise<unknown> | null = null;

export function ensureSchema() {
  ready ??= pool
    .query(
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;
              CREATE TABLE IF NOT EXISTS questions (
         id         SERIAL PRIMARY KEY,
         question   TEXT NOT NULL,
         answer     TEXT NOT NULL,
         segments   JSONB,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       );
       CREATE TABLE IF NOT EXISTS usuarios_assist (
         id            SERIAL PRIMARY KEY,
         nombre        TEXT NOT NULL,
         correo        TEXT NOT NULL,
         password_hash TEXT NOT NULL,
         estatus       TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estatus IN ('ACTIVO','CANCELADO')),
         created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
       );
       CREATE UNIQUE INDEX IF NOT EXISTS usuarios_assist_correo_key ON usuarios_assist (lower(correo));
       ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES usuarios_assist(id) ON DELETE CASCADE;
       ALTER TABLE questions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES usuarios_assist(id) ON DELETE CASCADE;
       DROP INDEX IF EXISTS documents_content_hash_key;
       CREATE UNIQUE INDEX IF NOT EXISTS documents_user_hash_key ON documents (user_id, content_hash);
       CREATE INDEX IF NOT EXISTS documents_user_idx ON documents (user_id);
       CREATE INDEX IF NOT EXISTS questions_user_idx ON questions (user_id, created_at DESC);`,
    )
    .catch((exceptionDB) => {
      ready = null;
      throw exceptionDB;
    });
  return ready;
}