package com.ewha_eng.grmr.auth.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.auth.domain.InvalidCredentialsException;
import com.ewha_eng.grmr.auth.domain.InvalidRefreshTokenException;
import com.ewha_eng.grmr.auth.domain.LoginResult;
import com.ewha_eng.grmr.auth.domain.RefreshResult;
import com.ewha_eng.grmr.auth.domain.RefreshTokenReader;
import com.ewha_eng.grmr.auth.domain.RefreshTokenStore;
import com.ewha_eng.grmr.auth.infrastructure.JwtTokenProvider;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private MemberReader memberReader;

    @Mock
    private RefreshTokenReader refreshTokenReader;

    @Mock
    private RefreshTokenStore refreshTokenStore;

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private PasswordEncoder passwordEncoder;

    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        authService = new AuthServiceImpl(memberReader, refreshTokenReader, refreshTokenStore, jwtTokenProvider, passwordEncoder);
    }

    private Member adminMember() {
        return Member.builder()
            .loginId("admin01")
            .password("hashed-password")
            .name("권태민")
            .type(MemberType.ADMIN)
            .build();
    }

    @Test
    void login_returnsTokens_whenCredentialsAreValid() {
        Member member = adminMember();
        when(memberReader.findByLoginId("admin01")).thenReturn(Optional.of(member));
        when(passwordEncoder.matches("password123!", "hashed-password")).thenReturn(true);
        when(jwtTokenProvider.createAccessToken(any(), eq(MemberType.ADMIN))).thenReturn("access-token");
        when(jwtTokenProvider.createRefreshToken(any())).thenReturn("refresh-token");
        when(jwtTokenProvider.getAccessTokenExpirationSeconds()).thenReturn(3600L);
        when(jwtTokenProvider.getRefreshTokenExpirationMillis()).thenReturn(1_209_600_000L);

        LoginResult result = authService.login("admin01", "password123!");

        assertThat(result.accessToken()).isEqualTo("access-token");
        assertThat(result.refreshToken()).isEqualTo("refresh-token");
        assertThat(result.expiresIn()).isEqualTo(3600L);
        assertThat(result.role()).isEqualTo(MemberType.ADMIN);
        assertThat(result.name()).isEqualTo("권태민");
        verify(refreshTokenStore).save(any(), eq("refresh-token"), eq(1_209_600_000L));
    }

    @Test
    void login_throwsInvalidCredentials_whenLoginIdNotFound() {
        when(memberReader.findByLoginId("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login("unknown", "password123!"))
            .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void login_throwsInvalidCredentials_whenPasswordDoesNotMatch() {
        Member member = adminMember();
        when(memberReader.findByLoginId("admin01")).thenReturn(Optional.of(member));
        when(passwordEncoder.matches("wrong-password", "hashed-password")).thenReturn(false);

        assertThatThrownBy(() -> authService.login("admin01", "wrong-password"))
            .isInstanceOf(InvalidCredentialsException.class);
    }

    @Test
    void refresh_reissuesTokens_whenRefreshTokenIsValidAndMatchesStore() {
        when(jwtTokenProvider.isValid("refresh-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("refresh-token")).thenReturn(1L);
        when(refreshTokenReader.findByMemberId(1L)).thenReturn(Optional.of("refresh-token"));
        Member storedMember = adminMember();
        ReflectionTestUtils.setField(storedMember, "id", 1L);
        when(memberReader.findById(1L)).thenReturn(Optional.of(storedMember));
        when(jwtTokenProvider.createAccessToken(eq(1L), any())).thenReturn("new-access-token");
        when(jwtTokenProvider.createRefreshToken(1L)).thenReturn("new-refresh-token");
        when(jwtTokenProvider.getAccessTokenExpirationSeconds()).thenReturn(3600L);
        when(jwtTokenProvider.getRefreshTokenExpirationMillis()).thenReturn(1_209_600_000L);

        RefreshResult result = authService.refresh("refresh-token");

        assertThat(result.accessToken()).isEqualTo("new-access-token");
        assertThat(result.refreshToken()).isEqualTo("new-refresh-token");
        verify(refreshTokenStore).save(eq(1L), eq("new-refresh-token"), eq(1_209_600_000L));
    }

    @Test
    void refresh_throwsInvalidRefreshToken_whenTokenSignatureIsInvalid() {
        when(jwtTokenProvider.isValid("bad-token")).thenReturn(false);

        assertThatThrownBy(() -> authService.refresh("bad-token"))
            .isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    void refresh_throwsInvalidRefreshToken_whenTokenNotFoundInStore() {
        when(jwtTokenProvider.isValid("refresh-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("refresh-token")).thenReturn(1L);
        when(refreshTokenReader.findByMemberId(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.refresh("refresh-token"))
            .isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    void refresh_throwsInvalidRefreshToken_whenStoredTokenDoesNotMatch() {
        when(jwtTokenProvider.isValid("refresh-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("refresh-token")).thenReturn(1L);
        when(refreshTokenReader.findByMemberId(1L)).thenReturn(Optional.of("a-different-token"));

        assertThatThrownBy(() -> authService.refresh("refresh-token"))
            .isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    void logout_deletesStoredRefreshToken_whenTokenIsValid() {
        when(jwtTokenProvider.isValid("refresh-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("refresh-token")).thenReturn(1L);

        authService.logout("refresh-token");

        verify(refreshTokenStore).deleteByMemberId(1L);
    }

    @Test
    void logout_doesNothing_whenTokenIsInvalid() {
        when(jwtTokenProvider.isValid("bad-token")).thenReturn(false);

        authService.logout("bad-token");

        verify(refreshTokenStore, never()).deleteByMemberId(anyLong());
    }
}
