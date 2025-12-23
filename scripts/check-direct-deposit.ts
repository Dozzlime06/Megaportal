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
  
  const { data } = await octokit.repos.getContent({
    owner: user.login, repo: 'Megaportal', path: 'client/src/pages/home.tsx'
  });
  
  if ('content' in data) {
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    if (content.includes('Direct deposit')) {
      console.log('ERROR: Direct deposit section STILL EXISTS on GitHub!');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('Direct deposit')) {
          console.log(`Line ${i+1}: ${line.substring(0, 100)}`);
        }
      });
    } else {
      console.log('OK: Direct deposit section has been REMOVED from GitHub.');
    }
  }
}

main().catch(console.error);
