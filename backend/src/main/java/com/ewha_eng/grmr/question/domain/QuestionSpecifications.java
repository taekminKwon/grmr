package com.ewha_eng.grmr.question.domain;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

public class QuestionSpecifications {

    private QuestionSpecifications() {
    }

    public static Specification<Question> search(String category, QuestionType type, QuestionLevel level,
        QuestionStatus status, String keyword) {
        return (root, query, cb) -> {
            var predicates = cb.conjunction();
            if (StringUtils.hasText(category)) {
                predicates = cb.and(predicates, cb.equal(root.get("category"), category));
            }
            if (type != null) {
                predicates = cb.and(predicates, cb.equal(root.get("type"), type));
            }
            if (level != null) {
                predicates = cb.and(predicates, cb.equal(root.get("level"), level));
            }
            if (status != null) {
                predicates = cb.and(predicates, cb.equal(root.get("status"), status));
            }
            if (StringUtils.hasText(keyword)) {
                predicates = cb.and(predicates, cb.like(root.get("text"), "%" + keyword + "%"));
            }
            return predicates;
        };
    }
}
