import {useState} from 'react';
import type {ReactNode} from 'react';
import {isDesktop} from './platform';

/** Read-only source content only: closing releases its DOM. Do not wrap editable forms. */
export default function SourceDetails({summary,children,className,defaultOpen=false,defer=isDesktop}:{summary:ReactNode;children:()=>ReactNode;className?:string;defaultOpen?:boolean;defer?:boolean}){
 const [expanded,setExpanded]=useState(defaultOpen);
 return <details className={className} open={expanded} onToggle={event=>{
  if(event.target===event.currentTarget)setExpanded(event.currentTarget.open);
 }}><summary>{summary}</summary>{(!defer||expanded)&&children()}</details>;
}
