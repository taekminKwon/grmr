package com.ewha_eng.grmr.studentassignment.domain;

public class QuestionNotInAssignmentException extends RuntimeException {

    public QuestionNotInAssignmentException(String message) {
        super(message);
    }
}
