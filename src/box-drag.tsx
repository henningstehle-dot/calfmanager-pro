import React, {useEffect,useRef,useState} from 'react';

// A dedicated handle keeps ordinary scrolling and other card controls intact.
export function BoxDragHandle({id,name,disabled,onDrop}:{id:string;name:string;disabled:boolean;onDrop:(source:string,target:string)=>void}){
 const cleanup=useRef<(()=>void)|null>(null);
 const [active,setActive]=useState(false);
 useEffect(()=>()=>cleanup.current?.(),[]);
 useEffect(()=>{if(disabled)cleanup.current?.()},[disabled]);
 function start(e:React.PointerEvent<HTMLButtonElement>){
  if(disabled||!e.isPrimary||e.button!==0||cleanup.current)return;
  const handle=e.currentTarget, pointer=e.pointerId, card=handle.closest<HTMLElement>('[data-box-sort-id]');
  const grid=card?.parentElement;if(!card||!grid)return;
  e.preventDefault();
  let x=e.clientX,y=e.clientY,activated=false,frame=0,timer=0,target:HTMLElement|null=null;
  const originX=x,originY=y;
  function highlight(){
   const hit=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-box-sort-id]')??null;
   const next=hit&&grid!.contains(hit)&&hit!==card?hit:null;
   if(target!==next){target?.classList.remove('box-drop344');target=next;target?.classList.add('box-drop344')}
  }
  function scroll(){
   if(!activated)return;
   const edge=80, height=window.innerHeight;
   const dy=y<edge?-Math.ceil((edge-y)/5):y>height-edge?Math.ceil((y-height+edge)/5):0;
   if(dy){let parent=grid!.parentElement;while(parent){const style=getComputedStyle(parent);if(/auto|scroll/.test(style.overflowY)&&parent.scrollHeight>parent.clientHeight){const before=parent.scrollTop;parent.scrollTop+=dy;if(parent.scrollTop!==before)break}parent=parent.parentElement}if(!parent)window.scrollBy(0,dy)}
   highlight();frame=requestAnimationFrame(scroll);
  }
  function activate(){if(activated)return;activated=true;setActive(true);card!.classList.add('box-source344');highlight();frame=requestAnimationFrame(scroll)}
  function move(ev:PointerEvent){if(ev.pointerId!==pointer)return;x=ev.clientX;y=ev.clientY;if(!activated&&e.pointerType==='mouse'&&Math.hypot(x-originX,y-originY)>4)activate();if(activated){ev.preventDefault();highlight()}}
  function finish(){clearTimeout(timer);cancelAnimationFrame(frame);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',finish);window.removeEventListener('keydown',key);handle.removeEventListener('lostpointercapture',finish);card!.classList.remove('box-source344');target?.classList.remove('box-drop344');cleanup.current=null;setActive(false);if(handle.hasPointerCapture(pointer))handle.releasePointerCapture(pointer)}
  function up(ev:PointerEvent){if(ev.pointerId!==pointer)return;x=ev.clientX;y=ev.clientY;if(activated)highlight();const destination=activated?target?.dataset.boxSortId:undefined;finish();if(destination&&destination!==id)onDrop(id,destination)}
  function cancel(ev:PointerEvent){if(ev.pointerId===pointer)finish()}
  function key(ev:KeyboardEvent){if(ev.key==='Escape')finish()}
  cleanup.current=finish;
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',finish);window.addEventListener('keydown',key);handle.addEventListener('lostpointercapture',finish);
  try{handle.setPointerCapture(pointer)}catch{/* Window listeners also support uncaptured pointers. */}
  timer=window.setTimeout(activate,350);
 }
 return <button type="button" className="outline box-drag343" disabled={disabled} aria-label={'Box verschieben: '+name} onPointerDown={start} onContextMenu={e=>e.preventDefault()} onDragStart={e=>e.preventDefault()}>{active?'↕ Jetzt verschieben':'☰ Halten & ziehen'}</button>;
}
