import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query as { id: string };
  const { error } = await supabase
    .from('alerts')
    .update({ resolved: true })
    .eq('id', id);

  if (error) return res.status(400).json(error);
  return res.json({ message: 'Alerta resolvido' });
}
