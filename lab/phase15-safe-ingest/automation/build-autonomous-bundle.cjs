const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sources=['Phase15IntegratedProductionEngine.gs','Phase15AutonomousRuntime.gs'];
const text='// GENERATED: edit source files, then run build-autonomous-bundle.cjs\n'+sources.map(name=>'\n// SOURCE: '+name+'\n'+fs.readFileSync(path.join(__dirname,name),'utf8')).join('\n');
new vm.Script(text);const dir=path.join(__dirname,'install');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'Phase15AutonomousBundle.gs'),text);console.log('Built and syntax checked install/Phase15AutonomousBundle.gs');
