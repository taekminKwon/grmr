package com.ewha_eng.grmr.studyrecord.domain;

public class InvalidStudyRecordException extends RuntimeException {

    public InvalidStudyRecordException(String message) {
        super(message);
    }
}
