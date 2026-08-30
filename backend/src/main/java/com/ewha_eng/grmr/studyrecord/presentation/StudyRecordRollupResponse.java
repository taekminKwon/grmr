package com.ewha_eng.grmr.studyrecord.presentation;

import com.ewha_eng.grmr.studyrecord.domain.StudyRecordRollup;
import java.time.LocalDate;

public record StudyRecordRollupResponse(
    Long studentId,
    String studentName,
    LocalDate date,
    String type,
    int questionCount,
    int correctCount,
    int accuracy,
    int durationMinutes
) {

    public static StudyRecordRollupResponse from(StudyRecordRollup rollup) {
        return new StudyRecordRollupResponse(
            rollup.studentId(),
            rollup.studentName(),
            rollup.date(),
            rollup.type().name(),
            rollup.questionCount(),
            rollup.correctCount(),
            rollup.accuracy(),
            0
        );
    }
}
