const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Captura TUDO: Body (JSON/Form) ou Query String (GET)
  const payload = {
    ...req.query,
    ...(typeof req.body === 'object' ? req.body : {})
  };

  // TUDO que chegar, a gente salva nos logs brutos PRIMEIRO (para debug)
  try {
    await supabase.from('webhook_raw_logs').insert([{
      payload: payload,
      method: req.method,
      headers: req.headers
    }]);
  } catch (err) {
    console.error("FATAL: Erro ao salvar log bruto", err);
  }

  const body = payload;

  // Extração inteligente de ID (Adaptada para SmartGPS)
  let chip_id = null;
  let device_name = null;

  // Prioridade 1: Formato detectado no seu Log (body.device.imei)
  if (body.device && typeof body.device === 'object') {
    chip_id = body.device.imei || body.device.id || body.device.deviceId;
    device_name = body.device.name;
    console.log(`[DEBUG] Detectado dispositivo no log: ${chip_id} (${device_name})`);
  }

  // Prioridade 2: Busca direta na raiz
  if (!chip_id) {
    const directFields = [
      'chip_id', 'imei', 'device_id', 'deviceId', 'identifier',
      'id', 'tracker_id', 'trackerId', 'serialNumber'
    ];
    for (const field of directFields) {
      if (body[field]) {
        chip_id = String(body[field]);
        break;
      }
    }
  }

  // Se ainda não achou, tenta em outros objetos aninhados
  if (!chip_id) {
    const nested = ['tracker', 'chip', 'unit', 'vehicle', 'equipment'];
    for (const parent of nested) {
      if (body[parent] && typeof body[parent] === 'object') {
        chip_id = body[parent].imei || body[parent].id || body[parent].deviceId || body[parent].chip_id;
        if (chip_id) {
          chip_id = String(chip_id);
          device_name = device_name || body[parent].name;
          break;
        }
      }
    }
  }

  // Salva log bruto para diagnóstico no Dashboard
  try {
    await supabase.from('webhook_raw_logs').insert([{
      payload: body,
      method: req.method,
      headers: req.headers,
    }]);
  } catch (e) {
    console.error('Erro ao salvar raw log', e);
  }

  if (!chip_id) {
    return res.status(200).json({
      success: false,
      message: 'Sinal recebido, mas ID do dispositivo não identificado.'
    });
  }

  try {
    // Auto-cadastro de novo chip (Deep Clean Nuclear)
    if (chip_id) {
      const { data: existingChip } = await supabase.from('chips').select('id').eq('id', chip_id).single();
      if (!existingChip) {
        await supabase.from('chips').insert([{
          id: chip_id,
          name: device_name || `Novo Chip ${chip_id.slice(-4)}`,
          api_url: ''
        }]);
      }

      // Registrar Log com status rico
      const latitude = body.latitude || body.lat;
      const longitude = body.longitude || body.lng || body.lon;

      await supabase.from('chip_logs').insert([{
        chip_id: chip_id,
        status: 'online',
        payload: { 
          ...body,
          location: latitude ? { lat: latitude, lng: longitude } : null
        }
      }]);

    // Enviar E-mail se for um Alerta ou Evento de Ignição
    const isAlert = body.alert || body.type?.toLowerCase().includes('ignition') || body.message;
    if (isAlert && process.env.GMAIL_USER && process.env.ALERT_RECIPIENT_EMAIL) {
      try {
        const subject = `🚨 ALERTA: ${device_name || chip_id} - ${body.type || 'Evento'}`;
        const html = `
          <h3>Novo Alerta Detectado</h3>
          <p><strong>Veículo:</strong> ${device_name || 'Desconhecido'}</p>
          <p><strong>ID/IMEI:</strong> ${chip_id}</p>
          <p><strong>Evento:</strong> ${body.type || 'N/A'}</p>
          <p><strong>Mensagem:</strong> ${body.message || 'N/A'}</p>
          <p><strong>Hora:</strong> ${body.time || new Date().toLocaleString()}</p>
          <p><a href="https://chip-tracker-monitor.vercel.app">Ver no Dashboard</a></p>
        `;

        await transporter.sendMail({
          from: `"Monitoramento Chip Watch" <${process.env.GMAIL_USER}>`,
          to: process.env.ALERT_RECIPIENT_EMAIL,
          subject: subject,
          html: html,
        });
        console.log(`[MAIL] Alerta enviado para ${process.env.ALERT_RECIPIENT_EMAIL}`);
      } catch (mailErr) {
        console.error("Erro ao enviar e-mail de alerta", mailErr);
      }
    }

    return res.status(200).json({ success: true, chip_id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
