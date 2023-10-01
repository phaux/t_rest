// deno-lint-ignore-file require-await

import { assertEquals } from "https://deno.land/std@0.195.0/assert/assert_equals.ts";
import { delay } from "https://deno.land/std@0.203.0/async/delay.ts";
import { Client } from "./client/mod.ts";
import { Api } from "./server/Api.ts";
import { Endpoint } from "./server/Endpoint.ts";

const assertType = <T>(_: T) => {};

Deno.test("simple request", async () => {
  const api = new Api({
    "": {
      GET: new Endpoint(
        { body: undefined, query: undefined },
        async () => ({ status: 200, type: "text/plain", body: "Welcome" }),
      ),
    },
    "hello": {
      GET: new Endpoint(
        { body: undefined, query: { name: { type: "string" } } },
        async ({ query }) => {
          assertType<{ name: string }>(query);
          return {
            status: 200,
            type: "text/plain",
            body: `Hello ${query.name}`,
          };
        },
      ),
    },
    "age": {
      POST: new Endpoint(
        { body: null, query: { age: { type: "number" } } },
        async ({ query }) => {
          assertType<{ age: number }>(query);
          return {
            status: 201,
            type: "application/json",
            body: { message: `You are ${query.age} years old` },
          };
        },
      ),
    },
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8123, signal: controller.signal },
    api.serve,
  );
  const client = new Client<typeof api>("http://localhost:8123");
  await delay(100);
  {
    const rootResp = await client.fetch("", "GET", {
      body: undefined,
      query: undefined,
    });
    assertType<200 | 400 | 500>(rootResp.status);
    assertType<string>(rootResp.body);
    assertEquals(rootResp, {
      status: 200,
      type: "text/plain",
      body: "Welcome",
    });
  }
  {
    const helloResp = await client.fetch("hello", "GET", {
      body: undefined,
      query: { name: "world" },
    });
    assertType<200 | 400 | 500>(helloResp.status);
    assertType<string>(helloResp.body);
    assertEquals(
      helloResp,
      { status: 200, type: "text/plain", body: "Hello world" },
    );
  }
  {
    const ageResp = await client.fetch("age", "POST", {
      query: { age: 42 },
    });
    assertType<201 | 400 | 500>(ageResp.status);
    if (ageResp.status === 201) {
      assertType<{ message: string }>(ageResp.body);
    }
    assertEquals(
      ageResp,
      {
        status: 201,
        type: "application/json",
        body: { message: "You are 42 years old" },
      },
    );
  }
  assertEquals(
    // @ts-expect-error - invalid path
    await client.fetch("hellooo", "GET", {
      query: { name: "world" },
    }),
    {
      status: 404,
      type: "text/plain",
      body: "Not found",
    } as never,
  );
  assertEquals(
    // @ts-expect-error - invalid method
    await client.fetch("age", "GET", {
      body: undefined,
      query: { age: 42 },
    }),
    {
      status: 405,
      type: "text/plain",
      body: "Method not allowed",
    } as never,
  );
  assertEquals(
    await client.fetch("age", "POST", {
      // @ts-expect-error - invalid param type
      query: { age: "old" },
    }),
    {
      status: 400,
      type: "text/plain",
      body: "Bad request: Invalid query: Expected age to be a number",
    } as never,
  );
  controller.abort();
  await server.finished;
});

