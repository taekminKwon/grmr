package com.ewha_eng.grmr.auth.domain;

public interface AuthService {

    LoginResult login(String loginId, String rawPassword);

    RefreshResult refresh(String refreshToken);

    void logout(String refreshToken);
}
