const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'CONFIG_MISSING' });
  }

  // Proteção do Watchdog
  const secret = req.headers['x-watchdog-secret'] || req.query['secret'];
  if (secret !== process.env.WATCHDOG_SECRET && process.env.WATCHDOG_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  try {
    const { data: chips, error } = await supabase.from('chips').select('*');
    if (error || !chips) throw new Error(error?.message || 'Chips não encontrados');

    const LIMITE_HORAS = 24;
    const now = new Date();
    let alertsGerados = 0;

    for (const chip of chips) {
      const { data: logs } = await supabase
        .from('chip_logs')
        .select('created_at')
        .eq('chip_id', chip.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastSignal = logs && logs[0] ? new Date(logs[0].created_at) : null;
      const horasSemSinal = lastSignal
        ? (now.getTime() - lastSignal.getTime()) / (1000 * 60 * 60)
        : Infinity;

      if (horasSemSinal > LIMITE_HORAS) {
        const { data: alertaExistente } = await supabase
          .from('alerts')
          .select('id')
          .eq('chip_id', chip.id)
          .eq('resolved', false)
          .limit(1);

        if (!alertaExistente || alertaExistente.length === 0) {
          await supabase.from('alerts').insert([{
            chip_id: chip.id,
            message: `AUSÊNCIA DE SINAL: Inatividade de ${LIMITE_HORAS}h.`,
            severity: 'critical',
          }]);

          await supabase.from('chip_logs').insert([{
            chip_id: chip.id,
            status: 'offline',
            payload: { error: 'Watchdog timeout' },
          }]);

          // Envio de e-mail (Blindado)
          if (process.env.GMAIL_USER && process.env.ALERT_RECIPIENT_EMAIL) {
            try {
              await transporter.sendMail({
                from: `"Monitoramento Alerta" <${process.env.GMAIL_USER}>`,
                to: process.env.ALERT_RECIPIENT_EMAIL,
                subject: `⚠️ ATENÇÃO: ${chip.name} Offline há mais de 24h`,
                html: `
                  <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #e11d48;">⚠️ Veículo Fora de Alcance</h2>
                    <p>O veículo <strong>${chip.name}</strong> está sem reportar sinal há mais de <strong>24 horas</strong>.</p>
                    <hr />
                    <p><strong>Detalhes do Dispositivo:</strong></p>
                    <ul>
                      <li><strong>Nome:</strong> ${chip.name}</li>
                      <li><strong>IMEI/ID:</strong> ${chip.id}</li>
                      <li><strong>Último sinal conhecido:</strong> ${lastSignal ? lastSignal.toLocaleString() : 'Nunca'}</li>
                    </ul>
                    <p style="margin-top: 20px;">
                      <a href="https://chip-tracker-monitor.vercel.app" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Acessar Dashboard</a>
                    </p>
                  </div>
                `,
              });
            } catch (mailErr) {
              console.error('Falha no envio de email', mailErr);
            }
          }
          alertsGerados++;
        }
      }
    }

    return res.status(200).json({ success: true, checked: chips.length, alerts: alertsGerados });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
