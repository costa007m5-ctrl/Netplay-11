-- ============================================================
-- NetPlay — Índices de Performance para a tabela `movies`
-- Execute este script no SQL Editor do Supabase (uma vez só)
-- ============================================================

-- Filtro mais comum: separar filmes de séries
CREATE INDEX IF NOT EXISTS idx_movies_type
  ON movies (type);

-- Busca por título (ilike usa operador de texto — o índice gin/trgm
-- acelera ILIKE '%termo%' em ordens de magnitude)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_movies_title_trgm
  ON movies USING gin (title gin_trgm_ops);

-- Ocultar conteúdo (is_hidden = false é o filtro padrão em todas as telas)
CREATE INDEX IF NOT EXISTS idx_movies_is_hidden
  ON movies (is_hidden);

-- Verificar se conteúdo já existe pelo ID do TMDB
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id
  ON movies (tmdb_id);

-- Ordenação por data de criação (carrossel "Novidades", admin)
CREATE INDEX IF NOT EXISTS idx_movies_created_at
  ON movies (created_at DESC);

-- Ordenação por data de atualização (séries com novos episódios)
CREATE INDEX IF NOT EXISTS idx_movies_updated_at
  ON movies (updated_at DESC);

-- Ordenação por avaliação (busca avançada — Melhor Avaliados)
CREATE INDEX IF NOT EXISTS idx_movies_rating
  ON movies (rating DESC);

-- Índice composto: filtro type + ordenação created_at (query mais frequente)
CREATE INDEX IF NOT EXISTS idx_movies_type_created
  ON movies (type, created_at DESC);

-- Índice composto: filtro type + ordenação updated_at (carrossel novos episódios)
CREATE INDEX IF NOT EXISTS idx_movies_type_updated
  ON movies (type, updated_at DESC);

-- Índice composto: filtro is_hidden + type (tela principal — filtra ocultos e separa tipo)
CREATE INDEX IF NOT EXISTS idx_movies_hidden_type
  ON movies (is_hidden, type);
