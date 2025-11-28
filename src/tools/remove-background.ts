import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { sessionStore } from "../services/session-store.js";
import { removeBackground } from "../services/image-processor.js";
import { validateSessionId, INVALID_SESSION_ERROR } from "../utils/validation.js";

const inputSchema = z.object({
  sessionId: z.string().describe("The session ID returned from create_session"),
  output_path: z
    .string()
    .optional()
    .describe(
      "Optional absolute path to save the output PNG file. If not provided, returns base64 payload."
    ),
});

type InputType = z.infer<typeof inputSchema>;

export function createRemoveBackgroundTool() {
  return {
    name: "remove_background",
    description:
      "Removes the background from an image using ML-based segmentation. Returns PNG with transparency. Powered by @imgly/background-removal-node for accurate subject detection.",
    inputSchema,
    async handler(input: InputType) {
      try {
        const validation = validateSessionId(input.sessionId);
        if (!validation.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: INVALID_SESSION_ERROR,
              },
            ],
            isError: true,
          };
        }

        const session = sessionStore.get(input.sessionId);
        if (!session) {
          return {
            content: [
              {
                type: "text" as const,
                text: INVALID_SESSION_ERROR,
              },
            ],
            isError: true,
          };
        }

        // Validate output_path if provided
        if (input.output_path) {
          if (!path.isAbsolute(input.output_path)) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "output_path must be an absolute path",
                },
              ],
              isError: true,
            };
          }

          const dir = path.dirname(input.output_path);
          try {
            await fs.access(dir);
          } catch {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Directory does not exist: ${dir}`,
                },
              ],
              isError: true,
            };
          }
        }

        const result = await removeBackground(session.image_payload);

        if (input.output_path) {
          await fs.writeFile(input.output_path, result.buffer);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  path: input.output_path,
                  removed_pixel_count: result.removedPixelCount,
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                image_payload: result.base64,
                mime_type: "image/png",
                removed_pixel_count: result.removedPixelCount,
              }),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error removing background: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
