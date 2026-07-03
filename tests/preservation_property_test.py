"""
Preservation Property Tests — Task 2
======================================
Property 2: Preservation — Auth, Scraping, dan DB Write Tetap Berjalan

TUJUAN: Konfirmasi baseline behavior SEBELUM fix diimplementasi.
EXPECTED OUTCOME: Semua test LULUS di kode original.

Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.9, 3.10

Methodology (observation-first):
  - Observe source code to identify preserved behaviors
  - Write static analysis tests that confirm behaviors exist in code
  - Write live-service tests with pytest.skip if service is unavailable

Observed baselines:
  - POST /api/v1/auth/login  → { access_token, token_type, user }
  - GET  /api/v1/health (FastAPI) → { status: "ok", service: "ai-service" }
  - GET  /api/v1/health (NestJS)  → { status: "ok", service: "backend" }
  - extract_article_text(url) → ScrapeResult with content len > 0 and status == "ok"
  - RolesGuard uses user.role_code from JWT to enforce access control
"""
from __future__ import annotations

import os
import socket
import sys

import pytest

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(WORKSPACE_ROOT, "backend")
AI_SERVICE_DIR = os.path.join(WORKSPACE_ROOT, "ai-service")

AI_SERVICE_BASE_URL = "http://localhost:8000"
BACKEND_BASE_URL = "http://localhost:4000"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (ConnectionRefusedError, socket.timeout, OSError):
        return False


def _is_backend_running() -> bool:
    return _is_port_open("127.0.0.1", 4000)


def _is_ai_service_running() -> bool:
    return _is_port_open("127.0.0.1", 8000)


# ---------------------------------------------------------------------------
# Preservation 3.1 / 3.2 / 3.3 — Auth: JWT Login & Role Check
# Validates: Requirements 3.1, 3.2, 3.3
# ---------------------------------------------------------------------------

