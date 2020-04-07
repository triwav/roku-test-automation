import { Options, RequestHandler } from 'http-proxy-middleware';
import { NetworkProxy } from './NetworkProxy';

const path: string = '/';
const options: Options = {
    target: 'https://api.fubo.tv',  // Target host we're redirecting requests to - Router overrides this
    pathRewrite: {'/;': ''},        // Removing the param splitter from our Roku app network requests
    changeOrigin: true,             // Needed for virtual hosted sites - may be able to remove
    followRedirects: true,
    onProxyReq: onProxyRequest,
    //FIXME: this is not fixing the missing image errors within the app - was seeing cached images that appeared to make this fix good
    router: {
        'gn-imgx.fubo.tv': 'https://gn-imgx.fubo.tv',
        'imgx.fubo.tv': 'https://imgx.fubo.tv',
        'amolio.fubo.tv': 'https://amolio.fubo.tv'
    }
}
const port: number = 8888;

let networkProxy: NetworkProxy = new NetworkProxy(path, options, port);

function onProxyRequest(proxyReq, req, res) {
    console.log('onProxy Request', req.url);
}