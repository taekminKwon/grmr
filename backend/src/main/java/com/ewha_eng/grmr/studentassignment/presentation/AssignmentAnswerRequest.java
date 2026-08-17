package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.global.exception.InvalidRequestException;

public record AssignmentAnswerRequest(String answer) {

    public String toAnswer() {
        if (answer == null || answer.isBlank()) {
            throw new InvalidRequestException("답안 입력은 필수입니다.");
        }
        return answer;
    }
}
