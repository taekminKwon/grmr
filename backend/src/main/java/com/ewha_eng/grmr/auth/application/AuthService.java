package com.ewha_eng.grmr.auth.application;

import com.ewha_eng.grmr.auth.domain.RefreshTokenReader;
import com.ewha_eng.grmr.auth.domain.RefreshTokenStore;
import com.ewha_eng.grmr.auth.infrastructure.JwtTokenProvider;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final MemberReader memberReader;
    private final RefreshTokenReader refreshTokenReader;
    private final RefreshTokenStore refreshTokenStore;
    private final JwtTokenProvider jwtTokenProvider;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public LoginResult login(String loginId, String rawPassword) {
        Member member = memberReader.findByLoginId(loginId)
            .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(rawPassword, member.getPassword())) {
            throw new InvalidCredentialsException();
        }

        return issueTokens(member);
    }

    @Transactional(readOnly = true)
    public RefreshResult refresh(String refreshToken) {
        if (!jwtTokenProvider.isValid(refreshToken)) {
            throw new InvalidRefreshTokenException();
        }

        Long memberId = jwtTokenProvider.getMemberId(refreshToken);
        String storedToken = refreshTokenReader.findByMemberId(memberId)
            .orElseThrow(InvalidRefreshTokenException::new);

        if (!storedToken.equals(refreshToken)) {
            throw new InvalidRefreshTokenException();
        }

        Member member = memberReader.findById(memberId)
            .orElseThrow(InvalidRefreshTokenException::new);

        LoginResult tokens = issueTokens(member);
        return new RefreshResult(tokens.accessToken(), tokens.refreshToken(), tokens.expiresIn());
    }

    public void logout(String refreshToken) {
        if (!jwtTokenProvider.isValid(refreshToken)) {
            return;
        }
        refreshTokenStore.deleteByMemberId(jwtTokenProvider.getMemberId(refreshToken));
    }

    private LoginResult issueTokens(Member member) {
        String accessToken = jwtTokenProvider.createAccessToken(member.getId(), member.getType());
        String refreshToken = jwtTokenProvider.createRefreshToken(member.getId());
        refreshTokenStore.save(member.getId(), refreshToken, jwtTokenProvider.getRefreshTokenExpirationMillis());

        return new LoginResult(
            accessToken,
            refreshToken,
            jwtTokenProvider.getAccessTokenExpirationSeconds(),
            member.getType(),
            member.getName()
        );
    }
}
