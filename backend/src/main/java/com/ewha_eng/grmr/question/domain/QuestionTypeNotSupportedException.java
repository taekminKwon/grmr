package com.ewha_eng.grmr.question.domain;

public class QuestionTypeNotSupportedException extends RuntimeException {

    public QuestionTypeNotSupportedException(String message) {
        super(message);
    }
}