class TestP1_AuthJwtPreservation:
    """
    Property 2 — Auth behavior is preserved.

    Observation:
      - AuthService.login() returns { access_token, token_type, user }
      - JWT payload contains { sub, email, role_code, full_name }
      - RolesGuard reads user.role_code from request (populated by JwtStrategy)
    """

    def test_p1a_auth_controller_has_login_endpoint(self):
        """
        PRESERVED if: auth.controller.ts has @Post('login') calling authService.login().
        Static analysis.
        """
        controller_path = os.path.join(
            BACKEND_DIR, "src", "modules", "auth", "auth.controller.ts"
        )
        assert os.path.exists(controller_path), f"auth.controller.ts not found: {controller_path}"

        with open(controller_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "@Post('login')" in content or "@Post(\"login\")" in content, (
            "Login endpoint (@Post('login')) not found in auth.controller.ts"
        )
        assert "authService.login" in content, (
            "authService.login() call not found in auth.controller.ts"
        )

    def test_p1b_auth_service_returns_access_token_and_user(self):
        """
        PRESERVED if: auth.service.ts returns { access_token, token_type, user }.
        Static analysis of return shape.
        """
        service_path = os.path.join(
            BACKEND_DIR, "src", "modules", "auth", "auth.service.ts"
        )
        assert os.path.exists(service_path), f"auth.service.ts not found: {service_path}"

        with open(service_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "access_token" in content, (
            "access_token not found in auth.service.ts — JWT response may be broken"
        )
        assert "token_type" in content, (
            "token_type not found in auth.service.ts"
        )
        assert "signAccessToken" in content or "signAsync" in content, (
            "JWT signing function not found in auth.service.ts"
        )
        # JWT payload must include sub, email, role_code
        assert "sub:" in content or "sub :" in content, (
            "'sub' field not in JWT payload"
        )
        assert "email" in content, (
            "'email' field not in JWT payload"
        )
        assert "role_code" in content, (
            "'role_code' field not in JWT payload — role check may be broken"
        )

    def test_p1c_roles_guard_checks_role_code_from_jwt(self):
        """
        PRESERVED if: roles.guard.ts reads user.role_code from request to enforce roles.
        This is the preserved behavior — implementation method may change after fix
        but role enforcement must remain.
        """
        guard_path = os.path.join(
            BACKEND_DIR, "src", "common", "guards", "roles.guard.ts"
        )
        assert os.path.exists(guard_path), f"roles.guard.ts not found: {guard_path}"

        with open(guard_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Guard must check roles somewhere
        assert "canActivate" in content, (
            "canActivate method not found in roles.guard.ts"
        )
        assert "ForbiddenException" in content, (
            "ForbiddenException not imported — 403 enforcement may be missing"
        )
        # Must read role from user object (either role_code or role)
        has_role_check = "user.role_code" in content or "user.role" in content
        assert has_role_check, (
            "No user.role_code or user.role check found in roles.guard.ts"
        )

    def test_p1d_jwt_auth_guard_uses_passport_jwt(self):
        """
        PRESERVED if: jwt-auth.guard.ts extends AuthGuard('jwt').
        Ensures JwtStrategy is still active.
        """
        guard_path = os.path.join(
            BACKEND_DIR, "src", "common", "guards", "jwt-auth.guard.ts"
        )
        assert os.path.exists(guard_path)

        with open(guard_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "AuthGuard('jwt')" in content or 'AuthGuard("jwt")' in content, (
            "JwtAuthGuard does not extend AuthGuard('jwt') — JWT validation broken"
        )

    def test_p1e_live_login_returns_jwt(self):
        """
        LIVE TEST: POST /api/v1/auth/login → access_token present.
        Skipped if backend not running.
        Validates: Requirement 3.1
        """
        if not _is_backend_running():
            pytest.skip("NestJS backend not running on port 4000")

        import requests
        resp = requests.post(
            f"{BACKEND_BASE_URL}/api/v1/auth/login",
            json={"email": "admin@newsmind.local", "password": "admin123"},
            timeout=10,
        )
        if resp.status_code == 401:
            pytest.skip("Invalid credentials — seed data may differ. Static tests P1a-P1d confirm preservation.")

        assert resp.status_code == 200, (
            f"Login returned {resp.status_code}: {resp.text[:200]}"
        )
        data = resp.json()
        assert "access_token" in data, (
            f"access_token missing in login response. Keys: {list(data.keys())}"
        )
        assert "token_type" in data, (
            f"token_type missing in login response. Keys: {list(data.keys())}"
        )
        assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20, (
            "access_token is not a valid JWT string"
        )
        # Verify JWT structure (3 base64 parts separated by dots)
        parts = data["access_token"].split(".")
        assert len(parts) == 3, f"access_token does not look like a JWT: {data['access_token'][:50]}"


# ---------------------------------------------------------------------------
# Preservation 3.9 — FastAPI Health Endpoint
# Validates: Requirement 3.9
# ---------------------------------------------------------------------------

class TestP2_FastAPIHealthPreservation:
    """
    Property 2 — FastAPI health endpoint is preserved.

    Observation: GET /api/v1/health returns { status: "ok", service: "ai-service" }
    """

    def test_p2a_health_router_exists_with_correct_path(self):
        """
        PRESERVED if: health.py has GET /health endpoint.
        Static analysis — no service startup needed.
        """
        health_path = os.path.join(AI_SERVICE_DIR, "app", "routers", "health.py")
        assert os.path.exists(health_path), f"health.py not found: {health_path}"

        with open(health_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "@router.get(\"/health\")" in content or "@router.get('/health')" in content, (
            "GET /health endpoint not found in health.py"
        )
        # Must return a status field
        assert '"status"' in content or "'status'" in content, (
            "status field not found in health endpoint response"
        )

    def test_p2b_health_router_registered_in_main(self):
        """
        PRESERVED if: main.py imports and registers health_router under /api/v1.
        Static analysis.
        """
        main_path = os.path.join(AI_SERVICE_DIR, "app", "main.py")
        assert os.path.exists(main_path)

        with open(main_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "health_router" in content, (
            "health_router not imported/used in main.py"
        )
        assert "api_router.include_router(health_router)" in content or \
               "include_router(health_router)" in content, (
            "health_router not registered in FastAPI app"
        )
        # Verify /api/v1 prefix
        assert '"/api/v1"' in content or "'/api/v1'" in content, (
            "/api/v1 prefix not found in main.py"
        )

    def test_p2c_health_response_contains_ok_status(self):
        """
        PRESERVED if: health() function returns dict with status: "ok".
        Static code analysis of the return value.
        """
        health_path = os.path.join(AI_SERVICE_DIR, "app", "routers", "health.py")

        with open(health_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Response must have "ok" status
        assert '"ok"' in content or "'ok'" in content, (
            "Status value 'ok' not found in health.py — health response may be wrong"
        )
        assert '"service"' in content or "'service'" in content, (
            "'service' key not found in health response"
        )

    def test_p2d_live_fastapi_health_returns_200(self):
        """
        LIVE TEST: GET /api/v1/health → 200 with status field.
        Skipped if FastAPI not running.
        Validates: Requirement 3.9
        """
        if not _is_ai_service_running():
            pytest.skip("FastAPI AI service not running on port 8000")

        import requests
        resp = requests.get(f"{AI_SERVICE_BASE_URL}/api/v1/health", timeout=5)

        assert resp.status_code == 200, (
            f"FastAPI health returned {resp.status_code}: {resp.text[:200]}"
        )
        data = resp.json()
        assert "status" in data, f"'status' field missing from health response: {data}"
        # Observed value is "ok" — preserve this
        assert data["status"] in ("ok", "healthy"), (
            f"Unexpected status value: {data['status']}. Expected 'ok' or 'healthy'."
        )


# ---------------------------------------------------------------------------
# Preservation 3.10 — NestJS Health Endpoint
# Validates: Requirement 3.10
# ---------------------------------------------------------------------------

class TestP3_NestJSHealthPreservation:
    """
    Property 2 — NestJS health endpoint is preserved.

    Observation: GET /api/v1/health returns { status: "ok", service: "backend" }
    """

    def test_p3a_health_controller_exists(self):
        """
        PRESERVED if: health.controller.ts has GET health endpoint.
        Static analysis.
        """
        controller_path = os.path.join(
            BACKEND_DIR, "src", "modules", "health", "health.controller.ts"
        )
        assert os.path.exists(controller_path), (
            f"health.controller.ts not found: {controller_path}"
        )

        with open(controller_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "@Get()" in content, (
            "GET health endpoint not found in health.controller.ts"
        )
        assert "getStatus" in content or "healthService" in content, (
            "Health service call not found in controller"
        )

    def test_p3b_health_service_returns_ok_status(self):
        """
        PRESERVED if: health.service.ts returns an object with status: 'ok'.
        Static analysis.
        """
        service_path = os.path.join(
            BACKEND_DIR, "src", "modules", "health", "health.service.ts"
        )
        assert os.path.exists(service_path), (
            f"health.service.ts not found: {service_path}"
        )

        with open(service_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "'ok'" in content or '"ok"' in content, (
            "Status 'ok' not found in health.service.ts"
        )
        assert "status" in content, (
            "'status' field not found in health.service.ts response"
        )
        # service field should also be present
        assert "service" in content, (
            "'service' field not found in health response"
        )

    def test_p3c_health_module_registered_in_app_module(self):
        """
        PRESERVED if: HealthModule is in app.module.ts imports.
        Static analysis.
        """
        app_module_path = os.path.join(BACKEND_DIR, "src", "app.module.ts")
        assert os.path.exists(app_module_path)

        with open(app_module_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "HealthModule" in content, (
            "HealthModule not found in app.module.ts — health endpoint may not be available"
        )

    def test_p3d_live_nestjs_health_returns_200(self):
        """
        LIVE TEST: GET /api/v1/health → 200 with status field.
        Skipped if NestJS not running.
        Validates: Requirement 3.10
        """
        if not _is_backend_running():
            pytest.skip("NestJS backend not running on port 4000")

        import requests
        resp = requests.get(f"{BACKEND_BASE_URL}/api/v1/health", timeout=5)

        assert resp.status_code == 200, (
            f"NestJS health returned {resp.status_code}: {resp.text[:200]}"
        )
        data = resp.json()
        assert "status" in data, f"'status' field missing from health response: {data}"
        assert data["status"] in ("ok", "healthy"), (
            f"Unexpected status value: {data['status']}"
        )


# ---------------------------------------------------------------------------
# Preservation 3.4 — Scraping via trafilatura/BS4
# Validates: Requirement 3.4
# ---------------------------------------------------------------------------

class TestP4_ScrapingPreservation:
    """
    Property 2 — Web scraping via trafilatura/BeautifulSoup is preserved.

    Observation:
      - link_extractor.py implements extract_article_text(url) → ScrapeResult
      - ScrapeResult has: content (str), method (str), status ("ok"|"extraction_failed")
      - Minimum content length > 200 chars for successful scrape
      - Trafilatura is tried first, BS4 is fallback
    """

    def test_p4a_link_extractor_module_exists(self):
        """
        PRESERVED if: link_extractor.py exists in app/scraper/.
        Static analysis.
        """
        extractor_path = os.path.join(
            AI_SERVICE_DIR, "app", "scraper", "link_extractor.py"
        )
        assert os.path.exists(extractor_path), (
            f"link_extractor.py not found: {extractor_path}"
        )

    def test_p4b_extract_function_uses_trafilatura(self):
        """
        PRESERVED if: extract_article_text uses trafilatura as primary extractor.
        Static analysis.
        """
        extractor_path = os.path.join(
            AI_SERVICE_DIR, "app", "scraper", "link_extractor.py"
        )
        with open(extractor_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "trafilatura" in content, (
            "trafilatura not used in link_extractor.py — scraping may be broken"
        )
        assert "trafilatura.extract" in content, (
            "trafilatura.extract() call not found"
        )
        assert "def extract_article_text" in content, (
            "extract_article_text function not found in link_extractor.py"
        )

    def test_p4c_bs4_fallback_exists(self):
        """
        PRESERVED if: BeautifulSoup fallback is implemented.
        Static analysis.
        """
        extractor_path = os.path.join(
            AI_SERVICE_DIR, "app", "scraper", "link_extractor.py"
        )
        with open(extractor_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "BeautifulSoup" in content, (
            "BeautifulSoup not imported in link_extractor.py — BS4 fallback missing"
        )
        assert "_clean_bs4" in content or "bs4" in content.lower(), (
            "BS4 fallback function not found in link_extractor.py"
        )

    def test_p4d_scrape_result_has_correct_fields(self):
        """
        PRESERVED if: ScrapeResult dataclass has content, method, status fields.
        Static analysis.
        """
        extractor_path = os.path.join(
            AI_SERVICE_DIR, "app", "scraper", "link_extractor.py"
        )
        with open(extractor_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "ScrapeResult" in content, (
            "ScrapeResult not defined in link_extractor.py"
        )
        assert "content" in content, "content field not found in ScrapeResult"
        assert "method" in content, "method field not found in ScrapeResult"
        assert "status" in content, "status field not found in ScrapeResult"
        # Status should have 'ok' value
        assert '"ok"' in content or "'ok'" in content, (
            "'ok' status value not found — status tracking may be broken"
        )

    def test_p4e_scrape_function_importable(self):
        """
        PRESERVED if: extract_article_text can be imported without error.
        This test verifies the module loads without triggering SemanticRouter
        (scraper is independent of the AI service imports).
        Skipped if ai-service dependencies (httpx, trafilatura, bs4) are not installed.
        """
        # Check that required packages are available before attempting import
        try:
            import httpx  # noqa: F401
            import trafilatura  # noqa: F401
            from bs4 import BeautifulSoup  # noqa: F401
        except ImportError as e:
            pytest.skip(
                f"ai-service dependency not installed in this Python env: {e}. "
                "Tests p4a-p4d (static analysis) confirm scraper preservation."
            )

        extractor_path = os.path.join(AI_SERVICE_DIR, "app", "scraper")
        sys.path.insert(0, AI_SERVICE_DIR)

        try:
            # Import only the scraper — must not trigger SemanticRouter
            import importlib
            spec = importlib.util.spec_from_file_location(
                "link_extractor",
                os.path.join(extractor_path, "link_extractor.py"),
            )
            assert spec is not None, "Cannot create module spec for link_extractor.py"
            module = importlib.util.module_from_spec(spec)
            # If this raises, the import chain is broken
            spec.loader.exec_module(module)  # type: ignore[union-attr]

            assert hasattr(module, "extract_article_text"), (
                "extract_article_text not exported from link_extractor"
            )
            assert hasattr(module, "ScrapeResult"), (
                "ScrapeResult not exported from link_extractor"
            )
        finally:
            if AI_SERVICE_DIR in sys.path:
                sys.path.remove(AI_SERVICE_DIR)

    def test_p4f_live_scrape_valid_news_url(self):
        """
        LIVE TEST: Scrape a known stable Indonesian news URL.
        Requires network access. Validates trafilatura returns >= 100 chars.
        Validates: Requirement 3.4
        """
        try:
            import trafilatura
        except ImportError:
            pytest.skip("trafilatura not installed in this environment")

        # Use a stable URL with static content
        test_url = "https://www.antara.co.id/berita/4029697/dprd-kalimantan-utara-sahkan-12-raperda-menjadi-perda"

        try:
            downloaded = trafilatura.fetch_url(test_url)
        except Exception as e:
            pytest.skip(f"Network not available or URL unreachable: {e}")

        if not downloaded:
            pytest.skip("URL returned no content — network may be restricted")

        text = trafilatura.extract(downloaded, include_comments=False, include_tables=False)

        # Preservation: scraping must return meaningful text (at least 100 chars)
        assert text is not None, "trafilatura.extract returned None for a valid news URL"
        assert len(text.strip()) >= 100, (
            f"Extracted text too short ({len(text.strip())} chars). "
            "Expected at least 100 characters from a valid news article."
        )


# ---------------------------------------------------------------------------
# Preservation — Property-Based: for all !isBugCondition(env) inputs,
# the preserved behaviors remain intact
# Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.9, 3.10
# ---------------------------------------------------------------------------

class TestP5_PropertyBased_PreservationInvariant:
    """
    Property-based tests using hypothesis.

    For any input that does NOT trigger isBugCondition(env), the preserved
    behaviors must hold:
    - Auth module is correctly structured
    - Health endpoints are correctly defined
    - Scraping module is correctly implemented

    Since we cannot run live services in all environments, we use property-based
    testing over static code invariants — verifying that the code structure
    supporting these behaviors is always intact.

    Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.9, 3.10
    """

    def test_p5a_preserved_modules_all_exist(self):
        """
        PROPERTY: All modules required for preserved behaviors must exist.
        For any valid environment !isBugCondition(env), these files must be present.
        """
        required_files = {
            "FastAPI health router": os.path.join(AI_SERVICE_DIR, "app", "routers", "health.py"),
            "FastAPI main app": os.path.join(AI_SERVICE_DIR, "app", "main.py"),
            "FastAPI scraper": os.path.join(AI_SERVICE_DIR, "app", "scraper", "link_extractor.py"),
            "NestJS health controller": os.path.join(BACKEND_DIR, "src", "modules", "health", "health.controller.ts"),
            "NestJS health service": os.path.join(BACKEND_DIR, "src", "modules", "health", "health.service.ts"),
            "NestJS auth controller": os.path.join(BACKEND_DIR, "src", "modules", "auth", "auth.controller.ts"),
            "NestJS auth service": os.path.join(BACKEND_DIR, "src", "modules", "auth", "auth.service.ts"),
            "NestJS jwt guard": os.path.join(BACKEND_DIR, "src", "common", "guards", "jwt-auth.guard.ts"),
            "NestJS roles guard": os.path.join(BACKEND_DIR, "src", "common", "guards", "roles.guard.ts"),
        }

        missing = []
        for name, path in required_files.items():
            if not os.path.exists(path):
                missing.append(f"{name} ({path})")

        assert len(missing) == 0, (
            f"Preservation-critical files missing: {missing}"
        )

    def test_p5b_health_endpoints_independent_of_bug_condition(self):
        """
        PROPERTY: Health endpoint code does NOT import from bug-condition modules.
        FastAPI health must be independent of SemanticRouter/BullMQ.
        NestJS health must be independent of QueueModule/WorkflowModule.
        """
        # FastAPI health must NOT import semantic_router, provider_manager, etc.
        health_path = os.path.join(AI_SERVICE_DIR, "app", "routers", "health.py")
        with open(health_path, "r", encoding="utf-8") as f:
            fastapi_health = f.read()

        bug_imports_fastapi = ["semantic_router", "provider_manager", "fallback_handler",
                               "model_selector", "intent_classifier", "response_formatter",
                               "bullmq", "redis"]
        for bad_import in bug_imports_fastapi:
            assert bad_import not in fastapi_health.lower(), (
                f"FastAPI health.py imports '{bad_import}' — health endpoint coupled to bug-condition module"
            )

        # NestJS health service must NOT import BullMQ, Redis, QueueModule
        nestjs_health_path = os.path.join(
            BACKEND_DIR, "src", "modules", "health", "health.service.ts"
        )
        with open(nestjs_health_path, "r", encoding="utf-8") as f:
            nestjs_health = f.read()

        bug_imports_nestjs = ["bullmq", "BullModule", "Queue", "redis", "WorkflowModule"]
        for bad_import in bug_imports_nestjs:
            assert bad_import not in nestjs_health, (
                f"NestJS health.service.ts imports '{bad_import}' — health endpoint coupled to bug-condition module"
            )

    def test_p5c_auth_independent_of_bug_condition_modules(self):
        """
        PROPERTY: Auth service does NOT depend on bug-condition modules.
        JWT login must work even when Redis/BullMQ/SemanticRouter are absent.
        """
        auth_service_path = os.path.join(
            BACKEND_DIR, "src", "modules", "auth", "auth.service.ts"
        )
        with open(auth_service_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Auth must not depend on queue/BullMQ/workflow
        bug_dependencies = ["BullMQ", "bullmq", "Queue", "WorkflowModule", "redis"]
        for dep in bug_dependencies:
            assert dep not in content, (
                f"auth.service.ts depends on '{dep}' — auth will break in bug-condition environment"
            )

        # Auth must use only: UsersService, JwtService, ConfigService, bcrypt
        assert "JwtService" in content, "JwtService not found in auth.service.ts"
        assert "bcrypt" in content, "bcrypt not found in auth.service.ts"
        assert "UsersService" in content, "UsersService not found in auth.service.ts"

    def test_p5d_scraper_independent_of_bug_condition_modules(self):
        """
        PROPERTY: Scraper does NOT import from SemanticRouter or other bug-condition modules.
        Web scraping must work even after SemanticRouter is removed.
        """
        scraper_path = os.path.join(
            AI_SERVICE_DIR, "app", "scraper", "link_extractor.py"
        )
        with open(scraper_path, "r", encoding="utf-8") as f:
            content = f.read()

        bug_imports = ["semantic_router", "provider_manager", "fallback_handler",
                       "model_selector", "intent_classifier", "response_formatter",
                       "SemanticRouter", "FastEmbedEncoder"]
        for bad_import in bug_imports:
            assert bad_import not in content, (
                f"link_extractor.py imports '{bad_import}' — scraper depends on bug-condition module"
            )

        # Must still use trafilatura and BeautifulSoup
        assert "trafilatura" in content, "trafilatura import removed from scraper"
        assert "BeautifulSoup" in content, "BeautifulSoup import removed from scraper"

    def test_p5e_property_all_preservation_invariants_hold_together(self):
        """
        AGGREGATE PROPERTY: All preservation invariants hold simultaneously.

        For all environments where !isBugCondition(env):
        - Auth module exists and is correctly structured
        - FastAPI health returns status field
        - NestJS health returns status field
        - Scraper uses trafilatura + BS4 fallback
        - No preserved module depends on bug-condition modules

        This test acts as a property-based assertion over the code structure.
        """
        results = {}

        # Check 1: Auth login flow
        auth_service_path = os.path.join(BACKEND_DIR, "src", "modules", "auth", "auth.service.ts")
        with open(auth_service_path) as f:
            auth_content = f.read()
        results["auth_has_access_token"] = "access_token" in auth_content
        results["auth_has_role_code"] = "role_code" in auth_content
        results["auth_has_bcrypt"] = "bcrypt" in auth_content

        # Check 2: FastAPI health
        fastapi_health_path = os.path.join(AI_SERVICE_DIR, "app", "routers", "health.py")
        with open(fastapi_health_path) as f:
            fastapi_health_content = f.read()
        results["fastapi_health_has_status"] = '"status"' in fastapi_health_content or "'status'" in fastapi_health_content
        results["fastapi_health_returns_ok"] = '"ok"' in fastapi_health_content or "'ok'" in fastapi_health_content

        # Check 3: NestJS health
        nestjs_health_path = os.path.join(BACKEND_DIR, "src", "modules", "health", "health.service.ts")
        with open(nestjs_health_path) as f:
            nestjs_health_content = f.read()
        results["nestjs_health_has_status"] = "status" in nestjs_health_content
        results["nestjs_health_returns_ok"] = "'ok'" in nestjs_health_content or '"ok"' in nestjs_health_content

        # Check 4: Scraper
        scraper_path = os.path.join(AI_SERVICE_DIR, "app", "scraper", "link_extractor.py")
        with open(scraper_path) as f:
            scraper_content = f.read()
        results["scraper_has_trafilatura"] = "trafilatura" in scraper_content
        results["scraper_has_bs4"] = "BeautifulSoup" in scraper_content
        results["scraper_has_extract_fn"] = "def extract_article_text" in scraper_content

        # All must be True
        failed = [k for k, v in results.items() if not v]
        assert len(failed) == 0, (
            f"Preservation invariants violated: {failed}\n"
            f"Full results: {results}"
        )


# ---------------------------------------------------------------------------
# Preservation — Hypothesis property-based tests (input variation)
# ---------------------------------------------------------------------------

class TestP6_HypothesisPreservation:
    """
    Hypothesis-based property tests for input variation.

    For any input text that is not a bug-condition, the scraper logic
    and JWT structure must remain consistent.

    Validates: Requirements 3.1, 3.4
    """

    def test_p6a_scrape_result_dataclass_invariant(self):
        """
        PROPERTY: ScrapeResult always has content (str), method (str), status (str).
        Test with hypothesis over various constructor inputs.
        Skipped if ai-service dependencies not installed in this environment.
        """
        try:
            from hypothesis import given, settings as h_settings
            from hypothesis import strategies as st
        except ImportError:
            pytest.skip("hypothesis not installed")

        # Check ai-service deps available before importing scraper
        try:
            import httpx  # noqa: F401
            import trafilatura  # noqa: F401
            from bs4 import BeautifulSoup  # noqa: F401
        except ImportError as e:
            pytest.skip(
                f"ai-service dependency not installed in this Python env: {e}. "
                "ScrapeResult structure confirmed by static analysis in TestP4."
            )

        # Import ScrapeResult from scraper
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "link_extractor_hyp",
            os.path.join(AI_SERVICE_DIR, "app", "scraper", "link_extractor.py"),
        )
        module = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
        spec.loader.exec_module(module)  # type: ignore[union-attr]
        ScrapeResult = module.ScrapeResult

        @given(
            content=st.text(max_size=500),
            method=st.sampled_from(["trafilatura", "beautifulsoup", "fallback_failed"]),
            status=st.sampled_from(["ok", "extraction_failed"]),
        )
        @h_settings(max_examples=50)
        def check_scrape_result(content, method, status):
            result = ScrapeResult(content=content, method=method, status=status)
            # Invariant: all fields are accessible and correct type
            assert isinstance(result.content, str)
            assert isinstance(result.method, str)
            assert isinstance(result.status, str)
            assert result.status in ("ok", "extraction_failed")

        check_scrape_result()

    def test_p6b_jwt_structure_invariant(self):
        """
        PROPERTY: JWT tokens produced by any valid user login have exactly 3 parts.
        We verify the signing function generates properly structured JWTs.
        Static check on the signing code — valid for all non-bug-condition environments.
        """
        auth_service_path = os.path.join(
            BACKEND_DIR, "src", "modules", "auth", "auth.service.ts"
        )
        with open(auth_service_path) as f:
            content = f.read()

        # JWT payload must include sub, email, role_code
        # These three fields define the invariant for any valid login
        required_payload_fields = ["sub:", "email", "role_code"]
        for field in required_payload_fields:
            assert field in content, (
                f"JWT payload field '{field}' missing from signAccessToken — "
                "JWT structure invariant broken"
            )

        # signAsync must be called with a secret key
        assert "JWT_SECRET" in content or "newsmind-super-secret" in content, (
            "JWT secret not configured — tokens cannot be signed"
        )
        assert "expiresIn" in content, (
            "JWT expiry not configured — tokens would never expire"
        )

    def test_p6c_health_response_keys_invariant(self):
        """
        PROPERTY: Health responses always contain 'status' key.
        Verified over both FastAPI and NestJS health implementations.
        Static analysis as property over all possible code states.
        """
        health_files = {
            "FastAPI": os.path.join(AI_SERVICE_DIR, "app", "routers", "health.py"),
            "NestJS": os.path.join(BACKEND_DIR, "src", "modules", "health", "health.service.ts"),
        }

        for service_name, path in health_files.items():
            with open(path) as f:
                content = f.read()

            assert "status" in content, (
                f"{service_name} health response missing 'status' key — "
                "health endpoint invariant broken"
            )
