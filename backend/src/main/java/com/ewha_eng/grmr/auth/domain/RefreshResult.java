package com.ewha_eng.grmr.auth.domain;

public record RefreshResult(
    String accessToken,
    String refreshToken,
    long expiresIn
) {
}
