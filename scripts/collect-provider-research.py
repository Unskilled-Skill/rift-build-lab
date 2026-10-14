import json,re,ast,time,threading,urllib.request,concurrent.futures,argparse,datetime,tempfile,os
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parent.parent
CACHE=ROOT/'data/provider-research';CACHE.mkdir(parents=True,exist_ok=True)
OUT=ROOT/'scripts/provider-research';OUT.mkdir(parents=True,exist_ok=True)
CAT=json.loads((ROOT/'public/data/catalog.json').read_text(encoding='utf-8'));OVERRIDES={e['champion']:('adc' if e['role']=='bot' else e['role']) for e in json.loads((ROOT/'scripts/meta-baselines.json').read_text(encoding='utf-8'))}
DATE='2026-10-13';REFRESH=False;SEMS={p:threading.Semaphore(2) for p in ['opgg','lolalytics']}
def request(url,body=None):
 for attempt in range(3):
  try:
   h={'User-Agent':'Mozilla/5.0','Accept':'application/json, text/event-stream' if body else 'text/html'}
   if REFRESH:h.update({'Cache-Control':'no-cache, no-store','Pragma':'no-cache'})
   if body:h['Content-Type']='application/json'
   with urllib.request.urlopen(urllib.request.Request(url,data=json.dumps(body).encode() if body else None,headers=h),timeout=35) as r:return r.read().decode()
  except Exception:
   if attempt==2:raise
   time.sleep(2*(attempt+1))
def number(s):return int(s.replace(',',''))
SHARD_ROWS=[[5005,5007,5008],[5008,5010,5001],[5011,5013,5001]]
def legal_shards(ids):return isinstance(ids,list) and len(ids)==3 and all(id in SHARD_ROWS[n] for n,id in enumerate(ids))
def lol_item_options(soup):
 options=[]
 for slot in [4,5,6]:
  label=soup.find(string=lambda t:t and t.strip()==f'Item {slot}')
  if not label:continue
  block=label.parent.parent;items=[]
  for img in block.find_all('img'):
   match=re.search(r'/item\d+/(\d+)\.',img.get('src',''))
   if not match:continue
   row=img.parent
   while row and row is not block:
    stat=re.search(r'(\d+(?:\.\d+)?)\s*%\s*([\d,]+)$',row.get_text(' ',strip=True))
    if stat and len(row.find_all('img'))==1:
     items.append(dict(id=int(match[1]),matches=number(stat[2]),winRate=float(stat[1])));break
    row=row.parent
  if items:options.append(dict(slot=slot,items=items))
 return options
def lol_shards(soup):
 label=soup.find(string=lambda t:t and t.strip()=='Stat Mods')
 if not label:return None
 rows=[row for row in label.parent.parent.find_all('div',recursive=False) if row.find('img',src=lambda t:t and '/statmod' in t)]
 selected=[]
 for row in rows:
  ids=[int(re.search(r'/statmod\d+/(\d+)\.',i['src'])[1]) for i in row.find_all('img') if re.search(r'/statmod\d+/(\d+)\.',i.get('src','')) and 'grayscale' not in i.get('class',[])]
  if len(ids)!=1:return None
  selected.extend(ids)
 return selected if legal_shards(selected) else None
def opgg_item_options(data):
 options=[]
 for slot,key in [(4,'fourth_items'),(5,'fifth_items'),(6,'sixth_items')]:
  items=[]
  for row in data.get(key) or []:
   if len(row.get('ids',[]))==1 and isinstance(row.get('play'),int) and row['play']>0 and isinstance(row.get('win'),int) and 0<=row['win']<=row['play']:
    items.append(dict(id=row['ids'][0],matches=row['play'],winRate=round(100*row['win']/row['play'],4)))
  if items:options.append(dict(slot=slot,items=items))
 return options
