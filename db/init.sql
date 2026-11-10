-- Creación de extensión de Postgresql
CREATE EXTENSION IF NOT EXISTS vector;

-- Se guarda la información de los documentos
CREATE TABLE IF NOT EXISTS documents (
  id         SERIAL PRIMARY KEY,
  filename   TEXT NOT NULL,
  mime_type  TEXT,
  size_bytes INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Usamos qwen3 como modelo de ollama: https://ollama.com/search
CREATE TABLE IF NOT EXISTS chunks (
  id          SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1024)
);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

-- Hash del contenido normalizado: evita guardar el mismo contenido dos veces
-- (los documentos anteriores quedan con NULL, que UNIQUE permite)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Historial de preguntas y respuestas
CREATE TABLE IF NOT EXISTS questions (
  id         SERIAL PRIMARY KEY,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  segments   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usuarios (password con hash bcrypt)
CREATE TABLE IF NOT EXISTS usuarios_assist (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  estatus       TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estatus IN ('ACTIVO','CANCELADO')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_assist_correo_key ON usuarios_assist (lower(correo));

-- Propiedad por usuario: cada usuario solo ve/usa sus documentos y su historial.
-- (Filas anteriores quedan con user_id NULL y no son visibles para nadie.)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES usuarios_assist(id) ON DELETE CASCADE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES usuarios_assist(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS documents_content_hash_key;
CREATE UNIQUE INDEX IF NOT EXISTS documents_user_hash_key ON documents (user_id, content_hash);
CREATE INDEX IF NOT EXISTS documents_user_idx ON documents (user_id);
CREATE INDEX IF NOT EXISTS questions_user_idx ON questions (user_id, created_at DESC);