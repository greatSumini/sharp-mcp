import { z } from "zod";
import { sessionStore } from "../services/session-store.js";

const inputSchema = z.object({});

export function createListSessionTool() {
  return {
    name: "list_session",
    description:
      "Lists all active sessions with their session IDs, image payloads, and descriptions.",
    inputSchema,
    async handler() {
      try {
        const sessions = sessionStore.getAll();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(sessions),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing sessions: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
