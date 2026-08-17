package com.ewha_eng.grmr.studentassignment.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AssignmentAnswerDraftRepository extends JpaRepository<AssignmentAnswerDraft, Long> {

    long countBySubmissionId(Long submissionId);
}
