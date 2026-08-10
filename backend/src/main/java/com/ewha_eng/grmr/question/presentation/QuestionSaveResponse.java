package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.domain.Question;
import java.util.List;

public record QuestionSaveResponse(
    List<QuestionListItemResponse> saved
) {

    public static QuestionSaveResponse from(List<Question> questions) {
        return new QuestionSaveResponse(questions.stream().map(QuestionListItemResponse::from).toList());
    }
}
