import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST /api/chips - cadastrar chip
  if (req.method === 'POST') {
    const { id, name, api_url } = req.body as { id: string; name: string; api_url?: string };
    const { error } = await supabase
      .from('chips')
      .upsert([{ id, name, api_url }], { onConflict: 'id' });
    if (error) return res.status(400).json(error);
    return res.json({ message: 'Chip registrado/atualizado' });
  }

  // GET /api/chips - listar chips
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('chips').select('*');
    if (error) return res.status(400).json(error);
    return res.json(data);
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
