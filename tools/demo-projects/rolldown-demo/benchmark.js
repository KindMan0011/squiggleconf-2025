// Simple bundler benchmark for SquiggleConf 2025

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Bundlers to benchmark
const BUNDLERS = [
  { name: 'webpack', command: 'npx webpack', color: '\x1b[31m' },
  { name: 'rollup', command: 'npx rollup -c', color: '\x1b[32m' },
  { name: 'esbuild', command: 'npx esbuild src/index.js --bundle --outfile=dist/esbuild.js', color: '\x1b[34m' },
  { name: 'vite', command: 'npx vite build', color: '\x1b[35m' },
  // Uncomment to test rolldown when available
  // { name: 'rolldown', command: 'npx rolldown src/index.js --bundle --outfile=dist/rolldown.js', color: '\x1b[36m' },
];

// Reset color code
const RESET = '\x1b[0m';

// Test project sizes
const PROJECT_SIZES = [
  { name: 'small', components: 10, imports: 5 },
  { name: 'medium', components: 50, imports: 10 },
  { name: 'large', components: 200, imports: 20 },
];

// Create a test project with specified size
function createTestProject(size) {
  console.log(`Creating ${size.name} test project (${size.components} components)...`);
  
  // Create directories
  fs.mkdirSync('src', { recursive: true });
  fs.mkdirSync('dist', { recursive: true });
  
  // Create components
  for (let i = 0; i < size.components; i++) {
    const imports = [];
    
    // Create imports for this component
    const importCount = Math.min(i, size.imports);
    for (let j = 0; j < importCount; j++) {
      const importIndex = Math.floor(Math.random() * i);
      imports.push(`import { something${importIndex} } from './Component${importIndex}';`);
    }
    
    const content = `
${imports.join('\n')}

export const something${i} = {
  name: 'Component${i}',
  render() {
    return \`
      <div class="component-${i}">
        <h2>Component ${i}</h2>
        <p>This is component ${i}</p>
        ${Array(Math.floor(Math.random() * 5) + 1).fill(0).map((_, idx) => 
          `<div class="item-${idx}">Item ${idx}</div>`
        ).join('\n        ')}
      </div>
    \`;
  }
};

export default something${i};
`;
    
    fs.writeFileSync(`src/Component${i}.js`, content);
  }
  
  // Create index.js
  const indexImports = Array(Math.min(size.components, 20))
    .fill(0)
    .map((_, i) => Math.floor(Math.random() * size.components))
    .map(i => `import Component${i} from './Component${i}';`);
  
  const indexContent = `
${indexImports.join('\n')}

const components = [
${Array(Math.min(size.components, 20))
  .fill(0)
  .map((_, i) => Math.floor(Math.random() * size.components))
  .map(i => `  Component${i},`)
  .join('\n')}
];

function renderAll() {
  return components.map(c => c.render()).join('\\n');
}

console.log('Rendered components:', components.length);
document.getElementById('app').innerHTML = renderAll();
`;
  
  fs.writeFileSync('src/index.js', indexContent);
  
  // Create webpack config
  const webpackConfig = `
module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    filename: 'webpack.js',
    path: require('path').resolve(__dirname, 'dist'),
  },
};
`;
  
  fs.writeFileSync('webpack.config.js', webpackConfig);
  
  // Create rollup config
  const rollupConfig = `
export default {
  input: 'src/index.js',
  output: {
    file: 'dist/rollup.js',
    format: 'iife',
  },
};
`;
  
  fs.writeFileSync('rollup.config.js', rollupConfig);
  
  // Create vite config
  const viteConfig = `
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: 'src/index.js',
      output: {
        entryFileNames: 'vite.js',
      },
    },
  },
});
`;
  
  fs.writeFileSync('vite.config.js', viteConfig);
  
  // Create package.json
  const packageJson = `
{
  "name": "bundler-benchmark",
  "version": "1.0.0",
  "description": "Benchmark for JavaScript bundlers",
  "scripts": {
    "webpack": "webpack",
    "rollup": "rollup -c",
    "esbuild": "esbuild src/index.js --bundle --outfile=dist/esbuild.js",
    "vite": "vite build"
  },
  "devDependencies": {
    "esbuild": "^0.20.0",
    "rollup": "^4.6.0",
    "vite": "^5.0.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4"
  }
}
`;
  
  fs.writeFileSync('package.json', packageJson);
  
  // Create HTML file
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bundler Benchmark</title>
</head>
<body>
  <div id="app"></div>
  <script src="./dist/bundle.js"></script>
</body>
</html>
`;
  
  fs.writeFileSync('index.html', html);
  
  console.log(`Created ${size.name} test project with ${size.components} components`);
}

// Run benchmark
async function runBenchmark() {
  console.log('Starting bundler benchmark...');
  
  const results = {};
  
  for (const size of PROJECT_SIZES) {
    results[size.name] = [];
    
    // Create test project
    createTestProject(size);
    
    // Install dependencies
    console.log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    
    for (const bundler of BUNDLERS) {
      console.log(`\nBenchmarking ${bundler.name} with ${size.name} project...`);
      
      try {
        // Clean dist directory
        fs.rmSync('dist', { recursive: true, force: true });
        fs.mkdirSync('dist', { recursive: true });
        
        // Warm up
        console.log(`Warming up ${bundler.name}...`);
        execSync(bundler.command, { stdio: 'ignore' });
        
        // Benchmark
        console.log(`Running ${bundler.name}...`);
        const start = performance.now();
        execSync(bundler.command, { stdio: 'ignore' });
        const end = performance.now();
        
        const duration = (end - start).toFixed(2);
        results[size.name].push({ bundler: bundler.name, duration });
        
        console.log(`${bundler.color}${bundler.name}${RESET}: ${duration}ms`);
        
        // Get output file size
        const outputFile = `dist/${bundler.name}.js`;
        if (fs.existsSync(outputFile)) {
          const stats = fs.statSync(outputFile);
          const fileSizeKB = (stats.size / 1024).toFixed(2);
          console.log(`Output size: ${fileSizeKB} KB`);
        }
      } catch (error) {
        console.error(`Error benchmarking ${bundler.name}:`, error.message);
        results[size.name].push({ bundler: bundler.name, duration: 'ERROR', error: error.message });
      }
    }
    
    // Clean up
    fs.rmSync('src', { recursive: true, force: true });
    fs.rmSync('dist', { recursive: true, force: true });
  }
  
  // Print summary
  console.log('\n\n=== BENCHMARK SUMMARY ===');
  
  for (const size of PROJECT_SIZES) {
    console.log(`\n${size.name.toUpperCase()} PROJECT:`);
    
    // Sort by duration
    const sortedResults = [...results[size.name]]
      .filter(r => r.duration !== 'ERROR')
      .sort((a, b) => parseFloat(a.duration) - parseFloat(b.duration));
    
    // Calculate fastest
    if (sortedResults.length > 0) {
      const fastest = sortedResults[0];
      console.log(`Fastest: ${fastest.bundler} (${fastest.duration}ms)`);
      
      // Print all results with speed comparison
      for (const result of sortedResults) {
        const times = result === fastest ? '1.00x' : 
          `${(parseFloat(result.duration) / parseFloat(fastest.duration)).toFixed(2)}x`;
        const bundlerColor = BUNDLERS.find(b => b.name === result.bundler)?.color || '';
        console.log(`${bundlerColor}${result.bundler}${RESET}: ${result.duration}ms (${times})`);
      }
    }
    
    // Print errors
    const errors = results[size.name].filter(r => r.duration === 'ERROR');
    if (errors.length > 0) {
      console.log('\nErrors:');
      for (const error of errors) {
        console.log(`${error.bundler}: ${error.error}`);
      }
    }
  }
}

// Run the benchmark if this file is executed directly
if (require.main === module) {
  runBenchmark().catch(console.error);
}

module.exports = { runBenchmark };
