#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const target=path.join(root,'scripts','stage-cloudflare.cjs');
const check=process.argv.includes('--check');
const restore=process.argv.includes('--restore');
const originalBackup=target+'.antes-petlovepro-v122.bak';
const marker='/* PETLOVEPRO_ASSERT_WRAPPED_V122 */';
const requireModule="require('./cloudflare-public-v122.cjs')";
if(!fs.existsSync(target))throw Error('Não encontrei scripts/stage-cloudflare.cjs. Nenhuma alteração realizada.');
if(restore){
 if(!fs.existsSync(originalBackup))throw Error('Não encontrei backup desta correção.');
 if(check){console.log('Backup encontrado: '+originalBackup);process.exit(0)}
 fs.copyFileSync(originalBackup,target);console.log('Restaurado: '+target);process.exit(0);
}
const src=fs.readFileSync(target,'utf8');
if(src.includes(marker)){
 console.log('Correção v1.2.2 já aplicada. Nada alterado.');process.exit(0);
}
// O log identifica assertPublic() como função original. A correção intercepta
// a DECLARAÇÃO central, não só a primeira chamada em stageCloudflare().
const declaration=/\bfunction\s+assertPublic\s*\(/g;
const hits=[...src.matchAll(declaration)];
if(hits.length!==1)throw Error('Assinatura de assertPublic() não reconhecida ou duplicada: '+hits.length+'. Envie o arquivo para ajuste manual; nada alterado.');
if(/\bfunction\s+assertPublicLegacy\s*\(/.test(src))throw Error('Já existe assertPublicLegacy no script: ajuste manual necessário.');
const renamed=src.replace(declaration,'function assertPublicLegacy(');
const wrapper=`\n${marker}\nfunction assertPublic(...args) {\n  return ${requireModule}.validateOnlyApprovedAdditionalEntries(\n    () => assertPublicLegacy(...args), __dirname, args\n  );\n}\n`;
const patched=renamed+'\n'+wrapper;
const temp=path.join(root,'scripts','.petlovepro-stage-v122-check.cjs');
try{
 fs.writeFileSync(temp,patched,'utf8');
 cp.execFileSync(process.execPath,['--check',temp],{stdio:'pipe'});
} catch(e) {
 throw Error('Arquivo ajustado não passou na análise sintática. Original mantido: '+String(e.stderr||e.message));
} finally { if(fs.existsSync(temp))fs.unlinkSync(temp); }
if(!fs.existsSync(path.join(root,'scripts','cloudflare-public-v122.cjs')))throw Error('Módulo de validação v122 ausente; extraia o pacote completo.');
if(check){console.log('Pré-verificação OK: é possível corrigir todas as chamadas sem tocar no projeto.');process.exit(0)}
if(fs.existsSync(originalBackup))throw Error('Backup v1.2.2 já existe, mas o arquivo não contém marcador. Para não sobrescrever backup, pare e inspecione manualmente.');
fs.copyFileSync(target,originalBackup);
try{
 fs.writeFileSync(target,patched,'utf8');
 console.log('Corrigida a declaração central de assertPublic: agora TODAS as chamadas passam por validação complementar.');
 console.log('Backup: '+path.relative(root,originalBackup));
} catch(e){fs.copyFileSync(originalBackup,target);throw e;}
