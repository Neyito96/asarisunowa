/** Local durable receipts + conservative cross-process lock. No tokens stored. */
import {mkdir,open,readFile,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';import {createHash,randomUUID} from 'node:crypto';
const digest=k=>createHash('sha256').update(k).digest('hex');
export async function openPlaylistJournal(directory){
 await mkdir(directory,{recursive:true,mode:0o700});const owned=new Set();
 return {durable:true,
  async get(key){try{return JSON.parse(await readFile(join(directory,digest(key)+'.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
  async put(key,value){const target=join(directory,digest(key)+'.json'),tmp=target+'.'+randomUUID()+'.tmp';const f=await open(tmp,'wx',0o600);try{await f.writeFile(JSON.stringify(value));await f.sync();}finally{await f.close();}await rename(tmp,target);const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}},
  async acquire(key){const path=join(directory,digest(key)+'.lock');try{const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify({pid:process.pid,at:new Date().toISOString()}));await f.sync();}finally{await f.close();}owned.add(key);return true;}catch(e){if(e.code==='EEXIST')return false;throw e;}},
  async release(key){if(!owned.has(key))throw Error('LOCK_NOT_OWNED');await unlink(join(directory,digest(key)+'.lock'));owned.delete(key);}
 };
}
