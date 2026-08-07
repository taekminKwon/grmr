package com.ewha_eng.grmr.auth.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.member.domain.MemberType;
import org.junit.jupiter.api.Test;

class JwtTokenProviderTest {

    private static final String SECRET = "test-secret-key-that-is-long-enough-for-hs256-signing";

    private final JwtTokenProvider provider =
        new JwtTokenProvider(SECRET, 3_600_000L, 1_209_600_000L);

    @Test
    void createAccessToken_roundTripsMemberIdAndType() {
        String token = provider.createAccessToken(42L, MemberType.ADMIN);

        assertThat(provider.isValid(token)).isTrue();
        assertThat(provider.getMemberId(token)).isEqualTo(42L);
        assertThat(provider.getMemberType(token)).isEqualTo(MemberType.ADMIN);
    }

    @Test
    void createRefreshToken_roundTripsMemberId() {
        String token = provider.createRefreshToken(7L);

        assertThat(provider.isValid(token)).isTrue();
        assertThat(provider.getMemberId(token)).isEqualTo(7L);
    }

    @Test
    void isValid_returnsFalse_forTamperedToken() {
        String token = provider.createAccessToken(1L, MemberType.STUDENT);

        assertThat(provider.isValid(token + "tampered")).isFalse();
    }

    @Test
    void isValid_returnsFalse_forExpiredToken() {
        JwtTokenProvider expiredProvider = new JwtTokenProvider(SECRET, -1000L, -1000L);
        String token = expiredProvider.createAccessToken(1L, MemberType.STUDENT);

        assertThat(expiredProvider.isValid(token)).isFalse();
    }

    @Test
    void isValid_returnsFalse_forGarbageString() {
        assertThat(provider.isValid("not-a-jwt")).isFalse();
    }

    @Test
    void getAccessTokenExpirationSeconds_convertsMillisToSeconds() {
        assertThat(provider.getAccessTokenExpirationSeconds()).isEqualTo(3600L);
    }
}
