/* Camada de plataforma: substitui as capacidades do Claude por serviços próprios
   (Supabase para login e dados, função /api/ai para a IA, voz e microfone do navegador). */
(function(){
  const CFG={ ready:null, sb:null, user:null, session:null, plan:"free" };
  window.RB=CFG;
  async function loadConfig(){
    const r=await fetch("/api/config"); if(!r.ok) throw new Error("config"); const c=await r.json();
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
    CFG.sb=createClient(c.supabaseUrl,c.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    CFG.priceLabel=c.priceLabel||"";
    const { data } = await CFG.sb.auth.getSession(); CFG.session=data.session; CFG.user=data.session?.user||null;
    CFG.sb.auth.onAuthStateChange((_e,s)=>{ const was=!!CFG.user; CFG.session=s; CFG.user=s?.user||null; if(!was&&CFG.user) location.reload(); });
    if(CFG.user) await refreshPlan();
    return CFG;
  }
  async function refreshPlan(){ try{ const { data } = await CFG.sb.from("profiles").select("plan,pro_until").eq("id",CFG.user.id).maybeSingle();
    CFG.plan = data && data.plan==="pro" && (!data.pro_until || new Date(data.pro_until)>new Date()) ? "pro" : "free"; }catch(e){} return CFG.plan; }
  CFG.refreshPlan=refreshPlan;
  CFG.ready=loadConfig().catch(e=>{ console.warn("config",e); return CFG; });
  async function token(){ const { data } = await CFG.sb.auth.getSession(); return data.session?.access_token; }

  /* ---- IA (substitui "sample") ---- */
  async function blobToB64(b){ const buf=await b.arrayBuffer(); let s=""; const u=new Uint8Array(buf); for(let i=0;i<u.length;i+=0x8000) s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000)); return btoa(s); }
  async function sample(input, opts={}){
    await CFG.ready; if(!CFG.user) throw {code:"no_sample"};
    const messages = typeof input==="string" ? [{role:"user",content:input}] : input;
    const images = opts.images ? await Promise.all(opts.images.map(async b=>({media_type:b.type||"image/jpeg",data:await blobToB64(b)}))) : null;
    const r=await fetch("/api/ai",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+await token()},
      body:JSON.stringify({messages,tier:opts.modelTier||"default",images}),signal:opts.signal});
    if(r.status===402){ const j=await r.json().catch(()=>({})); window.dispatchEvent(new CustomEvent("rb-quota",{detail:j})); throw {code:"quota",message:j.message}; }
    if(r.status===429) throw {code:"rate_limited"};
    if(!r.ok||!r.body) throw {code:"unavailable"};
    const rd=r.body.getReader(), dec=new TextDecoder(); let text="", stop="";
    for(;;){ const {done,value}=await rd.read(); if(done) break; text+=dec.decode(value,{stream:true});
      const i=text.indexOf("\u0000"); const visible=i>=0?text.slice(0,i):text; if(opts.onText) opts.onText({text:visible}); }
    const i=text.indexOf("\u0000"); if(i>=0){ stop=text.slice(i+1).replace("STOP:",""); text=text.slice(0,i); }
    if(stop==="error") throw {code:"unavailable"};
    return {text,truncated:stop==="max_tokens"};
  }
  sample.limits=async()=>({images:true});

  /* ---- Banco (substitui "db") ---- */
  function keyOf(path){ const m=path.match(/^data\/users\/[^/]+\/(.+)$/); return m?m[1]:path; }
  const SHARED=k=>/^(ch_|intro_|ent_|tema_)/.test(k);
  const db={ doc(path){ const key=keyOf(path); return {
    async get(){ await CFG.ready;
      if(SHARED(key)){ const { data } = await CFG.sb.from("shared_content").select("value").eq("key",key).maybeSingle(); return {exists:!!data,data:()=>data&&data.value}; }
      if(!CFG.user) return {exists:false,data:()=>undefined};
      const { data } = await CFG.sb.from("kv").select("value").eq("user_id",CFG.user.id).eq("key",key).maybeSingle(); return {exists:!!data,data:()=>data&&data.value}; },
    async set(value){ await CFG.ready; if(!CFG.user) throw {code:"invalid_argument"};
      if(SHARED(key)){ const r=await fetch("/api/shared",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+await token()},body:JSON.stringify({key,value})}); if(!r.ok&&r.status!==409) throw {code:"unavailable"}; return; }
      const { error } = await CFG.sb.from("kv").upsert({user_id:CFG.user.id,key,value,updated_at:new Date().toISOString()}); if(error) throw {code:"unavailable",message:error.message}; } }; } };

  /* ---- Usuário ---- */
  const user={ async id(){ await CFG.ready; return CFG.user?CFG.user.id:null; }, isOwner:()=>true, canEdit:()=>true, can:()=>true };

  /* ---- Microfone (substitui "dictation") ---- */
  function makeDictation(){ const R=window.SpeechRecognition||window.webkitSpeechRecognition; if(!R) return null;
    let rec=null, h={p:null,f:null,s:null};
    return { onPartial(f){h.p=f}, onFinal(f){h.f=f}, onState(f){h.s=f},
      start(){ return new Promise((res,rej)=>{ try{ rec=new R(); rec.lang="pt-BR"; rec.interimResults=true; rec.continuous=true;
        rec.onstart=()=>{ h.s&&h.s({state:"listening"}); res(); };
        rec.onresult=e=>{ let part=""; for(let i=e.resultIndex;i<e.results.length;i++){ const t=e.results[i][0].transcript; if(e.results[i].isFinal) h.f&&h.f({text:t.trim()}); else part+=t; } if(part) h.p&&h.p({text:part.trim()}); };
        rec.onerror=e=>{ if(e.error==="not-allowed"||e.error==="service-not-allowed") rej({code:"not_granted"}); };
        rec.onend=()=>{ h.s&&h.s({state:"idle",reason:"stopped"}); };
        rec.start(); }catch(e){ rej({code:"unavailable"}); } }); },
      stop(){ try{ rec&&rec.stop(); }catch(e){} return Promise.resolve(); } }; }

  /* ---- Downloads ---- */
  const downloads={ async save({filename,data}){ const b=data instanceof Blob?data:new Blob([data]); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); } };

  window.claude={ use:async(name)=>{ await CFG.ready;
    if(name==="sample") return CFG.user?sample:null;
    if(name==="db") return CFG.sb?db:null;
    if(name==="user") return user;
    if(name==="dictation") return makeDictation();
    if(name==="downloads") return downloads;
    if(name==="tts") return null; /* usa a voz nativa do aparelho (speechSynthesis) */
    return null; } };

  /* ---- Login ---- */
  CFG.signInGoogle=()=>CFG.sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin}});
  CFG.signInEmail=async(email)=>{ const { error } = await CFG.sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin}}); if(error) throw error; };
  CFG.signOut=async()=>{ await CFG.sb.auth.signOut(); location.reload(); };

  /* ---- Assinatura Pro (Google Play Billing via Digital Goods API) ---- */
  const PLAY="https://play.google.com/billing", SKU="pro_mensal";
  CFG.billingAvailable=async()=>{ if(!("getDigitalGoodsService" in window)) return false; try{ await window.getDigitalGoodsService(PLAY); return true; }catch(e){ return false; } };
  CFG.proPrice=async()=>{ try{ const s=await window.getDigitalGoodsService(PLAY); const [d]=await s.getDetails([SKU]); return d?new Intl.NumberFormat("pt-BR",{style:"currency",currency:d.price.currency}).format(d.price.value)+"/mês":""; }catch(e){ return CFG.priceLabel||""; } };
  CFG.buyPro=async()=>{ const req=new PaymentRequest([{supportedMethods:PLAY,data:{sku:SKU}}],{total:{label:"Total",amount:{currency:"BRL",value:"0"}}});
    const resp=await req.show(); const purchaseToken=resp.details.purchaseToken;
    const r=await fetch("/api/verify-purchase",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+await token()},body:JSON.stringify({purchaseToken,sku:SKU})});
    if(r.ok){ await resp.complete("success"); await refreshPlan(); return true; } await resp.complete("fail"); return false; };
  CFG.restorePurchases=async()=>{ try{ const s=await window.getDigitalGoodsService(PLAY); const list=await s.listPurchases(); for(const p of list){ if(p.itemId===SKU){ await fetch("/api/verify-purchase",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+await token()},body:JSON.stringify({purchaseToken:p.purchaseToken,sku:SKU})}); } } await refreshPlan(); }catch(e){} return CFG.plan; };
})();
