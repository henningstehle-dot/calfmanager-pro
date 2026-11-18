// Supabase Edge Function. Secrets: RESEND_API_KEY, INVITE_FROM_EMAIL.
import { createClient } from 'npm:@supabase/supabase-js@2';
Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers});
  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) throw new Error('Nicht angemeldet');
    const client = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) throw new Error('Nicht angemeldet');
    const {farm_id,email,redirect_base} = await req.json();
    if (typeof farm_id !== 'string'||typeof email !== 'string'||typeof redirect_base !== 'string') throw new Error('Ungültige Angaben');
    const origin = new URL(redirect_base);
    if (!['https:','http:'].includes(origin.protocol)||origin.username||origin.password||origin.search||origin.hash) throw new Error('Ungültige Weiterleitung');
    const allowed = (Deno.env.get('INVITE_APP_URL')||'').replace(/\/$/,'');
    if (!allowed || redirect_base.replace(/\/$/,'')!==allowed) throw new Error('App-Adresse nicht freigegeben');
    const {data:token,error:inviteError}=await client.rpc('create_farm_invitation',{p_farm_id:farm_id,p_email:email});
    if (inviteError) throw inviteError;
    const key=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('INVITE_FROM_EMAIL');
    if (!key||!from) throw new Error('E-Mail-Versand nicht eingerichtet');
    const link=new URL(redirect_base);link.searchParams.set('invite',token);
    const resp=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:'Einladung zu CalfManager Pro',text:`Du wurdest eingeladen, einem Betrieb in CalfManager Pro beizutreten. Dieser Link ist sieben Tage gültig:\n\n${link.toString()}\n\nMelde dich mit dieser E-Mail-Adresse an oder registriere dich. Die Einladung wird erst nach deiner Anmeldung angenommen.`})});
    if (!resp.ok) throw new Error('E-Mail-Versand fehlgeschlagen ('+resp.status+')');
    return new Response(JSON.stringify({ok:true}),{headers});
  }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Unbekannter Fehler'}),{status:400,headers});}
});
