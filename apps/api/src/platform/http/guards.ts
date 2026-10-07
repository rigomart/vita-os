import type { MiddlewareHandler } from "hono";

import { cors } from "hono/cors";

import type { ApiEnv } from "../env";

import {
  jsonRequestRequired,
  requestOriginNotAllowed,
  RequestRefusal,
  refusalResponse,
} from "./errors";

export function browserOrigin(value: string): string {
  return new URL(value).origin;
}

/** Bind CORS to this request's environment, including preflights and refusals. */
export const requestCors: MiddlewareHandler<ApiEnv> = (c, next) => {
  const origin = browserOrigin(c.env.BROWSER_ORIGIN);
  return cors({
    origin: (candidate) => (candidate === origin ? origin : undefined),
    credentials: true,
    exposeHeaders: ["X-Vita-Version"],
    allowMethods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  })(c, next);
};

/** Reject foreign writes and non-JSON mutations before authentication or parsing. */
export const requestGuards: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const method = c.req.method;
  if (!["OPTIONS", "GET", "HEAD"].includes(method)) {
    const origin = c.req.header("origin");
    if (
      origin !== undefined &&
      origin !== browserOrigin(c.env.BROWSER_ORIGIN)
    ) {
      return refusalResponse(new RequestRefusal(requestOriginNotAllowed, 403));
    }
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const mediaType = c.req
        .header("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase();
      if (mediaType !== "application/json")
        return refusalResponse(new RequestRefusal(jsonRequestRequired, 415));
    }
  }
  await next();
};
