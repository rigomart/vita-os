import { Effect } from "effect";
import {
  Headers,
  HttpMiddleware,
  HttpRouter,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/http";

import type { CreateScope } from "../request-scope";

import { authenticatedScope } from "../auth/authenticated-scope";
import { WorkerBindings } from "./context";
import {
  jsonRequestRequired,
  RequestRefusal,
  requestOriginNotAllowed,
  refusalResponse,
  toRefusal,
} from "./errors";

export function browserOrigin(value: string): string {
  return new URL(value).origin;
}

/** Decode ordinary path characters once, keeping reserved separators encoded. */
function requestPath(url: string): string {
  // Keeping %25 encoded mirrors the router's decoding. decodeURI runs once, so
  // %25 can only ever become "%", which cannot change whether a path is protected.
  const path = url.split(/[?#]/, 1)[0].replace(/%25/g, "%2525");
  try {
    return decodeURI(path);
  } catch {
    // Match the previous router's treatment of malformed escapes: decode the
    // valid runs so an invalid suffix cannot hide a protected route prefix.
    return path.replace(/(?:%[0-9A-Fa-f]{2})+/g, (encoded) => {
      try {
        return decodeURI(encoded);
      } catch {
        return encoded;
      }
    });
  }
}

/** Guard and failure responses run inside CORS, including router misses. */
export function requestMiddleware(createScope: CreateScope) {
  return HttpRouter.middleware(
    (httpEffect) =>
      Effect.gen(function* () {
        const originalRequest = yield* HttpServerRequest.HttpServerRequest;
        const path = requestPath(originalRequest.url);
        // FindMyWay treats a raw semicolon as a query separator. Encode only
        // pathname semicolons so opaque parameters retain their original value.
        const queryStart = originalRequest.url.search(/[?#]/);
        const pathname =
          queryStart < 0
            ? originalRequest.url
            : originalRequest.url.slice(0, queryStart);
        const suffix =
          queryStart < 0 ? "" : originalRequest.url.slice(queryStart);
        const routingUrl = pathname.replace(/;/g, "%3B") + suffix;
        const request =
          routingUrl === originalRequest.url
            ? originalRequest
            : originalRequest.modify({ url: routingUrl });
        const routingEffect =
          request === originalRequest
            ? httpEffect
            : Effect.provideService(
                httpEffect,
                HttpServerRequest.HttpServerRequest,
                request,
              );
        const protectedPath = path === "/v1" || path.startsWith("/v1/");
        const authPath = path === "/api/auth" || path.startsWith("/api/auth/");
        if (!protectedPath && !authPath) return yield* routingEffect;
        const env = yield* WorkerBindings;
        const origin = browserOrigin(env.BROWSER_ORIGIN);
        const guarded = Effect.gen(function* () {
          if (
            protectedPath &&
            !["OPTIONS", "GET", "HEAD"].includes(request.method)
          ) {
            if (
              request.headers.origin !== undefined &&
              request.headers.origin !== origin
            ) {
              return refusalResponse(
                new RequestRefusal(requestOriginNotAllowed, 403),
              );
            }
            if (["POST", "PUT", "PATCH"].includes(request.method)) {
              const mediaType = request.headers["content-type"]
                ?.split(";", 1)[0]
                .trim()
                .toLowerCase();
              if (mediaType !== "application/json") {
                return refusalResponse(
                  new RequestRefusal(jsonRequestRequired, 415),
                );
              }
            }
          }
          // Task DELETE historically reads JSON without requiring a media type.
          const taskDelete =
            request.method === "DELETE" &&
            /^\/v1\/threads\/[^/]+\/tasks\/[^/]+$/.test(path);
          return yield* taskDelete
            ? Effect.provideService(
                httpEffect,
                HttpServerRequest.HttpServerRequest,
                request.modify({
                  headers: Headers.set(
                    request.headers,
                    "content-type",
                    "application/json",
                  ),
                }),
              )
            : routingEffect;
        }).pipe(
          Effect.catch((error) => {
            if (
              error instanceof HttpServerError.HttpServerError &&
              error.reason instanceof HttpServerError.RouteNotFound
            ) {
              const notFound = Effect.succeed(
                HttpServerResponse.text("404 Not Found", { status: 404 }),
              );
              return protectedPath
                ? Effect.flatMap(
                    authenticatedScope(createScope),
                    () => notFound,
                  )
                : notFound;
            }
            return Effect.succeed(refusalResponse(toRefusal(error)));
          }),
          Effect.catch((error) =>
            Effect.succeed(refusalResponse(toRefusal(error))),
          ),
          Effect.catchDefect((defect) =>
            Effect.succeed(refusalResponse(toRefusal(defect))),
          ),
        );
        return yield* HttpMiddleware.cors({
          allowedOrigins: (candidate) => candidate === origin,
          credentials: true,
        })(guarded);
      }).pipe(
        Effect.catchDefect((defect) =>
          Effect.succeed(refusalResponse(toRefusal(defect))),
        ),
      ),
    { global: true },
  );
}
