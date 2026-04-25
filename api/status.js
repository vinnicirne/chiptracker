module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return res.status(200).json({
    status: "BOOT_SUCCESS",
    message: "A API serverless em JAVASCRIPT está respondendo!",
    timestamp: new Date().toISOString(),
    diagnostics: {
      url_configured: !!supabaseUrl,
      key_configured: !!supabaseKey,
      node_version: process.version,
      architecture: "CommonJS (Bulletproof)"
    }
  });
};
