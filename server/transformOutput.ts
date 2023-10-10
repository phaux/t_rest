import { Output } from "../common/Handler.ts";
import { initFormData } from "../common/initFormData.ts";

/**
 * Transforms {@link Output} into a {@link Response}.
 */
export function transformOutput(output: Output): Response {
  switch (output.body.type) {
    case "text/plain": {
      return new Response(output.body.data, {
        status: output.status,
      });
    }

    case "application/json": {
      return new Response(JSON.stringify(output.body.data), {
        status: output.status,
        headers: { "content-type": "application/json" },
      });
    }

    case "multipart/form-data": {
      return new Response(initFormData(output.body.data), {
        status: output.status,
      });
    }

    default: {
      if (
        output.body.type === "application/octet-stream" ||
        output.body.type.startsWith("image/") ||
        output.body.type.startsWith("audio/") ||
        output.body.type.startsWith("video/")
      ) {
        return new Response(output.body.data, {
          status: output.status,
          headers: { "content-type": output.body.type },
        });
      }

      throw new Error(
        `Unknown response body type ${output.body["type"]}`,
      );
    }
  }
}
