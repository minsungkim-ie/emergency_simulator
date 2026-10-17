import json,sys,statistics as st,collections,math
def load(f): return json.load(open(f))
MODES=['sequential','global','global_eta','greedy_cong','rolling_sa']
def table(rows,labelkey=lambda c:c['label']):
    by=collections.defaultdict(list)
    for r in rows: by[(labelkey(r['cfg']),r['cfg']['mode'])].append(r)
    labels=sorted({k[0] for k in by})
    for lab in labels:
        print('==',lab)
        for m in MODES:
            L=by.get((lab,m)); 
            if not L: continue
            def mean(f):
                v=[f(r['res']) for r in L]; return st.mean(v)
            print(f' {m:12s} n={len(L)} spawn {mean(lambda x:x["spawn"]):6.0f} fail {mean(lambda x:x["fail"]):7.1f} (crit {mean(lambda x:x["failBySev"]["critical"]):5.1f} urg {mean(lambda x:x["failBySev"]["urgent"]):6.1f} less {mean(lambda x:x["failBySev"]["less_urgent"]):6.1f}) search {mean(lambda x:x["avgSearchMin"]):5.2f} p95 {mean(lambda x:x["searchP95Min"]):5.2f} transit {mean(lambda x:x["avgTransitMin"]):5.2f} crit {mean(lambda x:x["transitBySev"]["critical"]["avgMin"]):5.2f} full {mean(lambda x:x["fullHospAvg"]):5.2f} std {mean(lambda x:x["utilStd"]):.3f} maxU {mean(lambda x:x["maxUtilAvg"]):.3f} treated {mean(lambda x:x["treated"]):6.0f} wall {st.mean([r["wall"] for r in L]):4.0f}s')
    return by
def paired(by,lab,a,b,key):
    A={r['cfg']['seed']:r['res'] for r in by[(lab,a)]}; B={r['cfg']['seed']:r['res'] for r in by[(lab,b)]}
    d=[key(A[s])-key(B[s]) for s in A if s in B]; n=len(d); mu=st.mean(d); se=(st.stdev(d)/math.sqrt(n)) if n>1 else 0
    return n,mu,se,sum(1 for x in d if x<0)
KEYS={'fail':lambda x:x['fail'],'transit':lambda x:x['avgTransitMin'],'crit':lambda x:x['transitBySev']['critical']['avgMin'],'full':lambda x:x['fullHospAvg'],'p95':lambda x:x['searchP95Min'],'maxU':lambda x:x['maxUtilAvg']}
if __name__=='__main__':
    rows=load(sys.argv[1]); by=table(rows)
    labs=sorted({k[0] for k in by})
    for lab in labs:
        for a,b in [('rolling_sa','greedy_cong'),('rolling_sa','global_eta'),('greedy_cong','global_eta')]:
            if (lab,a) in by and (lab,b) in by:
                print(lab,a,'-',b,' | '.join(f'{k} {paired(by,lab,a,b,f)[1]:+.2f}±{paired(by,lab,a,b,f)[2]:.2f}({paired(by,lab,a,b,f)[3]}/{paired(by,lab,a,b,f)[0]})' for k,f in KEYS.items()))
