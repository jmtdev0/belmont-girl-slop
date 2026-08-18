import { defineConfig, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function localVideoMiddleware(localVideoDir) {
  return {
    name: 'serve-local-belmont-girl-videos',
    configureServer(server) {
      server.middlewares.use('/local-videos', (request, response, next) => {
        if (!localVideoDir) return next();
        if (!request.url) return next();

        const requestedName = decodeURIComponent(request.url.split('?')[0].replace(/^\/+/, ''));
        const filePath = path.resolve(localVideoDir, requestedName);
        const relativePath = path.relative(localVideoDir, filePath);

        if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return next();
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next();

        const stat = fs.statSync(filePath);
        const extension = path.extname(filePath).toLowerCase();
        const contentType = extension === '.webm' ? 'video/webm' : 'video/mp4';
        const range = request.headers.range;

        response.setHeader('Accept-Ranges', 'bytes');
        response.setHeader('Content-Type', contentType);
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Access-Control-Allow-Origin', '*');

        if (!range) {
          response.statusCode = 200;
          response.setHeader('Content-Length', stat.size);
          if (request.method === 'HEAD') return response.end();
          return fs.createReadStream(filePath).pipe(response);
        }

        const [rangeStart, rangeEnd] = range.replace(/bytes=/, '').split('-');
        const start = Number.parseInt(rangeStart, 10);
        const end = rangeEnd ? Number.parseInt(rangeEnd, 10) : stat.size - 1;
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stat.size) {
          response.statusCode = 416;
          response.setHeader('Content-Range', `bytes */${stat.size}`);
          return response.end();
        }

        response.statusCode = 206;
        response.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        response.setHeader('Content-Length', end - start + 1);
        if (request.method === 'HEAD') return response.end();
        return fs.createReadStream(filePath, { start, end }).pipe(response);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredVideoDir = env.BELMONTGIRL_VIDEO_DIR?.trim();
  const localVideoDir = configuredVideoDir ? path.resolve(configuredVideoDir) : null;

  return {
    plugins: [localVideoMiddleware(localVideoDir)],
  };
});
