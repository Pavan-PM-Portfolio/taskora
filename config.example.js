/* Taskora — runtime config.
 *
 * Copy this file to config.js and fill in your project's values:
 *   Supabase dashboard → Project Settings → API Keys
 *
 *   supabaseUrl  https://<project-ref>.supabase.co
 *   supabaseKey  the PUBLISHABLE key (sb_publishable_…) or the legacy anon key.
 *                Never the secret / service_role key — deploy.sh refuses it.
 *
 * Leave both empty and the app still opens on the sign-in page: "Sign in as a guest"
 * works (a sample workspace, nothing saved), and email sign-in explains that
 * accounts aren't switched on yet.
 */
window.TASKORA_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""
};
