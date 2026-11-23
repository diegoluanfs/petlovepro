#!/usr/bin/env python3
"""Guided deployment through the official Kiwify editor. No private API calls."""
import argparse
import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
PRIVATE = ROOT / 'private'
THEME = PRIVATE / 'kiwify-theme'
WORK = PRIVATE / 'kiwify-theme-work'
URL = 'https://dashboard.kiwify.com.br/members-area/ac2fa6f3-2e58-483d-a32b-fb380933aed8'
FILES = ('snippets/petlovepro-book-card.liquid', 'sections/petlovepro-welcome.liquid', 'sections/petlovepro-library.liquid', 'sections/petlovepro-help.liquid', 'templates/index.json')


def trusted(url):
    try:
        p = urlsplit(url)
        port = p.port
    except ValueError:
        return False
    return p.scheme == 'https' and p.username is None and p.password is None and port in (None,443) and any(p.hostname == d or (p.hostname or '').endswith('.'+d) for d in ('kiwify.com','kiwify.com.br'))


def digest(s):
    return hashlib.sha256(s.encode('utf-8')).hexdigest()


def normalized(s):
    return s.replace('\r\n','\n').replace('\r','\n')


def merge_index(original, example):
    def valid(obj):
        if not isinstance(obj,dict) or not isinstance(obj.get('order'),list) or not isinstance(obj.get('sections'),dict):
            raise ValueError('Template sem order/sections esperados; nenhuma alteração aplicada.')
        order=obj['order']; sections=obj['sections']
        if any(not isinstance(x,str) for x in order) or len(order)!=len(set(order)) or any(x not in sections for x in order):
            raise ValueError('Ordem inconsistente.')
        if any(not isinstance(s,dict) or not isinstance(s.get('type'),str) for s in sections.values()):
            raise ValueError('Seção sem tipo válido.')
    current=json.loads(original); proposed=json.loads(example)
    valid(current); valid(proposed)
    if any(v['type']=='login' for v in current['sections'].values()):
        raise ValueError('Template de login identificado. Nenhuma alteração aplicada.')
    for key, value in proposed['sections'].items():
        matches=[k for k,v in current['sections'].items() if v['type']==value['type'] and k!=key]
        if matches: raise ValueError('Seção PetLovePro já registrada com outro ID; revise no editor.')
        if key in current['sections']:
            if current['sections'][key]['type']!=value['type']: raise ValueError('Colisão de ID de seção.')
        else: current['sections'][key]=value
    current['order']=proposed['order']+[k for k in current['order'] if k not in proposed['order']]
    if len(current['order'])>25: raise ValueError('Limite de 25 seções excedido.')
    return json.dumps(current,ensure_ascii=False,indent=2)+'\n'


def validate_package():
    for name in FILES[:-1]:
        p=THEME/name
        if not p.is_file(): raise FileNotFoundError(str(p))
        s=p.read_text(encoding='utf-8')
        if re.search(r'<\s*(script|iframe)\b',s,re.I): raise ValueError(f'Tag proibida em {name}')
        if name.startswith('sections/'):
            m=re.search(r'{%\s*schema\s*%}(.*?){%\s*endschema\s*%}',s,re.S)
            if not m: raise ValueError(f'Schema ausente: {name}')
            json.loads(m.group(1))
    merge_index('{"order":[],"sections":{}}',(THEME/'templates/index.example.json').read_text(encoding='utf-8'))

# Inspect only generic editor DOM; never serialize session, requests or account text.
DETECT = '''() => {
 const el=document.activeElement;
 if(!el) return null;
 const root=el.closest('.monaco-editor,.cm-editor,.CodeMirror,.ace_editor');
 if(root) return {kind:root.matches('.monaco-editor')?'monaco':root.matches('.cm-editor,.CodeMirror')?'codemirror':'ace'};
 if(el.tagName==='TEXTAREA' && !el.readOnly && !el.disabled) return {kind:'textarea'};
 return null;
}'''
META = '''() => {
 const selectors={monaco:'.monaco-editor',codemirror:'.cm-editor,.CodeMirror',ace:'.ace_editor',textarea:'textarea'};
 const kinds=Object.fromEntries(Object.entries(selectors).map(([k,s])=>[k,document.querySelectorAll(s).length]));
 const fileNames=new Set();
 for(const el of document.querySelectorAll('button,[role=button],[role=treeitem],label,span,a,[role=tab]')) {
  if(el.children.length>1)continue;
  const t=(el.textContent||'').trim();
  if(/^[a-zA-Z0-9_./-]{1,120}\\.(liquid|json|css)$/.test(t)) fileNames.add(t);
 }
 return {kinds,files:[...fileNames].sort().slice(0,200)};
}'''