def lol(c):
 alias=c['alias'];role=OVERRIDES.get(alias);slug='wukong' if alias=='MonkeyKing' else alias.lower();url=f'https://lolalytics.com/lol/{slug}/build/'+(f'?lane={dict(mid="middle",adc="bottom").get(role,role)}' if role else '')
 cache=CACHE/f'lol-{alias}.html'
 with SEMS['lolalytics']:
  html=cache.read_text(encoding='utf-8') if cache.exists() and not REFRESH else request(url)

 soup=BeautifulSoup(html,'html.parser');text=soup.get_text(' ',strip=True)
 if not all(v in text for v in ['EMERALD+','GLOBAL','Solo/Duo']):raise ValueError('Source scope differs from requested Emerald+/GLOBAL/SoloDuo')
 title=soup.find('h1');rm=re.search(r'for (top|jungle|middle|mid|bottom|adc|support) ',title.get_text(' ',strip=True) if title else '')
 if not rm:raise ValueError('Role not found in source title')
 observed={'middle':'mid','bottom':'adc'}.get(rm[1],rm[1]);role=role or observed
 if observed!=role:raise ValueError(f'Role mismatch {observed}/{role}')
 patch=re.search(r'LoL Patch (\d+\.\d+)',soup.find('meta',attrs={'name':'description'}).get('content',''))
 if not patch:raise ValueError('No source patch')
 tab=soup.find(attrs={'data-type':'win'});selection='Highest Win Build' if tab and 'bg-[#3a7e93]' in tab.get('class',[]) else None
 if not selection:raise ValueError('Unknown selected build tab')
 h=soup.find(string=lambda t:t and t.strip()=='Core Build')
 if not h:raise ValueError('Core build missing')
 core=h.parent.parent;ids=[int(re.search(r'/item\d+/(\d+)\.',i['src'])[1]) for i in core.find_all('img') if re.search(r'/item\d+/(\d+)\.',i.get('src',''))]
 coretext=core.get_text(' ',strip=True);m=re.search(r'(\d+(?:\.\d+)?)\s*%\s*([\d,]+)',coretext)
 runes=[int(re.search(r'/rune\d+/(\d+)\.',i['src'])[1]) for i in soup.find_all('img') if re.search(r'/rune\d+/(\d+)\.',i.get('src','')) and 'grayscale' not in i.get('class',[])]
 # Exclude stat shard icons if rendered in the same rune namespace.
 runes=list(dict.fromkeys(id for id in runes if id>=8000))
 if len(runes)!=6 or not ids or not m:raise ValueError(f'Incomplete source core/runes: {ids}/{runes}/{coretext[:150]}')
 games=re.search(r'([\d,]+)\s+Games',text)
 selected=next(i for i in soup.find_all('img') if re.search(r'/rune\d+/(\d+)\.',i.get('src','')) and 'grayscale' not in i.get('class',[]) and int(re.search(r'/rune\d+/(\d+)\.',i['src'])[1])==runes[0]);parent=selected
 while parent and 'Primary Runes' not in parent.get_text(' ',strip=True):parent=parent.parent
 while parent and 'Win Rate' not in parent.get_text(' ',strip=True):parent=parent.parent
 runeStat=re.search(r'([\d.]+)\s*%\s*Win Rate\s*([\d,]+)\s*Games',parent.get_text(' ',strip=True) if parent else '')
 if not cache.exists() or REFRESH:cache.write_text(html,encoding='utf-8')
 return dict(champion=alias,role=role,provider='lolalytics',status='available',sourceURL=url,sourcePatch=patch[1],checkedAt=DATE,selection=selection,observedCoreItemIds=ids,observedRunePage=runes,observedItemOptions=lol_item_options(soup),**({'observedShards':lol_shards(soup)} if lol_shards(soup) else {}),coreBuildMatches=number(m[2]),coreBuildWinRate=float(m[1]),keystoneMatches=number(runeStat[2]) if runeStat else None,keystoneWinRate=float(runeStat[1]) if runeStat else None,matches=number(games[1]) if games else None,limits='Emerald+, GLOBAL, Ranked Solo/Duo. Selected Highest Win Build, not Most Common. Core includes boots/quest items where shown. Core sample differs from champion-role cohort. Item 4/5/6 options are marginal purchase-slot statistics, not an observed complete inventory or joint six-item cohort. Stat Mods describe selected rows separately from the rune-page sample. Displayed rune statistics describe the primary keystone, not the entire rune page; rune and core samples are separate. High observed win rate is affected by sample size, matchup and item completion; it does not prove build superiority.')
