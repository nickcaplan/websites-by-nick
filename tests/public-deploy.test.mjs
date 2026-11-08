import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync,rmSync}from'node:fs';import{execFileSync}from'node:child_process';import{resolve}from'node:path';
test('Pages artifact retains public pages/assets and redirects retired concept HTML only',()=>{const root=resolve(import.meta.dirname,'..'),dir=resolve(root,'.test-public-artifact');try{execFileSync(process.execPath,['scripts/prepare-public-deploy.mjs',dir],{cwd:root});for(const path of['','about/','pricing/','charity/','contact/','privacy/']){const html=readFileSync(resolve(dir,'homepage-concepts',path,'index.html'),'utf8');assert.ok(html.includes('location.search+location.hash'));assert.ok(html.includes('https://websitesbynick.co.uk/'+path));assert.ok(html.includes('http-equiv="refresh"'));assert.ok(existsSync(resolve(dir,path,'index.html')))}for(const asset of['motion.css','pages.js','motion.js'])assert.ok(existsSync(resolve(dir,'homepage-concepts',asset)));for(const path of['tests','scripts','node_modules','.git'])assert.ok(!existsSync(resolve(dir,path)))}finally{rmSync(dir,{recursive:true,force:true})}});

test('named top-level artifact output is not copied into itself',()=>{
 const root=resolve(import.meta.dirname,'..'),dir=resolve(root,'public-artifact-test');
 try{execFileSync(process.execPath,['scripts/prepare-public-deploy.mjs',dir],{cwd:root});assert.ok(existsSync(resolve(dir,'index.html')));assert.ok(!existsSync(resolve(dir,'public-artifact-test')))}finally{rmSync(dir,{recursive:true,force:true})}
});
test('nested artifact output is rejected before creating a directory',()=>{
 const root=resolve(import.meta.dirname,'..'),dir=resolve(root,'public-artifact-test','nested');
 assert.throws(()=>execFileSync(process.execPath,['scripts/prepare-public-deploy.mjs',dir],{cwd:root,stdio:'pipe'}));assert.ok(!existsSync(dir));
});
test('crawlers may fetch all concept assets used by public pages but not retired HTML',()=>{
 const root=resolve(import.meta.dirname,'..'),robots=readFileSync(resolve(root,'robots.txt'),'utf8');
 const rules=[...robots.matchAll(/^(Allow|Disallow): (.+)$/gm)].map(([,kind,pattern])=>({kind,pattern}));
 const allowed=path=>{const matches=rules.filter(r=>r.pattern.endsWith('$')?path===r.pattern.slice(0,-1):path.startsWith(r.pattern)).sort((a,b)=>b.pattern.replace(/\$$/,'').length-a.pattern.replace(/\$$/,'').length);return !matches.length||matches[0].kind==='Allow'};
 for(const page of['','about/','pricing/','charity/','contact/','privacy/']){
  const html=readFileSync(resolve(root,page,'index.html'),'utf8');
  for(const [,asset]of html.matchAll(/(?:href|src)="(\/homepage-concepts\/[^"#?]+\.(?:css|js))"/g))assert.ok(allowed(asset),asset);
  assert.ok(!allowed('/homepage-concepts/'+page));assert.ok(!allowed('/homepage-concepts/'+page+'index.html'));
 }
});
