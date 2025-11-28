import { z } from "zod";
import { sessionStore } from "../services/session-store.js";
import { getImageMetadata } from "../services/image-processor.js";
import { validateSessionId, INVALID_SESSION_ERROR } from "../utils/validation.js";

const inputSchema = z.object({
  sessionId: z.string().describe("The session ID returned from create_session"),
});

type InputType = z.infer<typeof inputSchema>;

export function createGetImageSizeTool() {
  return {
    name: "get_dimensions",
    description:
      "Gets the dimensions and MIME type of an image stored in a session. Returns width, height, and mimeType.",
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

        const metadata = await getImageMetadata(session.image_payload);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(metadata),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting image size: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
