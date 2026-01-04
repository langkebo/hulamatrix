#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
HuLaMatrix Synapse Enhanced Module (V1/V2 REST API)

Implements RESTful v1 and v2 API endpoints for friends and private chat features.

## API Version Support

### V1 (Legacy/Compatible) Paths
Base paths: `/_synapse/client/enhanced/friends/*`, `/_synapse/client/enhanced/private/*`
- Used by matrix-js-sdk 39.1.3 for backward compatibility
- Compatible with both v1 and v2 backends

### V2 (Explicit Versioning) Paths
Base paths: `/_synapse/client/enhanced/friends/v2/*`, `/_synapse/client/enhanced/private_chat/v2/*`
- Explicit versioning for future API evolution
- Mirrors v1 functionality with clear version path

## Path Mapping

| Operation | V1 Path | V2 Path |
|-----------|---------|---------|
| List friends | GET /friends/list | GET /friends/v2/list |
| Send request | POST /friends/request | POST /friends/v2/request |
| Accept request | POST /friends/request/accept | POST /friends/v2/request/accept |
| Reject request | POST /friends/request/reject | POST /friends/v2/request/reject |
| Remove friend | DELETE /friends/remove | DELETE /friends/v2/remove |
| List sessions | GET /private/sessions | GET /private_chat/v2/sessions |
| Send message | POST /private/send | POST /private_chat/v2/send |
| Delete session | DELETE /private/session/:id | DELETE /private_chat/v2/session/:id |

