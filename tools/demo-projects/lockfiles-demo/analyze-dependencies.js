#!/usr/bin/env node

/**
 * A simple dependency tree analyzer for npm/yarn projects
 * This script helps identify common issues in dependency trees
 */

const fs = require('fs');
const path = require('path');

// Utility to parse lockfiles
function parseLockfile(projectPath) {
  const npmLockPath = path.join(projectPath, 'package-lock.json');
  const yarnLockPath = path.join(projectPath, 'yarn.lock');
  const pnpmLockPath = path.join(projectPath, 'pnpm-lock.yaml');
  
  if (fs.existsSync(npmLockPath)) {
    console.log('Found npm lockfile');
    return {
      type: 'npm',
      content: JSON.parse(fs.readFileSync(npmLockPath, 'utf8'))
    };
  } else if (fs.existsSync(yarnLockPath)) {
    console.log('Found yarn lockfile');
    // Simple yarn lockfile parser (not complete)
    const content = fs.readFileSync(yarnLockPath, 'utf8');
    const dependencies = {};
    
    // Very basic parsing of yarn.lock
    const depRegex = /^"?([^@\s"]+)(?:@[^\s"]+)?"?(?:@([^:]+))?\s*:\s*$/gm;
    const versionRegex = /^\s{2}version\s+"([^"]+)"/gm;
    
    let match;
    let currentDep = null;
    
    // First pass to extract dependencies
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for dependency declaration
      const depMatch = depRegex.exec(line);
      if (depMatch) {
        currentDep = depMatch[1];
        dependencies[currentDep] = { versions: [] };
        continue;
      }
      
      // Check for version
      if (currentDep && line.includes('version')) {
        const versionMatch = /version\s+"([^"]+)"/.exec(line);
        if (versionMatch) {
          dependencies[currentDep].versions.push(versionMatch[1]);
        }
      }
    }
    
    return {
      type: 'yarn',
      content: dependencies
    };
  } else if (fs.existsSync(pnpmLockPath)) {
    console.log('Found pnpm lockfile');
    // Basic pnpm lockfile analysis (not complete)
    return {
      type: 'pnpm',
      content: 'PNPM lockfile analysis not implemented'
    };
  } else {
    console.log('No lockfile found');
    return null;
  }
}

// Find duplicate dependencies
function findDuplicates(lockfile) {
  if (!lockfile) return [];
  
  const duplicates = [];
  
  if (lockfile.type === 'npm') {
    const packages = lockfile.content.packages || {};
    const deps = {};
    
    // Collect all packages by name and version
    Object.keys(packages).forEach(pkgPath => {
      if (pkgPath === '') return; // Skip root package
      
      const pkg = packages[pkgPath];
      if (!pkg.name || !pkg.version) return;
      
      if (!deps[pkg.name]) {
        deps[pkg.name] = [];
      }
      
      deps[pkg.name].push({
        version: pkg.version,
        path: pkgPath
      });
    });
    
    // Find packages with multiple versions
    Object.keys(deps).forEach(name => {
      const versions = deps[name];
      if (versions.length > 1) {
        const uniqueVersions = new Set(versions.map(v => v.version));
        if (uniqueVersions.size > 1) {
          duplicates.push({
            name,
            versions: versions.map(v => ({
              version: v.version,
              path: v.path
            }))
          });
        }
      }
    });
  } else if (lockfile.type === 'yarn') {
    const deps = lockfile.content;
    
    Object.keys(deps).forEach(name => {
      const versions = deps[name].versions;
      if (versions.length > 1) {
        duplicates.push({
          name,
          versions: versions.map(version => ({
            version,
            path: null // Yarn lockfile doesn't store paths
          }))
        });
      }
    });
  }
  
  return duplicates;
}

// Check for outdated dependencies
function checkOutdated(projectPath) {
  try {
    // This is a placeholder - in a real implementation we would
    // query the registry for latest versions
    console.log('Checking for outdated dependencies (simulated)');
    
    // Sample data - in a real tool, this would come from npm registry
    return [
      { name: 'express', current: '4.18.2', latest: '4.18.2', status: 'current' },
      { name: 'lodash', current: '4.17.21', latest: '4.17.21', status: 'current' }
    ];
  } catch (error) {
    console.error('Error checking outdated packages:', error);
    return [];
  }
}

// Check for security vulnerabilities
function checkVulnerabilities(projectPath) {
  // This is a placeholder - in a real implementation we would
  // query a vulnerability database
  console.log('Checking for vulnerabilities (simulated)');
  
  // Sample data - in a real tool, this would come from security advisories
  return [
    {
      name: 'example-vulnerable-pkg',
      version: '1.0.0',
      severity: 'high',
      description: 'This is a simulated vulnerability',
      recommendation: 'Upgrade to version 1.1.0 or later'
    }
  ];
}

// Main function to analyze a project
function analyzeProject(projectPath) {
  console.log(`Analyzing project at ${projectPath}`);
  
  // Parse lockfile
  const lockfile = parseLockfile(projectPath);
  if (!lockfile) {
    console.log('No lockfile found. Run npm install or yarn to generate a lockfile.');
    return;
  }
  
  // Find duplicates
  const duplicates = findDuplicates(lockfile);
  console.log('\nDuplicate Dependencies:');
  if (duplicates.length === 0) {
    console.log('No duplicates found');
  } else {
    duplicates.forEach(dup => {
      console.log(`- ${dup.name}:`);
      dup.versions.forEach(v => {
        console.log(`  - ${v.version}${v.path ? ` (${v.path})` : ''}`);
      });
    });
  }
  
  // Check for outdated dependencies
  const outdated = checkOutdated(projectPath);
  console.log('\nOutdated Dependencies:');
  if (outdated.length === 0) {
    console.log('All dependencies are up to date');
  } else {
    outdated.forEach(dep => {
      if (dep.status !== 'current') {
        console.log(`- ${dep.name}: ${dep.current} → ${dep.latest}`);
      }
    });
  }
  
  // Check for vulnerabilities
  const vulnerabilities = checkVulnerabilities(projectPath);
  console.log('\nVulnerabilities:');
  if (vulnerabilities.length === 0) {
    console.log('No vulnerabilities found');
  } else {
    vulnerabilities.forEach(vuln => {
      console.log(`- ${vuln.name}@${vuln.version}: ${vuln.severity}`);
      console.log(`  ${vuln.description}`);
      console.log(`  Recommendation: ${vuln.recommendation}`);
    });
  }
}

// Run if called directly
if (require.main === module) {
  const projectPath = process.argv[2] || '.';
  analyzeProject(path.resolve(projectPath));
}

module.exports = {
  parseLockfile,
  findDuplicates,
  checkOutdated,
  checkVulnerabilities,
  analyzeProject
};
