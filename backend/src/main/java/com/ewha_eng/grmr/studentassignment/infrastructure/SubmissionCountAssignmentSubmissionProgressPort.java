package com.ewha_eng.grmr.studentassignment.infrastructure;

import com.ewha_eng.grmr.assignment.application.AssignmentSubmissionProgress;
import com.ewha_eng.grmr.assignment.application.AssignmentSubmissionProgressPort;
import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepository;
import com.ewha_eng.grmr.studentassignment.domain.SubmissionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin-facing submission rate: SUBMITTED count for the assignment divided by how many students
 * are actually targeted (1 for a STUDENT-targeted assignment, or the member count of the target
 * group for a CLASS-targeted assignment).
 */
@Component
@RequiredArgsConstructor
public class SubmissionCountAssignmentSubmissionProgressPort implements AssignmentSubmissionProgressPort {

    private final AssignmentRepository assignmentRepository;
    private final MemberReader memberReader;
    private final AssignmentSubmissionRepository assignmentSubmissionRepository;

    @Override
    @Transactional(readOnly = true)
    public AssignmentSubmissionProgress progressFor(Long assignmentId) {
        if (assignmentId == null) {
            return AssignmentSubmissionProgress.zero();
        }

        return assignmentRepository.findById(assignmentId)
            .map(assignment -> new AssignmentSubmissionProgress(
                resolveTargetCount(assignment),
                (int) assignmentSubmissionRepository.countByAssignmentIdAndStatus(assignmentId,
                    SubmissionStatus.SUBMITTED)))
            .orElseGet(AssignmentSubmissionProgress::zero);
    }

    private int resolveTargetCount(Assignment assignment) {
        if (assignment.getTargetType() == AssignmentTargetType.STUDENT) {
            return 1;
        }
        return (int) memberReader.countByTypeAndStudentGroup(MemberType.STUDENT, assignment.getTargetGroup());
    }
}
