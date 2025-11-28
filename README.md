# Image Handler MCP

![Image Handler MCP Banner](./images/banner.png)

[![npm version](https://badge.fury.io/js/image-handler-mcp.svg)](https://www.npmjs.com/package/image-handler-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

MCP (Model Context Protocol) server for image session management and processing. Provides tools for storing images in sessions and extracting image metadata and colors.

## Features

![Image Processing Workflow](./images/workflow.png)

- **create_session**: Store base64 images in memory sessions with unique IDs
- **list_session**: List all active image sessions
- **get_image_size**: Get image dimensions and MIME type
- **pick_color**: Extract average color from a specified region
- Built with TypeScript for type safety
- Uses [sharp](https://sharp.pixelplumbing.com/) for high-performance image processing

## Installation

### NPM

```bash
npm install -g image-handler-mcp
```

### Smithery

To install Image Handler MCP for any client automatically via [Smithery](https://smithery.ai):

```bash
npx -y @smithery/cli@latest install image-handler-mcp --client <CLIENT_NAME>
```

Available clients: `cursor`, `claude`, `vscode`, `windsurf`, `cline`, `zed`, etc.

## MCP Client Integration

Image Handler MCP can be integrated with various AI coding assistants and IDEs that support the Model Context Protocol (MCP).

### Requirements

- Node.js >= v18.0.0
- An MCP-compatible client (Cursor, Claude Code, VS Code, Windsurf, etc.)

<details>
<summary><b>Install in Cursor</b></summary>

Go to: `Settings` -> `Cursor Settings` -> `MCP` -> `Add new global MCP server`

Add the following configuration to your `~/.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "image-handler": {
      "command": "npx",
      "args": ["-y", "image-handler-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Claude Code</b></summary>

Run this command:

```sh
claude mcp add image-handler -- npx -y image-handler-mcp
```

</details>

<details>
<summary><b>Install in VS Code</b></summary>

Add this to your VS Code MCP config file. See [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) for more info.

```json
"mcp": {
  "servers": {
    "image-handler": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "image-handler-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Windsurf</b></summary>

Add this to your Windsurf MCP config file:

```json
{
  "mcpServers": {
    "image-handler": {
      "command": "npx",
      "args": ["-y", "image-handler-mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Install in Claude Desktop</b></summary>

Open Claude Desktop developer settings and edit your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "image-handler": {
      "command": "npx",
      "args": ["-y", "image-handler-mcp"]
    }
  }
}
```

</details>

## Available Tools

### create_session

Creates a new session with the provided image payload and returns a unique session ID.

**Parameters:**

- `image_payload` (string, required): Base64 encoded image data
- `description` (string, optional): Optional description for the image

**Returns:**

```json
{ "sessionId": "img_abc123xyz" }
```

**Example:**

```json
{
  "image_payload": "iVBORw0KGgoAAAANSUhEUgAA...",
  "description": "Screenshot of the homepage"
}
```

### list_session

Lists all active sessions with their session IDs, image payloads, and descriptions.

**Parameters:** None

**Returns:**

```json
[
  {
    "sessionId": "img_abc123xyz",
    "image_payload": "iVBORw0KGgoAAAANSUhEUgAA...",
    "description": "Screenshot of the homepage"
  }
]
```

### get_image_size

Gets the dimensions and MIME type of an image stored in a session.

**Parameters:**

- `sessionId` (string, required): The session ID returned from create_session

**Returns:**

```json
{
  "width": 1920,
  "height": 1080,
  "mimeType": "image/png"
}
```

**Error Response (invalid session):**

```
Invalid or non-existent session ID. Please call create_session first to obtain a valid session ID.
```

### pick_color

Picks the average color from a square region centered at the specified coordinates.

**Parameters:**

- `sessionId` (string, required): The session ID returned from create_session
- `x` (number, required): X coordinate of the center point
- `y` (number, required): Y coordinate of the center point
- `radius` (number, optional, default: 5): Radius of the sampling area. The sampling area will be a square of (radius × 2) size.

**Returns:**

```json
{
  "r": 255,
  "g": 128,
  "b": 64,
  "hex": "#FF8040"
}
```

**Error Response (out of bounds):**

```
Coordinates (2000, 500) exceed image bounds (1920x1080).
```

## Usage Examples

### Example 1: Analyze an image

**In Cursor/Claude Code:**

```
Read the screenshot at ./screenshot.png, create a session with it,
and tell me its dimensions.
```

### Example 2: Extract colors from UI

**In Cursor/Claude Code:**

```
I have a UI screenshot. Create a session with it and pick the colors
at these coordinates: (100, 50), (200, 150), (300, 200).
```

### Example 3: Get image metadata

**In Cursor/Claude Code:**

```
Load ./logo.png into a session and get its size and format.
```

## Command Line Usage

Run the server directly:

```bash
# Using stdio transport (default)
image-handler-mcp

# Using HTTP transport
image-handler-mcp --transport http --port 5000
```

**CLI Options:**

- `--transport <stdio|http>`: Transport type (default: stdio)
- `--port <number>`: Port for HTTP transport (default: 5000)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Architecture

![Architecture Diagram](./images/architecture.png)

The project follows a modular architecture:

- **services/**: Session storage and image processing services
  - `session-store.ts`: In-memory session management
  - `image-processor.ts`: Sharp-based image analysis
- **tools/**: MCP tool implementations
  - `create-session.ts`: Session creation
  - `list-session.ts`: Session listing
  - `get-image-size.ts`: Image metadata extraction
  - `pick-color.ts`: Color extraction
- **utils/**: Shared utilities
  - `validation.ts`: Session ID validation
- **server.ts**: Main MCP server setup and configuration

## Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- TIFF (.tiff)
- AVIF (.avif)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

choesumin
