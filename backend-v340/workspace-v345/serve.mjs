import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';

const origin = 'http://127.0.0.1:15003';
const root = resolve('dist');
const types = {html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript',
  mjs: 'text/javascript', webmanifest: 'application/manifest+json', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2'};
const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:19099 http://127.0.0.1:18080; " +
  "worker-src http://127.0.0.1:15003/raytech-pwa-sw.js; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";

export async function serve() {
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.host !== '127.0.0.1:15003') throw Error();
      const endpoints=new Set(['/api/workspaceAuthorizeInvoice','/api/workspaceExtractInvoice','/api/workspaceUsageAdmin']);
      if(req.method==='POST'&&endpoints.has(req.url)){
        if(req.headers.origin!=='http://127.0.0.1:15003'||process.env.GCLOUD_PROJECT!=='demo-raytech-v340'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080'){res.writeHead(403).end();return;}
        const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){res.writeHead(413).end();return;}chunks.push(chunk);}
        const upstream=await fetch('http://127.0.0.1:15001/demo-raytech-v340/us-central1/'+req.url.slice(5),{method:'POST',headers:{authorization:req.headers.authorization??'','x-request-id':req.headers['x-request-id']??'','content-type':'application/json'},body:Buffer.concat(chunks),signal:AbortSignal.timeout(30000),redirect:'error'});
        res.writeHead(upstream.status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await upstream.text());return;
      }
      if(!['GET','HEAD'].includes(req.method))throw Error();
      const path = decodeURIComponent(new URL(req.url, origin).pathname);
      const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(root + sep) || !(await stat(file)).isFile()) throw Error();
      res.writeHead(200, {
        'Content-Type': types[extname(file).slice(1)] ?? 'application/octet-stream',
        'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') res.end();
      else createReadStream(file).pipe(res);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject).listen(15003, '127.0.0.1', resolve);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await serve();
  console.log(origin);
}
