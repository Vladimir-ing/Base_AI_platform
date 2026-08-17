import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg=window.AI_CORE_SUPABASE||{};
const configured=Boolean(cfg.url&&cfg.publishableKey&&!cfg.publishableKey.includes("PASTE_"));
if(configured){
  const supabase=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data}=await supabase.auth.getSession();
  if(!data.session){
    location.replace("auth.html?mode=signin");
  }else{
    const topbar=document.querySelector(".topbar");
    if(topbar){
      const account=document.createElement("div");
      account.className="auth-account";
      const email=document.createElement("span");
      email.textContent=data.session.user?.email||"AI CORE";
      const out=document.createElement("button");
      out.type="button";out.className="btn ghost";out.textContent=document.documentElement.lang==="en"?"Sign Out":"Выйти";
      out.addEventListener("click",async()=>{out.disabled=true;await supabase.auth.signOut();location.replace("index.html")});
      account.append(email,out);topbar.append(account);
    }
  }
}
