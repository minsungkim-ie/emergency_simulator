"""고정 간격 비교 실험 (배정 모드 × 수요 배율 × 시드 × [국지 폭주] × [SA 설정]).
사용: python fixed2.py <html URL> <설정 JSON 파일> <출력 JSON> [동시 실행 수]
설정 JSON: {"runs":[{"label":"...","mode":"rolling_sa","seed":42,"mult":2.5,"days":2,"surge":null|{...},"sa":{...},"eta_score":true}...]}
"""
import asyncio, json, sys, time
from playwright.async_api import async_playwright
STUB="""(()=>{const s=new Proxy(function(){},{get:(t,k)=>k===Symbol.toPrimitive?(()=>0):(k==='then'?undefined:s),apply:()=>s,construct:()=>s});window.L=s;})();"""
async def run(br, html, cfg, sem):
    async with sem:
        ctx=await br.new_context(); pg=await ctx.new_page()
        await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("file:") else r.abort())
        await pg.add_init_script(STUB)
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(html); await pg.wait_for_timeout(1200)
        t0=time.time()
        if cfg.get('eta_score'): await pg.evaluate("SIM_DEBUG.setScoreByEta(true)")
        if cfg.get('sa'): await pg.evaluate("([o])=>SIM_DEBUG.setSAConfig(o)",[cfg['sa']])
        await pg.evaluate("""([m,s,d])=>{const set=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))};
          set('seedInput',s); set('demandMultInput',d); set('modeSel',m);}""",[cfg['mode'],cfg['seed'],cfg['mult']])
        if cfg.get('surge'): await pg.evaluate("([o])=>SIM_DEBUG.setSurge(o)",[cfg['surge']])
        await pg.evaluate("([a])=>SIM_DEBUG.advance(a,10)",[int(cfg['days']*86400)])
        st=await pg.evaluate("SIM_DEBUG.getState()")
        await ctx.close()
        return dict(cfg=cfg, res=st, wall=time.time()-t0, errs=errs[:3])
async def main():
    html, cfgf, outp = sys.argv[1], sys.argv[2], sys.argv[3]
    par=int(sys.argv[4]) if len(sys.argv)>4 else 2
    runs=json.load(open(cfgf))['runs']; sem=asyncio.Semaphore(par)
    async with async_playwright() as p:
        br=await p.chromium.launch()
        res=await asyncio.gather(*[run(br,html,c,sem) for c in runs])
        json.dump(res,open(outp,'w'),ensure_ascii=False)
asyncio.run(main())
