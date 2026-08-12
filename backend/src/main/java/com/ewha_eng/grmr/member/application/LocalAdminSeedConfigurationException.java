package com.ewha_eng.grmr.member.application;

public class LocalAdminSeedConfigurationException extends RuntimeException {

    public LocalAdminSeedConfigurationException() {
        super("local 프로파일이 활성화된 상태에서 관리자 시드 계정 정보(LOCAL_ADMIN_LOGIN_ID, LOCAL_ADMIN_PASSWORD, "
            + "LOCAL_ADMIN_NAME)가 설정되지 않았습니다. .env 파일을 확인하세요.");
    }
}
