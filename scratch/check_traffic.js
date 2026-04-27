const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTraffic() {
  console.log('--- DIAGNÓSTICO DE TRÁFEGO ---');
  
  // 1. Checar últimos sinais brutos
  const { data: raw, error: err1 } = await supabase
    .from('webhook_raw_logs')
    .select('created_at, payload')
    .order('created_at', { ascending: false })
    .limit(5);

  if (err1) console.error('Erro ao ler raw logs:', err1);
  else {
    console.log('\nÚltimos 5 Webhooks Brutos:');
    raw.forEach(r => console.log(`[${new Date(r.created_at).toLocaleString()}] - ID/IMEI: ${r.payload?.chip_id || r.payload?.imei || 'DESCONHECIDO'}`));
  }

  // 2. Checar volume na última hora
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: err2 } = await supabase
    .from('webhook_raw_logs')
    .select('*', { count: 'exact', head: true })
    .gt('created_at', oneHourAgo);

  if (err2) console.error('Erro ao contar logs:', err2);
  else console.log(`\nSinais recebidos na última hora: ${count}`);
}

checkTraffic();
