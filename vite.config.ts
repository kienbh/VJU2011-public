import { defineConfig } from 'vite';
const apiPort=process.env.VJU_API_PORT||'8787';
if(!/^\d{1,5}$/.test(apiPort)||Number(apiPort)<1||Number(apiPort)>65535)throw Error('Invalid VJU_API_PORT');
export default defineConfig({
  build: { rollupOptions: { input: { main: 'index.html', finalePreview: 'experiments/finale-audio.html' } } },
  server: { proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
  preview: { proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
});
