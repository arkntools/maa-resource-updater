export const gitCORS = import.meta.env.DEV
  ? {
      CloudflareWorker: 'http://127.0.0.1:8787',
    }
  : {
      CloudflareWorker: 'https://mrugcp.lolicon.app',
    };

export type GitCORS = keyof typeof gitCORS;
