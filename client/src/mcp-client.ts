import {
    ListToolsResultSchema,
    CallToolResultSchema,
    ListPromptsResultSchema,
    GetPromptResultSchema,
    ListResourcesResultSchema,
    LoggingMessageNotificationSchema,
    ResourceListChangedNotificationSchema,
    ReadResourceResultSchema,
    type CallToolRequest,
    type ListToolsRequest,
    type ListPromptsRequest,
    type GetPromptRequest,
    type ListResourcesRequest,
    type ReadResourceRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCPOAuthClientProvider } from './mcp-oauth-provider.js';


// Global client and transport for interactive commands
let client: Client | null = null;
let transport: StreamableHTTPClientTransport | null = null;
let serverUrl = 'http://localhost:3002/mcp';
let notificationsToolLastEventId: string | undefined = undefined;

export async function OnInit() {
    const connectButton = document.getElementById('connect') as HTMLButtonElement;
    const divConnected = document.getElementById('divConnected')!;
    const tokens = sessionStorage.getItem('mcp_tokens');

    if (!tokens) {
        divConnected.style.display = 'none';
        handleOAuthCallback();
        connectButton.addEventListener('click', async () => {
            await connect();
        });
    } else {
        connectButton.style.display = 'none';
        divConnected.style.display = '';

        const disconnect = document.getElementById('disconnect') as HTMLButtonElement;
        disconnect.addEventListener('click', async () => {
            await disconnectMCP();
        });
        const tokenJson = tokens ? JSON.parse(tokens) : null;
        if (tokenJson) {
            await runMCPCalls();
        }
    }
}

async function disconnectMCP() {
    await cleanup();
    sessionStorage.clear();
    window.location.reload();
}


async function handleOAuthCallback() {
    const url = new URL(window.location.href);
    // Check if path is /callback and 'code' is present
    if (url.pathname === '/callback' && url.searchParams.has('code')) {
        const code = url.searchParams.get('code');
        console.log('OAuth Code:', code);
        transport = new StreamableHTTPClientTransport(
            new URL(serverUrl),
            {
                authProvider: new MCPOAuthClientProvider(serverUrl)
            }
        );
        await transport.finishAuth(code!);
        window.location.href = "/";
    }

}

async function runMCPCalls() {


    await connect();
    await listTools();
    await listPrompts();
    await listResources();

    await callTool('add', { a: 10, b: 20 });
    await callTool('echo', { message: "From mcp client" });
    await callTool('calculate-bmi', { weightKg: 70, heightM: 50 });

    await readResources('greeting://paramesh');
    await readResources('echo://paramesh');
    await getPrompt('echo', { message: 'hello' });

    await cleanup();
}

async function connect(url?: string): Promise<void> {
    if (client) {
        console.log('Already connected. Disconnect first.');
        return;
    }

    if (url) {
        serverUrl = url;
    }

    console.log(`Connecting to ${serverUrl}...`);

    try {
        // Create a new client
        client = new Client({
            name: 'example-client',
            version: '1.0.0'
        });
        client.onerror = (error) => {
            console.error('\x1b[31mClient error:', error, '\x1b[0m');
        }

        transport = new StreamableHTTPClientTransport(
            new URL(serverUrl),
            {
                authProvider: new MCPOAuthClientProvider(serverUrl)
            }
        );

        // Set up notification handlers
        client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
            console.log(`\nNotification received: ${notification}`);
        });

        client.setNotificationHandler(ResourceListChangedNotificationSchema, async (_) => {
            console.log(`\nResource list changed notification received!`);
        });

        // Connect the client
        await client.connect(transport);
        console.log('Connected to MCP server');
    } catch (error) {
        console.error('Failed to connect:', error);
        client = null;
        transport = null;
    }
}

async function listTools(): Promise<void> {
    if (!client) {
        console.log('Not connected to server.');
        return;
    }

    try {
        const toolsRequest: ListToolsRequest = {
            method: 'tools/list',
            params: {}
        };
        const toolsResult = await client.request(toolsRequest, ListToolsResultSchema);

        console.log('Available tools:');
        if (toolsResult.tools.length === 0) {
            console.log('  No tools available');
        } else {
            for (const tool of toolsResult.tools) {
                console.log(`  - ${tool.name}: ${tool.description}`);
            }
        }
    } catch (error) {
        console.log(`Tools not supported by this server (${error})`);
    }
}

