package com.ewha_eng.grmr.assignment.domain;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AssignmentRepository extends JpaRepository<Assignment, Long>, AssignmentRepositoryCustom {
}
