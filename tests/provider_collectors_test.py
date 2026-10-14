import unittest,importlib.util,tempfile,json,io,contextlib,os
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('provider_collector',Path(__file__).resolve().parents[1]/'scripts/collect-provider-research.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Collectors(unittest.TestCase):
 def test_explicit_lol_role_uses_lane_and_separate_cache_without_default_fallback(self):
  c=next(c for c in m.CAT['champions'] if c['alias']=='Aatrox')
  with tempfile.TemporaryDirectory() as folder,patch.object(m,'CACHE',Path(folder)),patch.object(m,'REFRESH',False),patch.object(m,'request',return_value='<h1>Aatrox for top Aatrox</h1>') as request:
   (Path(folder)/'lol-Aatrox.html').write_text('default must not be read')
   with self.assertRaisesRegex(ValueError,'Source scope'):m.lol(c,'mid')
   request.assert_called_once_with('https://lolalytics.com/lol/aatrox/build/?lane=middle')
 def test_lolalytics_slot_options_exclude_unlabelled_item_tables(self):
  from bs4 import BeautifulSoup
  soup=BeautifulSoup('<div><div>Item 4</div><div><article><img src="https://cdn5.lolalytics.com/item64/3089.webp"><span>58.4 %</span><span>18,230</span></article><article><img src="https://cdn5.lolalytics.com/item64/3041.webp"><span>78.09 %</span><span>4,597</span></article></div></div><div><h2>All Items</h2><img src="https://cdn5.lolalytics.com/item64/3157.webp">99 % 200</div>','html.parser')
  for img in soup.find_all('img')[:2]:img.insert_after(soup.new_tag('q:template'));img.next_sibling.string='Loading...'
  self.assertEqual(m.lol_item_options(soup),[{'slot':4,'items':[{'id':3089,'matches':18230,'winRate':58.4},{'id':3041,'matches':4597,'winRate':78.09}]}])
 def test_opgg_options_convert_wins_and_ignore_combinations_or_empty_samples(self):
  self.assertEqual(m.opgg_item_options({'fourth_items':[{'ids':[3089],'play':20,'win':12},{'ids':[3041,3157],'play':10,'win':9}],'sixth_items':[{'ids':[3157],'play':0,'win':0}]}),[{'slot':4,'items':[{'id':3089,'matches':20,'winRate':60.0}]}])
 def test_lol_shards_require_exactly_one_selected_icon_per_legal_row(self):
  from bs4 import BeautifulSoup
  html='<div><div>Stat Mods</div>'
  for row,selected in [([5008,5005,5007],5005),([5008,5010,5001],5010),([5011,5013,5001],5011)]:
   html+='<div>'+''.join(f'<img class="{"grayscale" if id!=selected else ""}" src="https://cdn5.lolalytics.com/statmod32/{id}.webp">' for id in row)+'</div>'
  soup=BeautifulSoup(html+'</div>','html.parser')
  self.assertEqual(m.lol_shards(soup),[5005,5010,5011])
  soup.find('img')['class']=[]
  self.assertIsNone(m.lol_shards(soup))
 def test_compact_schema_names_define_order_without_execution(self):
  text='class Result: data\nclass Data: ids,play\n\nResult(Data([6657,3040],123))'
  self.assertEqual(m.compact(text),{'data':{'ids':[6657,3040],'play':123}})
  with self.assertRaises(ValueError):m.compact('class Result: data\n\nResult(__import__("os"))')
 def test_lolalytics_core_and_keystone_samples_stay_separate(self):
  original=m.CACHE
  with tempfile.TemporaryDirectory() as folder:
   m.CACHE=Path(folder)
   imgs=''.join(f'<img src="https://cdn5.lolalytics.com/rune68/{id}.webp">' for id in [8010,9111,9105,8299,8453,8473])
   html=f'<meta name="description" content="LoL Patch 16.20"><h1>Aatrox Build, Runes &amp; Counters for top Aatrox</h1><p>EMERALD+ GLOBAL Ranked Solo/Duo 10,000 Games</p><div data-type="win" class="bg-[#3a7e93]">Highest Win Build</div><div><div>Core Build</div><img src="https://cdn5.lolalytics.com/item64/6692.webp"><p>55.5 % 1,000</p></div><div>Primary Runes {imgs}<img class="grayscale" src="https://cdn5.lolalytics.com/rune68/8005.webp"><p>51.5 % Win Rate 3,000 Games</p></div>'
   (m.CACHE/'lol-Aatrox.html').write_text(html)
   c=next(c for c in m.CAT['champions'] if c['alias']=='Aatrox');r=m.lol(c)
   self.assertEqual(r['matches'],10000);self.assertEqual(r['coreBuildMatches'],1000);self.assertEqual(r['keystoneMatches'],3000);self.assertEqual(r['observedRunePage'],[8010,9111,9105,8299,8453,8473]);self.assertEqual(r['selection'],'Highest Win Build')
  m.CACHE=original
 def test_unavailable_wukong_retains_the_real_provider_url(self):
  self.assertEqual(m.failure({'alias':'MonkeyKing'},'lolalytics',None,ValueError('No data'))['sourceURL'],'https://lolalytics.com/lol/wukong/build/')
 def test_refresh_cli_isolates_sources_and_reports_actual_roster_progress(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);output=root/'data/provider-refresh/runs/job';authored=root/'scripts/provider-research';authored.mkdir(parents=True)
   (authored/'opgg.json').write_text('previous authored snapshot')
   records=[json.loads((m.ROOT/f'scripts/provider-research/{p}.json').read_text())[0] for p in ['lolalytics','opgg']]
   for record in records:record['checkedAt']='2026-10-14'
   catalog=dict(m.CAT,champions=m.CAT['champions'][:1]);log=io.StringIO()
   with patch.multiple(m,ROOT=root,CAT=catalog,CACHE=root/'cache',OUT=authored,DATE=m.DATE,REFRESH=False),patch.object(m,'collect',return_value=records),contextlib.redirect_stdout(log):
    m.main(['--refresh','--checked-at','2026-10-14','--output-dir',str(output)])
   self.assertEqual((authored/'opgg.json').read_text(),'previous authored snapshot')
   self.assertIn('1/1 Aatrox',log.getvalue())
   self.assertTrue((output/'acquisition-cache/opgg.pending.json').exists())
   self.assertEqual(json.loads((output/'opgg.json').read_text())[0]['context']['region'],'unverified')
 def test_unknown_ids_fail_without_overwriting_sources(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);output=root/'incoming';output.mkdir();(output/'opgg.json').write_text('previous')
   records=[json.loads((m.ROOT/f'scripts/provider-research/{p}.json').read_text())[0] for p in ['lolalytics','opgg']]
   records[0]['observedCoreItemIds']=[-1];catalog=dict(m.CAT,champions=m.CAT['champions'][:1])
   with patch.multiple(m,ROOT=root,CAT=catalog,CACHE=root/'cache',OUT=output,DATE=m.DATE,REFRESH=False),patch.object(m,'collect',return_value=records),contextlib.redirect_stdout(io.StringIO()):
    with self.assertRaisesRegex(ValueError,'IDs differ'):m.main(['--refresh','--output-dir',str(output)])
   self.assertEqual((output/'opgg.json').read_text(),'previous')
 def test_acquisition_failure_retains_both_sources(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);output=root/'incoming';output.mkdir()
   for p in ['opgg','lolalytics']:(output/f'{p}.json').write_text('previous '+p)
   c=m.CAT['champions'][0];records=[m.failure(c,p,'top','test failure') for p in ['lolalytics','opgg']]
   with patch.multiple(m,ROOT=root,CAT=dict(m.CAT,champions=[c]),CACHE=root/'cache',OUT=output,DATE=m.DATE,REFRESH=False),patch.object(m,'collect',return_value=records),contextlib.redirect_stdout(io.StringIO()):
    with self.assertRaises(SystemExit):m.main(['--refresh','--output-dir',str(output)])
   for p in ['opgg','lolalytics']:self.assertEqual((output/f'{p}.json').read_text(),'previous '+p)
 def test_new_date_cannot_relabel_cached_acquisition(self):
  with patch.multiple(m,DATE=m.DATE,REFRESH=False),contextlib.redirect_stderr(io.StringIO()):
   with self.assertRaises(SystemExit):m.main(['--checked-at','2026-10-14'])
 def test_second_source_replace_failure_rolls_back_first_source(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);(root/'data/provider-refresh/runs').mkdir(parents=True);output=root/'incoming';output.mkdir()
   for p in ['opgg','lolalytics']:(output/f'{p}.json').write_text('previous '+p)
   records=[dict(champion='Aatrox',provider=p) for p in ['opgg','lolalytics']];replace=os.replace
   def fail_second(source,target):
    if Path(source).parent.name=='snapshot' and Path(source).name=='lolalytics.json':raise OSError('simulated swap failure')
    return replace(source,target)
   with patch.object(m,'ROOT',root),patch.object(m.os,'replace',side_effect=fail_second):
    with self.assertRaisesRegex(OSError,'swap failure'):m.write_collection(records,output)
   for p in ['opgg','lolalytics']:self.assertEqual((output/f'{p}.json').read_text(),'previous '+p)
if __name__=='__main__':unittest.main()
