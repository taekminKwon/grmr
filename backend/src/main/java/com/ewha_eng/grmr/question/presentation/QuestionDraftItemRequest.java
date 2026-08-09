package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.domain.InvalidQuestionException;
import com.ewha_eng.grmr.question.domain.QuestionDraft;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;

public record QuestionDraftItemRequest(
    String category,
    String type,
    String level,
    String text,
    List<String> choices,
    String answer,
    String explanation
) {

    public QuestionDraft toQuestionDraft() {
        return new QuestionDraft(toCategory(), toQuestionType(), toQuestionLevel(), text, choices, answer,
            explanation);
    }

    private String toCategory() {
        if (category == null || category.isBlank()) {
            throw new InvalidQuestionException("문법 항목은 필수입니다.");
        }
        return category;
    }

    private QuestionType toQuestionType() {
        if (type == null || type.isBlank()) {
            throw new InvalidQuestionException("문제 유형은 필수입니다.");
        }
        return QuestionType.fromLabel(type);
    }

    private QuestionLevel toQuestionLevel() {
        if (level == null || level.isBlank()) {
            throw new InvalidQuestionException("난이도는 필수입니다.");
        }
        return QuestionLevel.fromLabel(level);
    }
}
