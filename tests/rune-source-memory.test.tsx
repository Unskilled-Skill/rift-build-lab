import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import RuneCard from '../src/RuneCard';
import catalog from '../public/data/catalog.json';
import type {Rune} from '../src/types';

it('keeps every rune name and description while leaving closed numeric tables unmounted',()=>{
 for(const rune of catalog.runes as unknown as Rune[]){
  const html=renderToStaticMarkup(<RuneCard rune={rune} deferSource/>);
  expect(html).toContain(renderToStaticMarkup(<h3>{rune.name}</h3>));
  expect(html).toContain('Numeric parameters &amp; source formulas');
  expect(html).not.toContain('<table');expect(html).not.toContain('<pre');
 }
});
it('preserves published values when eager source rendering is selected',()=>{
 const rune=(catalog.runes as unknown as Rune[]).find(r=>Object.keys(r.effectValuesRaw).length)!;
 const html=renderToStaticMarkup(<RuneCard rune={rune} deferSource={false}/>);
 expect(html).toContain('<table');expect(html).toContain(Object.keys(rune.effectValuesRaw)[0]);
});
