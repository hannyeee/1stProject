"""Import and CLI checks run in fresh processes to catch accidental sys.path dependencies."""
from pathlib import Path
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ModuleImportTests(unittest.TestCase):
    def test_modules_import_without_a_previous_script_modifying_sys_path(self):
        modules = (
            'users.testGeneratePersonas', 'users.testExpandPersonas',
            'users.playwright.run', 'users.playwright.runPeriods',
            'users.playwright.periods', 'users.playwright.serve',
            'users.playwright.verify', 'users.playwright.verifyPeriods',
            'users.previous.audit', 'users.previous.recover',
            'users.loadtest.run_load', 'users.loadtest.report',
            'users.loadtest.verify_load', 'users.loadtest.db_snapshot',
            'users.loadtest.stress_report',
        )
        for module in modules:
            with self.subTest(module=module):
                result = subprocess.run(
                    [sys.executable, '-c', f'import {module}'], cwd=ROOT,
                    capture_output=True, text=True, timeout=30,
                )
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_cli_help_works_when_invoked_by_file_path(self):
        scripts = (
            'playwright/run.py', 'playwright/runPeriods.py', 'playwright/serve.py',
            'playwright/verify.py', 'playwright/verifyPeriods.py',
            'previous/audit.py', 'previous/recover.py', 'previous/extend_personas.py',
            'loadtest/run_load.py', 'loadtest/report.py', 'loadtest/verify_load.py',
            'loadtest/db_snapshot.py', 'loadtest/stress_report.py',
        )
        for script in scripts:
            with self.subTest(script=script):
                result = subprocess.run(
                    [sys.executable, str(ROOT / 'users' / script), '--help'],
                    cwd=ROOT, capture_output=True, text=True, timeout=30,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('usage:', result.stdout)
