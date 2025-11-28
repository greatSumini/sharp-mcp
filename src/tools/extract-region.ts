import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { sessionStore } from "../services/session-store.js";
import { extractRegion } from "../services/image-processor.js";
import { validateSessionId, INVALID_SESSION_ERROR } from "../utils/validation.js";

const inputSchema = z.object({
  sessionId: z.string().describe("The session ID returned from create_session"),
  x: z.number().describe("X coordinate of the top-left corner of the crop region"),
  y: z.number().describe("Y coordinate of the top-left corner of the crop region"),
  width: z.number().describe("Width of the crop region"),
  height: z.number().describe("Height of the crop region"),
  output_path: z
    .string()
    .optional()
    .describe(
      "Optional absolute path to save the cropped image. If not provided, returns base64 payload."
    ),
});

type InputType = z.infer<typeof inputSchema>;

export function createExtractRegionTool() {
  return {
    name: "extract_region",
    description:
      "Extracts (crops) a rectangular region from an image. Returns the cropped image as a file or base64 payload.",
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

        const { x, y, width, height } = input;

        if (x < 0 || y < 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid coordinates: x and y must be non-negative values.`,
              },
            ],
            isError: true,
          };
        }

        if (width <= 0 || height <= 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid dimensions: width and height must be positive values.`,
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

        const result = await extractRegion(session.image_payload, x, y, width, height);

        if (input.output_path) {
          await fs.writeFile(input.output_path, result.buffer);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  path: input.output_path,
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
                base64: result.base64,
                mimeType: result.mimeType,
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
              text: `Error extracting region: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
