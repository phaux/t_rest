# tREST

[![deno doc](https://doc.deno.land/badge.svg)](https://deno.land/x/trest/mod.ts)

Library inspired by [tRPC](https://trpc.io/) for REST APIs.

## Example

Server:

```ts
import { Api, Endpoint } from "https://deno.land/x/trest/server/mod.ts";

const api = new Api({
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
```

Client:

```ts
import { Client } from "https://deno.land/x/trest/client/mod.ts";

const client = new Client("http://localhost:8080");

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
