package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.domain.QuestionDraft;
import java.util.List;

public record QuestionGenerateResponse(
    List<QuestionDraftResponse> drafts
) {

    public static QuestionGenerateResponse from(List<QuestionDraft> drafts) {
        return new QuestionGenerateResponse(drafts.stream().map(QuestionDraftResponse::from).toList());
    }
}
