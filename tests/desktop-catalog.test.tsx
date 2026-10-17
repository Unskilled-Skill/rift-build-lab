import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import DesktopCatalog,{catalogPage} from '../src/desktop/DesktopCatalog';

it('mounts only one bounded page while preserving the full result count',()=>{
 const entries=Array.from({length:870},(_,id)=>id);
 const html=renderToStaticMarkup(<DesktopCatalog entries={entries} kind="items" className="catalog-grid" render={id=><article key={id}>Item {id}</article>}/>);
 expect(html.match(/<article/g)).toHaveLength(32);
 expect(html).toContain('1–32 of 870 items');
 expect(html).toContain('Item 31');expect(html).not.toContain('Item 32<');
 expect(html).toContain('aria-label="Items catalog pages"');
});
it('makes every result reachable once with no duplicates or missing final records',()=>{
 const indexes=[];
 for(let page=0;page<28;page++){
  const range=catalogPage(870,page);
  for(let i=range.start;i<range.end;i++)indexes.push(i);
 }
 expect(indexes).toEqual(Array.from({length:870},(_,i)=>i));
 expect(catalogPage(870,27)).toMatchObject({start:864,end:870,page:27,pages:28});
});
it('clamps a previous page after filtering and handles zero or one page',()=>{
 expect(catalogPage(3,27)).toEqual({start:0,end:3,page:0,pages:1});
 expect(catalogPage(0,27)).toEqual({start:0,end:0,page:0,pages:1});
 expect(catalogPage(69,-1)).toMatchObject({start:0,end:32,page:0});
});
