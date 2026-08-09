package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.domain.QuestionDraft;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;

public record QuestionDraftResponse(
    String category,
    String type,
    String level,
    String text,
    List<String> choices,
    String answer,
    String explanation
) {

    public static QuestionDraftResponse from(QuestionDraft draft) {
        return new QuestionDraftResponse(
            draft.category(),
            label(draft.type()),
            label(draft.level()),
            draft.text(),
            draft.choices(),
            draft.answer(),
            draft.explanation()
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
