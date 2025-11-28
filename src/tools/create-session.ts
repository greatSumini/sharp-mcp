import { z } from "zod";
import { sessionStore } from "../services/session-store.js";

const inputSchema = z.object({
  image_payload: z.string().describe("Base64 encoded image data"),
  description: z.string().optional().describe("Optional description for the image"),
});

type InputType = z.infer<typeof inputSchema>;

export function createCreateSessionTool() {
  return {
    name: "create_session",
    description:
      "Creates a new session with the provided image payload. Returns a unique session ID that can be used with other image processing tools.",
    inputSchema,
    async handler(input: InputType) {
      try {
        const sessionId = sessionStore.create({
          image_payload: input.image_payload,
          description: input.description,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ sessionId }),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating session: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
