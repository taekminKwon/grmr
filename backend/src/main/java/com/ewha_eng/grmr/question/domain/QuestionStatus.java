package com.ewha_eng.grmr.question.domain;

import org.springframework.util.StringUtils;

public enum QuestionStatus {
    DRAFT,
    ACTIVE,
    INACTIVE;

    public static QuestionStatus fromLabel(String label) {
        if (!StringUtils.hasText(label)) {
            return null;
        }
        return switch (label) {
            case "초안" -> DRAFT;
            case "사용 중" -> ACTIVE;
            case "사용 중지" -> INACTIVE;
            default -> throw new InvalidQuestionException("알 수 없는 상태입니다: " + label);
        };
    }
}
