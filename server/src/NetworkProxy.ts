import * as express from 'express';
import { createProxyMiddleware, Options, RequestHandler } from 'http-proxy-middleware';

export class NetworkProxy {
	private app: express;

    constructor(path: string, options: Options, port: number) {
        this.app = express();
        this.app.use(path, createProxyMiddleware(options));
        this.app.listen(port);
    }
}