def compact(text):
 schemas={m[1]:m[2].split(',') for m in re.finditer(r'^class (\w+): ([\w,]+)$',text,re.M)}
 expr=text.split('\n\n')[-1].strip();tree=ast.parse(expr,mode='eval')
 def walk(n):
  if isinstance(n,ast.Constant):return n.value
  if isinstance(n,(ast.List,ast.Tuple)):return [walk(x) for x in n.elts]
  if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id in schemas:
   fields=schemas[n.func.id]
   if len(fields)!=len(n.args) or n.keywords:raise ValueError('Compact schema mismatch')
   return dict(zip(fields,[walk(x) for x in n.args]))
  raise ValueError('Unexpected compact data expression')
 return walk(tree.body)
FIELDS=['data.fourth_items[].{ids[],play,win}','data.fifth_items[].{ids[],play,win}','data.sixth_items[].{ids[],play,win}','champion','position','data.core_items.{ids[],play,win}','data.boots.{ids[],play,win}','data.runes.{primary_rune_ids[],secondary_rune_ids[],stat_mod_ids[]}','data.trends.win.{version,created_at}','data.summary.average_stats.{play}']
def opgg(c,role):
 alias=c['alias'];key=re.sub(r'([a-z])([A-Z])',r'\1_\2',alias).upper();alternates=[key,re.sub(r'[^A-Z0-9]+','_',c['name'].upper()).strip('_'),alias.upper()]
 for key in dict.fromkeys(alternates):
  cache=CACHE/f'opgg-{alias}-{key}-{role}.json'
  with SEMS['opgg']:
   raw=cache.read_text(encoding='utf-8') if cache.exists() and not REFRESH else request('https://mcp-api.op.gg/mcp',{'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':'lol_get_champion_analysis','arguments':{'game_mode':'ranked','champion':key,'position':role,'tier':'emerald_plus','desired_output_fields':FIELDS}}})

  try:
   j=json.loads(raw);r=j['result']
   if r.get('isError'):raise ValueError(str(r)[:250])
   parsed=compact('\n'.join(t['text'] for t in r['content'] if t.get('type')=='text'));d=parsed['data'];core=d['core_items'];runes=d['runes'];ids=core['ids'];rs=runes['primary_rune_ids']+runes['secondary_rune_ids'];trend=d['trends']['win']
   if not ids or len(rs)!=6 or parsed['position'].lower()!=role or parsed['champion']!=key:raise ValueError('Missing or mismatched champion/core/runes/role')
   if not cache.exists() or REFRESH:cache.write_text(raw,encoding='utf-8')
   return dict(champion=alias,role=role,provider='opgg',status='available',sourceURL='https://op.gg/open-source/opgg-mcp',sourcePatch=trend['version'],checkedAt=DATE,selection='Returned OP.GG core; provider definition',observedCoreItemIds=ids,observedRunePage=rs,observedItemOptions=opgg_item_options(d),**({'observedShards':runes['stat_mod_ids']} if legal_shards(runes.get('stat_mod_ids')) else {}),coreBuildMatches=core['play'],coreBuildWins=core['win'],matches=d['summary']['average_stats']['play'],bootsId=(d.get('boots') or {}).get('ids',[None])[0],sourceUpdatedAt=trend['created_at'],requestChampion=key,limits='Ranked, Emerald+. Public MCP has no region or patch input; patch is from returned trend, region unverified. Provider core may include components/transformed items and is not a complete six-slot inventory. Fourth/fifth/sixth item options are marginal purchase-slot statistics, not an observed complete inventory or joint six-item cohort. Rune and item sample selections are separate; no causal superiority claim.')
  except Exception as e:last=e
 raise ValueError(str(last))
def failure(c,p,role,e):return dict(champion=c['alias'],role=role or 'unknown',provider=p,status='unavailable',checkedAt=DATE,sourceURL='https://op.gg/open-source/opgg-mcp' if p=='opgg' else f'https://lolalytics.com/lol/{"wukong" if c["alias"]=="MonkeyKing" else c["alias"].lower()}/build/',error=str(e)[:500],limits='No validated data was published; do not infer missing IDs or samples.')
def collect(c):
 try:l=lol(c)
 except Exception as e:l=failure(c,'lolalytics',OVERRIDES.get(c['alias']),e)
 role=l['role']
 if role=='unknown':return l,failure(c,'opgg',None,'No validated role available for a matched-role request.')
 try:o=opgg(c,role)
 except Exception as e:o=failure(c,'opgg',role,e)
 return l,o
