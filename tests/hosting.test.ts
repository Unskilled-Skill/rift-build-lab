import {it,expect} from 'vitest';
import {appPath} from '../src/hosting';
it('keeps data URLs inside the GitHub Pages project path',()=>{expect(appPath('/data/catalog.json','/rift-build-lab/')).toBe('/rift-build-lab/data/catalog.json');expect(appPath('data/champions/Cassiopeia.json','/rift-build-lab/')).toBe('/rift-build-lab/data/champions/Cassiopeia.json');expect(appPath('/data/catalog.json','/')).toBe('/data/catalog.json')});
