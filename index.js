// 复杂一点的命令行工具 展示目录和文件 完善--> 加上压缩和缓存
let http = require('http');
let url = require('url');
let path = require('path');
let fs = require('fs');
let util = require('util');
let zlib = require('zlib');
let mime = require('mime');   //第三方模块 用来获取内容类型
// let debug = require('debug')('env')  //打印输出 会根据环境变量控制输出
let chalk = require('chalk'); // 粉笔
let ejs = require('ejs')    //高效的 JavaScript 模板引擎。


let config = require('./config');

let stat = util.promisify(fs.stat);
let readdir = util.promisify(fs.readdir);

let templateStr = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
class Server {
    constructor(options) {
        this.config = {...config, ...options};
        this.template = templateStr;
    }
    async handleRequest(req, res) {
        let { pathname } = url.parse(req.url, true);
        let realPath = path.join(this.config.dir, pathname);
        try{
            let statObj = await stat(realPath)
            if(statObj.isFile()) {   //文件
                this.sendFile(req, res, statObj, realPath)
            } else {   //文件夹
                let dirs = await readdir(realPath);
                dirs = dirs.map(dir => ({ name: dir, path: path.join(pathname, dir) }));
                let str = ejs.render(this.template, { dirs });
                res.setHeader('Content-Type', 'text/html;charset=utf-8');
                res.end(str);
            }
        } catch (e) {
            this.sendError(req, res, e);
        }
    }
    sendError(req, res, e) {
        console.log(e); // 将错误打印出来
        res.statusCode = 404;
        res.end('Not Found');
    }
    cache(req, res, statObj, realPath) {
        res.setHeader('Cache-control','max-age=100')    //强制缓存  注意即使是强制缓存也不会缓存主网页
        let etag = statObj.ctime.toGMTString() + statObj.size;
        let lastModified = statObj.ctime.toGMTString();    //atime创建时间 ctime --- change time 修改时间
        res.setHeader('Etag', etag);   //Etag -- if-none-match
        res.setHeader('Last-Modified', lastModified);  //Last-Modified --- if-none-match
        let ifNoneMatch = req.headers['if-none-match'];
        let ifModifiedSince = req.headers['if-modified-since'];
        if (etag != ifNoneMatch) {       //两种方式 第一种就行
            return false
        }
        if (lastModified !=ifModifiedSince) {       //两种方式 第一种就行，此种只是列出304缓存的另一种方式
            return false
        }
        return true
    }
    compress(req, res, statObj, realPat) {    //实现压缩功能
        let encoding = req.headers['accept-encoding'];
        if (encoding) {
            if (encoding.match(/\bgzip\b/)) {
                res.setHeader('content-encoding','gzip')
                return zlib.createGzip()
            } else if (encoding.match(/\bdeflate\b/)) {
                res.setHeader('content-encoding', 'deflate')
                return zlib.createDeflate();
            } else {
                return false
            }
        } else {
            return false
        }
    }
    sendFile(req, res, statObj, realPath) {
        if (this.cache(req, res, statObj, realPath)) {
            res.statusCode = 304;
            res.end();
            return;
        }
        res.setHeader('Content-Type', mime.getType(realPath) + ';charset=utf-8');
        let zip = this.compress(req, res, statObj, realPath);
        if(zip) {
            return fs.createReadStream(realPath).pipe(zip).pipe(res)
        }
        fs.createReadStream(realPath).pipe(res)
    }
    start() {
        let server = http.createServer(this.handleRequest.bind(this));
        let { port, host } = this.config;
        server.listen(port, host, function () {
            console.log(`server start http://${host}:${chalk.green(port)}`)
        });
    }

}
module.exports = Server;

