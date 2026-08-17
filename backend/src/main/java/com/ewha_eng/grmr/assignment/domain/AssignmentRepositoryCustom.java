package com.ewha_eng.grmr.assignment.domain;

import java.time.LocalDate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AssignmentRepositoryCustom {

    Page<Assignment> search(AssignmentStatus status, String keyword, LocalDate today, Pageable pageable);

    /**
     * Finds assignments targeting the given student, either individually or via their class
     * group, excluding assignments that have not started yet ({@code startDate} in the future).
     */
    Page<Assignment> findForStudent(Long studentId, String studentGroup, LocalDate today, Pageable pageable);
}
