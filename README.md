# Typed REST

[![deno doc](https://doc.deno.land/badge.svg)](https://deno.land/x/t_rest)

Library inspired by tRPC for REST APIs.

## Example

`server.ts`:

```ts
import { Api, Endpoint } from "https://deno.land/x/t_rest/server/mod.ts";

const myApi = new Api({
  "hello": {
    GET: new Endpoint(
      {
        query: { name: { type: "string" } },
        body: null,
      },
      async ({ query }) => {
        return {
          status: 200,
          type: "text/plain",
          body: `Hello ${query.name}`,
        };
      },
    ),
  },
});

Deno.serve({ port: 8000 }, myApi.serve);

export type MyApi = typeof myApi;
```

`client.ts`:

```ts
// @deno-types="https://deno.land/x/t_rest/client/mod.ts"
import { Client } from "https://esb.deno.dev/https://deno.land/x/t_rest/client/mod.ts";
import { type MyApi } from "./server.ts";

const client = new Client<MyApi>("http://localhost:8080");

const response = await client.fetch("hello", "GET", {
  query: { name: "world" },
});

if (response.status !== 200) {
  throw new Error("Request failed");
}
console.log(response.body); // Hello world
```

See more examples in [tests](./mod.test.ts).

## Features / TODO

- [x] Query params
- [x] JSON body (`application/json`)
- [x] File uploads (`multipart/form-data`)
- [ ] Path segment params
- [ ] Custom headers
- [ ] Subscriptions (Server Sent Events / WebSockets)
