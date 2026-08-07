package com.ewha_eng.grmr.auth.presentation;

import com.ewha_eng.grmr.auth.application.LoginResult;

public record LoginResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    long expiresIn,
    String role,
    String name
) {

    public static LoginResponse from(LoginResult result) {
        return new LoginResponse(
            result.accessToken(),
            result.refreshToken(),
            "Bearer",
            result.expiresIn(),
            result.role().name(),
            result.name()
        );
    }
}
