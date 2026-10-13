import unittest
from unittest.mock import Mock
import monitor

class VeilleRadarTests(unittest.TestCase):
    def setUp(self):
        self.config = [{'id': 'exemple', 'name': 'Produit exemple', 'url': 'https://example.com/', 'selector': '.price'}]

    def test_baseline_then_change_and_no_duplicate(self):
        first, alerts = monitor.monitor_once(self.config, {'watches': {}, 'history': []}, fetch=lambda u: '<p class="price">20 €</p>', now='2026-10-13T00:00:00Z')
        self.assertEqual(first['watches']['exemple']['status'], 'baseline')
        self.assertFalse(alerts)
        second, alerts = monitor.monitor_once(self.config, first, fetch=lambda u: '<p class="price">19 €</p>', now='2026-10-13T01:00:00Z')
        self.assertEqual(second['watches']['exemple']['changes'], 1)
        self.assertEqual(len(alerts), 1)
        third, alerts = monitor.monitor_once(self.config, second, fetch=lambda u: '<p class="price">19 €</p>', now='2026-10-13T02:00:00Z')
        self.assertFalse(alerts)
        self.assertEqual(third['watches']['exemple']['status'], 'ok')

    def test_fetch_failure_does_not_erase_baseline(self):
        first, _ = monitor.monitor_once(self.config, {}, fetch=lambda u: '<p class="price">20 €</p>')
        broken, alerts = monitor.monitor_once(self.config, first, fetch=lambda u: '<h1>Page sans prix</h1>')
        self.assertEqual(broken['watches']['exemple']['status'], 'error')
        self.assertEqual(broken['watches']['exemple']['hash'], first['watches']['exemple']['hash'])
        self.assertFalse(alerts)

    def test_private_ip_rejected(self):
        for url in ['file:///etc/passwd','http://localhost:5000','http://127.0.0.1/','http://192.168.1.5/','http://169.254.169.254/latest/meta-data/','http://user:pass@example.com','http://example.com:8080']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                monitor.safe_url(url)

    def test_synthetic_resolver_rejects_internal_redirect_target(self):
        def resolver(host, port, type):
            ip = '192.168.0.2' if host=='internal.test' else '93.184.215.14'
            return [(2,1,6,'',(ip,port))]
        monitor.safe_url('https://public.test/path',resolver=resolver)
        with self.assertRaises(ValueError):
            monitor.safe_url('https://internal.test/path',resolver=resolver)

    def test_selector_is_precise(self):
        self.assertEqual(monitor.extract_text('<nav>Promo</nav><span class="price">35 €</span><footer>Info</footer>','.price'),'35 €')
        self.assertEqual(monitor.extract_text('<nav>Promo</nav><main>Article</main><footer>Info</footer>'),'Article')

    def test_config_limits_and_unsupported(self):
        self.assertEqual(monitor.validate_config({'monitors': []}), [])
        with self.assertRaises(ValueError):
            monitor.validate_config({'monitors': [self.config[0],self.config[0]]})
        with self.assertRaises(ValueError):
            monitor.validate_config({'monitors': [{'id':'id','name':'x','url':'https://example.com','selector':1}]})

if __name__ == '__main__':
    unittest.main()
