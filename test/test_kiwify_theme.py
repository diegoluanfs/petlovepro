import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('kiwify_theme',Path(__file__).resolve().parents[1]/'scripts/kiwify-theme.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

EXAMPLE=(m.THEME/'templates/index.example.json').read_text(encoding='utf-8')

class LocalTests(unittest.TestCase):
    def test_package(self):m.validate_package()
    def test_official_hosts_only(self):
        for u in ['https://dashboard.kiwify.com.br','https://editor.kiwify.com','https://kiwify.com.br:443']:
            self.assertTrue(m.trusted(u))
        for u in ['https://kiwify.com.br.evil.com','https://evilkiwify.com','http://kiwify.com','https://user@kiwify.com','https://kiwify.com:81','https://kiwify.com:bad']:
            self.assertFalse(m.trusted(u))
    def test_merge_preserves_native_settings(self):
        src={'order':['courses'],'sections':{'courses':{'type':'courses','settings':{'title':'Nativo'}}},'extra':42}
        result=json.loads(m.merge_index(json.dumps(src),EXAMPLE))
        self.assertEqual(result['sections']['courses'],src['sections']['courses'])
        self.assertEqual(result['order'][-1],'courses')
        self.assertEqual(result['extra'],42)
    def test_merge_idempotent_preserves_changes(self):
        r=m.merge_index('{"order":[],"sections":{}}',EXAMPLE)
        obj=json.loads(r);obj['sections']['plp-welcome']['settings']['title']='Alterado'
        a=m.merge_index(json.dumps(obj),EXAMPLE)
        self.assertEqual(a,m.merge_index(a,EXAMPLE))
        self.assertEqual(json.loads(a)['sections']['plp-welcome']['settings']['title'],'Alterado')
    def test_collision(self):
        for sections in [{'plp-welcome':{'type':'other'}},{'old':{'type':'petlovepro-library'}}]:
            with self.assertRaises(ValueError):m.merge_index(json.dumps({'order':list(sections),'sections':sections}),EXAMPLE)
    def test_wrong_schema(self):
        for data in ['{}','{"order":["x"],"sections":{}}','{"order":["x","x"],"sections":{"x":{"type":"ok"}}}']:
            with self.assertRaises(ValueError):m.merge_index(data,EXAMPLE)
    def test_never_merge_login(self):
        with self.assertRaises(ValueError):m.merge_index('{"order":["login"],"sections":{"login":{"type":"login"}}}',EXAMPLE)
    def test_limit(self):
        sections={str(i):{'type':'banner'} for i in range(23)}
        with self.assertRaises(ValueError):m.merge_index(json.dumps({'order':list(sections),'sections':sections}),EXAMPLE)
    def test_backup_no_overwrite(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'nested/file.liquid';m.save_local(path,'original')
            with self.assertRaises(FileExistsError):m.save_local(path,'other')
            self.assertEqual(path.read_text(),'original')
    def test_only_home_not_login(self):
        self.assertEqual(len(m.FILES),5)
        self.assertNotIn('templates/login.json',m.FILES)
        self.assertTrue(all('petlovepro-' in f for f in m.FILES[:-1]))

class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from playwright.sync_api import sync_playwright
        cls.p=sync_playwright().start()
        opts={'headless':True}
        executable=os.getenv('PLP_TEST_CHROMIUM')
        if executable:opts['executable_path']=executable
        cls.browser=cls.p.chromium.launch(**opts)
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.p.stop()
    def setUp(self):self.page=self.browser.new_page()
    def tearDown(self):self.page.close()
    def test_editor_detects_and_inserts_exact_text(self):
        self.page.set_content('<textarea id="editor">old</textarea><input id="password" type="password">')
        self.page.locator('#editor').focus()
        with patch.object(m,'trusted',return_value=True):
            e=m.BrowserEditor(self.page).bind();self.assertEqual(e.read(),'old')
            expected='Olá!\n{% assign x = 1 %}\n'+('texto\n'*2500)
            e.write(expected);self.assertEqual(e.read(),expected)
            self.page.locator('#password').focus()
            with self.assertRaises(RuntimeError):e.write('do not touch')
        self.assertEqual(self.page.locator('#password').input_value(),'')
    def test_inspection_metadata_only(self):
        self.page.set_content('<span>index.json</span><span>login.liquid</span><span>private@example.com</span><textarea>private text</textarea>')
        meta=self.page.evaluate(m.META)
        self.assertEqual(meta['files'],['index.json','login.liquid']);self.assertEqual(meta['kinds']['textarea'],1)
        self.assertNotIn('private',json.dumps(meta))
    def test_public_monaco_read_and_filename_guard(self):
        self.page.set_content('<div class="monaco-editor" id="ed"><textarea id="input"></textarea></div>')
        self.page.evaluate("""() => {window.monaco={editor:{getEditors:()=>[{getDomNode:()=>document.querySelector('#ed'),getModel:()=>({getValue:()=>'',uri:{path:'/sections/petlovepro-welcome.liquid'}})}]}};}""")
        self.page.locator('#input').focus()
        self.assertEqual(self.page.evaluate(m.DETECT)['kind'],'monaco')
        with patch.object(m,'trusted',return_value=True):
            e=m.BrowserEditor(self.page);e.frame=self.page.main_frame;e.kind='monaco'
            self.assertEqual(e.read(),'');e.check_filename('sections/petlovepro-welcome.liquid')
            with self.assertRaises(RuntimeError):e.check_filename('sections/petlovepro-help.liquid')

if __name__=='__main__':unittest.main()
