#!/usr/bin/env node

/**
 * Lambda Build Script
 *
 * Builds all Lambda function packages by creating zip files
 * from the source code in terraform/photography-app/lambda/
 *
 * Output: .zip files in terraform/photography-app/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LAMBDA_DIR = path.join(__dirname, '..', 'terraform', 'photography-app', 'lambda');
const OUTPUT_DIR = path.join(__dirname, '..', 'terraform', 'photography-app');

// Get all Lambda function directories
const lambdaFunctions = fs.readdirSync(LAMBDA_DIR).filter(item => {
  const itemPath = path.join(LAMBDA_DIR, item);
  return fs.statSync(itemPath).isDirectory();
});

console.log('Building Lambda functions...\n');

let successCount = 0;
let failCount = 0;

for (const func of lambdaFunctions) {
  const funcPath = path.join(LAMBDA_DIR, func);
  const zipPath = path.join(OUTPUT_DIR, `${func}.zip`);

  // Check if index.py exists
  const indexPath = path.join(funcPath, 'index.py');
  if (!fs.existsSync(indexPath)) {
    console.log(`  Skipping ${func} (no index.py found)`);
    continue;
  }

  try {
    // Remove old zip if exists
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // Check for requirements.txt (Lambda layer dependencies)
    const requirementsPath = path.join(funcPath, 'requirements.txt');
    const hasRequirements = fs.existsSync(requirementsPath);

    if (hasRequirements) {
      // For functions with dependencies, we need to include them
      // Create a temp directory, install deps, and zip everything
      console.log(`  Building ${func} (with dependencies)...`);

      const tempDir = path.join(funcPath, '.build');

      // Clean up any existing build directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir);

      // Copy index.py to temp
      fs.copyFileSync(indexPath, path.join(tempDir, 'index.py'));

      // Install dependencies
      execSync(`pip install -r requirements.txt -t .build --quiet`, {
        cwd: funcPath,
        stdio: 'pipe'
      });

      // Create zip from temp directory
      execSync(`zip -r "${zipPath}" .`, {
        cwd: tempDir,
        stdio: 'pipe'
      });

      // Clean up
      fs.rmSync(tempDir, { recursive: true });
    } else {
      // Simple zip of just index.py
      console.log(`  Building ${func}...`);
      execSync(`zip -j "${zipPath}" index.py`, {
        cwd: funcPath,
        stdio: 'pipe'
      });
    }

    const stats = fs.statSync(zipPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    console.log(`    -> ${func}.zip (${sizeKB} KB)`);
    successCount++;

  } catch (error) {
    console.error(`  ERROR building ${func}: ${error.message}`);
    failCount++;
  }
}

console.log(`\nBuild complete: ${successCount} succeeded, ${failCount} failed`);

if (failCount > 0) {
  process.exit(1);
}
