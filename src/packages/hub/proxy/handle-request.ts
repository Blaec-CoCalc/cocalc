/* Handle a proxy request */

import { createProxyServer } from "http-proxy";
import LRU from "lru-cache";
import stripRememberMeCookie from "./strip-remember-me-cookie";
import { versionCheckFails } from "./version";
import { getTarget, invalidateTargetCache } from "./target";
import getLogger from "../logger";
import { stripBasePath } from "./util";
import { ProjectControlFunction } from "@cocalc/server/projects/control";
import siteUrl from "@cocalc/server/settings/site-url";

const logger = getLogger("proxy:handle-request");

interface Options {
  projectControl: ProjectControlFunction;
  isPersonal: boolean;
}

export default function init({ projectControl, isPersonal }: Options) {
  /* Cache at most 5000 proxies, each for up to 3 minutes.
   Throwing away proxies at any time from the cache is fine since
   the proxy is just used to handle *individual* http requests,
   and the cache is entirely for speed.  Also, invalidating cache entries
   works around weird cases, where maybe error/close don't get
   properly called, but the proxy is not working due to network
   issues.  Invalidating cache entries quickly is also good from
   a permissions and security point of view.
*/

  const cache = new LRU({
    max: 5000,
    ttl: 1000 * 60 * 3,
    dispose: (proxy) => {
      // important to close the proxy whenever it gets removed
      // from the cache, to avoid wasting resources.
      (proxy as any)?.close();
    },
  });

  async function handleProxyRequest(req, res): Promise<void> {
    const dbg = (...args) => {
      // for low level debugging -- silly isn't logged by default
      logger.silly(req.url, ...args);
    };
    dbg("got request");
    dbg("headers = ", req.headers);

    if (!isPersonal && versionCheckFails(req, res)) {
      dbg("version check failed");
      // note that the versionCheckFails function already sent back an error response.
      throw Error("version check failed");
    }

    // Before doing anything further with the request on to the proxy, we remove **all** cookies whose
    // name contains "remember_me", to prevent the project backend from getting at
    // the user's session cookie, since one project shouldn't be able to get
    // access to any user's account.
    let remember_me, api_key;
    if (req.headers["cookie"] != null) {
      let cookie;
      ({ cookie, remember_me, api_key } = stripRememberMeCookie(
        req.headers["cookie"]
      ));
      req.headers["cookie"] = cookie;
    }

    if (!isPersonal && !remember_me) {
      dbg("no rememember me set, so blocking");
      // Not in personal mode and there is no remember me set all, so
      // definitely block access.  4xx since this is a *client* problem.
      const url = await siteUrl();
      throw Error(
        `Please login to <a target='_blank' href='${url}'>${url}</a> with cookies enabled, then refresh this page.`
      );
    }

    const url = stripBasePath(req.url);
    const { host, port, internal_url } = await getTarget({
      remember_me,
      api_key,
      url,
      isPersonal,
      projectControl,
    });

    // It's http here because we've already got past the ssl layer.  This is all internal.
    const target = `http://${host}:${port}`;
    dbg("target resolves to", target);

    let proxy;
    if (cache.has(target)) {
      // we already have the proxy for this target in the cache
      dbg("using cached proxy");
      proxy = cache.get(target);
    } else {
      dbg("make a new proxy server to", target);
      proxy = createProxyServer({
        ws: false,
        target,
        timeout: 60000,
      });
      // and cache it.
      cache.set(target, proxy);
      dbg("created new proxy");
      // setup error handler, so that if something goes wrong with this proxy (it will,
      // e.g., on project restart), we properly invalidate it.
      const remove_from_cache = () => {
        cache.delete(target); // this also closes the proxy.
        invalidateTargetCache(remember_me, url);
      };

      proxy.on("error", (e) => {
        dbg("http proxy error event (ending proxy)", e);
        remove_from_cache();
      });

      proxy.on("close", remove_from_cache);
    }

    if (internal_url != null) {
      dbg("changing req url from ", req.url, " to ", internal_url);
      req.url = internal_url;
    }
    dbg("handling the request using the proxy");
    proxy.web(req, res);
  }

  return async (req, res) => {
    try {
      await handleProxyRequest(req, res);
    } catch (err) {
      const msg = `WARNING: error proxying request ${req.url} -- ${err}`;
      res.writeHead(426, { "Content-Type": "text/html" });
      res.end(msg);
      // Not something to log as an error -- just debug; it's normal for it to happen, e.g., when
      // a project isn't running.
      logger.debug(msg);
    }
  };
}
