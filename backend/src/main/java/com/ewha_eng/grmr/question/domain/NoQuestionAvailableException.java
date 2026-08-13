package com.ewha_eng.grmr.question.domain;

public class NoQuestionAvailableException extends RuntimeException {

    public NoQuestionAvailableException(String message) {
        super(message);
    }
}
