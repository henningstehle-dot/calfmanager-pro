// CalfManager Pro – optionale Online-OCR (Google Cloud Vision)
// Google API key nur als Supabase Edge Function Secret speichern.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return respond({error:'Methode nicht erlaubt'},405);
 try{
  const jwt=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!jwt)return respond({error:'Anmeldung erforderlich'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const sb=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${jwt}`}}});
  const {data:{user},error}=await sb.auth.getUser(jwt);
  if(error||!user)return respond({error:'Nicht angemeldet'},401);
  const key=Deno.env.get('GOOGLE_VISION_API_KEY');
  if(!key)return respond({error:'Online-OCR ist noch nicht eingerichtet'},503);
  const body=await req.json();const img=body?.image_base64;
  if(typeof img!=='string'||img.length>7_000_000||!/^[A-Za-z0-9+/=]+$/.test(img))return respond({error:'Ungültiges Bild (maximal 5 MB)'},400);
  const response=await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:[{image:{content:img},features:[{type:'TEXT_DETECTION',maxResults:1}]}]})});
  if(!response.ok)return respond({error:'Online-OCR-Dienst nicht verfügbar'},502);
  const result=await response.json();
  if(result.responses?.[0]?.error)return respond({error:'Bild konnte nicht erkannt werden'},502);
  const text=String(result.responses?.[0]?.fullTextAnnotation?.text??result.responses?.[0]?.textAnnotations?.[0]?.description??'');
  return respond({text});
 }catch{return respond({error:'Online-OCR fehlgeschlagen'},500)}
});
