package com.ewha_eng.grmr.student.domain;

public class InvalidStudentSearchException extends RuntimeException {

    public InvalidStudentSearchException(String message) {
        super(message);
    }
}
