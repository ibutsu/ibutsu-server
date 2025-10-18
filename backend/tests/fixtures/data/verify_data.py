#!/usr/bin/env python3
"""
Quick verification script for sample test data.

Run this script to verify the sample data is correctly structured and loadable.

Usage:
    python backend/tests/fixtures/data/verify_data.py
"""

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def verify_json_structure():
    """Verify JSON file structure and content."""
    print("=" * 70)
    print("VERIFYING JSON DATA")
    print("=" * 70)

    json_path = Path(__file__).parent / "sample_test_data.json"

    try:
        with json_path.open() as f:
            data = json.load(f)
        print("✓ JSON file is valid and loadable")
    except Exception as e:
        print(f"✗ JSON file error: {e}")
        return False

    # Check structure
    required_keys = ["project", "runs", "results", "artifacts"]
    for key in required_keys:
        if key not in data:
            print(f"✗ Missing required key: {key}")
            return False
        print(f"✓ Found key: {key}")

    # Check counts
    print("\nData Summary:")
    print("  - Projects: 1")
    print(f"  - Runs: {len(data['runs'])}")
    print(f"  - Results: {len(data['results'])}")
    print(f"  - Artifacts: {len(data['artifacts'])}")

    # Verify result variety
    result_types = {}
    for result in data["results"]:
        result_type = result.get("result", "unknown")
        result_types[result_type] = result_types.get(result_type, 0) + 1

    print("\nResult Type Distribution:")
    for result_type, count in sorted(result_types.items()):
        print(f"  - {result_type}: {count}")

    # Verify metadata complexity
    simple_count = 0
    complex_count = 0
    for result in data["results"]:
        metadata = result.get("metadata", {})
        if len(metadata) <= 5:
            simple_count += 1
        else:
            complex_count += 1

    print("\nMetadata Complexity:")
    print(f"  - Simple metadata: {simple_count}")
    print(f"  - Complex metadata: {complex_count}")

    return True


def verify_xml_structure():
    """Verify XML file structure."""
    print("\n" + "=" * 70)
    print("VERIFYING XML DATA")
    print("=" * 70)

    xml_path = Path(__file__).parent / "sample_test_data.xml"

    try:
        tree = ET.parse(xml_path)  # noqa: S314
        root = tree.getroot()
        print("✓ XML file is valid and parseable")
    except Exception as e:
        print(f"✗ XML file error: {e}")
        return False

    # Check structure
    testsuites = root.findall("testsuite")
    print(f"✓ Found {len(testsuites)} test suites")

    total_tests = 0
    total_failures = 0
    total_errors = 0
    total_skipped = 0

    for testsuite in testsuites:
        tests = int(testsuite.get("tests", 0))
        failures = int(testsuite.get("failures", 0))
        errors = int(testsuite.get("errors", 0))
        skipped = int(testsuite.get("skipped", 0))

        total_tests += tests
        total_failures += failures
        total_errors += errors
        total_skipped += skipped

        print(f"  - {testsuite.get('name')}: {tests} tests")

    print("\nTest Suite Summary:")
    print(f"  - Total tests: {total_tests}")
    print(f"  - Failures: {total_failures}")
    print(f"  - Errors: {total_errors}")
    print(f"  - Skipped: {total_skipped}")
    print(f"  - Passed: {total_tests - total_failures - total_errors - total_skipped}")

    return True


def verify_artifact_files():
    """Verify artifact files exist and are readable."""
    print("\n" + "=" * 70)
    print("VERIFYING ARTIFACT FILES")
    print("=" * 70)

    fixture_dir = Path(__file__).parent

    artifact_files = [
        ("log_authentication_failure.txt", "text/plain"),
        ("log_traceback.txt", "text/plain"),
        ("log_performance_metrics.txt", "text/plain"),
        ("screenshot_failure.png", "image/png"),
    ]

    all_valid = True

    for filename, content_type in artifact_files:
        filepath = fixture_dir / filename

        if not filepath.exists():
            print(f"✗ Missing: {filename}")
            all_valid = False
            continue

        try:
            with filepath.open("rb") as f:
                content = f.read()

            size = len(content)
            print(f"✓ {filename}: {size} bytes ({content_type})")

        except Exception as e:
            print(f"✗ Error reading {filename}: {e}")
            all_valid = False

    return all_valid


def verify_loader_module():
    """Verify the loader module can be imported and used."""
    print("\n" + "=" * 70)
    print("VERIFYING LOADER MODULE")
    print("=" * 70)

    try:
        # Import from relative path
        import sys
        from pathlib import Path

        # Add backend to path for import
        backend_path = Path(__file__).parent.parent.parent.parent
        if str(backend_path) not in sys.path:
            sys.path.insert(0, str(backend_path))

        from tests.fixtures.loader import (
            get_sample_metadata_patterns,
            load_json_data,
        )

        print("✓ Loader module imports successfully")

        # Test loading data
        data = load_json_data()
        print(f"✓ load_json_data() works: loaded {len(data['runs'])} runs")

        # Test metadata patterns
        patterns = get_sample_metadata_patterns()
        print(f"✓ get_sample_metadata_patterns() works: found {len(patterns)} patterns")

        return True

    except Exception as e:
        print(f"✗ Loader module error: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    """Run all verification checks."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 10 + "SAMPLE TEST DATA VERIFICATION" + " " * 28 + "║")
    print("╚" + "=" * 68 + "╝")
    print()

    results = []

    results.append(("JSON Structure", verify_json_structure()))
    results.append(("XML Structure", verify_xml_structure()))
    results.append(("Artifact Files", verify_artifact_files()))
    results.append(("Loader Module", verify_loader_module()))

    # Summary
    print("\n" + "=" * 70)
    print("VERIFICATION SUMMARY")
    print("=" * 70)

    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {name}")

    all_passed = all(result[1] for result in results)

    print("\n" + "=" * 70)
    if all_passed:
        print("✓ ALL CHECKS PASSED - Sample data is ready for use!")
        print("=" * 70)
        print("\nQuick Start:")
        print("  from tests.fixtures.loader import load_sample_data")
        print("  project, runs, results, artifacts = load_sample_data(db_session)")
        print("\nSee backend/tests/fixtures/README.md for full documentation.")
        return 0
    print("✗ SOME CHECKS FAILED - Please review errors above")
    print("=" * 70)
    return 1


if __name__ == "__main__":
    sys.exit(main())
