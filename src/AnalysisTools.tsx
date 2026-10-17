import {Component,Suspense} from 'react';
import type {ReactNode} from 'react';
/** A failed optional chunk must not take down the editable bench or its saved draft. */
export default class AnalysisTools extends Component<{children:ReactNode},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?<p role="alert">Comparison tools could not be loaded. Your working setup is preserved. <button className="secondary" onClick={()=>location.reload()}>Reload app</button></p>:<Suspense fallback={<p role="status">Loading comparison and purchase tools…</p>}>{this.props.children}</Suspense>}
}
