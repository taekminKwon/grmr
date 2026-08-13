package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;

public record PracticeQuestionResponse(
    Long id,
    String category,
    String level,
    String type,
    String text,
    List<String> choices
) {

    public static PracticeQuestionResponse from(Question question) {
        return new PracticeQuestionResponse(
            question.getId(),
            question.getCategory(),
            label(question.getLevel()),
            label(question.getType()),
            question.getText(),
            question.getChoices()
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
}
