#!/usr/bin/env node

/**
 * Tool Version Check for SquiggleConf 2025
 * 
 * This script checks the versions of common development tools
 * used in web development tooling.
 */

const { execSync } = require('child_process');
const util = require('util');
const fs = require('fs');

// Tools to check
const tools = [
  { name: 'Node.js', command: 'node --version' },
  { name: 'npm', command: 'npm --version' },
  { name: 'TypeScript', command: 'tsc --version' },
  { name: 'Babel', command: 'npx @babel/cli --version' },
  { name: 'ESLint', command: 'npx eslint --version' },
  { name: 'Prettier', command: 'npx prettier --version' },
  { name: 'Vite', command: 'npx vite --version' },
  { name: 'Rollup', command: 'npx rollup --version' },
  { name: 'webpack', command: 'npx webpack --version' },
  { name: 'Rust', command: 'rustc --version' },
  { name: 'Go', command: 'go version' },
  { name: 'wasm-pack', command: 'wasm-pack --version' },
  { name: 'Deno', command: 'deno --version' }
];

function formatOutput(title, content) {
  const separator = '='.repeat(title.length + 8);
  return `\n${separator}\n    ${title}    \n${separator}\n\n${content}\n`;
}

function checkTool(tool) {
  try {
    const output = execSync(tool.command, { encoding: 'utf8' }).trim();
    return { name: tool.name, version: output, available: true };
  } catch (error) {
    return { name: tool.name, version: null, available: false };
  }
}

// Main function to check all tools
function checkAllTools() {
  console.log(formatOutput('SquiggleConf 2025 Tool Version Check', ''));
  
  let markdownOutput = '# Tool Version Check\n\n';
  markdownOutput += '| Tool | Version | Available |\n';
  markdownOutput += '|------|---------|----------|\n';
  
  const results = tools.map(tool => {
    const result = checkTool(tool);
    
    // Output to console
    if (result.available) {
      console.log(`✅ ${result.name}: ${result.version}`);
    } else {
      console.log(`❌ ${result.name}: Not available`);
    }
    
    // Add to markdown output
    markdownOutput += `| ${result.name} | ${result.available ? result.version : 'N/A'} | ${result.available ? '✓' : '✗'} |\n`;
    
    return result;
  });
  
  // Save results to markdown file
  fs.writeFileSync('../diagrams/tool-versions.md', markdownOutput);
  
  // Summary
  const available = results.filter(r => r.available).length;
  const total = tools.length;
  
  console.log(formatOutput('Summary', `${available}/${total} tools available`));
  
  if (available < total) {
    console.log('Missing tools:');
    results
      .filter(r => !r.available)
      .forEach(tool => {
        console.log(`- ${tool.name}`);
      });
  }
  
  console.log('\nDetailed report saved to ../diagrams/tool-versions.md');
}

// Run the check
checkAllTools();
