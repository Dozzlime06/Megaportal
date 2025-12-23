import { getUncachableGitHubClient } from '../server/github';
import * as fs from 'fs';
import * as path from 'path';

const REPO_NAME = 'megabridge-docs';
const REPO_DESCRIPTION = 'MegaBridge Documentation - GitBook';

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function main() {
  console.log('Getting GitHub client...');
  const octokit = await getUncachableGitHubClient();
  
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);

  let repo;
  try {
    const { data: existingRepo } = await octokit.repos.get({
      owner: user.login,
      repo: REPO_NAME,
    });
    repo = existingRepo;
    console.log(`Repository ${REPO_NAME} already exists: ${repo.html_url}`);
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`Creating repository ${REPO_NAME}...`);
      const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
        name: REPO_NAME,
        description: REPO_DESCRIPTION,
        private: false,
        auto_init: true,
      });
      repo = newRepo;
      console.log(`Created repository: ${repo.html_url}`);
      console.log('Waiting for repository to initialize...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } else {
      throw error;
    }
  }

  // Check if repo is empty and initialize with README if needed
  try {
    await octokit.repos.getContent({
      owner: user.login,
      repo: REPO_NAME,
      path: 'README.md',
    });
    console.log('Repository has content, proceeding...');
  } catch (error: any) {
    if (error.status === 404) {
      console.log('Repository is empty, creating initial README...');
      await octokit.repos.createOrUpdateFileContents({
        owner: user.login,
        repo: REPO_NAME,
        path: 'README.md',
        message: 'Initial commit',
        content: Buffer.from('# MegaBridge Docs\n\nDocumentation for MegaBridge').toString('base64'),
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('Collecting docs files...');
  const files = getAllFiles('docs');
  console.log(`Found ${files.length} files to upload`);

  let tree: any[] = [];
  
  for (const filePath of files) {
    // Remove 'docs/' prefix for the repo structure
    const relativePath = filePath.replace(/^docs\//, '');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    try {
      const { data: blob } = await octokit.git.createBlob({
        owner: user.login,
        repo: REPO_NAME,
        content: content,
        encoding: 'utf-8',
      });
      tree.push({
        path: relativePath,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
      console.log(`Uploaded: ${relativePath}`);
    } catch (err: any) {
      console.error(`Failed to upload ${relativePath}: ${err.message}`);
    }
  }

  console.log('Creating tree...');
  const { data: newTree } = await octokit.git.createTree({
    owner: user.login,
    repo: REPO_NAME,
    tree,
  });

  let parentSha: string[] = [];
  try {
    const { data: ref } = await octokit.git.getRef({
      owner: user.login,
      repo: REPO_NAME,
      ref: 'heads/main',
    });
    parentSha = [ref.object.sha];
  } catch {
    // No existing commits
  }

  console.log('Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner: user.login,
    repo: REPO_NAME,
    message: 'MegaBridge Documentation',
    tree: newTree.sha,
    parents: parentSha,
  });

  console.log('Updating main branch...');
  try {
    await octokit.git.updateRef({
      owner: user.login,
      repo: REPO_NAME,
      ref: 'heads/main',
      sha: commit.sha,
      force: true,
    });
  } catch {
    await octokit.git.createRef({
      owner: user.login,
      repo: REPO_NAME,
      ref: 'refs/heads/main',
      sha: commit.sha,
    });
  }

  console.log('\n✅ Successfully pushed docs to GitHub!');
  console.log(`📚 Repository: https://github.com/${user.login}/${REPO_NAME}`);
  console.log('\nYou can now connect this repository to GitBook:');
  console.log('1. Go to https://app.gitbook.com');
  console.log('2. Create a new space');
  console.log('3. Connect to GitHub and select this repository');
}

main().catch(console.error);
