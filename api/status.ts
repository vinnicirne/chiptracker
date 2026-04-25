import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const chipsRes = await supabase.from('chips').select('*');
    const logsRes = await supabase
      .from('chip_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    const alertsRes = await supabase
      .from('alerts')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    res.json({
      chips: chipsRes.data || [],
      recentLogs: logsRes.data || [],
      activeAlerts: alertsRes.data || [],
      db_status: {
        chips: !chipsRes.error,
        logs: !logsRes.error,
        alerts: !alertsRes.error,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno', details: String(error) });
  }
}
