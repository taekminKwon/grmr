package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.domain.InvalidQuestionException;
import com.ewha_eng.grmr.question.domain.QuestionDraft;
import java.util.List;

public record QuestionSaveRequest(
    List<QuestionDraftItemRequest> drafts
) {

    public List<QuestionDraft> toDrafts() {
        if (drafts == null || drafts.isEmpty()) {
            throw new InvalidQuestionException("저장할 문제 초안이 필요합니다.");
        }
        return drafts.stream().map(QuestionDraftItemRequest::toQuestionDraft).toList();
    }
}