Deno.test("subapi request", async () => {
  const api = new Api({
    "say/hello": {
      GET: new Endpoint(
        { query: { name: { type: "string" } }, body: null },
        async ({ query }) => {
          assertType<{ name: string }>(query);
          return {
            status: 200,
            type: "text/plain",
            body: `Hello ${query.name}`,
          };
        },
      ),
    },
    "subapi": new Api({
      "": {
        GET: new Endpoint(
          { query: null, body: null },
          async () => ({
            status: 200,
            type: "text/plain",
            body: "Welcome to sub API",
          }),
        ),
      },
      "age": {
        POST: new Endpoint(
          { query: { age: { type: "integer" } }, body: null },
          async ({ query }) => {
            assertType<{ age: number }>(query);
            return {
              status: 200,
              type: "application/json",
              body: `You are ${query.age} years old`,
            };
          },
        ),
      },
    }),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8125, signal: controller.signal },
    api.serve,
  );
  const client = new Client<typeof api>("http://localhost:8125");
  await delay(100);
  assertEquals(
    await client.fetch("subapi/", "GET", {}),
    { status: 200, type: "text/plain", body: "Welcome to sub API" },
  );
  assertEquals(
    await client.fetch("say/hello", "GET", {
      query: { name: "world" },
    }),
    { status: 200, type: "text/plain", body: "Hello world" },
  );
  assertEquals(
    await client.fetch("subapi/age", "POST", {
      query: { age: 42 },
    }),
    { status: 200, type: "application/json", body: "You are 42 years old" },
  );
  assertEquals(
    await client.fetch("subapi/age", "POST", {
      query: { age: Infinity },
    }),
    {
      status: 400,
      type: "text/plain",
      body: "Bad request: Invalid query: Expected age to be an integer",
    },
  );
  assertEquals(
    await client.fetch("subapi/age", "POST", {
      // @ts-expect-error - missing param
      query: { name: "world" },
    }),
    {
      status: 400,
      type: "text/plain",
      body: "Bad request: Invalid query: Missing param age",
    } as never,
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await client.fetch("subapi/name", "GET", {
      query: { name: "world" },
    }),
    {
      status: 404,
      type: "text/plain",
      body: "Not found",
    } as never,
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await client.fetch("say/hello/subpath", "PUT", null),
    {
      status: 404,
      type: "text/plain",
      body: "Not found",
    } as never,
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await client.fetch("subapi/age/subpath", "PATCH", undefined),
    {
      status: 404,
      type: "text/plain",
      body: "Not found",
    } as never,
  );

  controller.abort();
  await server.finished;
});

Deno.test("request with body", async () => {
  const _badApi = new Api({
    "hello": {
      // @ts-expect-error - GET can't have a body
      GET: new Endpoint(
        {
          query: undefined,
          body: {
            type: "application/json",
            schema: {
              type: "object",
              properties: {},
            },
          },
        },
        async () => ({ status: 200, type: "text/plain", body: "Hello" }),
      ),
      // @ts-expect-error - DELETE can't have a body
      DELETE: new Endpoint(
        {
          query: undefined,
          body: {
            type: "application/json",
            schema: {
              type: "object",
              properties: { name: { type: "string" } },
            },
          },
        },
        async ({ body }) => {
          assertType<{ name?: string }>(body);
          return {
            status: 200,
            type: "text/plain",
            body: `Goodbye ${body.name}`,
          };
        },
      ),
    },
  });
  const api = new Api({
    "hello": {
      POST: new Endpoint(
        {
          query: null,
          body: {
            type: "text/plain",
          },
        },
        async ({ body }) => {
          assertType<string>(body);
          return {
            status: 201,
            type: "text/plain",
            body: `Hello ${body}`,
          };
        },
      ),
      PUT: new Endpoint(
        {
          query: null,
          body: {
            type: "application/json",
            schema: {
              type: "object",
              properties: { name: { type: "string" } },
            },
          },
        },
        async ({ body }) => {
          assertType<{ name?: string }>(body);
          return {
            status: 200,
            type: "application/json",
            // TODO: undefined values in JSON become null but are still undefined in types
            body: ["Hello", body.name ?? null, "!"],
          };
        },
      ),
    },
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8126, signal: controller.signal },
    api.serve,
  );
  const client = new Client<typeof api>("http://localhost:8126");
  await delay(100);
  assertEquals(
    await client.fetch("hello", "POST", {
      type: "text/plain",
      body: "world",
    }),
    { status: 201, type: "text/plain", body: "Hello world" },
  );
  assertEquals(
    await client.fetch("hello", "PUT", {
      type: "application/json",
      body: { name: "world" },
    }),
    { status: 200, type: "application/json", body: ["Hello", "world", "!"] },
  );
  assertEquals(
    await client.fetch("hello", "PUT", {
      type: "application/json",
      body: {},
    }),
    { status: 200, type: "application/json", body: ["Hello", null, "!"] },
  );
  assertEquals(
    // @ts-expect-error - invalid method
    await client.fetch("hello", "PATCH", {
      type: "application/json",
      body: { name: "world" },
    }),
    {
      status: 405,
      type: "text/plain",
      body: "Method not allowed",
    } as never,
  );
  assertEquals(
    await client.fetch("hello", "PUT", {
      type: "application/json",
      // @ts-expect-error - invalid body
      body: { name: 123 },
    }),
    {
      status: 400,
      type: "text/plain",
      body:
        "Bad request: Invalid body: Invalid JSON: Expected name to be a string",
    } as never,
  );
  controller.abort();
  await server.finished;
});

