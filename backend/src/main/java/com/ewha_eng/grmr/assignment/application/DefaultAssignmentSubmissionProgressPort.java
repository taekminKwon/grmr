package com.ewha_eng.grmr.assignment.application;

import org.springframework.stereotype.Component;

/**
 * Submission persistence does not exist yet, so admin views always see zero progress
 * until a real collaborator backed by submission storage replaces this bean.
 */
@Component
public class DefaultAssignmentSubmissionProgressPort implements AssignmentSubmissionProgressPort {

    @Override
    public AssignmentSubmissionProgress progressFor(Long assignmentId) {
        return AssignmentSubmissionProgress.zero();
    }
}
