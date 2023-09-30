import { assertEquals } from "https://deno.land/std@0.195.0/assert/assert_equals.ts";
import { ConsoleHandler } from "https://deno.land/std@0.201.0/log/handlers.ts";
import { setup } from "https://deno.land/std@0.201.0/log/mod.ts";
import { delay } from "https://deno.land/std@0.203.0/async/delay.ts";
import { Client } from "./client/Client.ts";
import { Route } from "./server/Route.ts";
import { Api } from "./server/Api.ts";

const assertType = <T>(_: T) => {};

setup({
  handlers: {
    console: new ConsoleHandler("DEBUG"),
  },
  loggers: {
    trest: { level: "DEBUG", handlers: ["console"] },
  },
});

Deno.test("simple request", async () => {
  const api = new Api({
    "": {
      GET: new Route(
        { body: undefined, query: {} },
        () => new Response("Welcome"),
      ),
    },
    "hello": {
      GET: new Route(
        { body: undefined, query: { name: { type: "string" } } },
        ({ query }) => {
          assertType<{ name: string }>(query);
          return new Response(`Hello ${query.name}`);
        },
      ),
    },
    "age": {
      POST: new Route(
        { body: undefined, query: { age: { type: "number" } } },
        ({ query }) => {
          assertType<{ age: number }>(query);
          return new Response(`You are ${query.age} years old`);
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
  assertEquals(
    await client.fetch("", "GET", { body: undefined, query: {} }),
    "Welcome",
  );
  assertEquals(
    await client.fetch("hello", "GET", {
      body: undefined,
      query: { name: "world" },
    }),
    "Hello world",
  );
  assertEquals(
    await client.fetch("age", "POST", {
      body: undefined,
      query: { age: 42 },
    }),
    "You are 42 years old",
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await client.fetch("hellooo", "GET", {
      body: undefined,
      query: { name: "world" },
    }),
    "Not found",
  );
  assertEquals(
    // @ts-expect-error - invalid method
    await client.fetch("age", "GET", {
      body: undefined,
      query: { age: 42 },
    }),
    "Method not allowed",
  );
  assertEquals(
    await client.fetch("age", "POST", {
      body: undefined,
      // @ts-expect-error - invalid param type
      query: { age: "old" },
    }),
    "Bad request: Invalid query: Expected age to be a number",
  );
  controller.abort();
  await server.finished;
});

Deno.test("subapi request", async () => {
  const api = new Api({
    "say/hello": {
      GET: new Route(
        { query: { name: { type: "string" } }, body: undefined },
        ({ query }) => {
          assertType<{ name: string }>(query);
          return new Response(`Hello ${query.name}`);
        },
      ),
    },
    "subapi": new Api({
      "": {
        GET: new Route(
          { query: {}, body: undefined },
          () => new Response("Welcome to sub API"),
        ),
      },
      "age": {
        POST: new Route(
          { query: { age: { type: "integer" } }, body: undefined },
          ({ query }) => {
            assertType<{ age: number }>(query);
            return new Response(`You are ${query.age} years old`);
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
    await client.fetch("subapi/", "GET", { query: {}, body: undefined }),
    "Welcome to sub API",
  );
  assertEquals(
    await client.fetch("say/hello", "GET", {
      query: { name: "world" },
      body: undefined,
    }),
    "Hello world",
  );
  assertEquals(
    await client.fetch("subapi/age", "POST", {
      query: { age: 42 },
      body: undefined,
    }),
    "You are 42 years old",
  );
  assertEquals(
    await client.fetch("subapi/age", "POST", {
      query: { age: Infinity },
      body: undefined,
    }),
    "Bad request: Invalid query: Expected age to be an integer",
  );
  assertEquals(
    await client.fetch("subapi/age", "POST", {
      // @ts-expect-error - missing param
      query: { name: "world" },
      body: undefined,
    }),
    "Bad request: Invalid query: Missing param age",
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await client.fetch("subapi/name", "GET", {
      query: { name: "world" },
      body: undefined,
    }),
    "Not found",
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await client.fetch("say/hello/subpath", "PUT", {
      query: {},
      body: undefined,
    }),
    "Not found",
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await client.fetch("subapi/age/subpath", "PATCH", {
      query: {},
      body: undefined,
    }),
    "Not found",
  );

  controller.abort();
  await server.finished;
});

Deno.test("request with body", async () => {
  const _badApi = new Api({
    "hello": {
      // @ts-expect-error - GET can't have a body
      GET: new Route(
        {
          query: {},
          body: {
            type: "json",
            schema: {
              type: "object",
              properties: {},
            },
          },
        },
        () => new Response("Hello"),
      ),
      // @ts-expect-error - DELETE can't have a body
      DELETE: new Route(
        {
          query: {},
          body: {
            type: "json",
            schema: {
              type: "object",
              properties: { name: { type: "string" } },
            },
          },
        },
        ({ body }) => {
          assertType<{ name: string }>(body);
          return new Response(`Goodbye ${body.name}`);
        },
      ),
    },
  });
  const api = new Api({
    "hello": {
      POST: new Route(
        {
          query: {},
          body: {
            type: "string",
          },
        },
        ({ body }) => {
          assertType<string>(body);
          return new Response(`Hello ${body}`);
        },
      ),
      PUT: new Route(
        {
          query: {},
          body: {
            type: "json",
            schema: {
              type: "object",
              properties: { name: { type: "string" } },
            },
          },
        },
        ({ body }) => {
          assertType<{ name: string }>(body);
          return new Response(`Hello ${body.name}`);
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
      query: {},
      body: "world",
    }),
    "Hello world",
  );
  assertEquals(
    await client.fetch("hello", "PUT", {
      query: {},
      body: { name: "world" },
    }),
    "Hello world",
  );
  assertEquals(
    // @ts-expect-error - invalid method
    await client.fetch("hello", "PATCH", {
      query: {},
      body: { name: "world" },
    }),
    "Method not allowed",
  );
  assertEquals(
    await client.fetch("hello", "PUT", {
      query: {},
      // @ts-expect-error - invalid body
      body: { name: 123 },
    }),
    "Bad request: Invalid body: Expected name to be a string",
  );
  controller.abort();
  await server.finished;
});
