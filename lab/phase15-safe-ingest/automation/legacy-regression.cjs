// Execute existing CommonJS LAB fixtures without changing the repository's ESM config.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const engine={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(base,'engine.js'),'utf8'),{module:engine,exports:engine.exports,structuredClone,Date,Set,Map,console},{filename:'engine.js'});
for(const name of ['test.js','adversarial.test.js']){
 const context={require:id=>id==='./engine'?engine.exports:require(id),console,process,structuredClone,Date,Set,Map};
 vm.runInNewContext(fs.readFileSync(path.join(base,name),'utf8'),context,{filename:name});
}
