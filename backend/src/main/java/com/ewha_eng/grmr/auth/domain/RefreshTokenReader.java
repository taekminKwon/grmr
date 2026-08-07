package com.ewha_eng.grmr.auth.domain;

import java.util.Optional;

public interface RefreshTokenReader {

    Optional<String> findByMemberId(Long memberId);
}
