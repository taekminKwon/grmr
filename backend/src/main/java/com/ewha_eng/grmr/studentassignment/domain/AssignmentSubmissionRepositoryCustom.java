package com.ewha_eng.grmr.studentassignment.domain;

import java.util.List;
import java.util.Optional;

public interface AssignmentSubmissionRepositoryCustom {

    Optional<AssignmentSubmission> findWithDraftsByAssignmentIdAndStudentId(Long assignmentId, Long studentId);

    List<AssignmentSubmission> findAllWithDraftsByStudentIdAndAssignmentIdIn(Long studentId,
        List<Long> assignmentIds);
}
