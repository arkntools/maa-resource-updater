import type { Git } from '@/workers/git';

const worker = new ComlinkWorker<typeof import('@/workers/git')>(new URL('../workers/git.js', import.meta.url));

export const createGitClient = (...args: ConstructorParameters<typeof Git>) => new worker.Git(...args);
