import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ✅ Évite le crash au build si les variables ne sont pas encore définies
const isValid = supabaseUrl && supabaseUrl.startsWith("https://") && supabaseAnonKey;

export const supabase = isValid
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
