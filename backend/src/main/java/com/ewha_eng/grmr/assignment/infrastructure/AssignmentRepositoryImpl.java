package com.ewha_eng.grmr.assignment.infrastructure;

import static com.ewha_eng.grmr.assignment.domain.QAssignment.assignment;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepositoryCustom;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
@RequiredArgsConstructor
public class AssignmentRepositoryImpl implements AssignmentRepositoryCustom {

    private static final char LIKE_ESCAPE_CHAR = '!';

    private final JPAQueryFactory queryFactory;

    @Override
    public Page<Assignment> search(AssignmentStatus status, String keyword, LocalDate today, Pageable pageable) {
        BooleanBuilder predicate = new BooleanBuilder()
            .and(statusEq(status, today))
            .and(titleContains(keyword));

        List<Assignment> content = queryFactory
            .selectFrom(assignment)
            .where(predicate)
            .orderBy(assignment.createdAt.desc(), assignment.id.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        Long total = queryFactory
            .select(assignment.count())
            .from(assignment)
            .where(predicate)
            .fetchOne();

        return new PageImpl<>(content, pageable, total != null ? total : 0L);
    }

    @Override
    public Page<Assignment> findForStudent(Long studentId, String studentGroup, LocalDate today,
        Pageable pageable) {
        BooleanBuilder predicate = new BooleanBuilder()
            .and(targetsStudent(studentId, studentGroup))
            .and(assignment.startDate.loe(today));

        List<Assignment> content = queryFactory
            .selectFrom(assignment)
            .where(predicate)
            .orderBy(assignment.dueDate.asc(), assignment.id.asc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        Long total = queryFactory
            .select(assignment.count())
            .from(assignment)
            .where(predicate)
            .fetchOne();

        return new PageImpl<>(content, pageable, total != null ? total : 0L);
    }

    private BooleanExpression targetsStudent(Long studentId, String studentGroup) {
        BooleanExpression individual = assignment.targetType.eq(AssignmentTargetType.STUDENT)
            .and(assignment.targetStudentId.eq(studentId));
        if (!StringUtils.hasText(studentGroup)) {
            return individual;
        }
        BooleanExpression classTargeted = assignment.targetType.eq(AssignmentTargetType.CLASS)
            .and(assignment.targetGroup.eq(studentGroup));
        return individual.or(classTargeted);
    }

    private BooleanExpression statusEq(AssignmentStatus status, LocalDate today) {
        if (status == null) {
            return null;
        }
        return switch (status) {
            case SCHEDULED -> assignment.startDate.gt(today);
            case IN_PROGRESS -> assignment.startDate.loe(today).and(assignment.dueDate.goe(today));
            case CLOSED -> assignment.dueDate.lt(today);
        };
    }

    private BooleanExpression titleContains(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        String escaped = escapeLikeWildcards(keyword);
        return assignment.title.like("%" + escaped + "%", LIKE_ESCAPE_CHAR);
    }

    private String escapeLikeWildcards(String keyword) {
        return keyword
            .replace(String.valueOf(LIKE_ESCAPE_CHAR), "" + LIKE_ESCAPE_CHAR + LIKE_ESCAPE_CHAR)
            .replace("%", "" + LIKE_ESCAPE_CHAR + "%")
            .replace("_", "" + LIKE_ESCAPE_CHAR + "_");
    }
}
