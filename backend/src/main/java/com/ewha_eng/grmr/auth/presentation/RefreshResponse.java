package com.ewha_eng.grmr.auth.presentation;

import com.ewha_eng.grmr.auth.domain.RefreshResult;

public record RefreshResponse(String accessToken, String refreshToken, long expiresIn) {

    public static RefreshResponse from(RefreshResult result) {
        return new RefreshResponse(result.accessToken(), result.refreshToken(), result.expiresIn());
    }
}
