import * as path from 'path';
import { ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
  // The server is implemented in Node
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'server.js')
  );
  
  // Server debug options
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };
  
  // Server options
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };
  
  // Client options
  const clientOptions: LanguageClientOptions = {
    // Register the server for Squiggle documents
    documentSelector: [{ scheme: 'file', language: 'squiggle' }],
    synchronize: {
      // Notify the server about file changes
      fileEvents: workspace.createFileSystemWatcher('**/.squigglerc')
    }
  };
  
  // Create and start the client
  client = new LanguageClient(
    'squiggleLsp',
    'Squiggle Language Server',
    serverOptions,
    clientOptions
  );
  
  // Start the client and server
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
