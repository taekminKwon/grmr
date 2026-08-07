package com.ewha_eng.grmr.auth.application;

import com.ewha_eng.grmr.member.domain.MemberType;

public record LoginResult(
    String accessToken,
    String refreshToken,
    long expiresIn,
    MemberType role,
    String name
) {
}
