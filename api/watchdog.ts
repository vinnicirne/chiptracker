import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function runWatchdog() {
  console.log(`[WATCHDOG] Iniciando verificação: ${new Date().toISOString()}`);

  const { data: chips, error } = await supabase.from('chips').select('*');
  if (error || !chips) return { checked: 0, alerts: 0 };

  const LIMITE_HORAS = 12;
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
      console.warn(`[WATCHDOG] ⚠️ ${chip.name} sem sinal há ${horasSemSinal.toFixed(1)}h`);

      const { data: alertaExistente } = await supabase
        .from('alerts')
        .select('id')
        .eq('chip_id', chip.id)
        .eq('resolved', false)
        .limit(1);

      if (!alertaExistente || alertaExistente.length === 0) {
        await supabase.from('alerts').insert([{
          chip_id: chip.id,
          message: `AUSÊNCIA DE SINAL: O chip não comunica há mais de ${LIMITE_HORAS} horas.`,
          severity: 'critical',
        }]);

        await supabase.from('chip_logs').insert([{
          chip_id: chip.id,
          status: 'offline',
          payload: { error: 'Watchdog timeout: inatividade detectada' },
        }]);

        try {
          await transporter.sendMail({
            from: `Gestão de Frotas <${process.env.GMAIL_USER}>`,
            to: process.env.ALERT_RECIPIENT_EMAIL,
            subject: `🚨 ALERTA CRÍTICO: Chip Offline - ${chip.name}`,
            html: `
              <div style="font-family:sans-serif;border:2px solid #ef4444;padding:20px;border-radius:10px">
                <h2 style="color:#ef4444;margin-top:0">Falha de Comunicação Detectada</h2>
                <p>O chip rastreador <b>${chip.name}</b> parou de reportar à central.</p>
                <p><b>ID:</b> ${chip.id}</p>
                <p><b>Último sinal:</b> ${lastSignal ? lastSignal.toLocaleString('pt-BR') : 'Nunca comunicou'}</p>
                <p><b>Horas sem sinal:</b> ${horasSemSinal === Infinity ? 'Nunca comunicou' : horasSemSinal.toFixed(1) + 'h'}</p>
                <p style="background:#fee2e2;padding:10px;border-radius:5px;color:#b91c1c">
                  O tempo limite de ${LIMITE_HORAS} horas foi excedido. Verifique a alimentação do chip ou a cobertura da operadora.
                </p>
              </div>
            `,
          });
          console.log(`[WATCHDOG] 📧 Email enviado para ${chip.name}`);
        } catch (mailErr) {
          console.error('[WATCHDOG] Erro ao enviar email:', mailErr);
        }

        alertsGerados++;
      }
    } else {
      console.log(`[WATCHDOG] ✅ ${chip.name}: último sinal há ${horasSemSinal.toFixed(1)}h`);
    }
  }

  return { checked: chips.length, alerts: alertsGerados };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Protege o endpoint com uma chave secreta para não ser chamado por qualquer um
  const secret = req.headers['x-watchdog-secret'] || req.query['secret'];
  if (secret !== process.env.WATCHDOG_SECRET && process.env.WATCHDOG_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  const result = await runWatchdog();
  res.json({ success: true, ...result, timestamp: new Date().toISOString() });
}
