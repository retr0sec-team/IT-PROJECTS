const fs = require("fs");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Faltan SUPABASE_URL y/o SUPABASE_PUBLISHABLE_KEY en las variables de entorno de Vercel."
  );
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  console.warn("Aviso: SUPABASE_URL no tiene el formato habitual de Supabase.");
}

const config = `window.NEON_SUPABASE = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(key)}
};
`;

fs.writeFileSync("config.js", config, "utf8");
console.log("NEON//DAY: config.js generado para Vercel.");
