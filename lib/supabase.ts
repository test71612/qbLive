import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function serviceClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
