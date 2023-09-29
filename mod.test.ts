import { assertEquals } from "https://deno.land/std@0.195.0/assert/assert_equals.ts";
import { ConsoleHandler } from "https://deno.land/std@0.201.0/log/handlers.ts";
import { setup } from "https://deno.land/std@0.201.0/log/mod.ts";
import { delay } from "https://deno.land/std@0.203.0/async/delay.ts";
import { Fetcher } from "./client.ts";
import { Api, Endpoint } from "./server.ts";

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
    "/hello": new Endpoint(
      { name: { type: "string" } },
      (params) => {
        assertType<{ name: string }>(params);
        return new Response(`Hello ${params.name}`);
      },
    ),
    "/age": new Endpoint(
      { age: { type: "number" } },
      (params) => {
        assertType<{ age: number }>(params);
        return new Response(`You are ${params.age} years old`);
      },
    ),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8123, signal: controller.signal },
    api.serve,
  );
  const client = new Fetcher<typeof api["api"]>("http://localhost:8123");
  await delay(100);
  assertEquals(
    await client.fetch(["/hello"], { name: "world" }),
    "Hello world",
  );
  assertEquals(
    await client.fetch(["/age"], { age: 42 }),
    "You are 42 years old",
  );
  assertEquals(
    // @ts-expect-error
    await client.fetch(["/age"], { age: "old" }),
    "Invalid number param age",
  );
  assertEquals(
    // @ts-expect-error
    await client.fetch(["/hellooo"], { name: "world" }),
    "Not found",
  );
  controller.abort();
  await server.finished;
});

Deno.test("subapi request", async () => {
  const api = new Api({
    "/say/hello": new Endpoint(
      { name: { type: "string" } },
      (params) => {
        assertType<{ name: string }>(params);
        return new Response(`Hello ${params.name}`);
      },
    ),
    "/subapi": new Api({
      "/age": new Endpoint(
        { age: { type: "number" } },
        (params) => {
          assertType<{ age: number }>(params);
          return new Response(`You are ${params.age} years old`);
        },
      ),
    }),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8125, signal: controller.signal },
    api.serve,
  );
  const client = new Fetcher<typeof api["api"]>("http://localhost:8125");
  await delay(100);
  assertEquals(
    await client.fetch(["/say/hello"], { name: "world" }),
    "Hello world",
  );
  assertEquals(
    await client.fetch(["/subapi", "/age"], { age: 42 }),
    "You are 42 years old",
  );
  assertEquals(
    // @ts-expect-error
    await client.fetch(["/subapi", "/age"], { age: "old" }),
    "Invalid number param age",
  );
  assertEquals(
    // @ts-expect-error
    await client.fetch(["/subapi", "/age"], { name: "world" }),
    "Missing param age",
  );
  assertEquals(
    // @ts-expect-error
    await client.fetch(["/subapi", "/name"], { name: "world" }),
    "Not found",
  );
  assertEquals(
    // @ts-expect-error
    await client.fetch(["/say/hello", "/subpath"], { name: "world" }),
    "Not found",
  );
  assertEquals(
    // @ts-expect-error
    await client.fetch(["/subapi", "/age", "/subpath"], { age: 42 }),
    "Not found",
  );

  controller.abort();
  await server.finished;
});
