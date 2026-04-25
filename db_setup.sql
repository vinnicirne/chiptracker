-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE --

-- 1. Tabela de Chips (Dispositivos)
CREATE TABLE IF NOT EXISTS chips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Logs (Comunicação)
CREATE TABLE IF NOT EXISTS chip_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chip_id TEXT REFERENCES chips(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Alertas
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chip_id TEXT REFERENCES chips(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'critical',
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de diagnóstico de webhook (NOVA)
-- Salva TUDO que chega no webhook, mesmo sem chip_id identificado
CREATE TABLE IF NOT EXISTS webhook_raw_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payload JSONB,
  method TEXT,
  headers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
