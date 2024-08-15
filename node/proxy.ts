import { createServer } from 'http';
import Express from 'express';
import gitCorsProxy from '@isomorphic-git/cors-proxy/middleware';

export const startProxy = () => {
  try {
    const app = Express();
    app.use(gitCorsProxy());
    app.on('error', console.error);
    const server = createServer(app);
    server.on('error', () => {});
    server.listen(9999, () => {
      console.log('Git CORS proxy started');
    });
  } catch {}
};
