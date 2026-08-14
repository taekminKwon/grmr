package com.ewha_eng.grmr.studyrecord.presentation;

import com.ewha_eng.grmr.global.exception.InvalidRequestException;

public record PracticeAnswerRequest(Long questionId, String answer) {

    public Long toQuestionId() {
        if (questionId == null) {
            throw new InvalidRequestException("문제 ID는 필수입니다.");
        }
        return questionId;
    }

    public String toAnswer() {
        if (answer == null || answer.isBlank()) {
            throw new InvalidRequestException("답안 입력은 필수입니다.");
        }
        return answer;
    }
}
