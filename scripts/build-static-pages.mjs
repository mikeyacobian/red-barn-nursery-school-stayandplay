import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const checkOnly = process.argv.includes('--check');

const pageShell = ({ title, content, beforeContent = '', afterContent = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>${title}</title>
<style>:root{color-scheme:light;background:#fff}*{box-sizing:border-box}html,body{min-height:100%;margin:0}body{background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}[hidden]{display:none!important}.staff-auth-check{display:grid;min-height:100vh;place-items:center;padding:24px;color:#696965;font-weight:800}.staff-auth-check a{color:#c81010}</style>
</head>
<body>
${beforeContent}${content}${afterContent}
</body>
</html>
`;

const staffAuthScript = `
<script>
(() => {
  const check = document.getElementById('staff-auth-check');
  const dashboard = document.getElementById('staff-dashboard');
  const signout = document.getElementById('rb-staff-signout');
  const profile = document.getElementById('rb-staff-profile');

  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
    const result = await response.json().catch(() => ({}));
    return { response, result };
  };

  const initials = value => String(value || 'Staff')
    .trim()
    .split(/\\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('') || 'ST';

  const showDashboard = staff => {
    if (profile) {
      profile.textContent = initials(staff?.displayName);
      profile.title = staff?.displayName ? 'Signed in as ' + staff.displayName : 'Signed in as staff';
    }
    check.hidden = true;
    dashboard.hidden = false;
    document.documentElement.dataset.staffRole = staff?.role || 'staff';
    document.dispatchEvent(new CustomEvent('staff-authenticated', { detail: { staff: staff || {} } }));
  };

  const showLinkError = () => {
    check.innerHTML = '<span>This staff login link is invalid or expired. <a href="/staff-login.html">Request a new link</a>.</span>';
  };

  const initialize = async () => {
    const hash = new URLSearchParams(location.hash.slice(1));
    const token = hash.get('staff-token') || '';
    if (token) {
      history.replaceState(null, '', location.pathname + location.search);
      const { response, result } = await request('/api/staff/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token })
      });
      if (!response.ok) {
        showLinkError();
        return;
      }
      showDashboard(result.staff);
      return;
    }

    const { response, result } = await request('/api/staff/session');
    if (!response.ok) {
      location.replace('/staff-login.html');
      return;
    }
    showDashboard(result.staff);
  };

  signout?.addEventListener('click', async () => {
    signout.disabled = true;
    await request('/api/staff/logout', { method: 'POST' }).catch(() => {});
    location.replace('/staff-login.html');
  });

  initialize().catch(() => {
    check.innerHTML = '<span>Staff login is temporarily unavailable. <a href="/staff-login.html">Try again</a>.</span>';
  });
})();
</script>`;

const pages = [
  {
    source: 'src/parent-booking.html',
    target: 'parent.html',
    title: 'Red Barn Stay & Play — Parent Booking',
    wrap: content => pageShell({ title: 'Red Barn Stay & Play — Parent Booking', content })
  },
  {
    source: 'src/staff-dashboard.html',
    target: 'staff.html',
    title: 'Red Barn Stay & Play — Staff Dashboard',
    wrap: content => pageShell({
      title: 'Red Barn Stay & Play — Staff Dashboard',
      beforeContent: '<main class="staff-auth-check" id="staff-auth-check" role="status" aria-live="polite">Checking staff access…</main>\n<div id="staff-dashboard" hidden>\n',
      content,
      afterContent: `\n</div>\n${staffAuthScript}`
    })
  }
];

let mismatched = false;
for (const page of pages) {
  const source = await readFile(resolve(projectRoot, page.source), 'utf8');
  const generated = page.wrap(source.trim()).replace(/\n+$/, '') + '\n';
  const targetPath = resolve(projectRoot, page.target);
  if (checkOnly) {
    const current = await readFile(targetPath, 'utf8').catch(() => '');
    if (current !== generated) {
      mismatched = true;
      console.error(`${page.target} is out of date; run npm run build:pages.`);
    }
  } else {
    await writeFile(targetPath, generated, 'utf8');
    console.log(`Built ${page.target} from ${page.source}.`);
  }
}

if (mismatched) process.exitCode = 1;
