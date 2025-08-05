/**
 * JSR Module Resolution Demo
 *
 * This script demonstrates how JSR resolves modules differently
 * from traditional npm packages.
 */

// Type definitions for our demo
type PackageManager = "npm" | "yarn" | "pnpm" | "jsr";

interface ResolutionStep {
  step: number;
  description: string;
  lookupPath?: string;
  success: boolean;
  alternative?: string;
}

interface ResolutionProcess {
  packageManager: PackageManager;
  importStatement: string;
  steps: ResolutionStep[];
  resolved?: string;
  error?: string;
}

// Simulate the resolution process
function simulateResolution(
  packageManager: PackageManager,
  importStatement: string
): ResolutionProcess {
  const result: ResolutionProcess = {
    packageManager,
    importStatement,
    steps: [],
  };

  if (packageManager === "npm" || packageManager === "yarn" || packageManager === "pnpm") {
    // Traditional Node.js resolution
    if (importStatement.startsWith("@")) {
      // Scoped package
      const [scope, pkg, ...rest] = importStatement.split("/");
      const scopedPkg = `${scope}/${pkg}`;
      
      result.steps.push({
        step: 1,
        description: "Check for local file",
        lookupPath: `./${importStatement}.js`,
        success: false
      });
      
      result.steps.push({
        step: 2,
        description: "Look in node_modules",
        lookupPath: `./node_modules/${scopedPkg}/package.json`,
        success: true
      });
      
      result.steps.push({
        step: 3,
        description: "Read package.json 'main' field",
        lookupPath: `./node_modules/${scopedPkg}/index.js`,
        success: true
      });
      
      if (rest.length > 0) {
        result.steps.push({
          step: 4,
          description: "Resolve subpath",
          lookupPath: `./node_modules/${scopedPkg}/${rest.join("/")}`,
          success: true
        });
        
        result.resolved = `./node_modules/${scopedPkg}/${rest.join("/")}.js`;
      } else {
        result.resolved = `./node_modules/${scopedPkg}/index.js`;
      }
    } else {
      // Regular package
      const [pkg, ...rest] = importStatement.split("/");
      
      result.steps.push({
        step: 1,
        description: "Check for local file",
        lookupPath: `./${importStatement}.js`,
        success: false
      });
      
      result.steps.push({
        step: 2,
        description: "Look in node_modules",
        lookupPath: `./node_modules/${pkg}/package.json`,
        success: true
      });
      
      result.steps.push({
        step: 3,
        description: "Read package.json 'main' field",
        lookupPath: `./node_modules/${pkg}/index.js`,
        success: true
      });
      
      if (rest.length > 0) {
        result.steps.push({
          step: 4,
          description: "Resolve subpath",
          lookupPath: `./node_modules/${pkg}/${rest.join("/")}`,
          success: true
        });
        
        result.resolved = `./node_modules/${pkg}/${rest.join("/")}.js`;
      } else {
        result.resolved = `./node_modules/${pkg}/index.js`;
      }
    }
  } else if (packageManager === "jsr") {
    // JSR resolution
    if (importStatement.startsWith("@")) {
      // JSR scope format
      const [scope, pkg, ...rest] = importStatement.split("/");
      const jsrPkg = `${scope}/${pkg}`;
      
      result.steps.push({
        step: 1,
        description: "Check for URL format",
        success: false,
        alternative: "Not a URL, checking for JSR package"
      });
      
      result.steps.push({
        step: 2,
        description: "Resolve JSR package",
        lookupPath: `https://jsr.io/${jsrPkg}/[latest-version]`,
        success: true
      });
      
      if (rest.length > 0) {
        result.steps.push({
          step: 3,
          description: "Resolve subpath",
          lookupPath: `https://jsr.io/${jsrPkg}/[latest-version]/${rest.join("/")}`,
          success: true
        });
        
        result.resolved = `https://jsr.io/${jsrPkg}/[latest-version]/${rest.join("/")}`;
      } else {
        result.steps.push({
          step: 3,
          description: "Load default export",
          lookupPath: `https://jsr.io/${jsrPkg}/[latest-version]/mod.ts`,
          success: true
        });
        
        result.resolved = `https://jsr.io/${jsrPkg}/[latest-version]/mod.ts`;
      }
    } else {
      // Regular JSR package (non-scoped)
      result.steps.push({
        step: 1,
        description: "Check for URL format",
        success: false,
        alternative: "Not a URL, checking for JSR package"
      });
      
      result.steps.push({
        step: 2,
        description: "Resolve JSR package",
        lookupPath: `https://jsr.io/${importStatement}/[latest-version]`,
        success: true
      });
      
      result.steps.push({
        step: 3,
        description: "Load default export",
        lookupPath: `https://jsr.io/${importStatement}/[latest-version]/mod.ts`,
        success: true
      });
      
      result.resolved = `https://jsr.io/${importStatement}/[latest-version]/mod.ts`;
    }
  }

  return result;
}

// Example usage
function compareResolutions() {
  const examples = [
    { pkg: "express", npm: "express", jsr: "@std/express" },
    { pkg: "React", npm: "react", jsr: "@react/core" },
    { pkg: "Lodash helpers", npm: "lodash/fp", jsr: "@lodash/fp" }
  ];
  
  for (const example of examples) {
    console.log(`\n=== ${example.pkg} Resolution ===\n`);
    
    const npmResolution = simulateResolution("npm", example.npm);
    console.log(`npm resolution for "${example.npm}":`);
    console.log(`Resolved to: ${npmResolution.resolved}\n`);
    
    const jsrResolution = simulateResolution("jsr", example.jsr);
    console.log(`JSR resolution for "${example.jsr}":`);
    console.log(`Resolved to: ${jsrResolution.resolved}\n`);
  }
}

// This would be executed when running the script
// compareResolutions();

// Export for testing
export { simulateResolution, compareResolutions };
