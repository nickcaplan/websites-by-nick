// Preparation only: creates a local artifact and never deploys or changes DNS.
import {cp,mkdir,readFile,writeFile,readdir,rm,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const output=resolve(process.argv[2]||resolve(root,'.site-cloudflare'));
if(output===root||dirname(output)!==root)throw Error('Output must be a separate top-level directory within the repository');
const marker='.wbn-cloudflare-artifact',signature='websites-by-nick Cloudflare artifact v1';
try{const s=await lstat(output);if(s.isSymbolicLink()||!s.isDirectory()||await readFile(resolve(output,marker),'utf8')!==signature)throw Error('Refusing to replace an unowned artifact')}catch(e){if(e.code!=='ENOENT')throw e;try{await lstat(output);throw Error('Refusing to replace an unmarked directory')}catch(c){if(c.code!=='ENOENT')throw c}}
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});await writeFile(resolve(output,marker),signature);
// Explicit public inventory: do not publish arbitrary new top-level folders.
const inventory=['index.html','about','pricing','charity','contact','privacy','experience','kumar-co','bangham-and-scratchett','kitchen-shop','ozo-cafe','stay-inspired','talk-surrey','the-boathouse','walton-firs','riverhouse-barn','walton-park-dental','wheatley-and-sons','elmbridge-community-link','assets','favicon.ico','site.webmanifest','robots.txt','sitemap.xml'];
for(const path of inventory)await cp(resolve(root,path),resolve(output,path),{recursive:true});
// Only the approved prospect index is public, never arbitrary future folders.
await mkdir(resolve(output,'prospects'));
for(const name of['index.html','prospects.css'])await cp(resolve(root,'prospects',name),resolve(output,'prospects',name));
// Only these reviewed screenshot assets belong to the public collection.
await mkdir(resolve(output,'prospects/screens'));
const screenshotInventory=['bangham-and-scratchett-desktop-small.webp', 'bangham-and-scratchett-desktop.webp', 'bangham-and-scratchett-phone-small.webp', 'bangham-and-scratchett-phone.webp', 'elmbridge-community-link-desktop-small.webp', 'elmbridge-community-link-desktop.webp', 'elmbridge-community-link-phone-small.webp', 'elmbridge-community-link-phone.webp', 'kitchen-shop-desktop-small.webp', 'kitchen-shop-desktop.webp', 'kitchen-shop-phone-small.webp', 'kitchen-shop-phone.webp', 'kumar-co-desktop-small.webp', 'kumar-co-desktop.webp', 'kumar-co-phone-small.webp', 'kumar-co-phone.webp', 'ozo-cafe-desktop-small.webp', 'ozo-cafe-desktop.webp', 'ozo-cafe-phone-small.webp', 'ozo-cafe-phone.webp', 'riverhouse-barn-desktop-small.webp', 'riverhouse-barn-desktop.webp', 'riverhouse-barn-phone-small.webp', 'riverhouse-barn-phone.webp', 'stay-inspired-desktop-small.webp', 'stay-inspired-desktop.webp', 'stay-inspired-phone-small.webp', 'stay-inspired-phone.webp', 'talk-surrey-desktop-small.webp', 'talk-surrey-desktop.webp', 'talk-surrey-phone-small.webp', 'talk-surrey-phone.webp', 'the-boathouse-desktop-small.webp', 'the-boathouse-desktop.webp', 'the-boathouse-phone-small.webp', 'the-boathouse-phone.webp', 'walton-firs-desktop-small.webp', 'walton-firs-desktop.webp', 'walton-firs-phone-small.webp', 'walton-firs-phone.webp', 'walton-park-dental-desktop-small.webp', 'walton-park-dental-desktop.webp', 'walton-park-dental-phone-small.webp', 'walton-park-dental-phone.webp', 'wheatley-and-sons-desktop-small.webp', 'wheatley-and-sons-desktop.webp', 'wheatley-and-sons-phone-small.webp', 'wheatley-and-sons-phone.webp'];
for(const name of screenshotInventory)await cp(resolve(root,'prospects/screens',name),resolve(output,'prospects/screens',name));
// Keep only shared CSS/JS here, not any retired concept HTML or experiments.
await mkdir(resolve(output,'homepage-concepts'));
for(const entry of await readdir(resolve(root,'homepage-concepts'),{withFileTypes:true}))if(entry.isFile()&&/\.(css|js)$/.test(entry.name))await cp(resolve(root,'homepage-concepts',entry.name),resolve(output,'homepage-concepts',entry.name));
for(const name of['_redirects','_headers','404.html'])await cp(resolve(root,'deploy/cloudflare',name),resolve(output,name));
console.log(output);
