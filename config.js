/* Taskora — runtime config.
 *
 * Copy this file to config.js and fill in your project's values:
 *   Supabase dashboard → Project Settings → API Keys
 *
 *   supabaseUrl  https://<project-ref>.supabase.co
 *   supabaseKey  the PUBLISHABLE key (sb_publishable_…) or the legacy anon key.
 *                Never the secret / service_role key — deploy.sh refuses it.
 *
 * Leave both empty to run the offline demo, which keeps everything in this
 * browser's localStorage (handy for a public preview).
 */
window.TASKORA_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""
};
