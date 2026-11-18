const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const base=path.join(root,'public');
const plan=require('./cover-plan.json');
const covers=new Set(plan.map(p=>'assets/covers/'+p.name));
const staticFiles=['index.html','styles.css','app.js','access.js','catalog.js','firebase-config.js','google-auth.js','robots.txt','sitemap.xml','assets/logo.svg','assets/google-g.svg','assets/hero.svg',...Array.from({length:5},(_,i)=>`assets/book-${String(i+1).padStart(3,'0')}.svg`)];
const allowed=new Set([...staticFiles,...covers]);
function inspect(dir,{requireCovers=false}={}){
 const seen=new Set();const errors=[];
 function walk(p){for(const entry of fs.readdirSync(p,{withFileTypes:true})){
 const abs=path.join(p,entry.name),rel=path.relative(dir,abs).split(path.sep).join('/');
 if(entry.isSymbolicLink()){errors.push(`Link não permitido: ${rel}`);continue;}
 if(entry.isDirectory()){if(!['assets','assets/covers'].includes(rel)){errors.push(`Diretório não permitido: ${rel}`);continue;}walk(abs);continue;}
 if(!entry.isFile()||!allowed.has(rel)){errors.push(`Arquivo não autorizado: ${rel}`);continue;}
 seen.add(rel);
 const b=fs.readFileSync(abs);
 if(b.subarray(0,5).toString()==='%PDF-')errors.push(`PDF disfarçado: ${rel}`);
 if(covers.has(rel)&&(b.length<20||b.subarray(0,4).toString()!=='RIFF'||b.subarray(8,12).toString()!=='WEBP'||b.readUInt32LE(4)+8!==b.length))errors.push(`Capa não é WebP válido ou possui dados extras: ${rel}`);
 }}
 if(fs.lstatSync(dir).isSymbolicLink())return ['Pasta public não pode ser link.'];
 walk(dir);
 for(const f of staticFiles.filter(f=>!f.startsWith('assets/book-')&&f!=='assets/hero.svg'))if(!seen.has(f))errors.push(`Arquivo obrigatório ausente: ${f}`);
 if(requireCovers)for(const f of covers)if(!seen.has(f))errors.push(`Capa ausente: ${f}`);
 return errors;
}
module.exports={inspect,covers};
if(require.main===module){const errors=inspect(base,{requireCovers:process.argv.includes('--require-covers')});if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Pasta pública validada. Nenhum arquivo fora da lista permitida.');}
