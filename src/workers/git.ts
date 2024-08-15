import LightningFS, { type PromisifiedFS } from '@isomorphic-git/lightning-fs';
import http from 'isomorphic-git/http/web';
import git, { TREE, WORKDIR, type WalkerEntry } from 'isomorphic-git';
import { Buffer } from 'buffer/';

(globalThis as any).Buffer = Buffer;

const ignoreWalkSet = new Set(['.git', '.gitignore', 'LICENSE', 'README.md']);

const getFilename = (path: string) => path.split('/').pop()!;

interface WalkResult {
  path: string;
  name: string;
  type: 'blob' | 'tree';
  entry: WalkerEntry;
  children?: WalkResult[];
}

export interface GitProgress {
  value: number;
  desc: string;
}

export interface GitCommit {
  message: string;
  sha1: string;
}

export type OnGitProgress = (progress: GitProgress) => void;

export type OnGitCommitsUpdate = (commits: GitCommit[]) => void;

export class Git {
  private readonly fs: PromisifiedFS;
  private readonly commonOptions: Parameters<(typeof git)['clone']>[0] & Parameters<(typeof git)['pull']>[0];

  constructor(
    private readonly url: string,
    private readonly onProgress: OnGitProgress,
    private readonly onCommitsUpdate: OnGitCommitsUpdate,
  ) {
    this.fs = new LightningFS(url).promises;
    this.commonOptions = {
      fs: this.fs,
      http,
      dir: '/',
      corsProxy: import.meta.env.DEV ? 'http://127.0.0.1:9999' : 'https://mashir0-mrugcp.hf.space',
      url,
      singleBranch: true,
      depth: 1,
      author: {
        name: '',
        email: '',
      },
      onProgress: ({ phase, loaded, total }) => {
        this.onProgress({
          value: total ? loaded / total : 0,
          desc: total ? `${phase} (${loaded}/${total})` : `${phase} (${loaded})`,
        });
      },
    };
    this.emitUpdateCommits();
  }

  async update() {
    let type = '';
    if (await this.getHeadCommit()) {
      console.log('git pull');
      await git.pull(this.commonOptions);
      type = 'pull';
    } else {
      console.log('git clone');
      await git.clone(this.commonOptions);
      type = 'clone';
    }
    await this.emitUpdateCommits();
    return type;
  }

  clear() {
    return new Promise<boolean>(resolve => {
      const req = indexedDB.deleteDatabase(this.url);
      req.onsuccess = () => {
        this.onCommitsUpdate([]);
        resolve(true);
      };
      req.onerror = () => {
        resolve(false);
      };
    });
  }

  async copyToFileSystem(root: FileSystemDirectoryHandle) {
    this.onProgress({ value: 0, desc: 'Processing files' });
    let total = 0;
    const result: WalkResult = await git.walk({
      fs: this.fs,
      dir: '/',
      trees: [WORKDIR()],
      map: async (path, [entry]) => {
        if (!entry) return null;
        const name = getFilename(path);
        if (ignoreWalkSet.has(name)) return null;
        const type = await entry.type();
        if (type === 'blob') total++;
        return {
          path,
          name,
          type,
          entry,
        };
      },
      reduce: this.walkReduce,
    });
    await this.copyDir(root, result, { cur: 0, total });
    return { total };
  }

  async copyToFileSystemIncremental(root: FileSystemDirectoryHandle, startCommit: string) {
    this.onProgress({ value: 0, desc: 'Processing files' });
    let total = 0;
    const headCommit = await this.getHeadCommit();
    if (headCommit === startCommit) return { total };
    const paths: string[] = [];
    const result: WalkResult = await git.walk({
      fs: this.fs,
      dir: '/',
      trees: [TREE({ ref: 'HEAD' }), TREE({ ref: startCommit })],
      map: async (path, [entry, pastEntry]) => {
        if (!entry) return null;
        const name = getFilename(path);
        if (ignoreWalkSet.has(name)) return null;
        const type = await entry.type();
        if (type === 'blob') {
          if (pastEntry) {
            const oid = await entry.oid();
            const pastOid = await pastEntry.oid();
            if (oid === pastOid) return null;
          }
          total++;
          paths.push(path);
        }
        return {
          path,
          name,
          type,
          entry,
        };
      },
      reduce: this.walkReduce,
    });
    await this.copyDir(root, result, { cur: 0, total });
    return { total };
  }

  async getHeadCommit() {
    try {
      const logs = await git.log({ fs: this.fs, dir: '/', depth: 1 });
      return logs[0]?.commit.tree || null;
    } catch {
      return null;
    }
  }

  async getCommitList() {
    try {
      const logs = await git.log({ fs: this.fs, dir: '/' });
      return logs.map(({ commit: { message, tree } }): GitCommit => ({ message, sha1: tree }));
    } catch {
      return [];
    }
  }

  private async walkReduce(parent: WalkResult, children: WalkResult[]) {
    if (parent.type === 'blob') return parent;
    return Object.assign(parent, { children: children.filter(({ type, children }) => !(type === 'tree' && !children?.length)) });
  }

  private async copyDir(parentHandler: FileSystemDirectoryHandle, parentResult: WalkResult, state: { cur: number; total: number }) {
    if (!parentResult.children) return;
    await Promise.all(
      parentResult.children.map(async result => {
        try {
          if (result.children) {
            const dirHandler = await parentHandler.getDirectoryHandle(result.name, { create: true });
            await this.copyDir(dirHandler, result, state);
          } else {
            const content = await result.entry.content();
            if (!content) return;
            const fileHandler = await parentHandler.getFileHandle(result.name, { create: true });
            const writable = await fileHandler.createWritable();
            await writable.write(content);
            await writable.close();
            state.cur++;
            this.onProgress({
              value: state.total === 0 ? 1 : state.cur / state.total,
              desc: `Write (${state.cur}/${state.total}): ${result.path}`,
            });
          }
        } catch (error) {
          console.error(error);
        }
      }),
    );
  }

  private async emitUpdateCommits() {
    this.onCommitsUpdate(await this.getCommitList());
  }
}
