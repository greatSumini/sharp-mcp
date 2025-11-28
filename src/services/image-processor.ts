import sharp from "sharp";
import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal-node";

export interface ImageMetadata {
  width: number;
  height: number;
  mimeType: string;
}

export interface ColorResult {
  r: number;
  g: number;
  b: number;
  hex: string;
}


export interface RemoveBackgroundResult {
  buffer: Buffer;
  base64: string;
  removedPixelCount: number;
}

const formatToMimeType: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  tiff: "image/tiff",
  avif: "image/avif",
};

function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  return Buffer.from(base64Data, "base64");
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => {
        const hex = Math.round(v).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
      .toUpperCase()
  );
}

export async function getImageMetadata(base64: string): Promise<ImageMetadata> {
  const buffer = base64ToBuffer(base64);
  const metadata = await sharp(buffer).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to determine image dimensions");
  }

  const mimeType = formatToMimeType[metadata.format || ""] || "image/jpeg";

  return {
    width: metadata.width,
    height: metadata.height,
    mimeType,
  };
}

export async function getAverageColor(
  base64: string,
  x: number,
  y: number,
  radius: number
): Promise<ColorResult> {
  const buffer = base64ToBuffer(base64);
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to determine image dimensions");
  }

  const left = Math.max(0, x - radius);
  const top = Math.max(0, y - radius);
  const right = Math.min(metadata.width - 1, x + radius);
  const bottom = Math.min(metadata.height - 1, y + radius);

  const extractWidth = right - left + 1;
  const extractHeight = bottom - top + 1;

  if (extractWidth <= 0 || extractHeight <= 0) {
    throw new Error(
      `Coordinates (${x}, ${y}) exceed image bounds (${metadata.width}x${metadata.height})`
    );
  }

  const { data, info } = await image
    .extract({
      left,
      top,
      width: extractWidth,
      height: extractHeight,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const pixelCount = extractWidth * extractHeight;

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (let i = 0; i < data.length; i += channels) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
  }

  const r = Math.round(totalR / pixelCount);
  const g = Math.round(totalG / pixelCount);
  const b = Math.round(totalB / pixelCount);

  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
  };
}

export interface ExtractRegionResult {
  buffer: Buffer;
  base64: string;
  mimeType: string;
}

export async function extractRegion(
  base64: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<ExtractRegionResult> {
  const buffer = base64ToBuffer(base64);
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to determine image dimensions");
  }

  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    throw new Error("Invalid region parameters: x, y must be non-negative and width, height must be positive");
  }

  if (x + width > metadata.width || y + height > metadata.height) {
    throw new Error(
      `Region (${x}, ${y}, ${width}x${height}) exceeds image bounds (${metadata.width}x${metadata.height})`
    );
  }

  const mimeType = formatToMimeType[metadata.format || ""] || "image/png";

  const resultBuffer = await image
    .extract({ left: x, top: y, width, height })
    .toBuffer();

  return {
    buffer: resultBuffer,
    base64: resultBuffer.toString("base64"),
    mimeType,
  };
}

export type CompressionFormat = "jpeg" | "png" | "webp";

export interface CompressionResult {
  buffer: Buffer;
  base64: string;
  mimeType: string;
  format: string;
  originalSize: number;
  compressedSize: number;
}

export async function compressImage(
  base64: string,
  format?: CompressionFormat,
  quality: number = 80
): Promise<CompressionResult> {
  const buffer = base64ToBuffer(base64);
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Unable to determine image dimensions");
  }

  // Determine output format: use specified format or keep original
  let outputFormat: CompressionFormat;
  if (format) {
    outputFormat = format;
  } else {
    // Map original format to supported compression format
    const originalFormat = metadata.format || "jpeg";
    if (originalFormat === "png") {
      outputFormat = "png";
    } else if (originalFormat === "webp") {
      outputFormat = "webp";
    } else {
      // Default to JPEG for unsupported formats (gif, tiff, avif, etc.)
      outputFormat = "jpeg";
    }
  }

  let resultBuffer: Buffer;

  switch (outputFormat) {
    case "jpeg":
      resultBuffer = await image.jpeg({ quality }).toBuffer();
      break;
    case "png": {
      // Convert quality (1-100) to compressionLevel (0-9)
      // quality 100 → compressionLevel 0 (minimum compression)
      // quality 0 → compressionLevel 9 (maximum compression)
      const compressionLevel = Math.round((100 - quality) / 100 * 9);
      resultBuffer = await image.png({ compressionLevel }).toBuffer();
      break;
    }
    case "webp":
      resultBuffer = await image.webp({ quality }).toBuffer();
      break;
    default:
      throw new Error(`Unsupported format: ${outputFormat}`);
  }

  const mimeType = formatToMimeType[outputFormat] || "image/jpeg";

  return {
    buffer: resultBuffer,
    base64: resultBuffer.toString("base64"),
    mimeType,
    format: outputFormat,
    originalSize: buffer.length,
    compressedSize: resultBuffer.length,
  };
}

export async function removeBackground(base64: string): Promise<RemoveBackgroundResult> {
  const buffer = base64ToBuffer(base64);

  // Detect MIME type using sharp
  const metadata = await sharp(buffer).metadata();
  const mimeType = formatToMimeType[metadata.format || ""] || "image/png";

  // Convert Buffer to Blob for @imgly/background-removal-node
  const blob = new Blob([buffer], { type: mimeType });

  const resultBlob = await imglyRemoveBackground(blob);
  const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());

  return {
    buffer: resultBuffer,
    base64: resultBuffer.toString("base64"),
    removedPixelCount: -1,
  };
}
