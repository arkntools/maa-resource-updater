export const gitCORS = import.meta.env.DEV
  ? {
      HuggingFace: 'http://127.0.0.1:9999',
      CloudflareWorker: 'http://127.0.0.1:8787',
    }
  : {
      HuggingFace: 'https://mashir0-mrugcp.hf.space',
      CloudflareWorker: 'https://mrugcp.lolicon.app',
    };

export type GitCORS = keyof typeof gitCORS;
