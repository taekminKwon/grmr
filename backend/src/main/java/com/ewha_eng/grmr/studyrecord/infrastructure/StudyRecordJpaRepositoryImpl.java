package com.ewha_eng.grmr.studyrecord.infrastructure;

import static com.ewha_eng.grmr.studyrecord.domain.QStudyRecord.studyRecord;

import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordReader;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import java.util.Optional;
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

    private BooleanExpression categoryEq(String category) {
        return StringUtils.hasText(category) ? studyRecord.category.eq(category) : null;
    }
}
