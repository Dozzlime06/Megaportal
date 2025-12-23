import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
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
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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

async function main() {
  const repoName = 'Megaportal';
  
  console.log('Getting GitHub client...');
  const octokit = await getUncachableGitHubClient();
  
  console.log('Getting authenticated user...');
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);
  
  console.log(`Creating new repository: ${repoName}...`);
  try {
    await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: 'MegaPortal - Bridge to MegaETH',
      private: false,
      auto_init: false,
    });
    console.log(`Repository ${repoName} created successfully!`);
  } catch (error: any) {
    if (error.status === 422) {
      console.log(`Repository ${repoName} already exists, will push to existing repo.`);
    } else {
      throw error;
    }
  }
  
  const accessToken = await getAccessToken();
  const remoteUrl = `https://${user.login}:${accessToken}@github.com/${user.login}/${repoName}.git`;
  
  console.log('Setting up git remote...');
  try {
    execSync('git remote remove github-new 2>/dev/null || true', { stdio: 'inherit' });
  } catch (e) {}
  
  execSync(`git remote add github-new "${remoteUrl}"`, { stdio: 'inherit' });
  
  console.log('Pushing to GitHub...');
  execSync('git push -u github-new main --force', { stdio: 'inherit' });
  
  console.log(`\nSuccess! Repository pushed to: https://github.com/${user.login}/${repoName}`);
}

main().catch(console.error);
