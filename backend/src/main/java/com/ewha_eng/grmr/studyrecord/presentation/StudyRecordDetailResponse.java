package com.ewha_eng.grmr.studyrecord.presentation;

import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import java.time.LocalDateTime;
import java.util.List;

public record StudyRecordDetailResponse(
    Long id,
    Long questionId,
    String type,
    QuestionSnapshotResponse question,
    String submittedAnswer,
    boolean correct,
    LocalDateTime submittedAt
) {

    public static StudyRecordDetailResponse from(StudyRecord studyRecord) {
        return new StudyRecordDetailResponse(
            studyRecord.getId(),
            studyRecord.getQuestion().getId(),
            studyRecord.getType().name(),
            QuestionSnapshotResponse.from(studyRecord),
            studyRecord.getSubmittedAnswer(),
            studyRecord.isCorrect(),
            studyRecord.getSubmittedAt()
        );
    }

    public record QuestionSnapshotResponse(
        String category,
        String level,
        String text,
        List<String> choices,
        String correctAnswer,
        String explanation
    ) {

        public static QuestionSnapshotResponse from(StudyRecord studyRecord) {
            return new QuestionSnapshotResponse(
                studyRecord.getCategory(),
                label(studyRecord.getLevel()),
                studyRecord.getText(),
                studyRecord.getChoices(),
                studyRecord.getCorrectAnswer(),
                studyRecord.getExplanation()
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
}
