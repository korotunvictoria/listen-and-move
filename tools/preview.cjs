'use strict';
// Optional local preview. The game itself opens directly from index.html.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const port = Number(process.argv[2] || 8766);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.wav':'audio/wav' };
http.createServer((request,response) => {
  let name;
  try { name=decodeURIComponent(new URL(request.url,'http://localhost').pathname); }
  catch (_) { response.writeHead(400); response.end(); return; }
  let file=path.resolve(base,'.'+name);
  if (file!==base && !file.startsWith(base+path.sep)) { response.writeHead(403); response.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
  fs.readFile(file,(error,data)=>{
    if(error){response.writeHead(404);response.end('Not found');return;}
    response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    response.end(data);
  });
}).listen(port,'127.0.0.1',()=>process.stdout.write('http://127.0.0.1:'+port+'/\n'));
