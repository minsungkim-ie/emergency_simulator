import asyncio, json, sys, time
from playwright.async_api import async_playwright
HTML=sys.argv[5]
STUB="""(()=>{const s=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?(()=>0):(k==='then'?undefined:s),apply:()=>s,construct:()=>s});window.L=s;})();"""
VARIANTS={
 'sa_full':{},
 'sa_no_future':{'maxVirtual':0},
 'sa_no_congestion':{'congWeightSec':0},
 'sa_no_sev':{'sevWeight':{'critical':1,'urgent':1,'less_urgent':1}},
 'sa_iters_low':{'itersPerItem':5,'minIters':30,'maxIters':200},
}
async def run(br, var, seed, mult, days, sem):
    async with sem:
        ctx=await br.new_context(); pg=await ctx.new_page()
        await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        await pg.add_init_script(STUB)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(HTML); await pg.wait_for_timeout(1200)
        t0=time.time()
        await pg.evaluate("([o])=>SIM_DEBUG.setSAConfig(o)",[VARIANTS[var]])
        await pg.evaluate("""([s,d])=>{const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};
          set('seedInput',s); set('demandMultInput',d); set('modeSel','rolling_sa');}""",[seed,mult])
        await pg.evaluate("([a])=>SIM_DEBUG.advance(a,10)",[int(days*86400)])
        st=await pg.evaluate("SIM_DEBUG.getState()")
        await ctx.close(); return dict(mode=var,seed=seed,mult=mult,res={str(float(days)):st,'wall':time.time()-t0,'errs':errs[:3]})
async def main():
    seeds=[int(x) for x in sys.argv[1].split(',')]; mults=[float(x) for x in sys.argv[2].split(',')]; days=float(sys.argv[3]); outp=sys.argv[4]
    sem=asyncio.Semaphore(2)
    async with async_playwright() as p:
        br=await p.chromium.launch()
        res=await asyncio.gather(*[run(br,v,s,x,days,sem) for x in mults for s in seeds for v in VARIANTS])
        json.dump(res,open(outp,'w'),ensure_ascii=False)
asyncio.run(main())
