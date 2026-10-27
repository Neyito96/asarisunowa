'use strict';
// Offline-only state machine. Synthetic proof is NOT production rowHash.
const STATES=Object.freeze({RESERVED:'RESERVED',LEDGER:'LEDGER_WRITTEN',V3:'V3_VERIFIED',DONE:'COMPLETED'});
const clone=x=>structuredClone(x);
const key=x=>{if(typeof x?.guid!=='string'||!x.guid||typeof x?.url!=='string'||!x.url)throw Error('STOP_IDENTITY_INVALID');return x.guid.toLowerCase()};
const proof=x=>'synthetic:'+key(x)+':'+x.id;
const fail=(code)=>{throw Error('STOP_'+code)};
class LabIngest {
 constructor(snapshot={},opts={}){
  this.s=clone({ledger:snapshot.ledger||[],history:snapshot.history||[],v3:snapshot.v3||[],checkpoint:snapshot.checkpoint||{},sourcePending:snapshot.sourcePending||[]});
  this.now=opts.now||(()=>Date.now());this.budget=opts.budget||300000;
  this.authority=opts.authority===true;this.writerExcluded=opts.writerExcluded===true;
  this.locked=false;this.failAt=null;
 }
 guard(){if(this.now()-this.start>=this.budget)throw Error('SAFE_DEADLINE')}
 fault(stage){if(this.failAt===stage)throw Error('SYNTHETIC_CRASH_'+stage)}
 validate(){
  for(const name of ['ledger','history','v3']){
   const ids=new Set(),guids=new Set();
   for(const r of this.s[name]){
    if(!r.id||ids.has(r.id))fail('DUPLICATE_ID_'+name);ids.add(r.id);
    if(name!=='v3'){const g=key(r);if(guids.has(g))fail('DUPLICATE_GUID_'+name);guids.add(g)}
   }
  }
  const lm=new Map(this.s.ledger.map(x=>[x.id,x])),vm=new Map(this.s.v3.map(x=>[x.id,x]));
  for(const l of this.s.ledger){const h=this.s.history.find(x=>x.id===l.id);if(h&&(key(h)!==key(l)||h.url!==l.url))fail('HISTORY_LEDGER_SPLIT');const v=vm.get(l.id);if(v&&v.proof!==proof(l))fail('V3_PROOF');}
  for(const v of this.s.v3){const l=lm.get(v.id);if(!l)fail('ORPHAN_V3');if(v.proof!==proof(l))fail('V3_PROOF');}
  for(const h of this.s.history){const l=lm.get(h.id),v=vm.get(h.id);
   if(!Object.values(STATES).includes(h.state))fail('BAD_STATE');
   if(h.state===STATES.DONE&&(!l||!v))fail('COMPLETED_INCOMPLETE');
   if((h.state===STATES.LEDGER||h.state===STATES.V3)&&!l)fail('MISSING_LEDGER');
   if(h.state===STATES.V3&&!v)fail('MISSING_V3');
  }
 }
 find(item){const g=key(item);const candidates=this.s.ledger.filter(x=>key(x)===g||x.url===item.url||(item.audio&&x.audio===item.audio));if(candidates.some(x=>key(x)!==g||x.url!==item.url))fail('IDENTITY_CONFLICT');return candidates[0]||null;}
 reserve(item){const used=this.s.history.find(x=>key(x)===key(item));if(used){if(used.url!==item.url)fail('HISTORY_URL');return used;}
  const ids=[...this.s.ledger,...this.s.history,...this.s.v3].map(x=>x.id).filter(x=>/^EP-\d+$/.test(x));const n=Math.max(0,...ids.map(x=>Number(x.slice(3))))+1;
  const h={id:'EP-'+String(n).padStart(5,'0'),guid:key(item),url:item.url,state:STATES.RESERVED};this.s.history.push(h);return h;
 }
 step(h,item){let l=this.s.ledger.find(x=>x.id===h.id),v=this.s.v3.find(x=>x.id===h.id);
  if(h.state===STATES.DONE){if(!l||!v||v.proof!==proof(l))fail('COMPLETED_INCOMPLETE');return;}
  if(h.state===STATES.RESERVED){if(l&&(key(l)!==key(item)||l.url!==item.url))fail('PARTIAL_CONFLICT');if(!l){l={id:h.id,guid:key(item),url:item.url,audio:item.audio||''};this.s.ledger.push(l);}h.state=STATES.LEDGER;this.fault('after_ledger');}
  if(h.state===STATES.LEDGER){l=this.s.ledger.find(x=>x.id===h.id);if(!l||key(l)!==key(item))fail('LEDGER_MISSING');if(v&&v.proof!==proof(l))fail('V3_PROOF');if(!v){v={id:h.id,proof:proof(l)};this.s.v3.push(v);}h.state=STATES.V3;this.fault('after_v3');}
  if(h.state===STATES.V3){l=this.s.ledger.find(x=>x.id===h.id);v=this.s.v3.find(x=>x.id===h.id);if(!l||!v||v.proof!==proof(l))fail('V3_MISSING');h.state=STATES.DONE;this.fault('after_completed');}
 }
 run(feeds){this.start=this.now();if(!this.authority||!this.writerExcluded)fail('AUTHORITY');if(this.locked)throw Error('BUSY');this.locked=true;
  try{this.validate();for(const feed of feeds){this.guard();if(feed.error){if(!this.s.sourcePending.includes(feed.name))this.s.sourcePending.push(feed.name);continue;}
    // index-based checkpoints discarded; each item is revalidated on every run.
    for(const item of feed.items||[]){this.guard();const g=key(item),l=this.find(item),h=this.s.history.find(x=>key(x)===g);
      if(item.proposedId){const used=this.s.ledger.find(x=>x.id===item.proposedId);if(used&&key(used)!==g)fail('ID_COLLISION');}
      if(h&&h.url!==item.url)fail('HISTORY_URL');
      if(l&&!h){const v=this.s.v3.find(x=>x.id===l.id);if(!v)fail('LEGACY_PROOF_MISSING');if(v.proof!==proof(l))fail('V3_PROOF');this.s.checkpoint[feed.name]={lastGuid:g};continue;}
      if(l&&h&&l.id!==h.id)fail('HISTORY_LEDGER_SPLIT');
      if(!h&&this.s.history.some(x=>x.id===item.proposedId))fail('ID_COLLISION');
      const entry=h||this.reserve(item);if(!h)this.fault('after_reserved');this.step(entry,item);this.validate();this.s.checkpoint[feed.name]={lastGuid:g};
    }
  }return{status:this.s.sourcePending.length?'SOURCE_PENDING':'OK',registered:this.s.history.filter(x=>x.state===STATES.DONE).length};
  }finally{this.locked=false;}
 }
 snapshot(){return clone(this.s)}
}
module.exports={LabIngest,STATES};
