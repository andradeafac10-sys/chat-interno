-- Estrutura do banco de dados do chat interno

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','operator')),
  color TEXT NOT NULL DEFAULT '#2F6FED',
  avatar_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garante a coluna em bancos que já existiam antes dessa versão
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garante as colunas em bancos que já existiam antes dessa versão
ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS group_attachments (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  kind TEXT NOT NULL DEFAULT 'file' CHECK (kind IN ('file','image')),
  uploaded_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

-- conversation_id: para conversa privada usamos 'dm-<id_do_operador>'
-- para grupo usamos 'group-<id_do_grupo>'
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('text','image','file','audio')),
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  audio_seconds INTEGER,
  pinned BOOLEAN NOT NULL DEFAULT false,
  pinned_by INTEGER REFERENCES users(id),
  pinned_at TIMESTAMPTZ,
  reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  edited BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garante as colunas em bancos que já existiam antes dessa versão
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

-- Libera qualquer um dos emojis padrão (bancos antigos tinham só 👍/❌)
ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_emoji_check;
ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_emoji_check
  CHECK (emoji IN ('👍','❤️','😂','😮','😢','🙏'));

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  image_url TEXT,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','users','groups')),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garante a coluna em bancos que já existiam antes dessa versão
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all';

-- Quem deve receber o comunicado quando audience != 'all'
CREATE TABLE IF NOT EXISTS announcement_targets (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS announcement_acks (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
-- ===================================================================
-- PAINEL GESTÃO — TAREFAS (Etapa 3)
-- Este bloco não altera nada que já existe. Só adiciona tabelas novas.
-- ===================================================================

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',       -- pending, in_progress, done, canceled
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',       -- low, medium, high
  progress_type VARCHAR(10) NOT NULL DEFAULT 'manual',  -- manual, checklist
  progress_percent INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMP,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_checklist_items (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_history (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  action VARCHAR(50) NOT NULL,   -- created, status_changed, priority_changed, due_date_changed, assignee_added, assignee_removed, checklist_item_done, checklist_item_undone, comment_added, deleted
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task ON task_history(task_id);


-- ============================================================
-- ROTINAS (tarefas recorrentes) — Etapa 6 do Painel Gestão.
-- A "rotina" é a receita; cada dia que ela deve acontecer vira
-- uma tarefa de verdade (linha própria em "tasks"), independente
-- das outras — concluir a de segunda não afeta a de terça.
-- ============================================================

CREATE TABLE IF NOT EXISTS task_recurrences (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',        -- low, medium, high
  recurrence_type VARCHAR(20) NOT NULL DEFAULT 'weekdays', -- daily, weekdays, specific_days, monthly
  days_of_week INTEGER[] NOT NULL DEFAULT '{}',            -- 0=domingo ... 6=sábado (specific_days)
  day_of_month INTEGER,                                    -- usado quando recurrence_type = monthly
  start_time TIME,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,                                           -- opcional; nulo = sem data pra parar
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recurrence_assignees (
  recurrence_id INTEGER NOT NULL REFERENCES task_recurrences(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (recurrence_id, user_id)
);

-- Liga cada tarefa gerada de volta pra sua rotina de origem, e guarda
-- qual dia ela representa — é isso que impede duplicar a mesma ocorrência.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_id INTEGER REFERENCES task_recurrences(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS occurrence_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurrence_occurrence
  ON tasks(recurrence_id, occurrence_date) WHERE recurrence_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurrences_active ON task_recurrences(active);

-- Grupos que a pessoa escolheu esconder da própria lista (não afeta ninguém
-- mais nem tira ela do grupo de verdade — é só uma preferência pessoal de visão).
CREATE TABLE IF NOT EXISTS hidden_groups (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

-- Conversas fixadas no topo da lista (funciona pra DM e grupo, por isso guarda
-- o ID da conversa como texto em vez de referenciar uma tabela específica).
CREATE TABLE IF NOT EXISTS pinned_conversations (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);

-- Conversas privadas (DM) que a pessoa "fechou" — some da lista, mas o histórico
-- nunca é apagado, e volta a aparecer sozinha assim que qualquer um dos dois manda
-- mensagem de novo (fechar não é sair, é só arrumar a casa).
CREATE TABLE IF NOT EXISTS closed_dms (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  other_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_user_id)
);

-- ============================================================
-- ROTINAS COMO LISTA DE AFAZERES — cada ocorrência de rotina vira
-- uma linha simples de "feito / não feito", em vez de uma tarefa
-- completa. Reaproveita task_recurrences/recurrence_assignees (a
-- "receita" da rotina) já existentes.
-- ============================================================
CREATE TABLE IF NOT EXISTS routine_completions (
  id SERIAL PRIMARY KEY,
  recurrence_id INTEGER NOT NULL REFERENCES task_recurrences(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurrence_date DATE NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  UNIQUE (recurrence_id, user_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_routine_completions_user_date ON routine_completions(user_id, occurrence_date);

-- Até onde cada pessoa já leu cada conversa — usado pra calcular quantas
-- mensagens não lidas mostrar (sobrevive a F5, ao contrário de guardar só na tela).
CREATE TABLE IF NOT EXISTS conversation_reads (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, conversation_id)
);
