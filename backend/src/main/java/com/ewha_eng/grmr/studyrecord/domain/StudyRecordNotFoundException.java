package com.ewha_eng.grmr.studyrecord.domain;

public class StudyRecordNotFoundException extends RuntimeException {

    public StudyRecordNotFoundException(String message) {
        super(message);
    }
}
