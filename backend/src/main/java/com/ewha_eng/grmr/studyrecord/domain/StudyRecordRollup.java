package com.ewha_eng.grmr.studyrecord.domain;

import java.time.LocalDate;

/**
 * One (studentId, KST date, type) group from the admin/self history rollup aggregation, per the
 * shared rollup rules in the API spec ("공통 규칙 (일자별 집계)").
 */
public record StudyRecordRollup(
    Long studentId,
    String studentName,
    LocalDate date,
    StudyRecordType type,
    int questionCount,
    int correctCount
) {

    public int accuracy() {
        if (questionCount == 0) {
            return 0;
        }
        return (int) Math.round(correctCount * 100.0 / questionCount);
    }
}