async function callTool(name: string, args: Record<string, unknown>): Promise<void> {
    if (!client) {
        console.log('Not connected to server.');
        return;
    }

    try {
        const request: CallToolRequest = {
            method: 'tools/call',
            params: {
                name,
                arguments: args
            }
        };

        console.log(`Calling tool '${name}' with args:`, args);
        const onLastEventIdUpdate = (event: string) => {
            notificationsToolLastEventId = event;
        };
        const result = await client.request(request, CallToolResultSchema, {
            resumptionToken: notificationsToolLastEventId, onresumptiontoken: onLastEventIdUpdate
        });

        result.content.forEach(item => {
            if (item.type === 'text') {
                console.log(`Tool result: ${item.text}`);
            } else {
                console.log(`Tool result: ${item.type} content:`, item);
            }
        });
    } catch (error) {
        console.log(`Error calling tool ${name}: ${error}`);
    }
}

async function listPrompts(): Promise<void> {
    if (!client) {
        console.log('Not connected to server.');
        return;
    }

    try {
        const promptsRequest: ListPromptsRequest = {
            method: 'prompts/list',
            params: {}
        };
        const promptsResult = await client.request(promptsRequest, ListPromptsResultSchema);
        console.log('Available prompts:');
        if (promptsResult.prompts.length === 0) {
            console.log('  No prompts available');
        } else {
            for (const prompt of promptsResult.prompts) {
                console.log(`  - ${prompt.name}: ${prompt.description}`);
            }
        }
    } catch (error) {
        console.log(`Prompts not supported by this server (${error})`);
    }
}

async function getPrompt(name: string, args: Record<string, unknown>): Promise<void> {
    if (!client) {
        console.log('Not connected to server.');
        return;
    }

    try {
        const promptRequest: GetPromptRequest = {
            method: 'prompts/get',
            params: {
                name,
                arguments: args as Record<string, string>
            }
        };

        const promptResult = await client.request(promptRequest, GetPromptResultSchema);
        console.log('Prompt template:');
        promptResult.messages.forEach((msg, index) => {
            console.log(`  [${index + 1}] ${msg.role}: ${JSON.stringify(msg.content)}`);
        });
    } catch (error) {
        console.log(`Error getting prompt ${name}: ${error}`);
    }
}

async function listResources(): Promise<void> {
    if (!client) {
        console.log('Not connected to server.');
        return;
    }

    try {
        const resourcesRequest: ListResourcesRequest = {
            method: 'resources/list',
            params: {}
        };
        const resourcesResult = await client.request(resourcesRequest, ListResourcesResultSchema);

        console.log('Available resources:');
        if (resourcesResult.resources.length === 0) {
            console.log('  No resources available');
        } else {
            for (const resource of resourcesResult.resources) {
                console.log(`  - ${resource.name}: ${resource.uri}`);
            }
        }
    } catch (error) {
        console.log(`Resources not supported by this server (${error})`);
    }
}

async function readResources(resource: string): Promise<void> {
    if (!client) {
        console.log('Not connected to server.');
        return;
    }

    try {
        const readRequest: ReadResourceRequest = {
            method: 'resources/read',
            params: {
                uri: resource
            }
        };
        const resourceResult = await client.request(readRequest, ReadResourceResultSchema);

        console.log('Available resources:');
        if (!resourceResult) {
            console.log('  No resource available');
        } else {
            console.log(`  - ${JSON.stringify(resourceResult.contents)}`);
        }
    } catch (error) {
        console.log(`Resources not supported by this server (${error})`);
    }
}

async function cleanup(): Promise<void> {
    if (client && transport) {
        try {
            await transport.close();
        } catch (error) {
            console.error('Error closing transport:', error);
        }
    }
    console.log('\nGoodbye!');
}
