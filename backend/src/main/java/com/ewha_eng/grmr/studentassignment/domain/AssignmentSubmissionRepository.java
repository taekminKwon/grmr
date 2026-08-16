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
}
