package com.ewha_eng.grmr.studentassignment.application;

import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmission;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Runs the first-submission insert in its own physical transaction (REQUIRES_NEW) so that a
 * unique-constraint race with a concurrent request only rolls back this insert attempt, not the
 * caller's read transaction.
 *
 * <p>The unique-constraint violation must be left to propagate out of this method rather than be
 * caught here: {@code saveAndFlush} runs through Spring Data's own {@code @Transactional} (REQUIRED),
 * which joins this REQUIRES_NEW transaction, so a failure marks *this* transaction rollback-only
 * before a local catch could even see it — swallowing it here would only trade the constraint
 * violation for an {@code UnexpectedRollbackException} at commit. The caller must catch
 * {@link DataIntegrityViolationException} instead, once this transaction has actually rolled back.
 */
@Component
@RequiredArgsConstructor
public class AssignmentSubmissionStarter {

    private final AssignmentSubmissionRepository submissionRepository;
    private final Clock clock;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AssignmentSubmission startNew(Long assignmentId, Long studentId) {
        return submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignmentId, studentId, LocalDateTime.now(clock)));
    }
}
