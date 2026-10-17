import json,sys,statistics as st,collections
def load(fs):
    rows=[]
    for f in fs: 
        try: rows+=json.load(open(f))
        except Exception as e: pass
    return rows
def summarize(rows,day='2.0'):
    by=collections.defaultdict(list)
    for r in rows: by[(r['mult'],r['mode'])].append(r)
    mults=sorted({k[0] for k in by})
    for m in mults:
        print(f'=== 수요 x{m} (day {day}, seeds={sorted({r["seed"] for r in by[(m,"global")]})})')
        for mode in ['sequential','global','global_eta','rolling_sa']:
            L=by.get((m,mode),[]); 
            if not L: continue
            def mean(f): 
                v=[f(r['res'][day]) for r in L]; v=[x for x in v if x is not None]; return st.mean(v) if v else float('nan')
            print(f'{mode:11s} n={len(L)} spawn {mean(lambda x:x["spawn"]):7.0f} fail {mean(lambda x:x["fail"]):6.1f} (crit {mean(lambda x:x["failBySev"]["critical"]):5.1f}/urg {mean(lambda x:x["failBySev"]["urgent"]):6.1f}/less {mean(lambda x:x["failBySev"]["less_urgent"]):6.1f}) '
                  f'search {mean(lambda x:x["avgSearchMin"]):5.2f} p95 {mean(lambda x:x["searchP95Min"]):5.2f} transit {mean(lambda x:x["avgTransitMin"]):5.2f} (crit {mean(lambda x:x["transitBySev"]["critical"]["avgMin"]):5.2f}) '
                  f'erOcc {mean(lambda x:x["er"]["occupied"]/x["er"]["capacity"]*100):5.1f}% full {mean(lambda x:x["fullHospAvg"]):5.2f} std {mean(lambda x:x["utilStd"]):.3f} maxU {mean(lambda x:x["maxUtilAvg"]):.3f} treated {mean(lambda x:x["treated"]):7.0f} wall {st.mean([r["res"]["wall"] for r in L]):5.0f}s')
if __name__=='__main__':
    rows=load(sys.argv[2:]); summarize(rows,sys.argv[1])
