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

-- MONITORAMENTO NATIVO (WATCHDOG SQL)
-- Esta função identifica chips offline sem depender de servidores externos
CREATE OR REPLACE FUNCTION check_chip_inactivity()
RETURNS void AS $$
BEGIN
  INSERT INTO alerts (chip_id, message, severity)
  SELECT 
    c.id, 
    'AUSÊNCIA DE SINAL: Inatividade de 12h detectada pelo Watchdog Supabase.', 
    'critical'
  FROM chips c
  LEFT JOIN (
    SELECT chip_id, MAX(created_at) as last_signal
    FROM chip_logs
    GROUP BY chip_id
  ) l ON c.id = l.chip_id
  WHERE (l.last_signal < NOW() - INTERVAL '12 hours' OR l.last_signal IS NULL)
    AND NOT EXISTS (
      SELECT 1 FROM alerts a 
      WHERE a.chip_id = c.id AND a.resolved = false
    );
END;
$$ LANGUAGE plpgsql;

-- Para rodar automaticamente no Supabase:
-- 1. Habilite a extensão pg_cron no painel
-- 2. Execute: SELECT cron.schedule('0 0 * * *', 'SELECT check_chip_inactivity()');