def write_collection(results, output_dir):
 # Prepare every file before touching the prior authored snapshot. Keep backups
 # outside public and retain them rather than recursively deleting directories.
 transaction=Path(tempfile.mkdtemp(prefix='collect-',dir=ROOT/'data/provider-refresh/runs'))
 staged=transaction/'snapshot';staged.mkdir()
 for p in ['opgg','lolalytics']:
  records=sorted([r for r in results if r['provider']==p],key=lambda r:r['champion'])
  (staged/f'{p}.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 # output-dir can contain acquisition caches and pending files. Move only the two
 # authored source files; rollback both if either replacement fails.
 output_dir.mkdir(parents=True,exist_ok=True);moved=[];written=[]
 try:
  for p in ['opgg','lolalytics']:
   target=output_dir/f'{p}.json'
   if target.exists():os.replace(target,transaction/f'{p}.previous.json');moved.append(p)
   os.replace(staged/f'{p}.json',target);written.append(p)
 except Exception:
  for p in written:os.replace(output_dir/f'{p}.json',transaction/f'{p}.failed.json')
  for p in moved:os.replace(transaction/f'{p}.previous.json',output_dir/f'{p}.json')
  raise

def main(argv=None):
 global DATE,REFRESH,CACHE,OUT
 parser=argparse.ArgumentParser(description='Collect dated OP.GG and Lolalytics references for the local roster.');parser.add_argument('--refresh',action='store_true',help='Read providers again instead of resuming cached responses.');parser.add_argument('--checked-at',default='2026-10-13',help='Source check date YYYY-MM-DD.');parser.add_argument('--output-dir',type=Path,default=ROOT/'scripts/provider-research',help='Isolated output directory for both provider source files.');args=parser.parse_args(argv);datetime.date.fromisoformat(args.checked_at);DATE=args.checked_at;REFRESH=args.refresh
 if args.checked_at!='2026-10-13' and not REFRESH:parser.error('A new check date requires --refresh; cached responses cannot be relabelled as fresh.')
 OUT=args.output_dir.resolve()
 if OUT!=(ROOT/'scripts/provider-research').resolve():CACHE=OUT/'acquisition-cache'
 CACHE.mkdir(parents=True,exist_ok=True)
 (ROOT/'data/provider-refresh/runs').mkdir(parents=True,exist_ok=True)
 results=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  futures={pool.submit(collect,c):c for c in CAT['champions']}
  for f in concurrent.futures.as_completed(futures):
   l,o=f.result();results.extend([l,o]);
   for p in ['opgg','lolalytics']:(CACHE/f'{p}.pending.json').write_text(json.dumps(sorted([r for r in results if r['provider']==p],key=lambda r:r['champion']),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
   print(f'{len(results)//2}/{len(CAT["champions"])} {l["champion"]}: lol={l["status"]} opgg={o["status"]}',flush=True)
 if any(r['status']!='available' for r in results):
  print(f'Incomplete provider acquisition; prior authored and published snapshots retained. Review {CACHE}/*.pending.json.',flush=True);raise SystemExit(1)
 knownItems={i['id'] for i in CAT['items']};knownRunes={r['id'] for r in CAT['runes']}
 if any(any(id not in knownItems for id in r['observedCoreItemIds']) or any(id not in knownRunes for id in r['observedRunePage']) or (r.get('bootsId') is not None and r['bootsId'] not in knownItems) for r in results):raise ValueError('Provider IDs differ from local catalog; previous snapshot retained.')
 for r in results:
  if any(i['id'] not in knownItems or not isinstance(i.get('matches'),int) or not 1<=i['matches']<=100000000 or not 0<=i.get('winRate',-1)<=100 for row in r.get('observedItemOptions',[]) for i in row['items']):raise ValueError('Optional provider item IDs or samples differ from catalog; previous snapshot retained.')
  if r.get('observedShards') is not None and not legal_shards(r['observedShards']):raise ValueError('Invalid provider shard rows; previous snapshot retained.')
 for r in results:r['context']=dict(gameMode='ranked',tier='emerald_plus',queue='solo_duo',region='global' if r['provider']=='lolalytics' else 'unverified')
 write_collection(results,OUT)
 print('COMPLETE', {p:sum(r['status']=='available' for r in results if r['provider']==p) for p in ['opgg','lolalytics']},flush=True)

if __name__=='__main__':main()
