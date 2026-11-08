// Build the static Pages artifact without changing the source preview fixtures.
import{cp,mkdir,readdir,rm,writeFile,lstat,readFile}from'node:fs/promises';import{resolve,dirname}from'node:path';
const root=resolve(import.meta.dirname,'..'),output=resolve(process.argv[2]||resolve(root,'.site-public'));
if(output===root||dirname(output)!==root)throw Error('Output must be a separate top-level directory within the repository');
const marker='.wbn-generated-artifact',signature='websites-by-nick generated artifact v1';
try{const info=await lstat(output);if(info.isSymbolicLink()||!info.isDirectory()||await readFile(resolve(output,marker),'utf8')!==signature)throw Error('Refusing to remove a directory not owned by this build')}catch(error){if(error.code!=='ENOENT')throw error;try{await lstat(output);throw Error('Refusing to remove an unmarked existing directory')}catch(check){if(check.code!=='ENOENT')throw check}}
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});await writeFile(resolve(output,marker),signature);
for(const item of await readdir(root,{withFileTypes:true})){
 if(resolve(root,item.name)===output||item.name.startsWith('.')||['node_modules','test-results','playwright-report','tests','scripts','docs','package-lock.json','package.json','README.md','CONTRIBUTING.md','netlify.toml','playwright.config.mjs','playwright.width-local.config.mjs'].includes(item.name))continue;
 await cp(resolve(root,item.name),resolve(output,item.name),{recursive:true});
}
for(const path of['','about/','pricing/','charity/','contact/','privacy/']){
 const target='/'+path,directory=resolve(output,'homepage-concepts',path);await mkdir(directory,{recursive:true});
 await writeFile(resolve(directory,'index.html'),`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><link rel="canonical" href="https://websitesbynick.co.uk${target}"><meta http-equiv="refresh" content="0;url=${target}"><title>Page moved | Websites by Nick</title></head><body><p>This page has moved. <a href="${target}">Continue to Websites by Nick</a>.</p><script>location.replace(${JSON.stringify(target)}+location.search+location.hash)</script></body></html>`);
}
console.log(output);
