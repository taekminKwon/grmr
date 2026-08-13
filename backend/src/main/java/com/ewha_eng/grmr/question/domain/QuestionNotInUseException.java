package com.ewha_eng.grmr.question.domain;

public class QuestionNotInUseException extends RuntimeException {

    public QuestionNotInUseException(String message) {
        super(message);
    }
}
