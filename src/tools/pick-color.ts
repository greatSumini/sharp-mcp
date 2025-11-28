import { z } from "zod";
import { sessionStore } from "../services/session-store.js";
import { getAverageColor, getImageMetadata } from "../services/image-processor.js";
import { validateSessionId, INVALID_SESSION_ERROR } from "../utils/validation.js";

const inputSchema = z.object({
  sessionId: z.string().describe("The session ID returned from create_session"),
  x: z.number().describe("X coordinate of the center point"),
  y: z.number().describe("Y coordinate of the center point"),
  radius: z
    .number()
    .optional()
    .default(5)
    .describe("Radius of the sampling area (default: 5). The sampling area will be a square of (radius * 2) size."),
});

type InputType = z.infer<typeof inputSchema>;

export function createPickColorTool() {
  return {
    name: "pick_color",
    description:
      "Picks the average color from a square region centered at the specified coordinates. Returns RGB values and hex color code.",
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

        const { x, y, radius } = input;

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

        const metadata = await getImageMetadata(session.image_payload);

        if (x >= metadata.width || y >= metadata.height) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Coordinates (${x}, ${y}) exceed image bounds (${metadata.width}x${metadata.height}).`,
              },
            ],
            isError: true,
          };
        }

        const color = await getAverageColor(session.image_payload, x, y, radius);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(color),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error picking color: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
