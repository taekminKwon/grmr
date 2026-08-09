package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionStatus;
import com.ewha_eng.grmr.question.domain.QuestionType;

public record QuestionListItemResponse(
    Long id,
    String category,
    String type,
    String level,
    String status,
    String text
) {

    public static QuestionListItemResponse from(Question question) {
        return new QuestionListItemResponse(
            question.getId(),
            question.getCategory(),
            label(question.getType()),
            label(question.getLevel()),
            label(question.getStatus()),
            question.getText()
        );
    }

    private static String label(QuestionType type) {
        return switch (type) {
            case MULTIPLE_CHOICE -> "객관식";
            case FILL_IN_BLANK -> "빈칸";
            case ERROR_FINDING -> "오류 찾기";
        };
    }

    private static String label(QuestionLevel level) {
        return switch (level) {
            case BASIC -> "기초";
            case INTERMEDIATE -> "보통";
            case ADVANCED -> "심화";
        };
    }

    private static String label(QuestionStatus status) {
        return switch (status) {
            case DRAFT -> "초안";
            case ACTIVE -> "사용 중";
            case INACTIVE -> "사용 중지";
        };
    }
}
