import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('roles',Path(__file__).resolve().parents[1]/'scripts/collect-provider-roles.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class OptionalRoles(unittest.TestCase):
 def test_sample_thresholds_require_two_independently_observed_providers(self):
  pair=[dict(provider=p,status='available',matches=1000,coreBuildMatches=100) for p in ['opgg','lolalytics']]
  self.assertTrue(m.qualifies(pair))
  self.assertFalse(m.qualifies(pair[:1]))
  pair[1]['matches']=999;self.assertFalse(m.qualifies(pair))
  pair[1]['matches']=1000;pair[0]['coreBuildMatches']=99;self.assertFalse(m.qualifies(pair))
if __name__=='__main__':unittest.main()
