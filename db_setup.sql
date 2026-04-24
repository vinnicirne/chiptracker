-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE --

-- 1. Tabela de Chips (Dispositivos)
CREATE TABLE IF NOT EXISTS chips (
  id TEXT PRIMARY KEY, -- IMEI ou ID único do chip
  name TEXT NOT NULL,
  api_url TEXT, -- URL opcional do chip
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Logs (Comunicação)
-- Nota: O chip ou sua central deve inserir dados aqui quando houver comunicação.
CREATE TABLE IF NOT EXISTS chip_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chip_id TEXT REFERENCES chips(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'online' / 'offline'
  payload JSONB, -- Dados extras (bateria, sinal, coordenadas)
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
