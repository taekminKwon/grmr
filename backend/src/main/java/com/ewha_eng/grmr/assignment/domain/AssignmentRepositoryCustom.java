package com.ewha_eng.grmr.assignment.domain;

import java.time.LocalDate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AssignmentRepositoryCustom {

    Page<Assignment> search(AssignmentStatus status, String keyword, LocalDate today, Pageable pageable);
}
