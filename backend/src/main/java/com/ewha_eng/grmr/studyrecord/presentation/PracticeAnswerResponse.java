package com.ewha_eng.grmr.studyrecord.presentation;

import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import java.time.LocalDateTime;

public record PracticeAnswerResponse(
    Long id,
    Long questionId,
    boolean correct,
    String submittedAnswer,
    String correctAnswer,
    String explanation,
    LocalDateTime submittedAt
) {

    public static PracticeAnswerResponse from(StudyRecord studyRecord) {
        return new PracticeAnswerResponse(
            studyRecord.getId(),
            studyRecord.getQuestion().getId(),
            studyRecord.isCorrect(),
            studyRecord.getSubmittedAnswer(),
            studyRecord.getCorrectAnswer(),
            studyRecord.getExplanation(),
            studyRecord.getSubmittedAt()
        );
    }
}
