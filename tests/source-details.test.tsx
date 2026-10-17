import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import SourceDetails from '../src/SourceDetails';

it('does not construct or mount a closed deferred source table',()=>{
 const render=vi.fn(()=><table><tbody><tr><td>private formula body</td></tr></tbody></table>);
 const html=renderToStaticMarkup(<SourceDetails defer summary="Source formulas">{render}</SourceDetails>);
 expect(html).toContain('<summary>Source formulas</summary>');
 expect(html).not.toContain('<table');expect(render).not.toHaveBeenCalled();
});
it('renders an initially opened disclosure and keeps source content reachable',()=>{
 const html=renderToStaticMarkup(<SourceDetails defer defaultOpen summary="Source formulas">{()=><table><tbody><tr><td>25% AP</td></tr></tbody></table>}</SourceDetails>);
 expect(html).toContain('<table');expect(html).toContain('25% AP');expect(html).toContain('open=""');
});
it('preserves eager rendering when deferral is disabled',()=>{
 const html=renderToStaticMarkup(<SourceDetails defer={false} className="ability-source-details" summary="Source formulas">{()=><p>Published source</p>}</SourceDetails>);
 expect(html).toContain('class="ability-source-details"');expect(html).toContain('Published source');
});
