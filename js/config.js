/* The only file you edit to set Ballast up. Nothing in here is secret: a Google client ID and a public Worker address are both
   visible to anyone who opens the site. Never put an API key here. */
window.BALLAST_CONFIG = {
  // Google Cloud Console, APIs & Services, Credentials, OAuth client ID (Web application). Looks like 123456-abc.apps.googleusercontent.com
  GOOGLE_CLIENT_ID: '',
  // The address printed by `wrangler deploy`, no trailing slash. Example: https://ballast-api.yourname.workers.dev
  API_BASE: 'https://ballast-api.ballast-site.workers.dev',
  // Optional: your Google email, to skip the account picker.
  GOOGLE_ACCOUNT_HINT: '',
  PREVIEW: false,
  TEST: false
};
