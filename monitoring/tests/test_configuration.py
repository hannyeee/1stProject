"""Offline consistency checks for the current monitoring topology."""
import ast
import importlib.util
from pathlib import Path
import re
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[1]
HOSTS = {str(n) for n in range(171, 182)} | {'187', '188', '189'}


class MonitoringConfigurationTests(unittest.TestCase):
    def test_active_configuration_contains_no_retired_addresses(self):
        for path in ROOT.rglob('*'):
            if path.suffix in {'.alloy', '.yml', '.default', '.conf', '.env', '.json'}:
                with self.subTest(path=path):
                    self.assertIsNone(re.search(r'192\.168\.0\.(183|184|186)\b|mon-metrics184|mon-logs186', path.read_text(encoding='utf-8').replace('\\', '')))

    def test_prometheus_pulls_all_hosts_and_db_exporters(self):
        config = yaml.safe_load((ROOT / 'prometheus/prometheus.yml').read_text(encoding='utf-8'))
        jobs = {job['job_name']: job for job in config['scrape_configs']}
        self.assertEqual(set(jobs), {'node', 'mariadb', 'mongodb', 'prometheus', 'grafana', 'loki'})
        node = {address for group in jobs['node']['static_configs'] for address in group['targets']}
        self.assertEqual(node, {f'192.168.0.{host}:9100' for host in HOSTS})
        self.assertEqual(jobs['mongodb']['static_configs'][0]['targets'], ['192.168.0.174:9216'])
        self.assertEqual({address for group in jobs['mariadb']['static_configs'] for address in group['targets']}, {f'192.168.0.{n}:9104' for n in (171, 172, 173)})

    def test_grafana_queries_separate_prometheus_and_loki_servers(self):
        config = yaml.safe_load((ROOT / 'grafana/provisioning/datasources/datasources.yml').read_text(encoding='utf-8'))
        urls = {source['uid']: source['url'] for source in config['datasources']}
        self.assertEqual(urls, {'prometheus': 'http://192.168.0.187:9090', 'loki': 'http://192.168.0.189:3100'})

    def test_generated_alloy_files_match_the_single_generator(self):
        path = ROOT / 'deployed/alloy/gen_alloy.py'
        tree = ast.parse(path.read_text(encoding='utf-8'))
        self.assertIn('render_configs', {node.name for node in tree.body if isinstance(node, ast.FunctionDef)})
        spec = importlib.util.spec_from_file_location('monitoring_generator', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        expected = module.render_configs()
        self.assertEqual({name.split('-')[0] for name in expected}, HOSTS)
        self.assertEqual(set(expected), {p.name for p in path.parent.glob('*.alloy')})
        for name, content in expected.items():
            with self.subTest(file=name):
                self.assertEqual((path.parent / name).read_text(encoding='utf-8'), content)
                self.assertNotIn('prometheus.remote_write', content)
                self.assertIn('http://192.168.0.189:3100/loki/api/v1/push', content)
                self.assertIn('service_name', content)
                if 'nginx' in name:
                    self.assertIn('/var/log/nginx/access.json.log', content)

    def test_only_one_alloy_loading_mode_and_one_loki_configuration(self):
        self.assertEqual(list((ROOT / 'alloy').glob('*.alloy')), [])
        self.assertIn('CONFIG_FILE="/etc/alloy/config.alloy"', (ROOT / 'alloy/alloy.default').read_text(encoding='utf-8'))
        self.assertEqual((ROOT / 'loki/config.yml').read_bytes(), (ROOT / 'deployed/loki/config.yml').read_bytes())
        args = (ROOT / 'prometheus/prometheus.default').read_text(encoding='utf-8')
        self.assertNotIn('--web.enable-remote-write-receiver', args)


if __name__ == '__main__':
    unittest.main()
