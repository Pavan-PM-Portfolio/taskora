/* Taskora — runtime config (config.js next to index.html and app.html).
 *
 *   supabaseUrl  https://<project-ref>.supabase.co
 *   supabaseKey  the PUBLISHABLE key (sb_publishable_…) or the legacy anon key.
 *                It is public by design; the database rules protect your data.
 *                Never put the secret / service_role key here.
 *
 * Leave both empty and the login page still works: "Sign in as a guest" opens
 * a sample workspace (nothing saved) and email sign-in explains that accounts
 * aren't switched on yet.
 */
window.TASKORA_CONFIG = {
  supabaseUrl: "",
  supabaseKey: ""
};
