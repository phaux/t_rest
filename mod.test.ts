// deno-lint-ignore-file require-await

import { assertEquals } from "https://deno.land/std@0.195.0/assert/assert_equals.ts";
import { delay } from "https://deno.land/std@0.203.0/async/delay.ts";
import { createFetcher } from "./client/createFetcher.ts";
import {
  createEndpoint,
  createLoggerMiddleware,
  createMethodFilter,
  createPathFilter,
} from "./server/mod.ts";

const assertType = <T>(_: T) => {};

Deno.test("simple request", async () => {
  const serveApi = createLoggerMiddleware(createPathFilter({
    "": createMethodFilter({
      GET: createEndpoint(
        { body: undefined, query: undefined },
        async () => ({
          status: 200,
          body: { type: "text/plain", data: "Welcome" },
        } as const),
      ),
    }),
    "hello": createMethodFilter({
      GET: createEndpoint(
        { body: undefined, query: { name: { type: "string" } } },
        async ({ query }) => {
          assertType<{ name: string }>(query);
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
    "age": createMethodFilter({
      POST: createEndpoint(
        { body: null, query: { age: { type: "number" } } },
        async ({ query }) => {
          assertType<{ age: number }>(query);
          return {
            status: 201,
            body: {
              type: "application/json",
              data: { message: `You are ${query.age} years old` },
            },
          };
        },
      ),
    }),
  }));
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8123, signal: controller.signal },
    serveApi,
  );
  const fetchApi = createFetcher<typeof serveApi>({
    baseUrl: "http://localhost:8123",
  });
  await delay(100);
  {
    const rootResp = await fetchApi("", "GET", {
      body: undefined,
      query: undefined,
    });
    assertType<200 | 400 | 500>(rootResp.status);
    assertType<string>(rootResp.body.data);
    assertEquals(rootResp, {
      status: 200,
      body: { type: "text/plain", data: "Welcome" },
    });
  }
  {
    const helloResp = await fetchApi("hello", "GET", {
      body: undefined,
      query: { name: "world" },
    });
    assertType<200 | 400 | 500>(helloResp.status);
    assertType<string>(helloResp.body.data);
    assertEquals(
      helloResp,
      { status: 200, body: { type: "text/plain", data: "Hello world" } },
    );
  }
  {
    const ageResp = await fetchApi("age", "POST", {
      query: { age: 42 },
    });
    assertType<201 | 400 | 500>(ageResp.status);
    if (ageResp.status === 201) {
      assertType<{ message: string }>(ageResp.body.data);
    }
    assertEquals(
      ageResp,
      {
        status: 201,
        body: {
          type: "application/json",
          data: { message: "You are 42 years old" },
        },
      },
    );
  }
  assertEquals(
    // @ts-expect-error - invalid path - extra slash
    await fetchApi("hello/", "GET", {
      query: { name: "foo" },
    }),
    // extra slash still matches
    {
      status: 200,
      body: { type: "text/plain", data: "Hello foo" },
    },
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await fetchApi("hellooo", "GET", {
      query: { name: "world" },
    }),
    {
      status: 404,
      body: {
        type: "text/plain",
        data: "Not found",
      },
    } as never,
  );
  assertEquals(
    // @ts-expect-error - invalid method
    await fetchApi("age", "GET", {
      body: undefined,
      query: { age: 42 },
    }),
    {
      status: 405,
      body: {
        type: "text/plain",
        data: "Method not allowed",
      },
    } as never,
  );
  assertEquals(
    await fetchApi("age", "POST", {
      // @ts-expect-error - invalid param type
      query: { age: "old" },
    }),
    {
      status: 400,
      body: {
        type: "text/plain",
        data: "Bad request: Invalid query: Expected param age to be a number",
      },
    } as never,
  );
  controller.abort();
  await server.finished;
});

Deno.test("subapi request", async () => {
  const serveApi = createPathFilter({
    "say/hello": createMethodFilter({
      GET: createEndpoint(
        { query: { name: { type: "string" } }, body: null },
        async ({ query }) => {
          assertType<{ name: string }>(query);
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
    "subapi": createPathFilter({
      "": createMethodFilter({
        GET: createEndpoint(
          { query: null, body: null },
          async () => ({
            status: 200,
            body: {
              type: "text/plain",
              data: "Welcome to sub API",
            },
          }),
        ),
      }),
      "age": createMethodFilter({
        POST: createEndpoint(
          { query: { age: { type: "integer" } }, body: null },
          async ({ query }) => {
            assertType<{ age: number }>(query);
            return {
              status: 200,
              body: {
                type: "application/json",
                data: `You are ${query.age} years old`,
              },
            };
          },
        ),
      }),
    }),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8125, signal: controller.signal },
    serveApi,
  );
  const fetchApi = createFetcher<typeof serveApi>({
    baseUrl: "http://localhost:8125/",
  });
  await delay(100);
  assertEquals(
    await fetchApi("subapi", "GET", {}),
    {
      status: 200,
      body: { type: "text/plain", data: "Welcome to sub API" },
    },
  );
  assertEquals(
    await fetchApi("say/hello", "GET", {
      query: { name: "world" },
    }),
    { status: 200, body: { type: "text/plain", data: "Hello world" } },
  );
  assertEquals(
    await fetchApi("subapi/age", "POST", {
      query: { age: 42 },
    }),
    {
      status: 200,
      body: { type: "application/json", data: "You are 42 years old" },
    },
  );
  assertEquals(
    await fetchApi("subapi/age", "POST", {
      query: { age: Infinity },
    }),
    {
      status: 400,
      body: {
        type: "text/plain",
        data: "Bad request: Invalid query: Expected param age to be an integer",
      },
    },
  );
  assertEquals(
    await fetchApi("subapi/age", "POST", {
      // @ts-expect-error - missing param
      query: { name: "world" },
    }),
    {
      status: 400,
      body: {
        type: "text/plain",
        data: "Bad request: Invalid query: Missing param age",
      },
    } as never,
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await fetchApi("subapi/name", "GET", {
      query: { name: "world" },
    }),
    {
      status: 404,
      body: {
        type: "text/plain",
        data: "Not found",
      },
    } as never,
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await fetchApi("say/hello/subpath", "PUT", {}),
    {
      status: 404,
      body: {
        type: "text/plain",
        data: "Not found",
      },
    } as never,
  );
  assertEquals(
    // @ts-expect-error - invalid path
    await fetchApi("subapi/age/subpath", "PATCH", {}),
    {
      status: 404,
      body: {
        type: "text/plain",
        data: "Not found",
      },
    } as never,
  );

  controller.abort();
  await server.finished;
});

Deno.test("request with body", async () => {
  const serveApi = createPathFilter({
    "hello": createMethodFilter({
      POST: createEndpoint(
        {
          query: null,
          body: {
            type: "text/plain",
          },
        },
        async ({ body }) => {
          assertType<string>(body.data);
          return {
            status: 201,
            body: {
              type: "text/plain",
              data: `Hello ${body.data}`,
            },
          };
        },
      ),
      PUT: createEndpoint(
        {
          query: null,
          body: {
            type: "application/json",
            schema: {
              type: "object",
              properties: {
                name: { type: ["string", "number"] },
                stats: {
                  type: ["object", "null"],
                  additionalProperties: { type: "number" },
                },
              },
              required: ["name"],
            },
          },
        },
        async ({ body }) => {
          assertType<string | number>(body.data.name);
          assertType<Record<string, number> | undefined | null>(
            body.data.stats,
          );
          return {
            status: 200,
            body: {
              type: "application/json",
              // TODO: undefined values in JSON become null but are still undefined in types
              data: ["Hello", body.data.name, "!", body.data.stats ?? null],
            },
          };
        },
      ),
    }),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8126, signal: controller.signal },
    serveApi,
  );
  const fetchApi = createFetcher<typeof serveApi>({
    baseUrl: new URL("http://localhost:8126/"),
  });
  await delay(100);
  assertEquals(
    await fetchApi("hello", "POST", {
      body: { type: "text/plain", data: "world" },
    }),
    { status: 201, body: { type: "text/plain", data: "Hello world" } },
  );
  assertEquals(
    await fetchApi("hello", "PUT", {
      body: { type: "application/json", data: { name: "world" } },
    }),
    {
      status: 200,
      body: {
        type: "application/json",
        data: ["Hello", "world", "!", null],
      },
    },
  );
  assertEquals(
    await fetchApi("hello", "PUT", {
      body: {
        type: "application/json",
        data: { name: "world", stats: { hp: 100, mp: 50 } },
      },
    }),
    {
      status: 200,
      body: {
        type: "application/json",
        data: ["Hello", "world", "!", { hp: 100, mp: 50 }],
      },
    },
  );
  assertEquals(
    // @ts-expect-error - invalid method
    await fetchApi("hello", "PATCH", {
      type: "application/json",
      body: { name: "world" },
    }),
    {
      status: 405,
      body: {
        type: "text/plain",
        data: "Method not allowed",
      },
    } as never,
  );
  assertEquals(
    await fetchApi("hello", "PUT", {
      body: {
        type: "application/json",
        // @ts-expect-error - invalid body
        data: { name: true },
      },
    }),
    {
      status: 400,
      body: {
        type: "text/plain",
        data:
          "Bad request: Invalid body: Invalid JSON: Expected name to be string|number but got boolean",
      },
    } as never,
  );
  controller.abort();
  await server.finished;
});

Deno.test("bad api definition is type error", async () => {
  const _serveApi = createMethodFilter({
    // @ts-expect-error - GET can't have a body
    GET: createEndpoint(
      { query: null, body: { type: "text/plain" } },
      async () => ({
        status: 200,
        body: { type: "text/plain", data: "Hello" },
      }),
    ),
    // @ts-expect-error - DELETE can't have a body
    DELETE: createEndpoint(
      { query: null, body: { type: "text/plain" } },
      async () => ({
        status: 200,
        body: { type: "text/plain", data: "Hello" },
      }),
    ),
  });
  const _serve2 = createMethodFilter({
    // @ts-expect-error - invalid method
    FOO: createEndpoint(
      { query: null, body: null },
      async () => ({
        status: 200,
        body: { type: "text/plain", data: "Hello" },
      }),
    ),
  });
});

Deno.test("on exception receives 500", async () => {
  const serveApi = createPathFilter({
    "": createMethodFilter({
      GET: createEndpoint(
        { body: null, query: null },
        async () => {
          throw new Error("oops");
        },
      ),
    }),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8127, signal: controller.signal },
    serveApi,
  );
  const fetchApi = createFetcher<typeof serveApi>({
    baseUrl: "http://localhost:8127/",
  });
  await delay(100);
  assertEquals(
    await fetchApi("", "GET", {}),
    {
      status: 500,
      body: {
        type: "text/plain",
        data: "Internal Server Error",
      },
    },
  );
  controller.abort();
  await server.finished;
});

Deno.test("can return custom error", async () => {
  const serveApi = createPathFilter({
    "login": createMethodFilter({
      POST: createEndpoint(
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
          if (
            body.data.username === "admin" && body.data.password === "admin"
          ) {
            return {
              status: 200,
              body: {
                type: "application/json",
                data: { session: "qwerty12345" },
              },
            };
          }
          return {
            status: 401,
            body: {
              type: "text/plain",
              data: "Unauthorized",
            },
          };
        },
      ),
    }),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8128, signal: controller.signal },
    serveApi,
  );
  const fetchApi = createFetcher<typeof serveApi>({
    baseUrl: "http://localhost:8128/",
  });
  await delay(100);
  {
    const badLoginResp = await fetchApi("login", "POST", {
      body: {
        type: "application/json",
        data: { username: "admin", password: "wrong" },
      },
    });
    assertType<200 | 400 | 401 | 500>(badLoginResp.status);
    assertType<"text/plain" | "application/json">(badLoginResp.body.type);
    if (badLoginResp.status === 200) {
      assertType<"application/json">(badLoginResp.body.type);
      assertType<{ session: string }>(badLoginResp.body.data);
    }
    if (badLoginResp.status === 401) {
      assertType<"text/plain">(badLoginResp.body.type);
      assertType<string>(badLoginResp.body.data);
    }
    assertEquals(
      badLoginResp,
      {
        status: 401,
        body: { type: "text/plain", data: "Unauthorized" },
      },
    );
  }
  controller.abort();
  await server.finished;
});

Deno.test("form data request", async () => {
  const serveApi = createPathFilter({
    "": createMethodFilter({
      POST: createEndpoint(
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
          assertType<string>(body.data.name);
          assertType<number>(body.data.age);
          assertType<Blob>(body.data.photo);
          assertType<{ tags: string[] }>(body.data.metadata);
          return {
            status: 200,
            body: {
              type: "application/json",
              data: {
                message:
                  `Hello ${body.data.name}, you are ${body.data.age} years old`,
                photoSize: body.data.photo.size,
                photoType: body.data.photo.type,
                tagsCount: body.data.metadata.tags.length,
              },
            },
          } as const;
        },
      ),
    }),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8129, signal: controller.signal },
    serveApi,
  );
  const fetchApi = createFetcher<typeof serveApi>({
    baseUrl: "http://localhost:8129/",
  });
  await delay(100);
  assertEquals(
    await fetchApi("", "POST", {
      body: {
        type: "multipart/form-data",
        data: {
          name: "John",
          age: 42,
          metadata: {
            tags: ["tag1", "tag2"],
          },
          photo: new File([new Uint8Array(1024)], "photo.jpg"),
        },
      },
    }),
    {
      status: 200,
      body: {
        type: "application/json",
        data: {
          message: "Hello John, you are 42 years old",
          photoSize: 1024,
          photoType: "application/octet-stream",
          tagsCount: 2,
        },
      },
    },
  );
  assertEquals(
    await fetchApi("", "POST", {
      body: {
        type: "multipart/form-data",
        data: {
          name: "John",
          age: 42,
          // @ts-expect-error - param tags is required
          metadata: {},
          photo: new File([new Uint8Array(1024)], "photo.jpg"),
        },
      },
    }),
    {
      status: 400,
      body: {
        type: "text/plain",
        data:
          "Bad request: Invalid body: Invalid form data: Invalid JSON in field metadata: Missing required property tags",
      },
    },
  );
  controller.abort();
  await server.finished;
});

Deno.test("takes path params", async () => {
  const serveApi = createPathFilter({
    "users/{userId}": createPathFilter({
      "": createMethodFilter({
        "GET": createEndpoint(
          { query: null, body: null },
          async ({ params }) => {
            // assertType<{ userId: string }>(params);
            return {
              status: 200,
              body: {
                type: "text/plain",
                data: `User ${params.userId}`,
              },
            };
          },
        ),
      }),
      "{postId}": createMethodFilter({
        GET: createEndpoint(
          { query: null, body: null },
          async ({ params }) => {
            return {
              status: 200,
              body: {
                type: "text/plain",
                data: `User ${params.userId} post ${params.postId}`,
              },
            };
          },
        ),
      }),
    }),
  });
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 8145, signal: controller.signal },
    serveApi,
  );
  const fetchApi = createFetcher<typeof serveApi>({
    baseUrl: "http://localhost:8145/",
  });
  await delay(100);
  assertEquals(
    await fetchApi("users/{userId}", "GET", {
      params: { userId: "!?/@#$%^&*(),.;''|{}[]-=+" },
    }),
    {
      status: 200,
      body: {
        type: "text/plain",
        data: "User !?/@#$%^&*(),.;''|{}[]-=+",
      },
    },
  );
  assertEquals(
    await fetchApi("users/{userId}/{postId}", "GET", {
      params: { userId: "john", postId: "1" },
    }),
    {
      status: 200,
      body: {
        type: "text/plain",
        data: "User john post 1",
      },
    },
  );
  assertEquals(
    await fetchApi("users/{userId}/{postId}", "GET", {
      params: { userId: "", postId: "1" },
    }),
    {
      status: 200,
      body: {
        type: "text/plain",
        data: "User  post 1",
      },
    },
  );
  assertEquals(
    await fetchApi("users/{userId}/{postId}", "GET", {
      params: { userId: "", postId: "" },
    }),
    // empty postId actually matches the root endpoint
    {
      status: 200,
      body: {
        type: "text/plain",
        data: "User ",
      },
    },
  );
  assertEquals(
    await fetchApi("users/{userId}/{postId}", "GET", {
      // @ts-expect-error - missing param
      params: { postId: "123" },
    }),
    {
      status: 200,
      body: {
        type: "text/plain",
        data: "User {userId} post 123",
      },
    },
  );
  controller.abort();
  await server.finished;
});
