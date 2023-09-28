import { ConsoleHandler } from "https://deno.land/std@0.201.0/log/handlers.ts";
import { setup } from "https://deno.land/std@0.201.0/log/mod.ts";
import { Api, Endpoint } from "./server.ts";
import { Fetcher } from "./client.ts";
import { assertEquals } from "https://deno.land/std@0.195.0/assert/assert_equals.ts";

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
      "string",
      (param) => {
        return new Response(`Hello ${param}`);
      },
    ),
    "/age": new Endpoint(
      "number",
      (param) => {
        return new Response(`You are ${param} years old`);
      },
    ),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 1234, signal: controller.signal },
    api.serve,
  );
  const client = new Fetcher<typeof api["api"]>("http://localhost:1234");

  assertEquals(
    await client.fetch("/hello", "world"),
    "Hello world",
  );
  assertEquals(
    await client.fetch("/age", 42),
    "You are 42 years old",
  );
  assertEquals(
    // @ts-expect-error
    await client.fetch("/not-found", undefined),
    "Not found",
  );

  controller.abort();
  await server.finished;
});
