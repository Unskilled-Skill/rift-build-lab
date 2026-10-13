import unittest,importlib.util,tempfile,json
from pathlib import Path
spec=importlib.util.spec_from_file_location('provider_collector',Path(__file__).resolve().parents[1]/'scripts/collect-provider-research.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Collectors(unittest.TestCase):
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
if __name__=='__main__':unittest.main()
