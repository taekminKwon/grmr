package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionStatus;

public record QuestionStatusResponse(
    Long id,
    String status
) {

    public static QuestionStatusResponse from(Question question) {
        return new QuestionStatusResponse(question.getId(), label(question.getStatus()));
    }

    private static String label(QuestionStatus status) {
        return switch (status) {
            case DRAFT -> "초안";
            case ACTIVE -> "사용 중";
            case INACTIVE -> "사용 중지";
        };
    }
}
