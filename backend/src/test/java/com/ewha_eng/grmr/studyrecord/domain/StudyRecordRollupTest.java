package com.ewha_eng.grmr.studyrecord.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class StudyRecordRollupTest {

    @Test
    void accuracy_isZero_whenQuestionCountIsZero() {
        StudyRecordRollup rollup = new StudyRecordRollup(1L, "김민수", LocalDate.of(2026, 8, 1),
            StudyRecordType.PRACTICE, 0, 0);

        assertThat(rollup.accuracy()).isZero();
    }

    @Test
    void accuracy_roundsToNearestPercent() {
        StudyRecordRollup rollup = new StudyRecordRollup(1L, "김민수", LocalDate.of(2026, 8, 1),
            StudyRecordType.ASSIGNMENT, 3, 2);

        assertThat(rollup.accuracy()).isEqualTo(67);
    }

    @Test
    void accuracy_roundsHalfUp_atExactMidpoint() {
        StudyRecordRollup rollup = new StudyRecordRollup(1L, "김민수", LocalDate.of(2026, 8, 1),
            StudyRecordType.PRACTICE, 8, 5);

        assertThat(rollup.accuracy()).isEqualTo(63);
    }

    @Test
    void accuracy_is100_whenAllCorrect() {
        StudyRecordRollup rollup = new StudyRecordRollup(1L, "김민수", LocalDate.of(2026, 8, 1),
            StudyRecordType.PRACTICE, 20, 20);

        assertThat(rollup.accuracy()).isEqualTo(100);
    }
}
