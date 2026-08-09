package com.ewha_eng.grmr.question.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface QuestionRepository extends JpaRepository<Question, Long>,
    JpaSpecificationExecutor<Question> {
}
