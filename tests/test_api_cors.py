from fastapi.testclient import TestClient

from api.server import app


PREVIEW_ORIGIN = "https://risksearcher-git-main-example.vercel.app"


def test_vercel_preview_origin_is_allowed_for_get_requests():
    with TestClient(app) as client:
        response = client.get("/health", headers={"Origin": PREVIEW_ORIGIN})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == PREVIEW_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"


def test_vercel_preview_origin_is_allowed_for_analyze_preflight():
    with TestClient(app) as client:
        response = client.options(
            "/analyze",
            headers={
                "Origin": PREVIEW_ORIGIN,
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == PREVIEW_ORIGIN


def test_unrelated_origin_is_not_allowed():
    with TestClient(app) as client:
        response = client.get("/health", headers={"Origin": "https://unrelated.example"})

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