def find_page(ctx):
    pages=[p for p in ctx.pages if not p.is_closed() and trusted(p.url)]
    if not pages: raise RuntimeError('Abra o editor no domínio oficial Kiwify, na janela criada pelo script.')
    if len(pages)==1:return pages[0]
    print('Abas oficiais disponíveis:')
    for i,p in enumerate(pages,1): print(f' {i}: {urlsplit(p.url).hostname}')
    choice=input('Número da aba do editor: ').strip()
    if not choice.isdigit() or not 1<=int(choice)<=len(pages):raise RuntimeError('Aba não selecionada.')
    return pages[int(choice)-1]


def inspect(ctx):
    output=[]
    for page in ctx.pages:
        if not trusted(page.url):continue
        for frame in page.frames:
            if not trusted(frame.url):continue
            try: result=frame.evaluate(META)
            except Exception: continue
            output.append({'host':urlsplit(frame.url).hostname,**result})
    if not output: raise RuntimeError('Nenhum editor oficial encontrado.')
    WORK.mkdir(parents=True,exist_ok=True)
    (WORK/'editor-inspection.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(output,ensure_ascii=False,indent=2))
    print('Relatório: private/kiwify-theme-work/editor-inspection.json')


class BrowserEditor:
    def __init__(self,page):
        self.page=page
        self.frame=None
        self.kind=None

    def bind(self):
        if not trusted(self.page.url):raise RuntimeError('Origem não permitida.')
        self.page.bring_to_front()
        # User explicitly clicks the text editor, not a tree/search/password field.
        found=[]
        for f in self.page.frames:
            if not trusted(f.url):continue
            try:
                info=f.evaluate(DETECT)
                if info:found.append((f,info['kind']))
            except Exception:continue
        if len(found)!=1:raise RuntimeError('Clique dentro do editor de código correto. Editor ativo não identificado de forma única.')
        self.frame,self.kind=found[0]
        if self.kind!='textarea':
            self.page.context.grant_permissions(['clipboard-read','clipboard-write'],origin=f'https://{urlsplit(self.frame.url).netloc}')
        return self

    def check_filename(self,name):
        self.assert_active()
        expected=Path(name).name
        actual=self.frame.evaluate("""() => {
          const root=document.activeElement.closest('.monaco-editor');
          if(!root || !window.monaco?.editor?.getEditors)return null;
          const e=window.monaco.editor.getEditors().find(e=>e.getDomNode()===root);
          return e?.getModel()?.uri?.path || null;
        }""")
        if isinstance(actual,str) and re.search(r'\.(liquid|json|css)$',actual,re.I) and actual.rsplit('/',1)[-1]!=expected:
            raise RuntimeError('O editor informa outro nome de arquivo; operação bloqueada.')

    def assert_active(self):
        if not trusted(self.page.url) or not self.frame or not trusted(self.frame.url):raise RuntimeError('Origem mudou.')
        info=self.frame.evaluate(DETECT)
        if not info or info['kind']!=self.kind:raise RuntimeError('Foco saiu do editor de código. Nenhuma tecla enviada.')

    def clipboard(self,value=None):
        if value is None:return self.frame.evaluate('() => navigator.clipboard.readText()')
        self.frame.evaluate('(v) => navigator.clipboard.writeText(v)',value)

    def read(self):
        self.assert_active()
        if self.kind=='textarea':return self.frame.evaluate('() => document.activeElement.value')
        # Read using supported editor APIs when exposed by the page. Do not use
        # framework state, private endpoints, cookies or authentication tokens.
        direct=self.frame.evaluate("""() => {
          const el=document.activeElement;
          const root=el.closest('.monaco-editor,.CodeMirror');
          if(!root)return null;
          if(root.matches('.monaco-editor') && window.monaco?.editor?.getEditors){
            const e=window.monaco.editor.getEditors().find(e=>e.getDomNode()===root);
            if(e?.getModel())return e.getModel().getValue();
          }
          if(root.matches('.CodeMirror') && root.CodeMirror?.getValue)return root.CodeMirror.getValue();
          return null;
        }""")
        if isinstance(direct,str):return direct
        marker='PLP_CLIPBOARD_SENTINEL_'+str(time.time_ns())
        self.clipboard(marker)
        self.page.keyboard.press('Control+a')
        self.page.keyboard.press('Control+c')
        self.page.wait_for_timeout(250)
        result=self.clipboard()
        if result==marker:raise RuntimeError('Não foi possível copiar o código. Não serão enviados novos dados.')
        return result

    def write(self,content):
        self.assert_active()
        if self.kind=='textarea':
            self.frame.locator('textarea:focus').fill(content)
        else:
            self.clipboard(content)
            self.page.keyboard.press('Control+a')
            self.page.keyboard.press('Control+v')
            self.page.wait_for_timeout(350)
        actual=self.read()
        if normalized(actual)!=normalized(content):raise RuntimeError('Conteúdo inserido não coincide. NÃO salve; restaure o backup.')


def save_local(path,text):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('x',encoding='utf-8',newline='') as f:f.write(text)


def install(ctx,only=None):
    validate_package()
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    backup=WORK/'backups'/stamp; backup.mkdir(parents=True,exist_ok=False)
    print('Backup local desta execução:',backup)
    print('Verifique que está na PetLovePro — Biblioteca Digital e, se disponível, em uma versão de edição/preview.')
    print('O script não salva nem publica. O botão de salvar pode publicar imediatamente; confirme isso no painel antes de clicar.')
    if input('Digite PETLOVEPRO para continuar: ').strip()!='PETLOVEPRO':return
    chosen=[only] if only else list(FILES)
    page=find_page(ctx)
    if only=='templates/index.json':
        if input('Confirme que os quatro arquivos Liquid já foram salvos na mesma versão. Digite LIQUID-OK: ').strip()!='LIQUID-OK':return
    for name in chosen:
        print('\nArquivo:',name)
        print('No navegador, crie/abra exatamente esse arquivo, clique dentro do texto do editor e volte ao terminal.')
        answer=input('Digite o caminho acima para confirmar ou SAIR: ').strip()
        if answer=='SAIR':break
        if answer!=name:raise RuntimeError('Caminho não confirmado. Nenhuma alteração neste arquivo.')
        ed=BrowserEditor(page).bind()
        ed.check_filename(name)
        original=ed.read()
        save_local(backup/name,original)
        if name=='templates/index.json':
            replacement=merge_index(original,(THEME/'templates/index.example.json').read_text(encoding='utf-8'))
        else:
            replacement=(THEME/name).read_text(encoding='utf-8')
            if original.strip() and normalized(original)!=normalized(replacement):
                print('Arquivo existente não vazio. Backup feito. Nenhuma substituição automática.')
                raise RuntimeError('Revise o arquivo existente antes de substituir.')
        save_local(backup/'proposed'/name,replacement)
        if normalized(original)==normalized(replacement):print('Já corresponde ao conteúdo esperado; nada a alterar.');continue
        print(f'Backup feito ({len(original)} caracteres); novo código: {len(replacement)} caracteres; SHA256 {digest(replacement)[:12]}.')
        if input('Inserir o conteúdo no editor? Digite INSERIR: ').strip()!='INSERIR':raise RuntimeError('Cancelado antes da inserção.')
        ed.check_filename(name)
        if normalized(ed.read())!=normalized(original):raise RuntimeError('O conteúdo mudou após o backup. Operação interrompida.')
        ed.write(replacement)
        print('Inserção conferida localmente. Revise a tela e o modo de edição antes de salvar. O script não publica.')
        if input('Após salvar pelo painel (somente se seguro), digite SALVO; caso contrário SAIR: ').strip()!='SALVO':break
        # User re-opens the exact file if save changed focus; verifies visible content again.
        input('Reabra o mesmo arquivo, clique no editor e pressione Enter: ')
        opened=BrowserEditor(page).bind()
        opened.check_filename(name)
        verify=opened.read()
        if normalized(verify)!=normalized(replacement):raise RuntimeError('Conteúdo após salvar difere. Pare e revise o backup.')
        print('Conteúdo conferido após salvamento informado. Validação de persistência/renderização ainda necessária no painel.')
    print('Arquivos originais e propostos mantidos em:',backup)
    print('Login e publicação de aulas não foram modificados pelo script.')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['inspect','install','validate'])
    parser.add_argument('--only',choices=FILES)
    args=parser.parse_args()
    if args.only and args.action!='install':parser.error('--only exige install')
    validate_package()
    if args.action=='validate':print('Pacote local validado.');return
    from playwright.sync_api import sync_playwright
    WORK.mkdir(parents=True,exist_ok=True)
    print('Perfil local isolado: private/kiwify-theme-work/browser-profile. Não compartilhe nem versione essa pasta.')
    with sync_playwright() as p:
        ctx=p.chromium.launch_persistent_context(str(WORK/'browser-profile'),headless=False,viewport=None)
        try:
            page=ctx.pages[0] if ctx.pages else ctx.new_page()
            page.goto(URL,wait_until='domcontentloaded')
            input('Faça login na janela, abra PetLovePro > Personalizações > </> e pressione Enter aqui: ')
            if args.action=='inspect':inspect(ctx)
            else:install(ctx,args.only)
        finally:
            try: input('Pressione Enter para fechar o navegador...')
            except (EOFError,KeyboardInterrupt):pass
            ctx.close()

if __name__=='__main__':
    try:main()
    except (Exception,KeyboardInterrupt) as exc:
        print('Interrompido:', str(exc),file=sys.stderr)
        sys.exit(1)
