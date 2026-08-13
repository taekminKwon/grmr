package com.ewha_eng.grmr.question.domain;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface QuestionRepositoryCustom {

    Page<Question> search(String category, QuestionType type, QuestionLevel level, QuestionStatus status,
        String keyword, Pageable pageable);

    List<Question> findActiveMultipleChoice(String category, QuestionLevel level);
}
