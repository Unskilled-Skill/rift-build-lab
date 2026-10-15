import importlib.util,json,unittest,hashlib
from pathlib import Path
from companion.core import validate_bundle
ROOT=Path(__file__).resolve().parent.parent
class ContractTests(unittest.TestCase):
 def test_frontend_bundles_validate_against_real_companion_catalog(self):
  path=ROOT/'output/companion-contract/bundles.json'
  if not path.exists():self.skipTest('Run npm test first to generate real frontend bundles.')
  bundles=json.loads(path.read_text(encoding='utf-8'))
  self.assertGreaterEqual(len(bundles),865)
  catalog=json.loads((ROOT/'companion/catalog.json').read_text(encoding='utf-8'))
  for bundle in bundles:
   with self.subTest(champion=bundle['championAlias'],build=bundle['buildName']):
    validated=validate_bundle(bundle,catalog)
    self.assertEqual(validated['championId'],bundle['championId'])
 def test_packaged_download_matches_reviewed_sources(self):
  path=ROOT/'public/downloads/companion-manifest.json'
  if not path.exists():self.skipTest('Package the Windows companion first.')
  spec=importlib.util.spec_from_file_location('packager',ROOT/'scripts/package-companion.py')
  module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
  manifest=json.loads(path.read_text(encoding='utf-8'))
  self.assertEqual(manifest['sourceSha256'],module.source_hash(),'Rebuild the companion after source changes.')
  payload=(path.parent/manifest['file']).read_bytes()
  self.assertEqual(manifest['sha256'],hashlib.sha256(payload).hexdigest())
  self.assertEqual(manifest['bytes'],len(payload))
if __name__=='__main__':unittest.main()
