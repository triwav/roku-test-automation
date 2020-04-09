import { Options, RequestHandler } from 'http-proxy-middleware';
import { NetworkProxy } from '../src/NetworkProxy';

const path: string = '/';
const options: Options = {
    target: targetHost,
    pathRewrite: pathRewriteConfig,
    changeOrigin: true,
    followRedirects: true,
    onProxyReq: onProxyRequest,
    onProxyRes: onProxyResponse,
    router: routerConfig
}
const port: number = 8888;

let networkProxy: NetworkProxy = new NetworkProxy(path, options, port);

function onProxyRequest(proxyReq, req, res) {
    console.log('onProxy Request', req.url);
}

function onProxyResponse(proxyRes, req, res) {
    console.log('onProxy Response', req.url);
}