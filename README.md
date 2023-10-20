# Typed REST

[![deno doc](https://doc.deno.land/badge.svg)](https://deno.land/x/t_rest)

Library inspired by tRPC for REST APIs.

## Example

`server.ts`:

```ts
import {
  createEndpoint,
  createMethodFilter,
  createPathFilter,
} from "https://deno.land/x/t_rest/server/mod.ts";

const serveApi = createPathFilter({
  "hello": createMethodFilter({
    GET: createEndpoint(
      {
        query: {
          name: { type: "string" },
        },
      },
      async ({ query }) => {
        return {
          status: 200,
          body: {
            type: "text/plain",
            data: `Hello ${query.name}`,
          },
        };
      },
    ),
  }),
});

Deno.serve({ port: 8000 }, serveApi);

export type ApiHandler = typeof serveApi;
```

`client.ts`:

```ts
// @deno-types="https://deno.land/x/t_rest/client/mod.ts"
import { createFetcher } from "https://esb.deno.dev/https://deno.land/x/t_rest/client/mod.ts";
import { type ApiHandler } from "./server.ts";

const fetchApi = createFetcher<ApiHandler>({
  baseUrl: "http://localhost:8080/",
});

const response = await fetchApi("hello", "GET", {
  query: { name: "world" },
});

if (response.status !== 200) {
  throw new Error("Request failed");
}
console.log(response.body); // { type: "text/plain", data: "Hello world" }
```

See more examples in [tests](./mod.test.ts).

## Features / TODO

- [x] Query params
- [x] JSON body (`application/json`)
- [x] File uploads (`multipart/form-data`)
- [x] Path segment params
- [ ] Custom headers
- [ ] Subscriptions (Server Sent Events / WebSockets)
