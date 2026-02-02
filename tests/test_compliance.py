"""
GDPR & Compliance Tests - TC-GDPR-01 to TC-GDPR-03 and TC-SEC-01
"""

import pytest
from fastapi import status


class TestGDPRCompliance:
    """TC-GDPR-01 to TC-GDPR-03"""

    def test_self_data_export_success(self, client, db_session, authenticated_user, auth_headers):
        """TC-GDPR-01: Self Data Export - Authenticated User A exports A"""
        response = client.get(f"/api/v1/gdpr/{authenticated_user.id}/export", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Verify structure
        assert "user" in data
        assert "orders" in data
        assert data["user"]["id"] == authenticated_user.id
        assert data["user"]["phone_number"] == authenticated_user.phone_number

    def test_unauthorized_data_export(self, client, db_session, create_users, auth_headers):
        """TC-GDPR-02: Unauthorized Export - User A tries export User B"""
        user_a = create_users["registered"][0]
        user_b = create_users["registered"][1]
        
        # auth_headers is for user_a (from conftest)
        response = client.get(f"/api/v1/gdpr/{user_b.id}/export", headers=auth_headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_data_privacy_no_password(self, client, authenticated_user, auth_headers):
        """TC-GDPR-03: Data Privacy - hashed_password must be absent"""
        response = client.get(f"/api/v1/gdpr/{authenticated_user.id}/export", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Check user object
        assert "hashed_password" not in data["user"]
        # Also check top level just in case
        assert "hashed_password" not in data


class TestSecurityCompliance:
    """TC-SEC-01"""

    def test_sensitive_history_endpoint_removed(self, client, authenticated_user, auth_headers):
        """TC-SEC-01: Sensitive History - GET /orders/user/{uid} must be 404/405"""
        response = client.get(f"/api/v1/orders/user/{authenticated_user.id}", headers=auth_headers)
        # Should be 404 because the route is removed/not defined
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED]
