import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.cache',
  '.local',
  'attached_assets',
  'scripts/',
  '.upm',
  '.config',
  'generated-icon.png',
  '.replit',
  'replit.nix',
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (shouldIgnore(relativePath)) continue;
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
}

async function main() {
  const repoName = 'Megaportal';
  const baseDir = '/home/runner/workspace';
  
  console.log('Getting GitHub client...');
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);
  
  console.log('Initializing repository with README...');
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner: user.login,
      repo: repoName,
      path: 'README.md',
      message: 'Initial commit',
      content: Buffer.from('# MegaPortal\n\nBridge to MegaETH - The first real-time blockchain\n').toString('base64'),
    });
    console.log('README created');
  } catch (e: any) {
    if (e.status === 422) {
      console.log('README already exists');
    } else {
      throw e;
    }
  }
  
  console.log('Collecting files...');
  const files = getAllFiles(baseDir);
  console.log(`Found ${files.length} files to upload`);
  
  for (const file of files) {
    if (file === 'README.md') continue;
    
    const fullPath = path.join(baseDir, file);
    const content = fs.readFileSync(fullPath);
    const base64Content = content.toString('base64');
    
    console.log(`Uploading: ${file}`);
    try {
      let sha: string | undefined;
      try {
        const { data: existingFile } = await octokit.repos.getContent({
          owner: user.login,
          repo: repoName,
          path: file,
        });
        if ('sha' in existingFile) {
          sha = existingFile.sha;
        }
      } catch (e) {}
      
      await octokit.repos.createOrUpdateFileContents({
        owner: user.login,
        repo: repoName,
        path: file,
        message: `Add ${file}`,
        content: base64Content,
        sha,
      });
    } catch (e: any) {
      console.error(`Failed to upload ${file}: ${e.message}`);
    }
  }
  
  console.log(`\nSuccess! Code uploaded to: https://github.com/${user.login}/${repoName}`);
}

main().catch(console.error);
