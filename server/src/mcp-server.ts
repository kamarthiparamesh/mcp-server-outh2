import express, { Request, RequestHandler, Response } from "express";
import cors from 'cors';
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";

const app = express();
app.use(express.json());

// Allow requests frontend
app.use(cors({
    origin: '*',
    credentials: true
}));

const getServer = () => {
    const server = new McpServer({
        name: "mcp-oauth-server",
        version: "1.0.0"
    });

    server.resource(
        "echo",
        new ResourceTemplate("echo://{message}", {
            list: async () => {
                return {
                    resources: [
                        {
                            name: "echo",
                            uri: "echo://example",
                            description: "Echo resource example"
                        }
                    ]
                };
            }
        }),
        async (uri, { message }) => ({
            contents: [{
                uri: uri.href,
                text: `Resource echo: ${message}`
            }]
        })
    );

    server.resource(
        "greeting",
        new ResourceTemplate("greeting://{name}", {
            list: async () => {
                return {
                    resources: [
                        {
                            name: "echo",
                            uri: "greeting://example",
                            description: "Greeting resource example"
                        }
                    ]
                };
            }
        }),
        async (uri, { name }) => ({
            contents: [{
                uri: uri.href,
                text: `Resource greeting: Hello, ${name}!`
            }]
        })
    );

    server.tool("add",
        'Add two numbers',
        { a: z.number(), b: z.number() },
        async ({ a, b }) => ({
            content: [{ type: "text", text: String(a + b) }]
        })
    );

    server.tool(
        "echo",
        'echo a message',
        { message: z.string() },
        async ({ message }) => ({
            content: [{ type: "text", text: `Tool echo: ${message}` }]
        })
    );

    server.tool(
        "calculate-bmi",
        'Calculate BMI from weight and height',
        {
            weightKg: z.number(),
            heightM: z.number()
        },
        async ({ weightKg, heightM }) => ({
            content: [{
                type: "text",
                text: String(weightKg / (heightM * heightM))
            }]
        })
    );

    server.prompt(
        "echo",
        'echo a prompt message',
        { message: z.string() },
        ({ message }) => ({
            messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: `Please process this message: ${message}`
                }
            }]
        })
    );

    return server;
}

const server = getServer();

export const requireAuthToken: RequestHandler = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
        return;
    }

    next();
};

// Handle POST requests for client-to-server communication
app.post('/mcp', requireAuthToken, async (req, res) => {
    console.log('Received POST MCP request', req.body, req.headers);

    try {

        const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        res.on('close', () => {
            transport.close();
            server.close();
        });

        await server.connect(transport);

        await transport.handleRequest(req, res, req.body);

    } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                },
                id: null,
            });
        }
    }

});

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', requireAuthToken, async (req: Request, res: Response) => {
    console.log('Received GET MCP request', req.body, req.headers);
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Method not allowed."
        },
        id: null
    }));
});

// Handle DELETE requests for session termination
app.delete('/mcp', async (req: Request, res: Response) => {
    console.log('Received DELETE MCP request', req.headers);
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Method not allowed."
        },
        id: null
    }));
});

app.use(mcpAuthRouter({
    provider: new ProxyOAuthServerProvider({
        endpoints: {
            authorizationUrl: "https://801a212a-90b1-4463-bfb3-5235181d477d.apse1.login.affinidi.io/oauth2/auth",
            tokenUrl: "https://801a212a-90b1-4463-bfb3-5235181d477d.apse1.login.affinidi.io/oauth2/token",
            revocationUrl: "https://801a212a-90b1-4463-bfb3-5235181d477d.apse1.login.affinidi.io/oauth2/revoke",
        },

        verifyAccessToken: async (token) => {
            console.log("Verifying access token", token);
            return {
                token,
                clientId: "123",
                scopes: ["openid"],
            }
        },
        getClient: async (client_id) => {
            console.log("Getting client", client_id);
            return {
                client_id,
                // client_secret: "2jgY6-6QGRI~ebdK313iWDa.A~",
                scope: "openid offline_access",
                redirect_uris: ["http://localhost:5173/callback"],
            }
        }
    }),
    issuerUrl: new URL("https://801a212a-90b1-4463-bfb3-5235181d477d.apse1.login.affinidi.io"),
    baseUrl: new URL("http://localhost:3002"),
    serviceDocumentationUrl: new URL("https://801a212a-90b1-4463-bfb3-5235181d477d.apse1.login.affinidi.io"),
}))

// Start the server
const PORT = 3002;
app.listen(PORT, () => {
    console.log(`MCP Stateless Streamable HTTP Server listening on port ${PORT}`);
});