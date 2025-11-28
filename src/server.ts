#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "http";
import { Command } from "commander";
import { createCreateSessionTool } from "./tools/create-session.js";
import { createListSessionTool } from "./tools/list-session.js";
import { createGetImageSizeTool } from "./tools/get-image-size.js";
import { createPickColorTool } from "./tools/pick-color.js";

/** Default HTTP server port */
const DEFAULT_PORT = 5000;

// Parse CLI arguments using commander
const program = new Command()
  .option("--transport <stdio|http>", "transport type", "stdio")
  .option("--port <number>", "port for HTTP transport", DEFAULT_PORT.toString())
  .allowUnknownOption()
  .parse(process.argv);

const cliOptions = program.opts<{
  transport: string;
  port: string;
}>();

// Validate transport option
const allowedTransports = ["stdio", "http"];
if (!allowedTransports.includes(cliOptions.transport)) {
  console.error(
    `Invalid --transport value: '${cliOptions.transport}'. Must be one of: stdio, http.`
  );
  process.exit(1);
}

// Transport configuration
const TRANSPORT_TYPE = (cliOptions.transport || "stdio") as "stdio" | "http";

// Disallow incompatible flags based on transport
const passedPortFlag = process.argv.includes("--port");

if (TRANSPORT_TYPE === "stdio" && passedPortFlag) {
  console.error("The --port flag is not allowed when using --transport stdio.");
  process.exit(1);
}

// HTTP port configuration
const CLI_PORT = (() => {
  const parsed = parseInt(cliOptions.port, 10);
  return isNaN(parsed) ? undefined : parsed;
})();

// Function to create a new server instance with all tools registered
function createServerInstance() {
  const server = new McpServer({
    name: "image-handler-mcp",
    version: "0.0.0",
  });

  // Create and register tools
  const createSessionTool = createCreateSessionTool();
  const listSessionTool = createListSessionTool();
  const getImageSizeTool = createGetImageSizeTool();
  const pickColorTool = createPickColorTool();

  server.registerTool(
    createSessionTool.name,
    {
      title: "Create Session",
      description: createSessionTool.description,
      inputSchema: createSessionTool.inputSchema.shape,
      outputSchema: undefined,
    },
    createSessionTool.handler
  );

  server.registerTool(
    listSessionTool.name,
    {
      title: "List Session",
      description: listSessionTool.description,
      inputSchema: listSessionTool.inputSchema.shape,
      outputSchema: undefined,
    },
    listSessionTool.handler
  );

  server.registerTool(
    getImageSizeTool.name,
    {
      title: "Get Image Size",
      description: getImageSizeTool.description,
      inputSchema: getImageSizeTool.inputSchema.shape,
      outputSchema: undefined,
    },
    getImageSizeTool.handler
  );

  server.registerTool(
    pickColorTool.name,
    {
      title: "Pick Color",
      description: pickColorTool.description,
      inputSchema: pickColorTool.inputSchema.shape,
      outputSchema: undefined,
    },
    pickColorTool.handler
  );

  return server;
}

async function main() {
  const transportType = TRANSPORT_TYPE;

  if (transportType === "http") {
    // Get initial port from environment or use default
    const initialPort = CLI_PORT ?? DEFAULT_PORT;
    let actualPort = initialPort;

    // Set up HTTP server
    const httpServer = createServer(async (req, res) => {
      const pathname = new URL(req.url || "/", "http://localhost").pathname;

      try {
        if (pathname === "/mcp" && req.method === "POST") {
          // Create new server instance for each request
          const requestServer = createServerInstance();

          // Create a new transport for each request to prevent request ID collisions
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
          });

          res.on("close", () => {
            transport.close();
            requestServer.close();
          });

          await requestServer.connect(transport);
          await transport.handleRequest(req, res);
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found", status: 404 }));
        }
      } catch (error) {
        console.error("Error handling request:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Server Error", status: 500 }));
        }
      }
    });

    // Function to attempt server listen with port fallback
    const startServer = (port: number, maxAttempts = 10) => {
      httpServer.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && port < initialPort + maxAttempts) {
          console.warn(`Port ${port} is in use, trying port ${port + 1}...`);
          startServer(port + 1, maxAttempts);
        } else {
          console.error(`Failed to start server: ${err.message}`);
          process.exit(1);
        }
      });

      httpServer.listen(port, () => {
        actualPort = port;
        console.error(
          `Image Handler MCP Server running on ${transportType.toUpperCase()} at http://localhost:${actualPort}/mcp`
        );
      });
    };

    // Start the server with initial port
    startServer(initialPort);
  } else {
    // Stdio transport
    const server = createServerInstance();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`Image Handler MCP Server running on stdio`);
  }
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
