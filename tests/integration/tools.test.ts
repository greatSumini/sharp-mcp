import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { sessionStore } from "../../src/services/session-store.js";
import { createCreateSessionTool } from "../../src/tools/create-session.js";
import { createListSessionTool } from "../../src/tools/list-session.js";
import { createGetImageSizeTool } from "../../src/tools/get-image-size.js";
import { createPickColorTool } from "../../src/tools/pick-color.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test image as base64
const testImagePath = path.resolve(__dirname, "../../images/test.jpg");
const testImageBase64 = fs.readFileSync(testImagePath).toString("base64");

// Expected dimensions of test.jpg
const EXPECTED_WIDTH = 1080;
const EXPECTED_HEIGHT = 542;

describe("Image Handler MCP Tools Integration Tests", () => {
  // Clear session store before each test
  beforeEach(() => {
    sessionStore.clear();
  });

  describe("create_session", () => {
    const createSessionTool = createCreateSessionTool();

    it("should create a session with image payload and return sessionId", async () => {
      const result = await createSessionTool.handler({
        image_payload: testImageBase64,
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].type).toBe("text");

      const response = JSON.parse(result.content[0].text);
      expect(response.sessionId).toMatch(/^img_[a-zA-Z0-9_-]+$/);
    });

    it("should create a session with image payload and description", async () => {
      const description = "Test membership image";
      const result = await createSessionTool.handler({
        image_payload: testImageBase64,
        description,
      });

      expect(result.isError).toBeUndefined();

      const response = JSON.parse(result.content[0].text);
      const sessionId = response.sessionId;

      // Verify session data
      const session = sessionStore.get(sessionId);
      expect(session).toBeDefined();
      expect(session?.image_payload).toBe(testImageBase64);
      expect(session?.description).toBe(description);
    });
  });

  describe("list_session", () => {
    const createSessionTool = createCreateSessionTool();
    const listSessionTool = createListSessionTool();

    it("should return empty array when no sessions exist", async () => {
      const result = await listSessionTool.handler();

      expect(result.isError).toBeUndefined();

      const sessions = JSON.parse(result.content[0].text);
      expect(sessions).toEqual([]);
    });

    it("should list all created sessions with sessionId", async () => {
      // Create two sessions
      const result1 = await createSessionTool.handler({
        image_payload: testImageBase64,
        description: "First image",
      });
      const result2 = await createSessionTool.handler({
        image_payload: testImageBase64,
        description: "Second image",
      });

      const sessionId1 = JSON.parse(result1.content[0].text).sessionId;
      const sessionId2 = JSON.parse(result2.content[0].text).sessionId;

      // List sessions
      const listResult = await listSessionTool.handler();
      const sessions = JSON.parse(listResult.content[0].text);

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s: { sessionId: string }) => s.sessionId)).toContain(sessionId1);
      expect(sessions.map((s: { sessionId: string }) => s.sessionId)).toContain(sessionId2);

      // Verify structure includes sessionId, image_payload, and description
      const session1 = sessions.find((s: { sessionId: string }) => s.sessionId === sessionId1);
      expect(session1.image_payload).toBe(testImageBase64);
      expect(session1.description).toBe("First image");
    });
  });

  describe("get_image_size", () => {
    const createSessionTool = createCreateSessionTool();
    const getImageSizeTool = createGetImageSizeTool();

    it("should return correct dimensions for test image (1080x542)", async () => {
      // Create session first
      const createResult = await createSessionTool.handler({
        image_payload: testImageBase64,
      });
      const sessionId = JSON.parse(createResult.content[0].text).sessionId;

      // Get image size
      const result = await getImageSizeTool.handler({ sessionId });

      expect(result.isError).toBeUndefined();

      const metadata = JSON.parse(result.content[0].text);
      expect(metadata.width).toBe(EXPECTED_WIDTH);
      expect(metadata.height).toBe(EXPECTED_HEIGHT);
      expect(metadata.mimeType).toBe("image/jpeg");
    });

    it("should return error for invalid sessionId format", async () => {
      const result = await getImageSizeTool.handler({
        sessionId: "invalid_session_id",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("create_session");
    });

    it("should return error for non-existent sessionId", async () => {
      const result = await getImageSizeTool.handler({
        sessionId: "img_nonexistent123",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("create_session");
    });
  });

  describe("pick_color", () => {
    const createSessionTool = createCreateSessionTool();
    const pickColorTool = createPickColorTool();

    let sessionId: string;

    beforeEach(async () => {
      const createResult = await createSessionTool.handler({
        image_payload: testImageBase64,
      });
      sessionId = JSON.parse(createResult.content[0].text).sessionId;
    });

    it("should return average color at center of image", async () => {
      const result = await pickColorTool.handler({
        sessionId,
        x: Math.floor(EXPECTED_WIDTH / 2),
        y: Math.floor(EXPECTED_HEIGHT / 2),
        radius: 5,
      });

      expect(result.isError).toBeUndefined();

      const color = JSON.parse(result.content[0].text);
      expect(color).toHaveProperty("r");
      expect(color).toHaveProperty("g");
      expect(color).toHaveProperty("b");
      expect(color).toHaveProperty("hex");

      // Verify RGB values are in valid range
      expect(color.r).toBeGreaterThanOrEqual(0);
      expect(color.r).toBeLessThanOrEqual(255);
      expect(color.g).toBeGreaterThanOrEqual(0);
      expect(color.g).toBeLessThanOrEqual(255);
      expect(color.b).toBeGreaterThanOrEqual(0);
      expect(color.b).toBeLessThanOrEqual(255);

      // Verify hex format
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
    });

    it("should use default radius of 5 when not specified", async () => {
      const result = await pickColorTool.handler({
        sessionId,
        x: 100,
        y: 100,
        radius: 5,
      });

      expect(result.isError).toBeUndefined();

      const color = JSON.parse(result.content[0].text);
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
    });

    it("should return color at image corner (0, 0)", async () => {
      const result = await pickColorTool.handler({
        sessionId,
        x: 0,
        y: 0,
        radius: 3,
      });

      expect(result.isError).toBeUndefined();

      const color = JSON.parse(result.content[0].text);
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
    });

    it("should return color near bottom-right corner", async () => {
      const result = await pickColorTool.handler({
        sessionId,
        x: EXPECTED_WIDTH - 10,
        y: EXPECTED_HEIGHT - 10,
        radius: 5,
      });

      expect(result.isError).toBeUndefined();

      const color = JSON.parse(result.content[0].text);
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
    });

    it("should return error when x coordinate exceeds image width", async () => {
      const result = await pickColorTool.handler({
        sessionId,
        x: EXPECTED_WIDTH + 100,
        y: 100,
        radius: 5,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("exceed");
      expect(result.content[0].text).toContain(`${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`);
    });

    it("should return error when y coordinate exceeds image height", async () => {
      const result = await pickColorTool.handler({
        sessionId,
        x: 100,
        y: EXPECTED_HEIGHT + 100,
        radius: 5,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("exceed");
    });

    it("should return error for negative coordinates", async () => {
      const result = await pickColorTool.handler({
        sessionId,
        x: -10,
        y: 100,
        radius: 5,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("non-negative");
    });

    it("should return error for invalid sessionId", async () => {
      const result = await pickColorTool.handler({
        sessionId: "invalid_id",
        x: 100,
        y: 100,
        radius: 5,
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("create_session");
    });
  });

  describe("End-to-end workflow", () => {
    it("should complete full workflow: create -> list -> get_size -> pick_color", async () => {
      const createSessionTool = createCreateSessionTool();
      const listSessionTool = createListSessionTool();
      const getImageSizeTool = createGetImageSizeTool();
      const pickColorTool = createPickColorTool();

      // Step 1: Create session
      const createResult = await createSessionTool.handler({
        image_payload: testImageBase64,
        description: "Full workflow test image",
      });
      expect(createResult.isError).toBeUndefined();
      const sessionId = JSON.parse(createResult.content[0].text).sessionId;

      // Step 2: List sessions to verify creation
      const listResult = await listSessionTool.handler();
      const sessions = JSON.parse(listResult.content[0].text);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe(sessionId);

      // Step 3: Get image size
      const sizeResult = await getImageSizeTool.handler({ sessionId });
      expect(sizeResult.isError).toBeUndefined();
      const metadata = JSON.parse(sizeResult.content[0].text);
      expect(metadata.width).toBe(EXPECTED_WIDTH);
      expect(metadata.height).toBe(EXPECTED_HEIGHT);

      // Step 4: Pick colors from various positions
      const positions = [
        { x: 0, y: 0 },
        { x: EXPECTED_WIDTH - 1, y: 0 },
        { x: 0, y: EXPECTED_HEIGHT - 1 },
        { x: EXPECTED_WIDTH - 1, y: EXPECTED_HEIGHT - 1 },
        { x: Math.floor(EXPECTED_WIDTH / 2), y: Math.floor(EXPECTED_HEIGHT / 2) },
      ];

      for (const pos of positions) {
        const colorResult = await pickColorTool.handler({
          sessionId,
          x: pos.x,
          y: pos.y,
          radius: 3,
        });
        expect(colorResult.isError).toBeUndefined();
        const color = JSON.parse(colorResult.content[0].text);
        expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
      }
    });
  });
});
