package com.ewha_eng.grmr.studyrecord.domain;

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
}