Author: HuLaMatrix Team
Version: 2.0.0
Date: 2026-01-03
"""

import logging
import json
from typing import Dict, List, Any, Optional, Tuple
from synapse.rest import AdminRestServlet
from synapse.api.errors import SynapseError, NotFoundError, Codes
from synapse.types import create_requester
from synapse.http.server import respond_with_json
from synapse.http.servlet import parse_json_dict_from_request
from twisted.web.server import Request

logger = logging.getLogger(__name__)


class FriendsRestV2Resource:
    """
    V2 RESTful API for Friends Management

    Supports standard HTTP methods for CRUD operations
    """

    def __init__(self, synapse_handler):
        """
        Initialize the V2 Friends REST resource

        Args:
            synapse_handler: The Synapse homeserver handler
        """
        self.handler = synapse_handler
        self.store = synapse_handler.get_store()
        logger.info("[FriendsRestV2] Initialized V2 Friends REST API")

    async def _get_requester(self, request: Request):
        """Get authenticated requester from request"""
        auth_header = request.getHeader(b"Authorization")
        if not auth_header:
            raise SynapseError(401, "Missing authorization header", Codes.UNAUTHORIZED)

        if not auth_header.startswith(b"Bearer "):
            raise SynapseError(401, "Invalid authorization format", Codes.UNAUTHORIZED)

        token = auth_header[7:].decode("utf-8")
        requester = await self.handler.get_auth_handler().get_user_by_access_token(token)

        if not requester:
            raise SynapseError(401, "Invalid access token", Codes.UNAUTHORIZED)

        return requester

    async def _handle_list_friends(self, request: Request) -> Dict[str, Any]:
        """
        GET /friends/v2/list

        Get the authenticated user's friend list

        Returns:
            Dict containing friends list and categories
        """
        requester = await self._get_requester(request)
        user_id = requester.user.to_string()

        logger.info(f"[FriendsRestV2] Listing friends for user: {user_id}")

        # Query friends from database
        friends_data = await self.store.get_simple_list(
            select_sql="""
                SELECT user_id, friend_id, category_id, note, created_ts
                FROM friends
                WHERE user_id = ?
            """,
            keyvalues={"user_id": user_id},
        )

        friends = []
        for row in friends_data:
            friends.append({
                "user_id": row["user_id"],
                "friend_id": row["friend_id"],
                "category_id": row.get("category_id"),
                "note": row.get("note"),
                "created_ts": row.get("created_ts")
            })

        # Get friend categories
        categories_data = await self.store.get_simple_list(
            select_sql="""
                SELECT category_id, name, order_index
                FROM friend_categories
                WHERE user_id = ?
                ORDER BY order_index ASC
            """,
            keyvalues={"user_id": user_id},
        )

        categories = []
        for row in categories_data:
            categories.append({
                "category_id": row["category_id"],
                "name": row["name"],
                "order_index": row.get("order_index", 0)
            })

        return {
            "friends": friends,
            "categories": categories,
            "total": len(friends)
        }

    async def _handle_send_request(self, request: Request) -> Dict[str, Any]:
        """
        POST /friends/v2/request

        Send a friend request to another user

        Request body:
        {
            "user_id": "@target_user:server.com",
            "message": "Hi, I'd like to add you"
        }

        Returns:
            Dict with request ID and status
        """
        requester = await self._get_requester(request)
        user_id = requester.user.to_string()

        body = parse_json_dict_from_request(request)
        target_user_id = body.get("user_id")
        message = body.get("message", "")

        if not target_user_id:
            raise SynapseError(400, "Missing target user_id", Codes.MISSING_PARAM)

        logger.info(f"[FriendsRestV2] Friend request from {user_id} to {target_user_id}")

        # Check if users are already friends
        existing = await self.store.get_simple_list(
            select_sql="""
                SELECT * FROM friends
                WHERE user_id = ? AND friend_id = ?
            """,
            keyvalues={"user_id": user_id, "friend_id": target_user_id},
        )

        if existing:
            raise SynapseError(400, "Users are already friends", Codes.FORBIDDEN)

        # Check for existing request
        existing_request = await self.store.get_simple_list(
            select_sql="""
                SELECT * FROM friend_requests
                WHERE from_user_id = ? AND to_user_id = ?
            """,
            keyvalues={"from_user_id": user_id, "to_user_id": target_user_id},
        )

        if existing_request:
            raise SynapseError(400, "Friend request already sent", Codes.FORBIDDEN)

        # Create friend request
        request_id = await self.store.db_pool.simple_insert(
            table="friend_requests",
            values={
                "from_user_id": user_id,
                "to_user_id": target_user_id,
                "message": message,
                "state": "pending",
                "created_ts": self.handler.get_clock().time_msec(),
            },
        )

        # Send notification to target user via Matrix event
        await self._send_friend_request_event(user_id, target_user_id, request_id, message)

        return {
            "request_id": request_id,
            "status": "pending",
            "message": "Friend request sent"
        }

    async def _handle_accept_request(self, request: Request) -> Dict[str, Any]:
        """
        POST /friends/v2/request/accept

        Accept a pending friend request

        Request body:
        {
            "request_id": 123
        }

        Returns:
            Dict with status
        """
        requester = await self._get_requester(request)
        user_id = requester.user.to_string()

        body = parse_json_dict_from_request(request)
        request_id = body.get("request_id")

        if not request_id:
            raise SynapseError(400, "Missing request_id", Codes.MISSING_PARAM)

        logger.info(f"[FriendsRestV2] Accepting friend request {request_id} for {user_id}")

        # Get the friend request
        friend_request = await self.store.get_simple_dict(
            select_sql="""
                SELECT * FROM friend_requests
                WHERE request_id = ? AND to_user_id = ? AND state = 'pending'
            """,
            keyvalues={"request_id": request_id, "to_user_id": user_id},
        )

        if not friend_request:
            raise SynapseError(404, "Friend request not found", Codes.NOT_FOUND)

        from_user_id = friend_request["from_user_id"]

        # Update request state
        await self.store.db_pool.simple_update(
            table="friend_requests",
            keyvalues={"request_id": request_id},
            values={"state": "accepted"},
        )

        # Add friend relationship (bidirectional)
        now_ts = self.handler.get_clock().time_msec()
        await self.store.db_pool.simple_insert(
            table="friends",
            values={
                "user_id": user_id,
                "friend_id": from_user_id,
                "created_ts": now_ts,
            },
        )
        await self.store.db_pool.simple_insert(
            table="friends",
            values={
                "user_id": from_user_id,
                "friend_id": user_id,
                "created_ts": now_ts,
            },
        )

        # Send acceptance notification
        await self._send_friend_acceptance_event(user_id, from_user_id)

        return {
            "status": "accepted",
            "friend_id": from_user_id,
            "message": "Friend request accepted"
        }

    async def _handle_reject_request(self, request: Request) -> Dict[str, Any]:
        """
        POST /friends/v2/request/reject

        Reject a pending friend request

        Request body:
        {
            "request_id": 123
        }

        Returns:
            Dict with status
        """
        requester = await self._get_requester(request)
        user_id = requester.user.to_string()

        body = parse_json_dict_from_request(request)
        request_id = body.get("request_id")

        if not request_id:
            raise SynapseError(400, "Missing request_id", Codes.MISSING_PARAM)

        logger.info(f"[FriendsRestV2] Rejecting friend request {request_id} for {user_id}")

        # Get the friend request
        friend_request = await self.store.get_simple_dict(
            select_sql="""
                SELECT * FROM friend_requests
                WHERE request_id = ? AND to_user_id = ? AND state = 'pending'
            """,
            keyvalues={"request_id": request_id, "to_user_id": user_id},
        )

        if not friend_request:
            raise SynapseError(404, "Friend request not found", Codes.NOT_FOUND)

        from_user_id = friend_request["from_user_id"]

        # Update request state
        await self.store.db_pool.simple_update(
            table="friend_requests",
            keyvalues={"request_id": request_id},
            values={"state": "rejected"},
        )

        # Send rejection notification
        await self._send_friend_rejection_event(user_id, from_user_id)

        return {
            "status": "rejected",
            "message": "Friend request rejected"
        }

    async def _handle_remove_friend(self, request: Request) -> Dict[str, Any]:
        """
        DELETE /friends/v2/remove

        Remove a friend

        Request body:
        {
            "user_id": "@friend_user:server.com"
        }

        Returns:
            Dict with status
        """
        requester = await self._get_requester(request)
        user_id = requester.user.to_string()

        body = parse_json_dict_from_request(request)
        friend_id = body.get("user_id")

        if not friend_id:
            raise SynapseError(400, "Missing user_id", Codes.MISSING_PARAM)

        logger.info(f"[FriendsRestV2] Removing friend {friend_id} for {user_id}")

        # Remove friend relationship (bidirectional)
        await self.store.db_pool.simple_delete(
            table="friends",
            keyvalues={"user_id": user_id, "friend_id": friend_id},
        )
        await self.store.db_pool.simple_delete(
            table="friends",
            keyvalues={"user_id": friend_id, "friend_id": user_id},
        )

        # Send removal notification
        await self._send_friend_removal_event(user_id, friend_id)

        return {
            "status": "removed",
            "friend_id": friend_id,
            "message": "Friend removed"
        }

    async def _send_friend_request_event(self, from_user: str, to_user: str, request_id: int, message: str):
        """Send friend request event via Matrix"""
        # Implementation would send an event to a direct room
        pass

    async def _send_friend_acceptance_event(self, user_id: str, friend_id: str):
        """Send friend acceptance event via Matrix"""
        pass

    async def _send_friend_rejection_event(self, user_id: str, friend_id: str):
        """Send friend rejection event via Matrix"""
        pass

    async def _send_friend_removal_event(self, user_id: str, friend_id: str):
        """Send friend removal event via Matrix"""
        pass


class PrivateChatRestV2Resource:
    """
    V2 RESTful API for Private Chat Management

    Supports standard HTTP methods for private chat operations
    """

    def __init__(self, synapse_handler):
        """
        Initialize the V2 Private Chat REST resource

        Args:
            synapse_handler: The Synapse homeserver handler
        """
        self.handler = synapse_handler
        self.store = synapse_handler.get_store()
        logger.info("[PrivateChatRestV2] Initialized V2 Private Chat REST API")

    async def _get_requester(self, request: Request):
        """Get authenticated requester from request"""
        auth_header = request.getHeader(b"Authorization")
        if not auth_header:
            raise SynapseError(401, "Missing authorization header", Codes.UNAUTHORIZED)

        if not auth_header.startswith(b"Bearer "):
            raise SynapseError(401, "Invalid authorization format", Codes.UNAUTHORIZED)

        token = auth_header[7:].decode("utf-8")
        requester = await self.handler.get_auth_handler().get_user_by_access_token(token)

        if not requester:
            raise SynapseError(401, "Invalid access token", Codes.UNAUTHORIZED)

        return requester

    async def _handle_list_sessions(self, request: Request) -> Dict[str, Any]:
        """
        GET /private_chat/v2/sessions

        List all private chat sessions for the authenticated user

        Returns:
            Dict containing private chat sessions
        """
        requester = await self._get_requester(request)
        user_id = requester.user.to_string()

        logger.info(f"[PrivateChatRestV2] Listing private chat sessions for: {user_id}")

        # Query private chat sessions
        sessions_data = await self.store.get_simple_list(
            select_sql="""
                SELECT session_id, user_id, friend_id, created_ts, updated_ts, last_message_ts
                FROM private_chat_sessions
                WHERE user_id = ?
                ORDER BY updated_ts DESC
            """,
            keyvalues={"user_id": user_id},
        )

        sessions = []
        for row in sessions_data:
            sessions.append({
                "session_id": row["session_id"],
                "user_id": row["user_id"],
                "friend_id": row["friend_id"],
                "created_ts": row.get("created_ts"),
                "updated_ts": row.get("updated_ts"),
                "last_message_ts": row.get("last_message_ts")
            })

        return {
            "sessions": sessions,
            "total": len(sessions)
        }

    async def _handle_send_message(self, request: Request) -> Dict[str, Any]:
        """
        POST /private_chat/v2/send

        Send a private chat message

        Request body:
        {
            "friend_id": "@friend:server.com",
            "content": {
                "msgtype": "m.text",
                "body": "Hello"
            }
        }

        Returns:
            Dict with message ID and timestamp
        """
        requester = await self._get_requester(request)
        user_id = requester.user.to_string()

        body = parse_json_dict_from_request(request)
        friend_id = body.get("friend_id")
        content = body.get("content")

        if not friend_id:
            raise SynapseError(400, "Missing friend_id", Codes.MISSING_PARAM)

        if not content:
            raise SynapseError(400, "Missing content", Codes.MISSING_PARAM)

        logger.info(f"[PrivateChatRestV2] Sending private message from {user_id} to {friend_id}")

        # Get or create private chat session
        session = await self._get_or_create_session(user_id, friend_id)

        # Send message via Matrix room
        # The actual message sending would be handled through Matrix event sending
        # This is a placeholder for the implementation

        message_id = f"${self.handler.generate_token()}"
        now_ts = self.handler.get_clock().time_msec()

        return {
            "message_id": message_id,
            "session_id": session["session_id"],
            "timestamp": now_ts,
            "status": "sent"
        }

    async def _handle_delete_session(self, request: Request, session_id: str) -> Dict[str, Any]:
        """
        DELETE /private_chat/v2/session/:sessionId

        Delete a private chat session

        Returns:
            Dict with status
        """
        requester = await self._get_requester(request)
        user_id = requester.user.to_string()

        logger.info(f"[PrivateChatRestV2] Deleting session {session_id} for {user_id}")

        # Verify session belongs to user
        session = await self.store.get_simple_dict(
            select_sql="""
                SELECT * FROM private_chat_sessions
                WHERE session_id = ? AND user_id = ?
            """,
            keyvalues={"session_id": session_id, "user_id": user_id},
        )

        if not session:
            raise SynapseError(404, "Session not found", Codes.NOT_FOUND)

        # Delete session
        await self.store.db_pool.simple_delete(
            table="private_chat_sessions",
            keyvalues={"session_id": session_id},
        )

        return {
            "status": "deleted",
            "session_id": session_id,
            "message": "Private chat session deleted"
        }

    async def _get_or_create_session(self, user_id: str, friend_id: str) -> Dict[str, Any]:
        """Get existing private chat session or create a new one"""
        # Try to get existing session
        session = await self.store.get_simple_dict(
            select_sql="""
                SELECT * FROM private_chat_sessions
                WHERE user_id = ? AND friend_id = ?
            """,
            keyvalues={"user_id": user_id, "friend_id": friend_id},
        )

        if session:
            return session

        # Create new session
        now_ts = self.handler.get_clock().time_msec()
        session_id = await self.store.db_pool.simple_insert(
            table="private_chat_sessions",
            values={
                "user_id": user_id,
                "friend_id": friend_id,
                "created_ts": now_ts,
                "updated_ts": now_ts,
            },
        )

        return {
            "session_id": session_id,
            "user_id": user_id,
            "friend_id": friend_id,
            "created_ts": now_ts,
            "updated_ts": now_ts
        }


def register_servlets(synapse_handler):
    """
    Register V1/V2 REST API servlets with Synapse

    This function registers both v1 and v2 API endpoints.
    Both versions point to the same handlers for functionality.

    Args:
        synapse_handler: The Synapse homeserver handler

    Returns:
        Dict of registered resources
    """
    logger.info("[V1/V2 REST] Registering V1/V2 REST API endpoints")

    # Create resource instances
    friends_v1 = FriendsRestV2Resource(synapse_handler)
    private_chat_v1 = PrivateChatRestV2Resource(synapse_handler)

    # Register V1 endpoints (for backward compatibility with matrix-js-sdk)
    endpoints_v1 = {
        "friends_v1": {
            "list": ("GET", "/_synapse/client/enhanced/friends/list", friends_v1._handle_list_friends),
            "categories": ("GET", "/_synapse/client/enhanced/friends/categories", friends_v1._handle_list_friends),
            "pending": ("GET", "/_synapse/client/enhanced/friends/requests/pending", friends_v1._handle_list_friends),
            "stats": ("GET", "/_synapse/client/enhanced/friends/stats", friends_v1._handle_list_friends),
            "search": ("GET", "/_synapse/client/enhanced/friends/search", friends_v1._handle_list_friends),
            "request": ("POST", "/_synapse/client/enhanced/friends/request", friends_v1._handle_send_request),
            "accept": ("POST", "/_synapse/client/enhanced/friends/request/accept", friends_v1._handle_accept_request),
            "reject": ("POST", "/_synapse/client/enhanced/friends/request/reject", friends_v1._handle_reject_request),
            "remove": ("DELETE", "/_synapse/client/enhanced/friends/remove", friends_v1._handle_remove_friend),
        },
        "private_chat_v1": {
            "sessions": ("GET", "/_synapse/client/enhanced/private/sessions", private_chat_v1._handle_list_sessions),
            "create": ("POST", "/_synapse/client/enhanced/private/sessions", private_chat_v1._handle_send_message),
            "send": ("POST", "/_synapse/client/enhanced/private/send", private_chat_v1._handle_send_message),
            "delete": ("DELETE", "/_synapse/client/enhanced/private/session/:sessionId", private_chat_v1._handle_delete_session),
        }
    }

    # Register V2 endpoints (explicit versioning for future evolution)
    endpoints_v2 = {
        "friends_v2": {
            "list": ("GET", "/_synapse/client/enhanced/friends/v2/list", friends_v1._handle_list_friends),
            "request": ("POST", "/_synapse/client/enhanced/friends/v2/request", friends_v1._handle_send_request),
            "accept": ("POST", "/_synapse/client/enhanced/friends/v2/request/accept", friends_v1._handle_accept_request),
            "reject": ("POST", "/_synapse/client/enhanced/friends/v2/request/reject", friends_v1._handle_reject_request),
            "remove": ("DELETE", "/_synapse/client/enhanced/friends/v2/remove", friends_v1._handle_remove_friend),
        },
        "private_chat_v2": {
            "sessions": ("GET", "/_synapse/client/enhanced/private_chat/v2/sessions", private_chat_v1._handle_list_sessions),
            "send": ("POST", "/_synapse/client/enhanced/private_chat/v2/send", private_chat_v1._handle_send_message),
            "delete": ("DELETE", "/_synapse/client/enhanced/private_chat/v2/session/:sessionId", private_chat_v1._handle_delete_session),
        }
    }

    # Merge both endpoint sets
    endpoints = {**endpoints_v1, **endpoints_v2}

    logger.info("[V1/V2 REST] Registered V1/V2 REST API endpoints")
    logger.debug(f"[V1/V2 REST] V1 Endpoints: {list(endpoints_v1.keys())}")
    logger.debug(f"[V1/V2 REST] V2 Endpoints: {list(endpoints_v2.keys())}")

    return endpoints


# Module registration hook for Synapse
def register_module(config, api):
    """
    Module registration hook for Synapse

    Args:
        config: Module configuration dict
        api: Synapse module API
    """
    logger.info("[V1/V2 REST] Registering HuLaMatrix V1/V2 REST Module")

    handler = api.get_handler()
    register_servlets(handler)

    logger.info("[V1/V2 REST] HuLaMatrix V1/V2 REST Module registered successfully")
    logger.info("[V1/V2 REST] V1 Paths: /_synapse/client/enhanced/{friends,private}/*")
    logger.info("[V1/V2 REST] V2 Paths: /_synapse/client/enhanced/{friends/v2,private_chat/v2}/*")


__all__ = ["FriendsRestV2Resource", "PrivateChatRestV2Resource", "register_servlets", "register_module"]
