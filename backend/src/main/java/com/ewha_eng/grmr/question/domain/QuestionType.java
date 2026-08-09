package com.ewha_eng.grmr.question.domain;

import org.springframework.util.StringUtils;

public enum QuestionType {
    MULTIPLE_CHOICE,
    FILL_IN_BLANK,
    ERROR_FINDING;

    public static QuestionType fromLabel(String label) {
        if (!StringUtils.hasText(label)) {
            return null;
        }
        return switch (label) {
            case "객관식" -> MULTIPLE_CHOICE;
            case "빈칸" -> FILL_IN_BLANK;
            case "오류 찾기" -> ERROR_FINDING;
            default -> throw new InvalidQuestionException("알 수 없는 문제 유형입니다: " + label);
        };
    }
}
