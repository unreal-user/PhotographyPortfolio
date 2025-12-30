#!/usr/bin/env python3
"""Build Lambda deployment packages"""

import os
import zipfile
import subprocess
import shutil
import tempfile
from pathlib import Path

def build_lambda_package(lambda_dir, output_dir):
    """Create a zip file for a Lambda function"""
    function_name = lambda_dir.name
    index_py = lambda_dir / "index.py"
    requirements_txt = lambda_dir / "requirements.txt"

    if not index_py.exists():
        print(f"⚠️  Skipping {function_name} - no index.py found")
        return

    zip_path = output_dir / f"{function_name}.zip"

    # Check if this Lambda has dependencies
    has_requirements = requirements_txt.exists()

    if has_requirements:
        # Build with dependencies using a temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # Install dependencies to temp directory
            # Use pre-built wheels compatible with AWS Lambda (Amazon Linux 2)
            print(f"  Installing dependencies for {function_name}...")
            subprocess.run(
                [
                    "pip", "install",
                    "-r", str(requirements_txt),
                    "-t", str(temp_path),
                    "--platform", "manylinux2014_x86_64",
                    "--only-binary=:all:",
                    "--python-version", "3.12",
                    "--implementation", "cp",
                    "--quiet"
                ],
                check=True
            )

            # Create zip with dependencies and code
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                # Add all dependency files
                for root, dirs, files in os.walk(temp_path):
                    for file in files:
                        file_path = Path(root) / file
                        arcname = file_path.relative_to(temp_path)
                        zipf.write(file_path, arcname)

                # Add the Lambda handler
                zipf.write(index_py, 'index.py')
    else:
        # Simple Lambda with no dependencies
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(index_py, 'index.py')

    size_kb = zip_path.stat().st_size / 1024
    deps_note = " (with dependencies)" if has_requirements else ""
    print(f"✓ Built {function_name}.zip ({size_kb:.1f} KB){deps_note}")

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
