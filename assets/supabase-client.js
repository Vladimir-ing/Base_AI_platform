"use strict";

(function initSupabase() {
  const SUPABASE_URL = "https://hjbsrcreekzmrpplmrng.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_h2OsBAduR7mzCuFotS7Jsw_2AFnrZy6";

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase client library did not load");
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit"
      }
    }
  );
})();
