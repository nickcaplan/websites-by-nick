import { chromium } from "@playwright/test";
const B="https://deploy-preview-64--nickcaplan-profile.netlify.app";
const b=await chromium.launch({executablePath:"/usr/bin/google-chrome",args:["--no-sandbox"]});
for(const [n,vp] of [["phone",{width:412,height:915}],["desk",{width:1280,height:800}]]){
 for(const pg of ["","about/","pricing/"]){
  const p=await (await b.newContext({viewport:vp})).newPage();
  await p.goto(`${B}/homepage-concepts/${pg}`);await p.waitForTimeout(1500);
  for(const th of ["light","dark"]){
   if(th==="dark")await p.locator(".theme-toggle").first().click();
   await p.evaluate(()=>scrollTo(0,0));await p.waitForTimeout(500);
   const H=await p.evaluate(()=>document.documentElement.scrollHeight);
   const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   console.log(n,pg||"home",th,"height",H,"hOverflow",ov);
   let i=0;for(let y=0;y<H;y+=vp.height*0.9){await p.evaluate(v=>scrollTo(0,v),y);await p.waitForTimeout(700);await p.screenshot({path:`/tmp/fp/${n}-${pg.replace("/","")||"home"}-${th}-${String(i++).padStart(2,"0")}.png`});if(i>14)break;}
  }
 }
}
await b.close();
