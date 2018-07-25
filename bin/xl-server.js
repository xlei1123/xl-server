#! /usr/bin/env node

let commander = require('commander');

commander.on('--help', () => {
    console.log('\r\n how to use:');
    console.log('    xl-server --port <val>');
    console.log('    xl-server --host <val>');
    console.log('    xl-server --dir <val>');
})

commander
    .version('1.0.0')
    .usage('[option]')
    .option('-p,--port <n>','server port')
    .parse(process.argv)

let Server = require('../index')   //引入index文件导出的类
let server = new Server(commander)  //实例
server.start();   //启动

let {exec} = require('child_process');
if(process.platform === 'win32'){ //执行调起浏览器 localhost:port
    exec(`start http://localhost:${server.config.port}`);    
}else{
    exec(`open http://localhost:${server.config.port}`);
}
