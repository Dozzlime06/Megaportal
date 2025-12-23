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

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken! } }
  ).then(res => res.json()).then(data => data.items?.[0]);

  return connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
}

async function main() {
  const octokit = new Octokit({ auth: await getAccessToken() });
  const { data: user } = await octokit.users.getAuthenticated();
  
  const file = 'client/src/pages/home.tsx';
  const content = fs.readFileSync('/home/runner/workspace/' + file);
  
  let sha: string | undefined;
  try {
    const { data: existingFile } = await octokit.repos.getContent({
      owner: user.login,
      repo: 'Megaportal',
      path: file,
    });
    if ('sha' in existingFile) sha = existingFile.sha;
  } catch (e) {}
  
  await octokit.repos.createOrUpdateFileContents({
    owner: user.login,
    repo: 'Megaportal',
    path: file,
    message: 'Fix switch button - use swap icon and center properly',
    content: content.toString('base64'),
    sha,
  });
  
  console.log('Committed: Fix switch button - use swap icon and center properly');
}

main().catch(console.error);
