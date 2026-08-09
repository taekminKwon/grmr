package com.ewha_eng.grmr.question.domain;

import org.springframework.util.StringUtils;

public enum QuestionLevel {
    BASIC,
    INTERMEDIATE,
    ADVANCED;

    public static QuestionLevel fromLabel(String label) {
        if (!StringUtils.hasText(label)) {
            return null;
        }
        return switch (label) {
            case "기초" -> BASIC;
            case "보통" -> INTERMEDIATE;
            case "심화" -> ADVANCED;
            default -> throw new InvalidQuestionException("알 수 없는 난이도입니다: " + label);
        };
    }
}
