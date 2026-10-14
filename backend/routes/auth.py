from fastapi import APIRouter, Depends, HTTPException, status

from backend.dependencies import TOKEN_TTL_SECONDS, create_access_token, get_current_user
from backend.schemas import TokenRequest, TokenResponse, UserResponse
from database.access_control import authenticate_user
from database.audit_log import log_event


router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Exchange credentials for a short-lived bearer token",
)
def issue_token(request: TokenRequest):
    user = authenticate_user(request.username, request.password)
    if user is None:
        log_event(
            "LOGIN",
            username=request.username,
            status="denied",
            details={"reason": "invalid_credentials", "client": "api"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": "Invalid username or password."},
            headers={"WWW-Authenticate": "Bearer"},
        )
    log_event(
        "LOGIN",
        username=user["username"],
        user_id=user["id"],
        status="success",
        details={"client": "api"},
    )
    return TokenResponse(
        access_token=create_access_token(user["id"]),
        expires_in=TOKEN_TTL_SECONDS,
    )


@router.get("/me", response_model=UserResponse, summary="Return the authenticated user")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.get(
    "/session",
    response_model=TokenResponse,
    summary="Get active session or bootstrap default local admin",
)
def get_session():
    import sqlite3
    from database.access_control import (
        DATABASE_PATH,
        bootstrap_admin,
        init_db,
        require_login,
    )

    init_db()
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH))
    user_row = conn.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1").fetchone()
    conn.close()

    if not user_row:
        res = bootstrap_admin("admin", "admin123456789", "AUTOSAR Demo")
        admin_user_id = res["user_id"]
    else:
        admin_user_id = user_row[0]

    current_user = require_login(admin_user_id)
    return TokenResponse(
        access_token=create_access_token(current_user["id"]),
        expires_in=TOKEN_TTL_SECONDS,
        user=UserResponse(
            id=current_user["id"],
            username=current_user["username"],
            role=current_user["role"],
        ),
    )