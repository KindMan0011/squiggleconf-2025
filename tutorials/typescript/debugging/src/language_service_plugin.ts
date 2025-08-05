import * as ts from 'typescript/lib/tsserverlibrary';

// This would typically be in a separate .d.ts file
declare module 'typescript/lib/tsserverlibrary' {
  interface PluginModule {
    create(info: ts.server.PluginCreateInfo): ts.LanguageService;
    getExternalFiles?(project: ts.server.ConfiguredProject): string[];
  }
}

function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
  const typescript = modules.typescript;
  
  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    // Get the existing language service
    const languageService = info.languageService;
    const proxy = Object.create(null);
    
    // Proxy most methods directly
    for (const k of Object.keys(languageService)) {
      (proxy as any)[k] = function() {
        return (languageService as any)[k].apply(languageService, arguments);
      };
    }
    
    // Override getCompletionsAtPosition to add custom completions
    proxy.getCompletionsAtPosition = function(
      fileName: string,
      position: number,
      options: ts.GetCompletionsAtPositionOptions
    ): ts.WithMetadata<ts.CompletionInfo> | undefined {
      // Get original completions
      const original = languageService.getCompletionsAtPosition(fileName, position, options);
      
      if (!original) {
        return original;
      }

      // Add custom completions
      const customCompletions: ts.CompletionEntry[] = [
        {
          name: 'customLog',
          kind: typescript.ScriptElementKind.functionElement,
          sortText: '0',
          insertText: 'customLog(\'DEBUG\', $1)$0',
          isSnippet: true,
          source: 'Custom Plugin',
          labelDetails: { description: 'Custom logging function' }
        }
      ];
      
      // Combine original with custom completions
      original.entries = [...original.entries, ...customCompletions];
      
      return original;
    };
    
    return proxy;
  }
  
  return { create };
}

// Example of how to register (in tsconfig.json):
/*
{
  "compilerOptions": {
    "plugins": [
      { "name": "my-custom-language-service-plugin" }
    ]
  }
}
*/

// In a real plugin, this would be exported:
// export = init;

// For this tutorial, let's log how this would be used:
console.log(`
To use a language service plugin:

1. Create a package that exports the init function
2. Install the package in your project
3. Configure in tsconfig.json:
   {
     "compilerOptions": {
       "plugins": [
         { "name": "my-custom-language-service-plugin" }
       ]
     }
   }
4. The plugin will enhance the TypeScript language service in your IDE
`);
