import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodeCron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Supabase Setup
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Nodemailer Setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/**
 * Watchdog: Verifica se os chips pararam de enviar sinal por mais de 12 horas.
 */
async function runWatchdog() {
  console.log(`[${new Date().toISOString()}] Rodando Watchdog de Inatividade...`);
  
  try {
    const { data: chips, error: chipsError } = await supabase.from('chips').select('*');
    if (chipsError) throw chipsError;

    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
    const now = new Date();

    for (const chip of chips) {
      // Busca o último log desse chip
      const { data: logs } = await supabase
        .from('chip_logs')
        .select('created_at')
        .eq('chip_id', chip.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastSignal = logs && logs[0] ? new Date(logs[0].created_at) : null;
      const hoursSinceLastSignal = lastSignal ? (now.getTime() - lastSignal.getTime()) / (1000 * 60 * 60) : Infinity;

      // Se não houver sinal há mais de 12 horas
      if (hoursSinceLastSignal > 12) {
        console.warn(`[WATCHDOG] O chip ${chip.name} (${chip.id}) está sem sinal há ${hoursSinceLastSignal.toFixed(1)} horas.`);

        // 1. Verificar se já existe um alerta ativo para evitar spam
        const { data: existingAlert } = await supabase
          .from('alerts')
          .select('id')
          .eq('chip_id', chip.id)
          .eq('resolved', false)
          .limit(1);

        if (!existingAlert || existingAlert.length === 0) {
          // 2. Registrar Novo Alerta
          await supabase.from('alerts').insert([{
            chip_id: chip.id,
            message: `AUSÊNCIA DE SINAL: O chip não comunica com a central há mais de 12 horas.`,
            severity: 'critical'
          }]);

          // 3. Registrar Log de Falha
          await supabase.from('chip_logs').insert([{
            chip_id: chip.id,
            status: 'offline',
            payload: { error: 'Watchdog timeout: Inactivity detected' }
          }]);

          // 4. Enviar Notificação via Gmail
          try {
            await transporter.sendMail({
              from: `Gestão de Frotas <${process.env.GMAIL_USER}>`,
              to: process.env.ALERT_RECIPIENT_EMAIL,
              subject: `🚨 ALERTA CRÍTICO: Chip Offline - ${chip.name}`,
              html: `
                <div style="font-family: sans-serif; border: 2px solid #ef4444; padding: 20px; border-radius: 10px;">
                  <h2 style="color: #ef4444; margin-top: 0;">Falha de Comunicação Detectada</h2>
                  <p>O chip rastreador <b>${chip.name}</b> parou de reportar à central.</p>
                  <p><b>ID do Equipamento:</b> ${chip.id}</p>
                  <p><b>Último Sinal:</b> ${lastSignal ? lastSignal.toLocaleString() : 'Nunca comunicou'}</p>
                  <p style="background: #fee2e2; padding: 10px; border-radius: 5px; color: #b91c1c;">
                    O tempo de tolerância de 12 horas foi excedido. Verifique a alimentação do chip ou a cobertura da operadora.
                  </p>
                </div>
              `
            });
            console.log(`Email de alerta enviado para ${chip.name}`);
          } catch (mailErr) {
            console.error("Erro ao enviar email:", mailErr);
          }
        }
      } else {
        console.log(`[OK] Chip ${chip.name} comunicou há ${hoursSinceLastSignal.toFixed(1)} horas.`);
      }
    }
  } catch (err) {
    console.error("Erro no Watchdog:", err);
  }
}

// Configura o cron job para rodar 2x ao dia (00:00 e 12:00)
nodeCron.schedule('0 0,12 * * *', () => {
  runWatchdog();
});

// Middleware
app.use(express.json());

// API Endpoints
app.get("/api/status", async (req, res) => {
  try {
    console.log("[API] Buscando dados do Supabase...");
    
    // Buscamos cada um separadamente para identificar qual falha (por falta de tabela, etc)
    const chipsRes = await supabase.from('chips').select('*');
    if (chipsRes.error) console.error("Erro ao buscar chips:", chipsRes.error.message);

    const logsRes = await supabase.from('chip_logs').select('*').order('created_at', { ascending: false }).limit(30);
    if (logsRes.error) console.error("Erro ao buscar logs:", logsRes.error.message);

    const [alertsRes, rawLogsRes] = await Promise.all([
      supabase.from('alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }),
      supabase.from('webhook_raw_logs').select('*').order('created_at', { ascending: false }).limit(15)
    ]);

    if (alertsRes.error) console.error("Erro ao buscar alertas:", alertsRes.error.message);
    if (rawLogsRes.error) console.error("Erro ao buscar raw logs:", rawLogsRes.error.message);

    res.json({
      chips: chipsRes.data || [],
      recentLogs: logsRes.data || [],
      activeAlerts: alertsRes.data || [],
      webhookRaw: rawLogsRes.data || [],
      db_status: {
        chips: !chipsRes.error,
        logs: !logsRes.error,
        alerts: !alertsRes.error
      }
    });
  } catch (error) {
    console.error("Erro crítico na API /status:", error);
    res.status(500).json({ 
      error: "Erro interno no servidor",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Registrar Novo Chip
app.post("/api/chips", async (req, res) => {
  const { id, name, api_url } = req.body;
  const { data, error } = await supabase.from('chips').upsert([{ id, name, api_url }], { onConflict: 'id' });
  if (error) return res.status(400).json(error);
  res.json({ message: "Chip registrado/atualizado", data });
});

// Deletar Chip
app.delete("/api/chips/:id", async (req, res) => {
  const { error } = await supabase.from('chips').delete().eq('id', req.params.id);
  if (error) return res.status(400).json(error);
  res.json({ message: "Chip removido" });
});

// Resolver Alerta
app.post("/api/alerts/:id/resolve", async (req, res) => {
  const { error } = await supabase.from('alerts').update({ resolved: true }).eq('id', req.params.id);
  if (error) return res.status(400).json(error);
  res.json({ message: "Alerta resolvido" });
});

// Simular Sinal (Para Testes do Usuário)
app.post("/api/simulate-signal", async (req, res) => {
  const { chip_id } = req.body;
  const { error } = await supabase.from('chip_logs').insert([{
    chip_id,
    status: 'online',
    payload: { battery: 100, signal: 'excelente', info: 'Simulação Manual' }
  }]);
  if (error) return res.status(400).json(error);
  res.json({ message: "Sinal simulado com sucesso. O Watchdog agora considerará o chip como ativo." });
});

/**
 * Endpoint para receber sinal real do chip ou da central de rastreamento (Webhook)
 * Configure seu rastreador para enviar um POST aqui.
 */
app.post("/api/webhooks/signal", async (req, res) => {
  const { chip_id, battery, signal, lat, lng, ...rest } = req.body;

  if (!chip_id) {
    return res.status(400).json({ error: "Missing chip_id in payload" });
  }

  console.log(`[WEBHOOK] Sinal recebido do chip: ${chip_id}`);

  const { error } = await supabase.from('chip_logs').insert([{
    chip_id,
    status: 'online',
    payload: {
      battery: battery || 100,
      signal: signal || 'ok',
      lat: lat || null,
      lng: lng || null,
      source: 'external_webhook',
      raw_data: rest
    }
  }]);

  if (error) {
    console.error("Erro ao salvar log via webhook:", error.message);
    return res.status(500).json(error);
  }

  res.json({ success: true, message: "Sinal registrado. Watchdog atualizado." });
});

app.post("/api/check-now", async (req, res) => {
  await runWatchdog();
  res.json({ message: "Processo de Watchdog concluído." });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
