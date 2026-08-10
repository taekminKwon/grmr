package com.ewha_eng.grmr.question.infrastructure;

import static com.ewha_eng.grmr.question.domain.QQuestion.question;

import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepositoryCustom;
import com.ewha_eng.grmr.question.domain.QuestionStatus;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
@RequiredArgsConstructor
public class QuestionRepositoryImpl implements QuestionRepositoryCustom {

    private static final char LIKE_ESCAPE_CHAR = '!';

    private final JPAQueryFactory queryFactory;

    @Override
    public Page<Question> search(String category, QuestionType type, QuestionLevel level, QuestionStatus status,
        String keyword, Pageable pageable) {
        BooleanBuilder predicate = new BooleanBuilder()
            .and(categoryEq(category))
            .and(typeEq(type))
            .and(levelEq(level))
            .and(statusEq(status))
            .and(textContains(keyword));

        List<Question> content = queryFactory
            .selectFrom(question)
            .where(predicate)
            .orderBy(question.createdAt.desc(), question.id.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        Long total = queryFactory
            .select(question.count())
            .from(question)
            .where(predicate)
            .fetchOne();

        return new PageImpl<>(content, pageable, total != null ? total : 0L);
    }

    private BooleanExpression categoryEq(String category) {
        return StringUtils.hasText(category) ? question.category.eq(category) : null;
    }

    private BooleanExpression typeEq(QuestionType type) {
        return type != null ? question.type.eq(type) : null;
    }

    private BooleanExpression levelEq(QuestionLevel level) {
        return level != null ? question.level.eq(level) : null;
    }

    private BooleanExpression statusEq(QuestionStatus status) {
        return status != null ? question.status.eq(status) : null;
    }

    private BooleanExpression textContains(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        String escaped = escapeLikeWildcards(keyword);
        return question.text.like("%" + escaped + "%", LIKE_ESCAPE_CHAR);
    }

    private String escapeLikeWildcards(String keyword) {
        return keyword
            .replace(String.valueOf(LIKE_ESCAPE_CHAR), "" + LIKE_ESCAPE_CHAR + LIKE_ESCAPE_CHAR)
            .replace("%", "" + LIKE_ESCAPE_CHAR + "%")
            .replace("_", "" + LIKE_ESCAPE_CHAR + "_");
    }
}
