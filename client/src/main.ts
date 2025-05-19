import './style.css'
import { OnInit } from './mcp-client'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <h1>MCP Client</h1>
    <p class="read-the-docs">
      A test client for the MCP Server using OAuth2.
    </p>
    <div class="card">
      <button id="connect" type="button">Connect to MCP Server</button>
      <div id="divConnected" style="display: none;">
            <h2>Connected to MCP Server with OAuth2</h2>
            <button id="disconnect" type="button">Disconnect</button>
      </div>
      <br/>
      <br/>
      <div id="terminal"></div>
    </div>
  </div>
`

window.addEventListener('DOMContentLoaded', OnInit);

const terminal = document.getElementById("terminal")!;

function printToTerminal(type: 'log' | 'info' | 'warn' | 'error', message: string) {
  const div = document.createElement("div");
  div.className = type;
  div.textContent = message;
  terminal.appendChild(div);
  terminal.scrollTop = terminal.scrollHeight; // auto-scroll
}
['log', 'info', 'warn', 'error'].forEach((type) => {
  const original = console[type as keyof Console] as (...args: any[]) => void;

  console[type as keyof Console] = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(" ");

    printToTerminal(type as any, message);
    original(...args); // still call original
  };
});