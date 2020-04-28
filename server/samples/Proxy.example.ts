import { Options, RequestHandler } from 'http-proxy-middleware';
import { NetworkProxy } from '../src/NetworkProxy';

// Typescript class describing service specific config.
import { ProxyConfig } from './fubo/Proxy.config';
// Json objects describing the error mapping and custom errors to return.
import * as responseConfig from "./fubo/Proxy.response.set.home.json";
import * as errorMap from "./fubo/Proxy.error.map.json";

const path: string = '/';
const options: Options = {
    target: ProxyConfig.targetDomain,
    pathRewrite: ProxyConfig.pathRewriteConfig,
    changeOrigin: true,
    followRedirects: true,
    onProxyReq: onProxyRequest,
    onProxyRes: onProxyResponse,
    router: ProxyConfig.routerConfig
}
const ignoreList = responseConfig['_ignore'];
const port: number = 8888;
let networkProxy: NetworkProxy = new NetworkProxy(path, options, port);

// Proxy callback when a URL is requested.
function onProxyRequest(proxyReq, req, res) {
    let requestHostname = getHostName(req.url);
    let requestPath = getPath(req.path);
    let targetHostname = getHostName(ProxyConfig.targetDomain);

    // Handling API responses only atm
    if (requestHostname === targetHostname && typeof ignoreList !== 'undefined' && ignoreList.indexOf(requestPath) === -1) {
        mapErrorResponse(responseConfig[requestPath], req, res);
        //console.log('API response', requestHostname, requestPath, req.query);
        //console.log('API response', requestHostname, requestPath);
    }
}

// Proxy callback when a URL responds - not currently used.
function onProxyResponse(proxyRes, req, res) {
    // console.log('onProxy Response', req.url);
}

// Maps the requested URL to known/valid error responses, defined in Proxy.response.set.* json.
function mapErrorResponse(responseToMap, req, res) {
    if (typeof responseToMap !== 'undefined') {
        let httpStatus: number = -1;
        switch (typeof responseToMap) {
            case 'number':
                httpStatus = responseToMap;
                res.statusMessage = 'Custom error response from Proxy.';
                res.status(httpStatus).end();
                // console.log("httpStatus Error only",res.statusCode, res.statusMessage)
                break;
            case 'string':
                let errorObj: object = errorMap[responseToMap];
                let error: object = errorObj['error'];
                httpStatus = errorObj['httpStatus'];
                res.statusMessage = JSON.stringify(error);
                res.status(httpStatus).end()
                // console.log("Custom error",res.statusCode, res.statusMessage)
                break;
            case 'object':
                for (let responseKey in responseToMap) {
                    let queryToMap = responseToMap[responseKey];
                    for (let queryKey in queryToMap) {
                        let reqQueryValue = req.query[responseKey];
                        if (typeof reqQueryValue === 'number' || (typeof reqQueryValue === 'string' && reqQueryValue.indexOf(queryKey) > -1)) {
                            let queryResponseToMap = queryToMap[queryKey];
                            mapErrorResponse(queryResponseToMap, req, res);
                        }
                    }
                }
                break;
        }
    }
}

// Formats the URL path to ensure we can map it from the Proxy.response.set keys.
function getPath(path: string) {
    let str = path.replace(/\//g, "_");  //Replacing all forward slash's with underscore.
    str = str.substring(1, str.length);  //Removing the first underscore.
    return str;
}

// Returns the hostname anywhere within the URL request. This fixes an issue when passing the request back to a hosted box IP. The native `req.hostname` only returns the IP address.
function getHostName(url: string) {
    let match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
    if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
        return match[2];
    }
    return null;
}