package com.ewha_eng.grmr.question.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface QuestionRepositoryCustom {

    Page<Question> search(String category, QuestionType type, QuestionLevel level, QuestionStatus status,
        String keyword, Pageable pageable);
}
