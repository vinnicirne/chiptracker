import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ 
      success: false, 
      error: 'Variáveis de ambiente do Supabase não configuradas.' 
    });
  }

  try {
    const [chipsRes, logsRes, alertsRes, rawLogsRes] = await Promise.all([
      supabase.from('chips').select('*').order('name'),
      supabase.from('chip_logs').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }),
      supabase.from('webhook_raw_logs').select('*').order('created_at', { ascending: false }).limit(10)
    ]);

    return res.status(200).json({
      chips: chipsRes.data || [],
      recentLogs: logsRes.data || [],
      activeAlerts: alertsRes.data || [],
      webhookRaw: rawLogsRes.data || [],
      db_status: {
        chips: !chipsRes.error,
        logs: !logsRes.error,
        alerts: !alertsRes.error,
        raw_logs: !rawLogsRes.error
      }
    });
  } catch (error: any) {
    console.error('[API_ERROR]', error);
    return res.status(500).json({ error: 'Erro interno', message: error.message });
  }
}
