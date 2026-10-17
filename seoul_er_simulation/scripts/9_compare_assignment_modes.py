import asyncio, json, sys, time
from playwright.async_api import async_playwright
HTML=sys.argv[1]
STUB="""(()=>{const s=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?(()=>0):(k==='then'?undefined:s),apply:()=>s,construct:()=>s});window.L=s;})();"""
async def run(br, mode, seed, mult, days, sem, marks):
    async with sem:
        ctx=await br.new_context(); pg=await ctx.new_page()
        await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        await pg.add_init_script(STUB)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(HTML); await pg.wait_for_timeout(1200)
        await pg.evaluate("""([m,s,d])=>{const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};
          set('seedInput',s); set('demandMultInput',d); set('modeSel',m);}""",[mode,seed,mult])
        t0=time.time(); out={}
        done=0
        for d in marks:
            await pg.evaluate("([a])=>SIM_DEBUG.advance(a,10)",[int((d-done)*86400)]); done=d
            out[str(d)]=await pg.evaluate("SIM_DEBUG.getState()")
        out['wall']=time.time()-t0; out['errs']=errs[:3]
        await ctx.close(); return dict(mode=mode,seed=seed,mult=mult,res=out)
async def main():
    modes=sys.argv[2].split(','); seeds=[int(x) for x in sys.argv[3].split(',')]; mults=[float(x) for x in sys.argv[4].split(',')]
    marks=[float(x) for x in sys.argv[5].split(',')]; outp=sys.argv[6]; par=int(sys.argv[7]) if len(sys.argv)>7 else 4
    sem=asyncio.Semaphore(par)
    async with async_playwright() as p:
        br=await p.chromium.launch(args=["--disable-background-timer-throttling"])
        res=await asyncio.gather(*[run(br,m,s,x,marks[-1],sem,marks) for x in mults for s in seeds for m in modes])
        json.dump(res,open(outp,'w'),ensure_ascii=False)
asyncio.run(main())
