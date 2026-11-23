#!/usr/bin/env node
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base=path.join(root,'site-dist');
if(!fs.existsSync(path.join(base,'index.html')))execFileSync(process.execPath,[path.join(root,'scripts/build-site.cjs')],{stdio:'inherit'});
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpeg':'image/jpeg','.jpg':'image/jpeg','.pdf':'application/pdf'};
const port=Number(process.env.PORT||4173);
http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let url;try{url=new URL(req.url,'http://localhost')}catch{res.writeHead(400);res.end();return;}
  let decoded;try{decoded=decodeURIComponent(url.pathname)}catch{res.writeHead(400);res.end();return;}
  if(decoded.includes('\0')||decoded.includes('\\')||decoded.includes('..')){res.writeHead(403);res.end();return;}
  const target=path.resolve(base,'.'+decoded),inside=target===base||target.startsWith(base+path.sep);
  if(!inside){res.writeHead(403);res.end();return;}
  let file=target;try{if(!fs.statSync(file).isFile())file=path.join(base,'index.html')}catch{if(!path.extname(decoded)&&!decoded.startsWith('/assets/'))file=path.join(base,'index.html');else{res.writeHead(404);res.end();return;}}
  const type=types[path.extname(file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
}).listen(port,()=>console.log(`PetLovePro local: http://localhost:${port} (sem checkout real até integrar Firebase).`));
