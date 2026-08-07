package com.ewha_eng.grmr.auth.domain;

public interface RefreshTokenStore {

    void save(Long memberId, String refreshToken, long ttlMillis);

    void deleteByMemberId(Long memberId);
}
