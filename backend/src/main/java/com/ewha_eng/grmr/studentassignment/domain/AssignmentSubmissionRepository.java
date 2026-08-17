package com.ewha_eng.grmr.studentassignment.domain;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AssignmentSubmissionRepository
    extends JpaRepository<AssignmentSubmission, Long>, AssignmentSubmissionRepositoryCustom {

    Optional<AssignmentSubmission> findByAssignmentIdAndStudentId(Long assignmentId, Long studentId);

    long countByAssignmentIdAndStatus(Long assignmentId, SubmissionStatus status);

    /**
     * Locks the row for the final-submit transaction so a concurrent submit attempt on the same
     * submission blocks until this transaction commits/rolls back, instead of racing on {@code status}.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from AssignmentSubmission s where s.id = :id")
    Optional<AssignmentSubmission> findByIdForSubmission(@Param("id") Long id);

    /**
     * Same lock as {@link #findByIdForSubmission}, but keyed by the natural (assignment, student)
     * pair so the final-submit flow can acquire the lock as its <em>first</em> read of the row.
     * Reading the row once unlocked and then again under {@code FOR UPDATE} within the same
     * persistence context makes Hibernate's optimistic {@code @Version} check race a concurrent
     * committer: the blocked reader wakes up to a version bump on an already-cached instance and
     * fails with {@link org.springframework.orm.ObjectOptimisticLockingFailureException} instead of
     * cleanly observing the now-{@code SUBMITTED} row. Locking by natural key avoids that double read.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from AssignmentSubmission s where s.assignmentId = :assignmentId and s.studentId = :studentId")
    Optional<AssignmentSubmission> findByAssignmentIdAndStudentIdForSubmission(
        @Param("assignmentId") Long assignmentId, @Param("studentId") Long studentId);
}
