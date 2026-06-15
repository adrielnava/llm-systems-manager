"""Tests for proxies._proxy_error — text/plain, no reflected detail (#27, #26→#7)."""
from __future__ import annotations

import proxies


def test_proxy_error_is_text_plain():
    resp = proxies._proxy_error("Proxy error", 502)
    assert "text/plain" in resp.content_type


def test_proxy_error_preserves_status():
    resp = proxies._proxy_error("Method not supported for /sdcpp proxy", 405)
    assert resp.status_code == 405


def test_proxy_error_body_is_generic_message():
    resp = proxies._proxy_error("Proxy error", 502)
    assert resp.get_data() == b"Proxy error"


def test_proxy_error_does_not_reflect_detail():
    # The reflected HTTP method / exception (the CodeQL #7 source) must never
    # reach the response body — only the generic message does.
    resp = proxies._proxy_error("Proxy error", 502, detail="<script>BADMETHOD</script>")
    body = resp.get_data()
    assert b"<script>" not in body
    assert b"BADMETHOD" not in body
