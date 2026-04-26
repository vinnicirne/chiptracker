const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
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

  // Extração inteligente de ID (DeepSeek Suggestion)
  const directFields = [
    'chip_id', 'imei', 'device_id', 'deviceId', 'identifier',
    'id', 'tracker_id', 'trackerId', 'equipmentId', 'equipment_id',
    'unitId', 'unit_id', 'vehicleId', 'vehicle_id', 'serialNumber', 'serial'
  ];

  let chip_id = null;
  for (const field of directFields) {
    if (body[field]) {
      chip_id = String(body[field]);
      break;
    }
  }

  // Tenta em objetos aninhados se falhar
  if (!chip_id) {
    const nested = ['device', 'tracker', 'chip', 'unit', 'vehicle', 'equipment'];
    for (const parent of nested) {
      if (body[parent] && typeof body[parent] === 'object') {
        for (const field of directFields) {
          if (body[parent][field]) {
            chip_id = String(body[parent][field]);
            break;
          }
        }
      }
      if (chip_id) break;
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
    // 1. Garante que o chip existe
    const { data: existing } = await supabase
      .from('chips')
      .select('id')
      .eq('id', chip_id)
      .single();

    if (!existing) {
      await supabase.from('chips').insert([{
        id: chip_id,
        name: `Novo Chip (${chip_id.substring(0, 5)})`
      }]);
    }

    // 2. Registra o sinal online
    await supabase.from('chip_logs').insert([{
      chip_id: chip_id,
      status: 'online',
      payload: body
    }]);

    // 3. Resolve alertas pendentes
    await supabase.from('alerts')
      .update({ resolved: true })
      .eq('chip_id', chip_id)
      .eq('resolved', false);

    return res.status(200).json({ success: true, chip_id });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
