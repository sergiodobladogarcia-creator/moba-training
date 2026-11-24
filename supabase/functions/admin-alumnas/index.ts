// Acciones de la profesora sobre cuentas de alumnas: nueva contraseña temporal y eliminar cuenta.
// Solo responde si quien llama es administradora (perfiles.rol = 'admin').
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

function clave(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint8Array(8));
  return "Moba-" + Array.from(r, (n) => abc[n % abc.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const quien = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: esAdmin, error: e1 } = await quien.rpc("es_admin");
    if (e1 || !esAdmin) return json({ error: "Solo la profesora puede hacer esto" }, 403);

    const { accion, cliente_id } = await req.json();
    if (!cliente_id) return json({ error: "Falta la alumna" }, 400);
    const admin = createClient(url, svc);
    const { data: p } = await admin.from("perfiles").select("rol").eq("id", cliente_id).maybeSingle();
    if (!p) return json({ error: "Alumna no encontrada" }, 404);
    if (p.rol === "admin") return json({ error: "No se puede usar con la cuenta de la profesora" }, 400);

    if (accion === "clave") {
      const password = clave();
      const { error } = await admin.auth.admin.updateUserById(cliente_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ password });
    }
    if (accion === "eliminar") {
      const { error } = await admin.auth.admin.deleteUser(cliente_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
