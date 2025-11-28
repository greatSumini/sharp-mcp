#!/usr/bin/env node

/**
 * Manual test script for ML-based background removal.
 * Run after build: node scripts/test-remove-background.js
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  const { createRemoveBackgroundTool } = await import(
    "../dist/tools/remove-background.js"
  );
  const { createCreateSessionTool } = await import(
    "../dist/tools/create-session.js"
  );

  const testImagePath = path.resolve(__dirname, "../images/test.jpg");
  const testImageBase64 = fs.readFileSync(testImagePath).toString("base64");

  console.log("Testing ML-based background removal...\n");

  // Create session
  const createSessionTool = createCreateSessionTool();
  const createResult = await createSessionTool.handler({
    image_payload: testImageBase64,
  });
  const sessionId = JSON.parse(createResult.content[0].text).sessionId;
  console.log("✓ Session created:", sessionId);

  // Test 1: Remove background and return base64
  console.log("\nTest 1: Remove background (base64 output)...");
  const removeBackgroundTool = createRemoveBackgroundTool();
  const result1 = await removeBackgroundTool.handler({ sessionId });

  if (result1.isError) {
    console.error("✗ Test 1 failed:", result1.content[0].text);
    process.exit(1);
  }

  const response1 = JSON.parse(result1.content[0].text);
  if (!response1.image_payload || response1.mime_type !== "image/png") {
    console.error("✗ Test 1 failed: Invalid response structure");
    process.exit(1);
  }
  console.log("✓ Test 1 passed: Base64 PNG output received");
  console.log("  Output size:", response1.image_payload.length, "bytes");

  // Test 2: Remove background and save to file
  console.log("\nTest 2: Remove background (file output)...");
  const tempDir = path.resolve(__dirname, "../temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const outputPath = path.resolve(tempDir, "test-output.png");

  const result2 = await removeBackgroundTool.handler({
    sessionId,
    output_path: outputPath,
  });

  if (result2.isError) {
    console.error("✗ Test 2 failed:", result2.content[0].text);
    process.exit(1);
  }

  const response2 = JSON.parse(result2.content[0].text);
  if (response2.path !== outputPath || !fs.existsSync(outputPath)) {
    console.error("✗ Test 2 failed: File not saved correctly");
    process.exit(1);
  }

  const fileSize = fs.statSync(outputPath).size;
  console.log("✓ Test 2 passed: File saved to", outputPath);
  console.log("  File size:", fileSize, "bytes");

  // Cleanup
  fs.unlinkSync(outputPath);

  console.log("\n✓ All tests passed!");
}

test().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
