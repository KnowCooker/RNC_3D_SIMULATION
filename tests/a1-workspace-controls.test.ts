import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPanelDisclosure, observationMode } from '../src/team-a/lab/workspace-controls';

// Minimal DOM test double. Exercises retained controls, focus and keyboard events without a browser.
class ElementStub {
  children:ElementStub[]=[];parent:ElementStub|null=null;dataset:Record<string,string>={};
  className='';id='';type='';hidden=false;scrollTop=0;textContent='';innerHTML='';
  attributes=new Map<string,string>();listeners=new Map<string,Set<(event:any)=>void>>();
  classList={add:(name:string)=>{this.className+=' '+name;}};
  append(...elements:ElementStub[]){for(const el of elements){if(el.parent)el.parent.children=el.parent.children.filter(c=>c!==el);el.parent=this;this.children.push(el);}}
  prepend(el:ElementStub){this.append(el);this.children=[el,...this.children.filter(c=>c!==el)];}
  querySelector(){return this.children.find(c=>c.className==='cp-card-heading')??null;}
  setAttribute(name:string,value:string){this.attributes.set(name,value);}
  contains(el:unknown):boolean{return el===this||this.children.some(c=>c.contains(el));}
  focus(){documentStub.activeElement=this;}
  addEventListener(name:string,fn:(e:any)=>void){const set=this.listeners.get(name)??new Set();set.add(fn);this.listeners.set(name,set);}
  removeEventListener(name:string,fn:(e:any)=>void){this.listeners.get(name)?.delete(fn);}
  dispatch(name:string,e:unknown={}){this.listeners.get(name)?.forEach(fn=>fn(e));}
}
const documentStub={activeElement:null as ElementStub|null,createElement:()=>new ElementStub()};
function withDOM(run:()=>void){
  const originals=new Map<string,PropertyDescriptor|undefined>();let frame=0;
  for(const [key,value] of Object.entries({document:documentStub,requestAnimationFrame:()=>++frame,cancelAnimationFrame:()=>{}})){
    originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  }
  try{run();}finally{for(const [key,value]of originals){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}documentStub.activeElement=null;}
}
test('gallery and road mode selection follows actual viewer state, including overlay inspection',()=>{
  assert.equal(observationMode('gallery','true'),'gallery');
  assert.equal(observationMode('road','false'),'road');
  assert.equal(observationMode('road','true'),'inspect');
  assert.equal(observationMode('workshop','false'),'workshop');
  assert.equal(observationMode(),'gallery');
});
test('collapse preserves control identity and state, hides body, and returns focus',()=>withDOM(()=>{
  const panel=new ElementStub(),control=new ElementStub();control.dataset.selection='residual';panel.append(control);
  let changes=0;control.addEventListener('change',()=>changes++);
  const disclosure=mountPanelDisclosure(panel as unknown as HTMLElement,'声场实验','field-body',()=>{});
  const [header,body]=panel.children,toggle=header.children.at(-1)!;control.focus();
  toggle.dispatch('click');
  assert.equal(body.hidden,true);assert.equal(panel.dataset.collapsed,'true');assert.equal(documentStub.activeElement,toggle);
  assert.equal(toggle.attributes.get('aria-expanded'),'false');assert.equal(toggle.attributes.get('aria-controls'),body.id);
  toggle.dispatch('click');assert.equal(body.hidden,false);assert.equal(body.children[0],control);
  assert.equal(control.dataset.selection,'residual');control.dispatch('change');assert.equal(changes,1);
  disclosure.dispose();toggle.dispatch('click');assert.equal(body.hidden,false);
}));
test('Escape collapses only its own panel while preserving other panels and header actions',()=>withDOM(()=>{
  const panel=new ElementStub(),header=new ElementStub(),settings=new ElementStub();header.className='cp-card-heading';header.append(settings);panel.append(header,new ElementStub());
  const a=mountPanelDisclosure(panel as unknown as HTMLElement,'声场实验','a',()=>{}),other=new ElementStub();other.append(new ElementStub());
  const b=mountPanelDisclosure(other as unknown as HTMLElement,'结构与布置','b',()=>{});
  let prevented=false,stopped=false;
  panel.children[1].dispatch('keydown',{key:'Escape',preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
  assert.equal(panel.dataset.collapsed,'true');assert.equal(other.dataset.collapsed,'false');
  assert.equal(header.children[0],settings);assert.ok(prevented&&stopped);
  b.setCollapsed(true);a.setCollapsed(false);assert.equal(other.dataset.collapsed,'true');
  a.dispose();b.dispose();
}));
