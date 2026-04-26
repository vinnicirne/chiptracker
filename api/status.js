module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabase = require('@supabase/supabase-js').createClient(supabaseUrl, supabaseKey);

  try {
    const [chipsRes, logsRes, alertsRes, rawLogsRes] = await Promise.all([
      supabase.from('chips').select('*').order('name'),
      supabase.from('chip_logs').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }),
      supabase.from('webhook_raw_logs').select('*').order('created_at', { ascending: false }).limit(15)
    ]);

    return res.status(200).json({
      status: "BOOT_SUCCESS",
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
  } catch (error) {
    return res.status(500).json({ error: 'INTERNAL_ERROR', details: error.message });
  }
};
