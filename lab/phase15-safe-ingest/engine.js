'use strict';
// LAB-only: no GAS, Sheets, network or production credentials.
const STATES=Object.freeze({RESERVED:'RESERVED',LEDGER:'LEDGER_WRITTEN',V3:'V3_VERIFIED',DONE:'COMPLETED'});
const clone=x=>structuredClone(x);
const identity=x=>{if(!x.guid||!x.url)throw Error('INVALID_IDENTITY');return x.guid.toLowerCase()};
class LabIngest{
 constructor(snapshot={},opts={}){this.s=clone({ledger:snapshot.ledger||[],history:snapshot.history||[],v3:snapshot.v3||[],checkpoint:snapshot.checkpoint||{},sourcePending:snapshot.sourcePending||[]});this.now=opts.now||(()=>Date.now());this.budget=opts.budget||300000;this.authority=opts.authority===true;this.writerExcluded=opts.writerExcluded===true;this.locked=false;this.failAt=null;}
 guard(){if(this.now()-this.start>=this.budget)throw Error('SAFE_DEADLINE')}
 fault(stage){if(this.failAt===stage)throw Error('SYNTHETIC_CRASH_'+stage)}
 reserve(item){let h=this.s.history.find(x=>x.guid.toLowerCase()===identity(item));if(h)return h;const ids=[...this.s.ledger,...this.s.history,...this.s.v3].map(x=>x.id).filter(x=>/^EP-\d{5}$/.test(x.id||x));const max=Math.max(0,...ids.map(x=>Number(x.slice(3))));const id='EP-'+String(max+1).padStart(5,'0');h={guid:identity(item),id,state:STATES.RESERVED,url:item.url};this.s.history.push(h);return h;}
 existing(item){const k=identity(item),matches=this.s.ledger.filter(x=>x.guid.toLowerCase()===k||x.url===item.url||(item.audio&&x.audio===item.audio));if(matches.some(x=>x.guid.toLowerCase()!==k))throw Error('STOP_IDENTITY_CONFLICT');return matches[0]||null;}
 step(h,item){let l=this.s.ledger.find(x=>x.id===h.id),v=this.s.v3.find(x=>x.id===h.id);
 if(h.state===STATES.RESERVED){if(l&&l.guid.toLowerCase()!==identity(item))throw Error('STOP_PARTIAL_CONFLICT');if(!l)this.s.ledger.push({id:h.id,guid:identity(item),url:item.url,audio:item.audio||''});h.state=STATES.LEDGER;this.fault('after_ledger')}
 if(h.state===STATES.LEDGER){l=this.s.ledger.find(x=>x.id===h.id);if(!l||l.guid.toLowerCase()!==identity(item))throw Error('STOP_LEDGER_MISSING');const proof='synthetic:'+l.guid+':'+l.id;if(v&&v.proof!==proof)throw Error('STOP_V3_CONFLICT');if(!v)this.s.v3.push({id:h.id,proof});h.state=STATES.V3;this.fault('after_v3')}
 if(h.state===STATES.V3){if(!this.s.v3.some(x=>x.id===h.id))throw Error('STOP_V3_MISSING');h.state=STATES.DONE;this.fault('after_completed')}return h;}
 run(feeds){this.start=this.now();if(!this.authority||!this.writerExcluded)throw Error('STOP_AUTHORITY');if(this.locked)throw Error('BUSY');this.locked=true;try{
 for(const feed of feeds){this.guard();if(feed.error){if(!this.s.sourcePending.includes(feed.name))this.s.sourcePending.push(feed.name);continue}
 const offset=this.s.checkpoint[feed.name]||0;for(let i=offset;i<(feed.items||[]).length;i++){this.guard();const item=feed.items[i],same=this.existing(item),prior=this.s.history.find(x=>x.guid.toLowerCase()===identity(item));
 if(item.proposedId){const used=this.s.ledger.find(x=>x.id===item.proposedId);if(used&&used.guid.toLowerCase()!==identity(item))throw Error('STOP_ID_COLLISION')}
 if(same&&!prior){this.s.checkpoint[feed.name]=i+1;continue}
 const h=prior||this.reserve(item);if(!prior)this.fault('after_reserved');
 if(same&&same.id!==h.id)throw Error('STOP_HISTORY_LEDGER_SPLIT');this.step(h,item);this.s.checkpoint[feed.name]=i+1;}}
 return {status:this.s.sourcePending.length?'SOURCE_PENDING':'OK',registered:this.s.history.filter(x=>x.state===STATES.DONE).length}
 }finally{this.locked=false}}
 snapshot(){return clone(this.s)}
}
module.exports={LabIngest,STATES};
