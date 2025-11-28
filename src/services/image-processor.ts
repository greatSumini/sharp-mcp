import sharp from "sharp";

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
