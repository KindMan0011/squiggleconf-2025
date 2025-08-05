import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  Position,
  Range,
  Hover,
  MarkupContent,
  MarkupKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';

// Create a connection for the server
const connection = createConnection(ProposedFeatures.all);

// Create a document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Example Squiggle language keywords
const KEYWORDS = [
  'squiggle', 'draw', 'line', 'curve', 'color', 'width',
  'style', 'dotted', 'dashed', 'solid', 'arrow', 'label',
  'connect', 'point', 'group', 'layer', 'export'
];

// Documentation for keywords
const KEYWORD_DOCS: Record<string, string> = {
  'squiggle': 'Define a new squiggle drawing',
  'draw': 'Draw a shape or path',
  'line': 'Create a straight line',
  'curve': 'Create a curved line',
  'color': 'Set the color for drawing elements',
  'width': 'Set the width of lines',
  'style': 'Set the style of lines',
  'dotted': 'Use a dotted line style',
  'dashed': 'Use a dashed line style',
  'solid': 'Use a solid line style',
  'arrow': 'Add an arrow to the end of a line',
  'label': 'Add text label to an element',
  'connect': 'Connect two points or elements',
  'point': 'Define a point with x,y coordinates',
  'group': 'Group multiple elements together',
  'layer': 'Create a new drawing layer',
  'export': 'Export the drawing to various formats'
};

connection.onInitialize((params: InitializeParams) => {
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Enable completion support
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.', ' ']
      },
      // Enable hover support
      hoverProvider: true,
      // We could add more capabilities like:
      // - documentSymbolProvider
      // - definitionProvider
      // - referencesProvider
      // - etc.
    }
  };
  
  return result;
});

// Initialize
connection.onInitialized(() => {
  connection.console.log('Squiggle Language Server initialized!');
});

// Provide diagnostics for a document
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  const diagnostics: Diagnostic[] = [];
  
  // Simple pattern to check for unclosed squiggle blocks
  const openSquiggles = (text.match(/squiggle\s+\w+\s*\{/g) || []).length;
  const closeSquiggles = (text.match(/\}/g) || []).length;
  
  if (openSquiggles > closeSquiggles) {
    // Find the position of the last squiggle
    const lastSquiggleMatch = /squiggle\s+\w+\s*\{/g.exec(text);
    if (lastSquiggleMatch && lastSquiggleMatch.index !== undefined) {
      const start = textDocument.positionAt(lastSquiggleMatch.index);
      const end = textDocument.positionAt(lastSquiggleMatch.index + lastSquiggleMatch[0].length);
      
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start,
          end
        },
        message: `Unclosed squiggle block. Expected '}'.`,
        source: 'squiggle-lsp'
      });
    }
  }
  
  // Check for unknown keywords
  const wordRegex = /\b(\w+)\b/g;
  let match: RegExpExecArray | null;
  
  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[1];
    // Skip numbers
    if (/^\d+$/.test(word)) continue;
    
    // Check if it's a variable declaration
    const isVarDeclaration = /let\s+(\w+)/.exec(text.slice(Math.max(0, match.index - 5), match.index + word.length + 1));
    if (isVarDeclaration && isVarDeclaration[1] === word) continue;
    
    // Check if the word is not a keyword and not following certain patterns
    if (!KEYWORDS.includes(word) && 
        !/^[xy]\d*$/.test(word) && // Allow x1, y2, etc. as coordinates
        !/(let|const|var|function)/.test(word) && // Allow JavaScript keywords
        !/^[A-Z][A-Za-z]+$/.test(word)) { // Allow PascalCase names for types
      
      const start = textDocument.positionAt(match.index);
      const end = textDocument.positionAt(match.index + word.length);
      
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start,
          end
        },
        message: `Unknown Squiggle keyword: '${word}'.`,
        source: 'squiggle-lsp'
      });
    }
  }
  
  // Send the diagnostics to the client
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Listen for document changes
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

// Handle completion requests
connection.onCompletion(
  (params: TextDocumentPositionParams): CompletionItem[] => {
    // Get the document and position
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return [];
    }
    
    // Get the word at position
    const text = document.getText();
    const position = params.position;
    const offset = document.offsetAt(position);
    
    // Simple prefix detection
    let start = offset - 1;
    while (start >= 0 && /[\w]/.test(text.charAt(start))) {
      start--;
    }
    start++;
    
    const prefix = text.substring(start, offset).toLowerCase();
    
    // Filter keywords by prefix
    return KEYWORDS
      .filter(keyword => keyword.startsWith(prefix))
      .map(keyword => ({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        detail: KEYWORD_DOCS[keyword] || '',
        data: { keyword }
      }));
  }
);

// Handle completion item resolve
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    // Add more details to the completion item
    if (item.data?.keyword && KEYWORD_DOCS[item.data.keyword]) {
      item.documentation = {
        kind: MarkupKind.Markdown,
        value: [
          '```squiggle',
          `${item.data.keyword}`,
          '```',
          '',
          KEYWORD_DOCS[item.data.keyword]
        ].join('\n')
      };
    }
    return item;
  }
);

// Handle hover requests
connection.onHover(
  (params: TextDocumentPositionParams): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }
    
    // Get the word at position
    const text = document.getText();
    const position = params.position;
    const offset = document.offsetAt(position);
    
    // Find the word at the position
    let start = offset;
    while (start > 0 && /[\w]/.test(text.charAt(start - 1))) {
      start--;
    }
    
    let end = offset;
    while (end < text.length && /[\w]/.test(text.charAt(end))) {
      end++;
    }
    
    const word = text.substring(start, end);
    
    // Check if it's a keyword
    if (KEYWORDS.includes(word)) {
      const range: Range = {
        start: document.positionAt(start),
        end: document.positionAt(end)
      };
      
      const contents: MarkupContent = {
        kind: MarkupKind.Markdown,
        value: [
          '```squiggle',
          `${word}`,
          '```',
          '',
          KEYWORD_DOCS[word] || 'No documentation available'
        ].join('\n')
      };
      
      return { contents, range };
    }
    
    return null;
  }
);

// Listen for document opens
documents.onDidOpen(event => {
  connection.console.log(`Document opened: ${event.document.uri}`);
  validateTextDocument(event.document);
});

// Listen for document closes
documents.onDidClose(event => {
  connection.console.log(`Document closed: ${event.document.uri}`);
});

// Register the document manager
documents.listen(connection);

// Start the server
connection.listen();
