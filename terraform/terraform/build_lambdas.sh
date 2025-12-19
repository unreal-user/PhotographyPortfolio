#!/bin/bash
# Build Lambda deployment packages

set -e

LAMBDA_DIR="$(dirname "$0")/lambda"

echo "Building Lambda deployment packages..."
echo ""

for function_dir in "$LAMBDA_DIR"/*; do
  if [ -d "$function_dir" ]; then
    function_name=$(basename "$function_dir")
    echo "Building $function_name..."

    cd "$function_dir"
    zip -q -r "../${function_name}.zip" index.py
    cd - > /dev/null

    echo "✓ Built ${function_name}.zip"
  fi
done

echo ""
echo "All Lambda functions built successfully!"
echo ""
echo "Deployment packages created:"
ls -lh "$LAMBDA_DIR"/*.zip | awk '{print "  - " $9 " (" $5 ")"}'
