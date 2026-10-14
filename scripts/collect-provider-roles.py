"""Bounded, opt-in alternate-lane acquisition. Does not touch default sources.

Only publish observed role pairs after prepare-provider-roles.mjs validates them.
The targets are acquisition candidates, never evidence of role availability.
"""
import argparse,concurrent.futures,datetime,importlib.util,json,os
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('base_collector',ROOT/'scripts/collect-provider-research.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)

def qualifies(sources):
 return len(sources)==2 and {s.get('provider') for s in sources}=={'opgg','lolalytics'} and all(s.get('status')=='available' and (s.get('provider')!='lolalytics' or isinstance(s.get('matches'),int) and s['matches']>=1000) and isinstance(s.get('coreBuildMatches'),int) and s['coreBuildMatches']>=100 for s in sources)

def collect(target):
 c=next(c for c in base.CAT['champions'] if c['alias']==target['champion']);role=target['role'];sources=[]
 for provider,fetch in [('lolalytics',base.lol),('opgg',base.opgg)]:
  try:
   source=fetch(c,role)
   source['context']=dict(gameMode='ranked',tier='emerald_plus',queue='solo_duo',region='global' if provider=='lolalytics' else 'unverified')
   source['sampleScope']='champion_role' if provider=='lolalytics' else 'champion_summary_unverified'
   if provider=='opgg':source['limits']+=' The summary matches count can repeat across positions; it is not verified as a champion-role cohort. Only the returned position and core-item sample establish this role observation.'
  except Exception as e:source=base.failure(c,provider,role,e)
  sources.append(source)
 return sources

def main(argv=None):
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--targets',type=Path,default=ROOT/'scripts/provider-role-targets.json')
 parser.add_argument('--output-dir',type=Path,default=ROOT/'scripts/provider-roles')
 parser.add_argument('--checked-at',default=datetime.datetime.now(datetime.timezone.utc).date().isoformat())
 args=parser.parse_args(argv);datetime.date.fromisoformat(args.checked_at)
 targets=json.loads(args.targets.read_text(encoding='utf-8'));known={c['alias'] for c in base.CAT['champions']}
 if not targets or len(targets)>40 or len({(t['champion'],t['role']) for t in targets})!=len(targets) or any(t['champion'] not in known or t['role'] not in ['top','jungle','mid','adc','support'] for t in targets):parser.error('Expected 1–40 unique known champion-role targets.')
 output=args.output_dir.resolve();output.mkdir(parents=True,exist_ok=True)
 base.CACHE=ROOT/'data/provider-roles/acquisition-cache';base.CACHE.mkdir(parents=True,exist_ok=True)
 base.DATE=args.checked_at;base.REFRESH=True
 observed=[];accepted=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  futures={pool.submit(collect,t):t for t in targets}
  for future in concurrent.futures.as_completed(futures):
   sources=future.result();observed.extend(sources);ok=qualifies(sources)
   if ok:accepted.extend(sources)
   target=futures[future]
   print(f'{target["champion"]}/{target["role"]}: '+('qualified' if ok else 'not qualified')+' '+str([(s['provider'],s.get('matches'),s.get('coreBuildMatches'),s.get('error')) for s in sources]),flush=True)
   (base.CACHE/'attempts.pending.json').write_text(json.dumps(observed,indent=2)+'\n',encoding='utf-8')
 # No successful pair means this run must not erase a prior optional catalog.
 if not accepted:raise SystemExit('No qualified alternate roles; previous observations retained.')
 pending=output/'observations.pending.json';pending.write_text(json.dumps(sorted(accepted,key=lambda s:(s['champion'],s['role'],s['provider'])),indent=2)+'\n',encoding='utf-8')
 os.replace(pending,output/'observations.json')
 print(f'Collected {len(accepted)//2}/{len(targets)} qualified champion-role pairs. Run node scripts/prepare-provider-roles.mjs to validate and publish.',flush=True)
if __name__=='__main__':main()
