package com.ewha_eng.grmr.auth.application;

public record RefreshResult(
    String accessToken,
    String refreshToken,
    long expiresIn
) {
}
