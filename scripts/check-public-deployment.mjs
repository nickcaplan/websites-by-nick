// Usage: node scripts/check-public-deployment.mjs DEPLOY_URL [--netlify]
// Optional: --production-netlify=EXACT_PRODUCTION_NETLIFY_URL checks the existing host redirect.
// HTTP checks cannot verify browser fragment preservation. Use the browser checklist too.
import {pathToFileURL} from 'node:url';
const canonicalOrigin='https://websitesbynick.co.uk';
const routes=['','about/','pricing/','charity/','contact/','privacy/'];
function check(value,message){if(!value)throw Error(message)}
export async function checkPublicDeployment(base,{netlify=false,productionNetlify,fetcher=fetch}={}){
 const origin=new URL(base);check(origin.pathname==='/'&&!origin.search&&!origin.hash,'Pass a deployment origin, not a subpage');
 for(const path of routes){
  const url=new URL(path,origin),page=await fetcher(url,{redirect:'manual'});
  check(page.status===200,'Public route is not a direct200: '+url);
  check((page.headers.get('content-type')||'').includes('text/html'),'Public route is not HTML: '+url);
  const html=await page.text();
  check(html.includes('rel="canonical" href="'+canonicalOrigin+'/'+path+'"'),'Wrong public page: '+url);
  check(html.includes('data-measurement-id="G-J3J3NS19ZS"'),'Consent script missing: '+url);
  const oldUrl=new URL('homepage-concepts/'+path+'?promotion-check=1',origin);
  const old=await fetcher(oldUrl,{redirect:'manual'});
  if(netlify){
   check(old.status===301,'Retired Netlify HTML route is not301: '+oldUrl);
   const destination=new URL(old.headers.get('location')||'',oldUrl);
   check(destination.origin===origin.origin&&destination.pathname==='/'+path&&destination.search==='?promotion-check=1','Wrong redirect destination or lost query: '+destination);
  }else{
   check(old.status===200,'Pages fallback is not200: '+oldUrl);
   const fallback=await old.text();
   check(fallback.includes('location.replace('+JSON.stringify('/'+path)+'+location.search+location.hash)')&&fallback.includes('http-equiv="refresh"')&&fallback.includes(canonicalOrigin+'/'+path),'Retired page lacks the correct fallback: '+oldUrl);
  }
 }
 for(const [path,type,marker] of[
  ['homepage-concepts/motion.js',/javascript/,''],
  ['homepage-concepts/pages.css',/css/,''],
  ['robots.txt',/text\/plain/,'Sitemap: https://websitesbynick.co.uk/sitemap.xml'],
  ['sitemap.xml',/xml/,'https://websitesbynick.co.uk/about/'],
  ['assets/images/social-homepage-portrait.png',/image\/png/,''],
 ]){
  const url=new URL(path,origin),r=await fetcher(url,{redirect:'manual'});
  check(r.status===200&&type.test(r.headers.get('content-type')||''),'Missing, redirected or wrong-type asset: '+url);
  if(marker)check((await r.text()).includes(marker),'Wrong asset contents: '+url);
  else check((await r.arrayBuffer()).byteLength>100,'Empty/truncated asset: '+url);
 }
 if(productionNetlify){
  const host=new URL(productionNetlify);check(host.pathname==='/'&&!host.search&&!host.hash&&host.origin!==canonicalOrigin,'Pass the exact production Netlify origin');
  const r=await fetcher(new URL('about/?promotion-check=1',host),{redirect:'manual'});
  check(r.status===302,'Production Netlify catch-all is not302');
  const to=new URL(r.headers.get('location')||'',host);
  check(to.href===canonicalOrigin+'/about/?promotion-check=1','Production host redirect lost path/query or points elsewhere');
 }
 return origin.href;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const base=process.argv[2];if(!base)throw Error('Pass the exact deployed origin');
 const productionNetlify=process.argv.find(a=>a.startsWith('--production-netlify='))?.slice('--production-netlify='.length);
 console.log('HTTP deployment checks passed:',await checkPublicDeployment(base,{netlify:process.argv.includes('--netlify'),productionNetlify}));
 console.log('Still required in a browser: old-route query/hash arrival, consent interaction, production destination and no redirect loop.');
}
