package com.ewha_eng.grmr.studyrecord.domain;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface StudyRecordReader {

    Optional<StudyRecord> findByIdAndMemberId(Long id, Long memberId);

    Page<StudyRecord> search(Long memberId, String category, Pageable pageable);

    /**
     * Immutable ASSIGNMENT-type snapshots for one student's attempt at one assignment, created by
     * the final-submit flow. Empty when the student hasn't submitted.
     */
    List<StudyRecord> findAssignmentAttempts(Long memberId, Long assignmentId);

    /**
     * Day-level rollup used by {@code GET /api/study-records} (admin) and {@code GET
     * /api/me/history}, grouped by (studentId, date, type) over {@code [periodStartInclusive,
     * periodEndExclusive)}. {@code studentId}/{@code type} narrow the group when given; both may
     * be {@code null} to cover all students/types. Grouping, ordering (date desc, studentId asc,
     * type asc) and offset/limit are all applied in SQL, and the page's total reflects a
     * DB-side count of distinct groups rather than the fetched page size.
     */
    Page<StudyRecordRollup> searchRollups(Long studentId, LocalDateTime periodStartInclusive,
        LocalDateTime periodEndExclusive, StudyRecordType type, Pageable pageable);
}
