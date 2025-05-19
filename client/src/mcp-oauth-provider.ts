import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { OAuthClientInformationSchema, OAuthTokensSchema, type OAuthClientInformation, type OAuthClientMetadata, type OAuthMetadata, type OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";



export class MCPOAuthClientProvider implements OAuthClientProvider {

    constructor(serverUrl: string) {
        sessionStorage.setItem("mcp_server_url", serverUrl);
    }

    get redirectUrl() {
        console.log("OAuth::redirectUrl called ");
        return window.location.origin + "/callback";
    }

    saveServerMetadata(metadata: OAuthMetadata) {
        console.log("OAuth::saveServerMetadata called ");
        sessionStorage.setItem('mcp_server_metadata', JSON.stringify(metadata));
    }

    getServerMetadata(): OAuthMetadata | null {
        console.log("OAuth::getServerMetadata called ");
        const metadata = sessionStorage.getItem('mcp_server_metadata');
        if (!metadata) {
            return null;
        }
        return JSON.parse(metadata);
    }

    get clientMetadata(): OAuthClientMetadata {
        console.log("OAuth::clientMetadata called ");
        return {
            redirect_uris: [this.redirectUrl],
            scope: "openid offline_access",
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            client_name: "MCP Server",
            client_uri: "http://localhost:5173",
        };
    }

    async clientInformation() {
        console.log("OAuth::clientInformation called ");

        const value = JSON.stringify({
            "client_id": "a9115d62-b211-4424-aeee-ed4623e266b9",
            // "client_secret": "2jgY6-6QGRI~ebdK313iWDa.A~",
        })

        // const value = sessionStorage.getItem('mcp_client_information');
        if (!value) {
            return undefined;
        }

        return await OAuthClientInformationSchema.parseAsync(JSON.parse(value));
    }

    saveClientInformation(clientInformation: OAuthClientInformation) {
        console.log("OAuth::saveClientInformation called ", clientInformation);
        sessionStorage.setItem('mcp_client_information', JSON.stringify(clientInformation));
    }

    async tokens() {
        console.log("OAuth::tokens called ");
        const tokens = sessionStorage.getItem('mcp_tokens');
        if (!tokens) {
            return undefined;
        }

        return await OAuthTokensSchema.parseAsync(JSON.parse(tokens));
    }

    saveTokens(tokens: OAuthTokens) {
        console.log("OAuth::saveTokens called ", tokens);
        sessionStorage.setItem('mcp_tokens', JSON.stringify(tokens));
    }

    redirectToAuthorization(authorizationUrl: URL) {
        console.log("OAuth::redirectToAuthorization called ", authorizationUrl.href);
        window.location.href = authorizationUrl.href + "&state=123456789";
    }

    saveCodeVerifier(codeVerifier: string) {
        console.log("OAuth::saveCodeVerifier called ", codeVerifier);
        sessionStorage.setItem('mcp_code_verifier', codeVerifier);
    }

    codeVerifier() {
        console.log("OAuth::codeVerifier called ");
        const verifier = sessionStorage.getItem('mcp_code_verifier');
        if (!verifier) {
            throw new Error("No code verifier saved for session");
        }

        return verifier;
    }

    clear() {
        console.log("OAuth::clear called ");
        sessionStorage.clear();
    }
}