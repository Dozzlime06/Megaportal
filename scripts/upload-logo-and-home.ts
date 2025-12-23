import { Octokit } from '@octokit/rest';
import * as fs from 'fs';

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

async function uploadFile(octokit: Octokit, owner: string, repo: string, filePath: string, localPath: string, isBinary = false) {
  const content = fs.readFileSync(localPath);
  const base64Content = content.toString('base64');
  
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
    if ('sha' in data) sha = data.sha;
  } catch (e) {}
  
  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path: filePath,
    message: `Update ${filePath}`,
    content: base64Content, sha
  });
  console.log(`Uploaded: ${filePath}`);
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log('Authenticated as:', user.login);
  
  await uploadFile(octokit, user.login, 'Megaportal', 'client/public/logo.png', '/home/runner/workspace/client/public/logo.png', true);
  await uploadFile(octokit, user.login, 'Megaportal', 'client/src/pages/home.tsx', '/home/runner/workspace/client/src/pages/home.tsx');
  
  console.log('Done!');
}

main().catch(console.error);
