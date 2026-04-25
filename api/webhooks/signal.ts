import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Tenta extrair o chip_id do payload da SmartGPS.
 * A SmartGPS pode enviar: imei, device_id, deviceId, chip_id, id, identifier, etc.
 * Também aceita formatos aninhados como { device: { imei: "..." } }
 */
function extractChipId(body: Record<string, unknown>): string | null {
  // Campos diretos mais comuns em plataformas de rastreamento
  const directFields = [
    'chip_id', 'imei', 'device_id', 'deviceId', 'identifier',
    'id', 'tracker_id', 'trackerId', 'equipmentId', 'equipment_id',
    'unitId', 'unit_id', 'vehicleId', 'vehicle_id', 'serialNumber', 'serial'
  ];

  for (const field of directFields) {
    if (body[field] && typeof body[field] === 'string') return body[field] as string;
    if (body[field] && typeof body[field] === 'number') return String(body[field]);
  }

  // Campos aninhados: { device: { imei, id }, tracker: { imei } }
  const nested = ['device', 'tracker', 'chip', 'unit', 'vehicle', 'equipment'];
  for (const parent of nested) {
    const obj = body[parent] as Record<string, unknown>;
    if (obj && typeof obj === 'object') {
      for (const field of directFields) {
        if (obj[field]) return String(obj[field]);
      }
    }
  }

  return null;
}

function extractCoords(body: Record<string, unknown>) {
  const lat = body['lat'] || body['latitude'] || body['Latitude'] ||
    (body['device'] as Record<string, unknown>)?.['lat'] ||
    (body['position'] as Record<string, unknown>)?.['lat'] || null;
  const lng = body['lng'] || body['lon'] || body['longitude'] || body['Longitude'] ||
    (body['device'] as Record<string, unknown>)?.['lng'] ||
    (body['position'] as Record<string, unknown>)?.['lng'] || null;
  return { lat, lng };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Aceita GET também (alguns sistemas testam com GET)
  const body = req.method === 'GET' ? (req.query as Record<string, unknown>) : (req.body as Record<string, unknown>) || {};

  console.log('[WEBHOOK] Payload recebido:', JSON.stringify(body));

  // Salva o raw payload numa tabela de diagnóstico independente do chip_id
  await supabase.from('webhook_raw_logs').insert([{
    payload: body,
    method: req.method,
    headers: req.headers,
  }]).then(() => {}); // Ignora erro — tabela pode não existir ainda

  const chip_id = extractChipId(body);

  if (!chip_id) {
    console.warn('[WEBHOOK] chip_id não encontrado no payload. Payload salvo em webhook_raw_logs.');
    // Retorna 200 para a SmartGPS não ficar reenvando
    return res.status(200).json({
      success: false,
      message: 'Payload recebido mas chip_id não identificado. Verifique webhook_raw_logs no Supabase.',
      received_payload: body,
    });
  }

  const { lat, lng } = extractCoords(body);

  // Verifica se o chip está cadastrado, se não estiver, cadastra automaticamente
  const { data: existingChip } = await supabase
    .from('chips')
    .select('id')
    .eq('id', chip_id)
    .limit(1);

  if (!existingChip || existingChip.length === 0) {
    await supabase.from('chips').insert([{
      id: chip_id,
      name: `Chip ${chip_id}`,
    }]);
    console.log(`[WEBHOOK] Novo chip cadastrado automaticamente: ${chip_id}`);
  }

  // Registra o log de sinal
  const { error } = await supabase.from('chip_logs').insert([{
    chip_id,
    status: 'online',
    payload: {
      lat: lat || null,
      lng: lng || null,
      source: 'smartgps_webhook',
      raw_data: body,
    },
  }]);

  if (error) {
    console.error('[WEBHOOK] Erro ao salvar log:', error.message);
    return res.status(500).json({ error: error.message });
  }

  // Se havia alerta ativo para este chip, resolve automaticamente
  await supabase
    .from('alerts')
    .update({ resolved: true })
    .eq('chip_id', chip_id)
    .eq('resolved', false);

  console.log(`[WEBHOOK] ✅ Sinal registrado para chip: ${chip_id}`);
  return res.status(200).json({ success: true, chip_id, message: 'Sinal registrado.' });
}
