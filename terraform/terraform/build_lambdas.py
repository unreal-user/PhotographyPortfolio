#!/usr/bin/env python3
"""Build Lambda deployment packages"""

import os
import zipfile
from pathlib import Path

def build_lambda_package(lambda_dir, output_dir):
    """Create a zip file for a Lambda function"""
    function_name = lambda_dir.name
    index_py = lambda_dir / "index.py"

    if not index_py.exists():
        print(f"⚠️  Skipping {function_name} - no index.py found")
        return

    zip_path = output_dir / f"{function_name}.zip"

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        zipf.write(index_py, 'index.py')

    size_kb = zip_path.stat().st_size / 1024
    print(f"✓ Built {function_name}.zip ({size_kb:.1f} KB)")

    return zip_path

def main():
    script_dir = Path(__file__).parent
    lambda_base_dir = script_dir / "lambda"

    print("Building Lambda deployment packages...")
    print()

    built_packages = []

    for lambda_dir in sorted(lambda_base_dir.iterdir()):
        if lambda_dir.is_dir() and not lambda_dir.name.startswith('.'):
            zip_path = build_lambda_package(lambda_dir, lambda_base_dir.parent)
            if zip_path:
                built_packages.append(zip_path)

    print()
    print(f"All {len(built_packages)} Lambda functions built successfully!")

if __name__ == "__main__":
    main()
