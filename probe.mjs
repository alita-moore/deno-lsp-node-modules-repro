import { spawn } from "node:child_process";
import { readFileSync, createWriteStream } from "node:fs";
import { pathToFileURL } from "node:url";
const [, , root, target, logPath, reqSpec] = process.argv;
const uri = pathToFileURL(target).href;
const text = readFileSync(target, "utf8");
const settings = { enable: true, lint: false, unstable: [], codeLens: {}, suggest: {}, inlayHints: {} };
const lsp = spawn("deno", ["lsp"], { stdio: ["pipe","pipe","pipe"], env: { ...process.env, DENO_LOG: "debug" } });
lsp.stderr.pipe(createWriteStream(logPath));
let buf = Buffer.alloc(0), id = 1; const pending = new Map();
const write = (o) => { const s = JSON.stringify(o); lsp.stdin.write(`Content-Length: ${Buffer.byteLength(s)}\r\n\r\n${s}`); };
lsp.stdout.on("data", (c) => { buf = Buffer.concat([buf,c]);
  for(;;){ const h=buf.indexOf("\r\n\r\n"); if(h<0)return; const m=/Content-Length: (\d+)/i.exec(buf.slice(0,h).toString()); if(!m)return;
    const len=+m[1], st=h+4; if(buf.length<st+len)return; const msg=JSON.parse(buf.slice(st,st+len).toString()); buf=buf.slice(st+len);
    if(msg.id!==undefined&&msg.method!==undefined){ const n=(msg.params?.items??[]).length||1;
      write({jsonrpc:"2.0",id:msg.id,result:msg.method==="workspace/configuration"?Array.from({length:n},()=>settings):null}); continue; }
    if(msg.id!==undefined&&pending.has(msg.id)){ const e=pending.get(msg.id); pending.delete(msg.id); e.resolve(Date.now()-e.t); } } });
const send=(m,p)=>{const i=id++;write({jsonrpc:"2.0",id:i,method:m,params:p});return new Promise(r=>pending.set(i,{resolve:r,t:Date.now()}));};
const notify=(m,p)=>write({jsonrpc:"2.0",method:m,params:p});
const rootUri = pathToFileURL(root).href;
await send("initialize",{processId:process.pid,rootUri,workspaceFolders:[{uri:rootUri,name:"r"}],
  capabilities:{textDocument:{documentSymbol:{},definition:{}},workspace:{configuration:true}},initializationOptions:settings});
notify("initialized",{});
await new Promise(r=>setTimeout(r,2500));
notify("textDocument/didOpen",{textDocument:{uri,languageId:"typescript",version:1,text}});
const marks=[];
for (const step of reqSpec.split(",")) {
  const ms = await send(`textDocument/${step}`, step==="definition"
    ? {textDocument:{uri},position:{line:0,character:15}}
    : {textDocument:{uri}});
  marks.push(`${step}=${ms}ms`);
}
console.log("  " + marks.join("  "));
lsp.kill(); process.exit(0);
