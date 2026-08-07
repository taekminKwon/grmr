package com.ewha_eng.grmr.auth.domain;

import java.util.Optional;

public interface RefreshTokenRepository {

    void save(Long memberId, String refreshToken, long ttlMillis);

    Optional<String> findByMemberId(Long memberId);

    void deleteByMemberId(Long memberId);
}
