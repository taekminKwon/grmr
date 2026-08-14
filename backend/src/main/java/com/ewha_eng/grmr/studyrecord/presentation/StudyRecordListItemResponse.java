package com.ewha_eng.grmr.studyrecord.presentation;

import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import java.time.LocalDateTime;

public record StudyRecordListItemResponse(
    Long id,
    Long questionId,
    String type,
    String category,
    String level,
    boolean correct,
    LocalDateTime submittedAt
) {

    public static StudyRecordListItemResponse from(StudyRecord studyRecord) {
        return new StudyRecordListItemResponse(
            studyRecord.getId(),
            studyRecord.getQuestion().getId(),
            studyRecord.getType().name(),
            studyRecord.getCategory(),
            label(studyRecord.getLevel()),
            studyRecord.isCorrect(),
            studyRecord.getSubmittedAt()
        );
    }

    private static String label(QuestionLevel level) {
        return switch (level) {
            case BASIC -> "기초";
            case INTERMEDIATE -> "보통";
            case ADVANCED -> "심화";
        };
    }
}
