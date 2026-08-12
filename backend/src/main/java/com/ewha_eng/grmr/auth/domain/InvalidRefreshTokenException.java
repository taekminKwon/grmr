package com.ewha_eng.grmr.auth.domain;

public class InvalidRefreshTokenException extends RuntimeException {

    public InvalidRefreshTokenException() {
        super("유효하지 않거나 만료된 토큰입니다.");
    }
}
