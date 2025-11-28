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

// Background removal types
interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RemoveBackgroundOptions {
  tolerance: number;
  edgeFeathering: number;
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

// ============================================
// Background Removal Functions
// ============================================

function getPixelColor(
  data: Buffer,
  x: number,
  y: number,
  width: number,
  channels: number
): RGB {
  const idx = (y * width + x) * channels;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

function colorDistance(c1: RGB, c2: RGB): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isColorSimilar(c1: RGB, c2: RGB, tolerance: number): boolean {
  return colorDistance(c1, c2) <= tolerance;
}

function sampleEdgeColors(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  sampleInterval: number = 15
): RGB[] {
  const samples: RGB[] = [];

  // Top edge
  for (let x = 0; x < width; x += sampleInterval) {
    samples.push(getPixelColor(data, x, 0, width, channels));
  }
  // Bottom edge
  for (let x = 0; x < width; x += sampleInterval) {
    samples.push(getPixelColor(data, x, height - 1, width, channels));
  }
  // Left edge
  for (let y = 0; y < height; y += sampleInterval) {
    samples.push(getPixelColor(data, 0, y, width, channels));
  }
  // Right edge
  for (let y = 0; y < height; y += sampleInterval) {
    samples.push(getPixelColor(data, width - 1, y, width, channels));
  }

  return samples;
}

function calculateBackgroundColor(samples: RGB[]): { color: RGB; variance: number } {
  if (samples.length === 0) {
    return { color: { r: 255, g: 255, b: 255 }, variance: 0 };
  }

  const avgR = samples.reduce((sum, p) => sum + p.r, 0) / samples.length;
  const avgG = samples.reduce((sum, p) => sum + p.g, 0) / samples.length;
  const avgB = samples.reduce((sum, p) => sum + p.b, 0) / samples.length;

  const variance =
    samples.reduce((sum, p) => {
      const dr = p.r - avgR;
      const dg = p.g - avgG;
      const db = p.b - avgB;
      return sum + Math.sqrt(dr * dr + dg * dg + db * db);
    }, 0) / samples.length;

  return {
    color: { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) },
    variance,
  };
}

function calculateAdaptiveTolerance(baseTolerance: number, variance: number): number {
  const scaleFactor = 1 + variance / 50;
  return Math.min(baseTolerance * scaleFactor, 100);
}

function computeEdgeMask(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): Uint8Array {
  const edgeMask = new Uint8Array(width * height);

  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      let ki = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * channels;
          const intensity = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          gx += intensity * sobelX[ki];
          gy += intensity * sobelY[ki];
          ki++;
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edgeMask[y * width + x] = magnitude > 30 ? 255 : 0;
    }
  }

  return edgeMask;
}

function floodFillBackground(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  backgroundColor: RGB,
  tolerance: number,
  edgeMask: Uint8Array
): { mask: Uint8Array; removedCount: number } {
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  let removedCount = 0;

  const stack: Array<{ x: number; y: number }> = [];

  // Seed from all edges where color matches background
  for (let x = 0; x < width; x++) {
    if (isColorSimilar(getPixelColor(data, x, 0, width, channels), backgroundColor, tolerance)) {
      stack.push({ x, y: 0 });
    }
    if (
      isColorSimilar(
        getPixelColor(data, x, height - 1, width, channels),
        backgroundColor,
        tolerance
      )
    ) {
      stack.push({ x, y: height - 1 });
    }
  }
  for (let y = 0; y < height; y++) {
    if (isColorSimilar(getPixelColor(data, 0, y, width, channels), backgroundColor, tolerance)) {
      stack.push({ x: 0, y });
    }
    if (
      isColorSimilar(
        getPixelColor(data, width - 1, y, width, channels),
        backgroundColor,
        tolerance
      )
    ) {
      stack.push({ x: width - 1, y });
    }
  }

  while (stack.length > 0) {
    const { x, y } = stack.pop()!;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = y * width + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    // Skip edge pixels to protect subject boundaries
    if (edgeMask[idx] > 128) continue;

    const pixel = getPixelColor(data, x, y, width, channels);
    if (isColorSimilar(pixel, backgroundColor, tolerance)) {
      mask[idx] = 255;
      removedCount++;

      // Add 4-connected neighbors
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }
  }

  return { mask, removedCount };
}

function isBoundaryPixel(
  mask: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  const idx = y * width + x;
  const current = mask[idx];

  // Check 4 neighbors for different values
  if (x > 0 && mask[idx - 1] !== current) return true;
  if (x < width - 1 && mask[idx + 1] !== current) return true;
  if (y > 0 && mask[idx - width] !== current) return true;
  if (y < height - 1 && mask[idx + width] !== current) return true;

  return false;
}

function createGaussianKernel(radius: number): number[] {
  const size = radius * 2 + 1;
  const kernel = new Array(size * size);
  const sigma = radius / 2;
  let sum = 0;

  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      kernel[(y + radius) * size + (x + radius)] = value;
      sum += value;
    }
  }

  // Normalize
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

function applyEdgeFeathering(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  if (radius === 0) return mask;

  const featheredMask = new Uint8Array(mask.length);
  const kernelSize = radius * 2 + 1;
  const kernel = createGaussianKernel(radius);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      if (isBoundaryPixel(mask, x, y, width, height)) {
        let sum = 0;
        let weightSum = 0;

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = x + kx;
            const ny = y + ky;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const weight = kernel[(ky + radius) * kernelSize + (kx + radius)];
              sum += mask[ny * width + nx] * weight;
              weightSum += weight;
            }
          }
        }

        featheredMask[idx] = Math.round(sum / weightSum);
      } else {
        featheredMask[idx] = mask[idx];
      }
    }
  }

  return featheredMask;
}

export async function removeBackground(
  base64: string,
  options: RemoveBackgroundOptions
): Promise<RemoveBackgroundResult> {
  const buffer = base64ToBuffer(base64);

  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels; // Should be 4 (RGBA)

  // Step 1: Sample edge colors
  const edgeSamples = sampleEdgeColors(data, width, height, channels);

  // Step 2: Calculate background color and variance
  const { color: backgroundColor, variance } = calculateBackgroundColor(edgeSamples);

  // Step 3: Calculate adaptive tolerance
  const adaptiveTolerance = calculateAdaptiveTolerance(options.tolerance, variance);

  // Step 4: Compute Sobel edge mask to protect subject boundaries
  const edgeMask = computeEdgeMask(data, width, height, channels);

  // Step 5: Flood fill to create background mask
  const { mask, removedCount } = floodFillBackground(
    data,
    width,
    height,
    channels,
    backgroundColor,
    adaptiveTolerance,
    edgeMask
  );

  // Step 6: Apply edge feathering for smooth transitions
  const featheredMask = applyEdgeFeathering(mask, width, height, options.edgeFeathering);

  // Step 7: Apply mask to alpha channel
  const outputData = Buffer.from(data);
  for (let i = 0; i < width * height; i++) {
    outputData[i * channels + 3] = 255 - featheredMask[i];
  }

  // Step 8: Convert to PNG
  const resultBuffer = await sharp(outputData, {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();

  return {
    buffer: resultBuffer,
    base64: resultBuffer.toString("base64"),
    removedPixelCount: removedCount,
  };
}
