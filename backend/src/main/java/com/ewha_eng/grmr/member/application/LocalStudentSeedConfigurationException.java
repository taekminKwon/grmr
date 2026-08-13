package com.ewha_eng.grmr.member.application;

public class LocalStudentSeedConfigurationException extends RuntimeException {

    public LocalStudentSeedConfigurationException() {
        super("local 프로파일에서 학생 시드 계정이 활성화(LOCAL_STUDENT_SEED_ENABLED=true)되었지만 계정 정보"
            + "(LOCAL_STUDENT_LOGIN_ID, LOCAL_STUDENT_PASSWORD, LOCAL_STUDENT_NAME)가 설정되지 않았습니다. "
            + ".env 파일을 확인하세요.");
    }
}
