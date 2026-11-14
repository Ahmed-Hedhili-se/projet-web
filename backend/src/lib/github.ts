import { env } from '../config/env';

const API = 'https://api.github.com';
const TIMEOUT_MS = 10_000;
const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

export class RepoError extends Error {}

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface RepoFile {
  path: string;
  size: number;
}

export interface RepoSource {
  getDefaultBranch(ref: RepoRef): Promise<string>;
  listFiles(ref: RepoRef, branch: string): Promise<RepoFile[]>;
  readFile(ref: RepoRef, branch: string, path: string): Promise<string>;
}

export function parseRepoUrl(input: string): RepoRef {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new RepoError('Invalid repository URL.');
  }
  if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) {
    throw new RepoError('Only public github.com repositories are supported.');
  }
  const [owner, rawRepo] = url.pathname.split('/').filter(Boolean);
  const repo = rawRepo?.replace(/\.git$/, '');
  if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo)) {
    throw new RepoError('Invalid repository URL: expected https://github.com/<owner>/<repo>.');
  }
  return { owner, repo };
}

async function githubFetch(path: string, accept = 'application/vnd.github+json'): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'TeraMind-GPU-Advisor',
  };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new RepoError('GitHub did not answer in time. Try again later.');
  }
  if (res.status === 404) throw new RepoError('Repository or file not found (only public repositories can be read).');
  if (res.status === 403 || res.status === 429) throw new RepoError('GitHub rate limit reached. Try again later.');
  if (!res.ok) throw new RepoError(`GitHub returned an error (${res.status}).`);
  return res;
}

const repoPath = ({ owner, repo }: RepoRef) => `/repos/${owner}/${repo}`;

export const githubSource: RepoSource = {
  async getDefaultBranch(ref) {
    const data = (await (await githubFetch(repoPath(ref))).json()) as { default_branch: string; private: boolean };
    if (data.private) throw new RepoError('This repository is private: only public repositories can be read.');
    return data.default_branch;
  },

  async listFiles(ref, branch) {
    const res = await githubFetch(`${repoPath(ref)}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
    const data = (await res.json()) as { tree: { path: string; type: string; size?: number }[] };
    return data.tree.filter((item) => item.type === 'blob').map((item) => ({ path: item.path, size: item.size ?? 0 }));
  },

  async readFile(ref, branch, path) {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const res = await githubFetch(`${repoPath(ref)}/contents/${encoded}?ref=${encodeURIComponent(branch)}`,
      'application/vnd.github.raw');
    return res.text();
  },
};
