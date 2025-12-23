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

function getAllFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);
    
    if (['.git', 'node_modules', 'dist', '.cache', '.replit', '.upm', '.config', '.local', 'attached_assets', '.pnpm-store', 'tmp'].includes(entry.name)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
}

async function pushToGitHub() {
  console.log('Getting GitHub access token...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  const owner = 'Dozzlime06';
  const repo = 'Megaportal';
  const branch = 'main';
  const baseDir = '/home/runner/workspace';
  
  console.log(`Pushing to ${owner}/${repo}...`);
  
  // Check if repo is empty by trying to get contents
  let isEmpty = false;
  let baseSha: string | undefined;
  
  try {
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    
    // Check if repo has any commits by checking size or trying to list contents
    try {
      const { data: contents } = await octokit.repos.getContent({ owner, repo, path: '' });
      // If we get here, repo has content
      const { data: ref } = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
      baseSha = ref.object.sha;
      console.log('Repo has content, base SHA:', baseSha);
    } catch (e: any) {
      if (e.status === 404 || e.status === 409) {
        isEmpty = true;
        console.log('Repository is empty, will initialize...');
      } else {
        throw e;
      }
    }
  } catch (e: any) {
    console.error('Failed to get repo:', e.message);
    throw e;
  }
  
  // If empty, create initial file to initialize repo
  if (isEmpty) {
    console.log('Creating initial README to initialize repo...');
    const readmeContent = `# MegaPortal Bridge

Cross-chain bridge for MegaETH - the first real-time blockchain.

## Features
- Bridge ETH from Base, Ethereum, and other chains to MegaETH
- Real-time quotes and transaction tracking
- Multi-wallet support via Privy

## Development
\`\`\`bash
npm install
npm run dev
\`\`\`
`;
    
    const { data: fileData } = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: 'Initial commit: Add README',
      content: Buffer.from(readmeContent).toString('base64'),
    });
    
    baseSha = fileData.commit.sha;
    console.log('Repo initialized with SHA:', baseSha);
  }
  
  // Get all files
  console.log('Collecting files...');
  const files = getAllFiles(baseDir);
  console.log(`Found ${files.length} files`);
  
  // Create tree entries
  console.log('Creating tree entries...');
  const treeEntries: any[] = [];
  let count = 0;
  
  for (const file of files) {
    try {
      const filePath = path.join(baseDir, file);
      const stat = fs.statSync(filePath);
      
      // Skip large files (> 10MB)
      if (stat.size > 10 * 1024 * 1024) {
        console.log(`Skipping large file: ${file}`);
        continue;
      }
      
      const content = fs.readFileSync(filePath);
      
      // Check if binary
      let isBinary = false;
      for (let i = 0; i < Math.min(content.length, 8000); i++) {
        if (content[i] === 0) {
          isBinary = true;
          break;
        }
      }
      
      if (isBinary || stat.size > 500 * 1024) {
        // Create blob for binary/large files
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo,
          content: content.toString('base64'),
          encoding: 'base64'
        });
        treeEntries.push({
          path: file,
          mode: '100644',
          type: 'blob',
          sha: blob.sha
        });
      } else {
        treeEntries.push({
          path: file,
          mode: '100644',
          type: 'blob',
          content: content.toString('utf-8')
        });
      }
      count++;
      if (count % 50 === 0) {
        console.log(`Processed ${count} files...`);
      }
    } catch (e) {
      console.log(`Skipping ${file}: ${e}`);
    }
  }
  
  console.log(`Creating tree with ${treeEntries.length} entries...`);
  
  // Create tree
  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    tree: treeEntries,
    base_tree: baseSha
  });
  
  console.log('Tree created:', tree.sha);
  
  // Create commit
  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: 'Sync from Replit: Update bridge configuration\n\n- Reverted ETH bridge to user EOA address\n- Updated estimated time to 5 minutes\n- Base is default source chain',
    tree: tree.sha,
    parents: [baseSha!]
  });
  
  console.log('Commit created:', commit.sha);
  
  // Update reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.sha,
    force: false
  });
  
  console.log('Push successful!');
  console.log(`View at: https://github.com/${owner}/${repo}`);
}

pushToGitHub().catch(console.error);