Deno.test("on exception receives 500", async () => {
  const api = new Api({
    "": {
      GET: new Endpoint(
        { body: null, query: null },
        async () => {
          throw new Error("oops");
        },
      ),
    },
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8127, signal: controller.signal },
    api.serve,
  );
  const client = new Client<typeof api>("http://localhost:8127/");
  await delay(100);
  assertEquals(
    await client.fetch("", "GET", {}),
    {
      status: 500,
      type: "text/plain",
      body: "Internal Server Error",
    },
  );
  controller.abort();
  await server.finished;
});

Deno.test("can return custom error", async () => {
  const api = new Api({
    "login": {
      POST: new Endpoint(
        {
          body: {
            type: "application/json",
            schema: {
              type: "object",
              properties: {
                username: { type: "string" },
                password: { type: "string" },
              },
            },
          },
          query: null,
        },
        async ({ body }) => {
          if (body.username === "admin" && body.password === "admin") {
            return {
              status: 200,
              type: "application/json",
              body: { session: "qwerty12345" },
            };
          }
          return {
            status: 401,
            type: "text/plain",
            body: "Unauthorized",
          };
        },
      ),
    },
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8128, signal: controller.signal },
    api.serve,
  );
  const client = new Client<typeof api>("http://localhost:8128");
  await delay(100);
  {
    const badLoginResp = await client.fetch("login", "POST", {
      type: "application/json",
      body: { username: "admin", password: "wrong" },
    });
    assertType<200 | 400 | 401 | 500>(badLoginResp.status);
    assertType<"text/plain" | "application/json">(badLoginResp.type);
    if (badLoginResp.status === 200) {
      assertType<"application/json">(badLoginResp.type);
      assertType<{ session: string }>(badLoginResp.body);
    }
    if (badLoginResp.status === 401) {
      assertType<"text/plain">(badLoginResp.type);
      assertType<string>(badLoginResp.body);
    }
    assertEquals(
      badLoginResp,
      { status: 401, type: "text/plain", body: "Unauthorized" },
    );
  }
  controller.abort();
  await server.finished;
});

Deno.test("form data request", async () => {
  const api = new Api({
    "": {
      POST: new Endpoint(
        {
          body: {
            type: "multipart/form-data",
            schema: {
              name: { kind: "value", type: "string" },
              age: { kind: "value", type: "integer" },
              metadata: {
                kind: "file",
                type: "application/json",
                schema: {
                  type: "object",
                  properties: {
                    tags: { type: "array", items: { type: "string" } },
                  },
                  required: ["tags"],
                },
              },
              photo: { kind: "file", type: "application/octet-stream" },
            },
          },
          query: null,
        },
        async ({ body }) => {
          assertType<string>(body.name);
          assertType<number>(body.age);
          assertType<Blob>(body.photo);
          assertType<{ tags: string[] }>(body.metadata);
          return {
            status: 200,
            type: "application/json",
            body: {
              message: `Hello ${body.name}, you are ${body.age} years old`,
              photoSize: body.photo.size,
              tagsCount: body.metadata.tags.length,
            },
          };
        },
      ),
    },
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8129, signal: controller.signal },
    api.serve,
  );
  const client = new Client<typeof api>("http://localhost:8129");
  await delay(100);
  assertEquals(
    await client.fetch("", "POST", {
      type: "multipart/form-data",
      body: {
        name: "John",
        age: 42,
        metadata: {
          tags: ["tag1", "tag2"],
        },
        photo: new File([new Uint8Array(1024)], "photo.jpg"),
      },
    }),
    {
      status: 200,
      type: "application/json",
      body: {
        message: "Hello John, you are 42 years old",
        photoSize: 1024,
        tagsCount: 2,
      },
    },
  );
  assertEquals(
    await client.fetch("", "POST", {
      type: "multipart/form-data",
      body: {
        name: "John",
        age: 42,
        // @ts-expect-error - param tags is required
        metadata: {},
        photo: new File([new Uint8Array(1024)], "photo.jpg"),
      },
    }),
    {
      status: 400,
      type: "text/plain",
      body:
        "Bad request: Invalid body: Invalid form data: Invalid JSON in metadata: Missing required property tags",
    },
  );
  controller.abort();
  await server.finished;
});
