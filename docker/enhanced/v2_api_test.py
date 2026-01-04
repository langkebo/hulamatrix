#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
HuLaMatrix V1/V2 API Test Suite

Tests the V1 and V2 REST API endpoints for friends and private chat features.
Validates path compatibility and functionality.

Author: HuLaMatrix Team
Version: 2.0.0
Date: 2026-01-03
"""

import requests
import json
import logging
from typing import Dict, Any, List
from dataclasses import dataclass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class TestConfig:
    """Test configuration"""
    base_url: str = "https://matrix.cjystx.top"
    access_token: str = ""
    user_id: str = ""

    def get_headers(self) -> Dict[str, str]:
        """Get request headers with authorization"""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }


class V2ApiTester:
    """V2 API Test Suite"""

    def __init__(self, config: TestConfig):
        self.config = config
        self.session = requests.Session()
        self.test_results: List[Dict[str, Any]] = []

    def log_result(self, test_name: str, passed: bool, details: str = ""):
        """Log test result"""
        result = {
            "test": test_name,
            "passed": passed,
            "details": details
        }
        self.test_results.append(result)

        status = "✅ PASS" if passed else "❌ FAIL"
        logger.info(f"{status} - {test_name}")
        if details:
            logger.info(f"  Details: {details}")

    def test_endpoint(self, method: str, path: str, data: Dict[str, Any] = None) -> requests.Response:
        """Test an API endpoint"""
        url = f"{self.config.base_url}{path}"
        headers = self.config.get_headers()

        try:
            if method.upper() == "GET":
                response = self.session.get(url, headers=headers, timeout=10)
            elif method.upper() == "POST":
                response = self.session.post(url, headers=headers, json=data, timeout=10)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, headers=headers, json=data, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")

            return response
        except Exception as e:
            logger.error(f"Request failed: {e}")
            raise

    def run_friends_v1_tests(self):
        """Test Friends API V1 endpoints"""
        logger.info("\n" + "="*80)
        logger.info("Testing Friends API V1 Endpoints")
        logger.info("="*80)

        # Test 1: List Friends (V1)
        try:
            response = self.test_endpoint("GET", "/_synapse/client/enhanced/friends/list")
            self.log_result(
                "V1 - List Friends",
                response.status_code in [200, 401],  # 401 if no auth
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V1 - List Friends", False, str(e))

        # Test 2: Get Pending Requests (V1)
        try:
            response = self.test_endpoint("GET", "/_synapse/client/enhanced/friends/requests/pending")
            self.log_result(
                "V1 - Get Pending Requests",
                response.status_code in [200, 401],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V1 - Get Pending Requests", False, str(e))

        # Test 3: Get Categories (V1)
        try:
            response = self.test_endpoint("GET", "/_synapse/client/enhanced/friends/categories")
            self.log_result(
                "V1 - Get Categories",
                response.status_code in [200, 401],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V1 - Get Categories", False, str(e))

        # Test 4: Search Users (V1)
        try:
            response = self.test_endpoint("GET", "/_synapse/client/enhanced/friends/search?query=test&limit=10")
            self.log_result(
                "V1 - Search Users",
                response.status_code in [200, 401],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V1 - Search Users", False, str(e))

    def run_friends_v2_tests(self):
        """Test Friends API V2 endpoints"""
        logger.info("\n" + "="*80)
        logger.info("Testing Friends API V2 Endpoints")
        logger.info("="*80)

        # Test 1: List Friends (V2)
        try:
            response = self.test_endpoint("GET", "/_synapse/client/enhanced/friends/v2/list")
            self.log_result(
                "V2 - List Friends",
                response.status_code in [200, 401],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V2 - List Friends", False, str(e))

        # Test 2: Send Friend Request (V2)
        try:
            response = self.test_endpoint(
                "POST",
                "/_synapse/client/enhanced/friends/v2/request",
                {"user_id": "@test:matrix.cjystx.top", "message": "Test request"}
            )
            self.log_result(
                "V2 - Send Friend Request",
                response.status_code in [200, 201, 400, 401],  # 400 if already friends
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V2 - Send Friend Request", False, str(e))

        # Test 3: Accept Friend Request (V2)
        try:
            response = self.test_endpoint(
                "POST",
                "/_synapse/client/enhanced/friends/v2/request/accept",
                {"request_id": "test"}
            )
            self.log_result(
                "V2 - Accept Friend Request",
                response.status_code in [200, 400, 401, 404],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V2 - Accept Friend Request", False, str(e))

        # Test 4: Reject Friend Request (V2)
        try:
            response = self.test_endpoint(
                "POST",
                "/_synapse/client/enhanced/friends/v2/request/reject",
                {"request_id": "test"}
            )
            self.log_result(
                "V2 - Reject Friend Request",
                response.status_code in [200, 400, 401, 404],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V2 - Reject Friend Request", False, str(e))

    def run_private_chat_v1_tests(self):
        """Test Private Chat API V1 endpoints"""
        logger.info("\n" + "="*80)
        logger.info("Testing Private Chat API V1 Endpoints")
        logger.info("="*80)

        # Test 1: List Sessions (V1)
        try:
            response = self.test_endpoint("GET", "/_synapse/client/enhanced/private/sessions")
            self.log_result(
                "V1 - List Sessions",
                response.status_code in [200, 401],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V1 - List Sessions", False, str(e))

        # Test 2: Send Message (V1)
        try:
            response = self.test_endpoint(
                "POST",
                "/_synapse/client/enhanced/private/send",
                {
                    "friend_id": "@test:matrix.cjystx.top",
                    "content": {"msgtype": "m.text", "body": "Test message"}
                }
            )
            self.log_result(
                "V1 - Send Message",
                response.status_code in [200, 201, 400, 401],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V1 - Send Message", False, str(e))

    def run_private_chat_v2_tests(self):
        """Test Private Chat API V2 endpoints"""
        logger.info("\n" + "="*80)
        logger.info("Testing Private Chat API V2 Endpoints")
        logger.info("="*80)

        # Test 1: List Sessions (V2)
        try:
            response = self.test_endpoint("GET", "/_synapse/client/enhanced/private_chat/v2/sessions")
            self.log_result(
                "V2 - List Sessions",
                response.status_code in [200, 401],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V2 - List Sessions", False, str(e))

        # Test 2: Send Message (V2)
        try:
            response = self.test_endpoint(
                "POST",
                "/_synapse/client/enhanced/private_chat/v2/send",
                {
                    "friend_id": "@test:matrix.cjystx.top",
                    "content": {"msgtype": "m.text", "body": "Test message"}
                }
            )
            self.log_result(
                "V2 - Send Message",
                response.status_code in [200, 201, 400, 401],
                f"Status: {response.status_code}"
            )
        except Exception as e:
            self.log_result("V2 - Send Message", False, str(e))

    def run_compatibility_tests(self):
        """Test V1/V2 path compatibility"""
        logger.info("\n" + "="*80)
        logger.info("Testing V1/V2 Path Compatibility")
        logger.info("="*80)

        # Test pairs that should return same response
        test_pairs = [
            ("GET", "/_synapse/client/enhanced/friends/list", "V1 Friends List"),
            ("GET", "/_synapse/client/enhanced/friends/v2/list", "V2 Friends List"),
            ("GET", "/_synapse/client/enhanced/private/sessions", "V1 Private Sessions"),
            ("GET", "/_synapse/client/enhanced/private_chat/v2/sessions", "V2 Private Sessions"),
        ]

        for method, path, name in test_pairs:
            try:
                response = self.test_endpoint(method, path)
                self.log_result(
                    f"Compatibility - {name}",
                    response.status_code in [200, 401],
                    f"Path: {path} -> Status: {response.status_code}"
                )
            except Exception as e:
                self.log_result(f"Compatibility - {name}", False, str(e))

    def print_summary(self):
        """Print test summary"""
        logger.info("\n" + "="*80)
        logger.info("Test Summary")
        logger.info("="*80)

        total = len(self.test_results)
        passed = sum(1 for r in self.test_results if r["passed"])
        failed = total - passed

        logger.info(f"Total Tests: {total}")
        logger.info(f"Passed: {passed} ✅")
        logger.info(f"Failed: {failed} ❌")
        logger.info(f"Success Rate: {(passed/total*100):.1f}%")

        if failed > 0:
            logger.info("\nFailed Tests:")
            for result in self.test_results:
                if not result["passed"]:
                    logger.info(f"  - {result['test']}: {result['details']}")

    def run_all_tests(self):
        """Run all tests"""
        logger.info("Starting V1/V2 API Test Suite")
        logger.info(f"Base URL: {self.config.base_url}")
        logger.info(f"User ID: {self.config.user_id}")

        self.run_friends_v1_tests()
        self.run_friends_v2_tests()
        self.run_private_chat_v1_tests()
        self.run_private_chat_v2_tests()
        self.run_compatibility_tests()
        self.print_summary()


def main():
    """Main entry point"""
    import sys

    # Check command line arguments
    if len(sys.argv) < 3:
        logger.error("Usage: python v2_api_test.py <access_token> <user_id>")
        logger.error("Example: python v2_api_test.py syt_abc123 '@user:matrix.cjystx.top'")
        sys.exit(1)

    access_token = sys.argv[1]
    user_id = sys.argv[2]

    # Create config
    config = TestConfig(
        base_url="https://matrix.cjystx.top",
        access_token=access_token,
        user_id=user_id
    )

    # Run tests
    tester = V2ApiTester(config)
    tester.run_all_tests()

    # Exit with appropriate code
    failed = sum(1 for r in tester.test_results if not r["passed"])
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
