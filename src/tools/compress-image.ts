import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { sessionStore } from "../services/session-store.js";
import { compressImage, CompressionFormat } from "../services/image-processor.js";
import { validateSessionId, INVALID_SESSION_ERROR } from "../utils/validation.js";

const inputSchema = z.object({
  sessionId: z.string().describe("The session ID returned from create_session"),
  format: z
    .enum(["jpeg", "png", "webp"])
    .optional()
    .describe(
      "Output format: 'jpeg', 'png', or 'webp'. If not specified, keeps the original format."
    ),
  quality: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe(
      "Compression quality (1-100). Higher values mean better quality but larger file size. Default is 80."
    ),
  output_path: z
    .string()
    .optional()
    .describe(
      "Optional absolute path to save the compressed image. If not provided, returns base64 payload."
    ),
});

type InputType = z.infer<typeof inputSchema>;

export function createCompressImageTool() {
  return {
    name: "compress_image",
    description:
      "Compresses an image with specified format and quality. Supports JPEG, PNG, and WebP formats. Returns the compressed image as a file or base64 payload.",
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

        const quality = input.quality ?? 80;

        const result = await compressImage(
          session.image_payload,
          input.format as CompressionFormat | undefined,
          quality
        );

        const compressionRatio = (
          ((result.originalSize - result.compressedSize) / result.originalSize) *
          100
        ).toFixed(2);

        if (input.output_path) {
          await fs.writeFile(input.output_path, result.buffer);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: true,
                  path: input.output_path,
                  format: result.format,
                  originalSize: result.originalSize,
                  compressedSize: result.compressedSize,
                  compressionRatio: `${compressionRatio}%`,
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
                format: result.format,
                originalSize: result.originalSize,
                compressedSize: result.compressedSize,
                compressionRatio: `${compressionRatio}%`,
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
              text: `Error compressing image: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    },
  };
}
