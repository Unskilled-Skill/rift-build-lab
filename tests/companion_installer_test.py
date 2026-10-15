import tempfile,unittest
from pathlib import Path
from companion.launcher import install_plan,register_handler
class InstallerTests(unittest.TestCase):
 def test_quotes_paths_and_keeps_target_inside_own_local_appdata_folder(self):
  with tempfile.TemporaryDirectory(prefix='Rift build test ') as temp:
   target,command=install_plan('unused.exe',temp)
   self.assertEqual(target.parent,(Path(temp)/'RiftBuildLab'/'Companion').resolve())
   self.assertEqual(command,f'"{target}" "%1"')
 def test_never_takes_over_an_existing_unmarked_protocol_handler(self):
  class Key:
   def __enter__(self):return self
   def __exit__(self,*args):return False
  class Registry:
   HKEY_CURRENT_USER=1
   def OpenKey(self,*args):return Key()
   def QueryValueEx(self,*args):raise FileNotFoundError('marker missing')
  with tempfile.TemporaryDirectory() as temp:
   with self.assertRaisesRegex(RuntimeError,'different application'):
    register_handler(Path(temp)/'source.exe',temp,Registry())
if __name__=='__main__':unittest.main()
