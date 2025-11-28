import { z } from "zod";
import * as fs from "fs/promises";
import sharp from "sharp";
import { sessionStore } from "../services/session-store.js";
import { validateAbsolutePath } from "../utils/validation.js";

const inputSchema = z.object({
  path: z.string().describe("Absolute path to the image file"),
  description: z.string().optional().describe("Optional description for the image"),
});

type InputType = z.infer<typeof inputSchema>;

export function createCreateSessionByPathTool() {
  return {
    name: "create_session_by_path",
    description:
      "Creates a new session by reading an image from the specified absolute file path. Returns a unique session ID that can be used with other image processing tools.",
    inputSchema,
    async handler(input: InputType) {
      try {
        // 1. Validate absolute path
        const pathValidation = validateAbsolutePath(input.path);
        if (!pathValidation.valid) {
          return {
            content: [
              {
                type: "text" as const,
                text: pathValidation.error!,
              },
            ],
            isError: true,
          };
        }

        // 2. Check file existence and read permission
        try {
          await fs.access(input.path, fs.constants.R_OK);
        } catch (accessError) {
          const nodeError = accessError as NodeJS.ErrnoException;
          if (nodeError.code === "ENOENT") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `File not found: "${input.path}"`,
                },
              ],
              isError: true,
            };
          }
          if (nodeError.code === "EACCES") {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Permission denied: Cannot read file "${input.path}"`,
                },
              ],
              isError: true,
            };
          }
          throw accessError;
        }

        // 3. Read file
        let fileBuffer: Buffer;
        try {
          fileBuffer = await fs.readFile(input.path);
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: `Failed to read file: "${input.path}"`,
              },
            ],
            isError: true,
          };
        }

        // 4. Check empty file
        if (fileBuffer.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `File is empty: "${input.path}"`,
              },
            ],
            isError: true,
          };
        }

        // 5. Validate image with sharp
        try {
          const metadata = await sharp(fileBuffer).metadata();
          if (!metadata.width || !metadata.height) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Invalid or corrupted image file: "${input.path}"`,
                },
              ],
              isError: true,
            };
          }
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid or corrupted image file: "${input.path}"`,
              },
            ],
            isError: true,
          };
        }

        // 6. Convert to base64
        const base64Payload = fileBuffer.toString("base64");

        // 7. Create session
        const sessionId = sessionStore.create({
          image_payload: base64Payload,
          description: input.description,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                sessionId,
                source_path: input.path,
                file_size: fileBuffer.length,
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
              text: `Error creating session from path: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
