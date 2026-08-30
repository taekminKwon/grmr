package com.ewha_eng.grmr.studyrecord.infrastructure;

import static com.ewha_eng.grmr.member.domain.QMember.member;
import static com.ewha_eng.grmr.studyrecord.domain.QStudyRecord.studyRecord;

import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordReader;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordRollup;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordType;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.CaseBuilder;
import com.querydsl.core.types.dsl.DateTemplate;
import com.querydsl.core.types.dsl.Expressions;
import com.querydsl.core.types.dsl.NumberExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
@RequiredArgsConstructor
public class StudyRecordJpaRepositoryImpl implements StudyRecordReader {

    private final JPAQueryFactory queryFactory;
    private final EntityManager entityManager;

    @Override
    public Optional<StudyRecord> findByIdAndMemberId(Long id, Long memberId) {
        StudyRecord result = queryFactory
            .selectFrom(studyRecord)
            .where(studyRecord.id.eq(id), studyRecord.member.id.eq(memberId))
            .fetchOne();

        return Optional.ofNullable(result);
    }

    @Override
    public Page<StudyRecord> search(Long memberId, String category, Pageable pageable) {
        BooleanExpression predicate = studyRecord.member.id.eq(memberId)
            .and(categoryEq(category));

        List<StudyRecord> content = queryFactory
            .selectFrom(studyRecord)
            .where(predicate)
            .orderBy(studyRecord.submittedAt.desc(), studyRecord.id.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        Long total = queryFactory
            .select(studyRecord.count())
            .from(studyRecord)
            .where(predicate)
            .fetchOne();

        return new PageImpl<>(content, pageable, total != null ? total : 0L);
    }

    @Override
    public List<StudyRecord> findAssignmentAttempts(Long memberId, Long assignmentId) {
        return queryFactory
            .selectFrom(studyRecord)
            .where(studyRecord.member.id.eq(memberId), studyRecord.assignmentId.eq(assignmentId),
                studyRecord.type.eq(StudyRecordType.ASSIGNMENT))
            .fetch();
    }

    private BooleanExpression categoryEq(String category) {
        return StringUtils.hasText(category) ? studyRecord.category.eq(category) : null;
    }

    @Override
    public Page<StudyRecordRollup> searchRollups(Long studentId, LocalDateTime periodStartInclusive,
        LocalDateTime periodEndExclusive, StudyRecordType type, Pageable pageable) {
        BooleanBuilder predicate = new BooleanBuilder()
            .and(studyRecord.submittedAt.goe(periodStartInclusive))
            .and(studyRecord.submittedAt.lt(periodEndExclusive));
        if (studentId != null) {
            predicate.and(studyRecord.member.id.eq(studentId));
        }
        if (type != null) {
            predicate.and(studyRecord.type.eq(type));
        }

        // Hibernate returns a raw java.sql.Date for this native CAST template rather than
        // converting through java.time, so the template type must match that and be converted
        // explicitly below (a DateTemplate<LocalDate> throws ClassCastException on read).
        DateTemplate<java.sql.Date> kstDate = Expressions.dateTemplate(
            java.sql.Date.class, "CAST({0} AS DATE)", studyRecord.submittedAt);
        NumberExpression<Long> correctCount = new CaseBuilder()
            .when(studyRecord.correct.isTrue()).then(1L).otherwise(0L).sumAggregate();

        List<Tuple> rows = queryFactory
            .select(studyRecord.member.id, kstDate, studyRecord.type, studyRecord.count(), correctCount)
            .from(studyRecord)
            .where(predicate)
            .groupBy(studyRecord.member.id, kstDate, studyRecord.type)
            .orderBy(kstDate.desc(), studyRecord.member.id.asc(), studyRecord.type.asc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        long total = countDistinctGroups(studentId, periodStartInclusive, periodEndExclusive, type);
        if (rows.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, total);
        }

        Set<Long> studentIds = rows.stream()
            .map(row -> row.get(studyRecord.member.id))
            .collect(Collectors.toSet());
        Map<Long, String> studentNamesById = queryFactory
            .select(member.id, member.name)
            .from(member)
            .where(member.id.in(studentIds))
            .fetch().stream()
            .collect(Collectors.toMap(row -> row.get(member.id), row -> row.get(member.name)));

        List<StudyRecordRollup> content = rows.stream()
            .map(row -> {
                Long rowStudentId = row.get(studyRecord.member.id);
                return new StudyRecordRollup(
                    rowStudentId,
                    studentNamesById.get(rowStudentId),
                    row.get(kstDate).toLocalDate(),
                    row.get(studyRecord.type),
                    row.get(studyRecord.count()).intValue(),
                    row.get(correctCount).intValue()
                );
            })
            .toList();

        return new PageImpl<>(content, pageable, total);
    }

    /**
     * Counts distinct (studentId, date, type) groups entirely in SQL via a derived-table count,
     * so pagination totals don't require materializing every rollup row in the application.
     */
    private long countDistinctGroups(Long studentId, LocalDateTime periodStartInclusive,
        LocalDateTime periodEndExclusive, StudyRecordType type) {
        StringBuilder sql = new StringBuilder(
            "SELECT COUNT(*) FROM ("
                + "SELECT member_id, CAST(submitted_at AS DATE) AS d, type "
                + "FROM study_record "
                + "WHERE submitted_at >= :start AND submitted_at < :end");
        if (studentId != null) {
            sql.append(" AND member_id = :studentId");
        }
        if (type != null) {
            sql.append(" AND type = :type");
        }
        sql.append(" GROUP BY member_id, d, type) grouped");

        Query query = entityManager.createNativeQuery(sql.toString())
            .setParameter("start", periodStartInclusive)
            .setParameter("end", periodEndExclusive);
        if (studentId != null) {
            query.setParameter("studentId", studentId);
        }
        if (type != null) {
            query.setParameter("type", type.name());
        }

        return ((Number) query.getSingleResult()).longValue();
    }
}
