import http from 'node:http';
import {readFile,stat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.md':'text/plain; charset=utf-8','.R':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.tex':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.pdf':'application/pdf','.zip':'application/zip'};
const server=http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.split(/[\\/]/).some(s=>s.startsWith('.'))){res.writeHead(404);return res.end();}
    let file=path.resolve(root,`.${pathname}`);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    file=await realpath(file);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log(`CAST tutorial: http://127.0.0.1:${server.address().port}`));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
