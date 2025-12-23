import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;
  if (!xReplitToken) throw new Error('X_REPLIT_TOKEN not found');
  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);
  return connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  
  // Get file content from GitHub
  const { data } = await octokit.repos.getContent({
    owner: user.login,
    repo: 'Megaportal',
    path: 'client/src/pages/home.tsx'
  });
  
  if ('content' in data) {
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const lines = content.split('\n').slice(0, 10);
    console.log('First 10 lines of home.tsx on GitHub:');
    lines.forEach((line, i) => console.log(`${i+1}: ${line}`));
  }
}

main().catch(console.error);
