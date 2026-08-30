package com.ewha_eng.grmr.student.infrastructure;

import static com.ewha_eng.grmr.assignment.domain.QAssignment.assignment;
import static com.ewha_eng.grmr.member.domain.QMember.member;
import static com.ewha_eng.grmr.studentassignment.domain.QAssignmentSubmission.assignmentSubmission;
import static com.ewha_eng.grmr.studyrecord.domain.QStudyRecord.studyRecord;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.student.domain.StudentAggregate;
import com.ewha_eng.grmr.student.domain.StudentReader;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmission;
import com.ewha_eng.grmr.studentassignment.domain.SubmissionStatus;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.Tuple;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.CaseBuilder;
import com.querydsl.core.types.dsl.NumberExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
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
public class StudentReaderImpl implements StudentReader {

    private static final char LIKE_ESCAPE_CHAR = '!';

    private final JPAQueryFactory queryFactory;

    @Override
    public Page<Member> search(String keyword, String studentGroup, Pageable pageable) {
        BooleanBuilder predicate = new BooleanBuilder()
            .and(member.type.eq(MemberType.STUDENT))
            .and(nameContains(keyword))
            .and(groupEq(studentGroup));

        List<Member> content = queryFactory
            .selectFrom(member)
            .where(predicate)
            .orderBy(member.name.asc(), member.id.asc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch();

        Long total = queryFactory
            .select(member.count())
            .from(member)
            .where(predicate)
            .fetchOne();

        return new PageImpl<>(content, pageable, total != null ? total : 0L);
    }

    @Override
    public Map<Long, StudentAggregate> aggregatesFor(List<Member> students, LocalDate today) {
        if (students.isEmpty()) {
            return Map.of();
        }

        Map<Long, StudyStats> studyStatsByMemberId = studyStatsFor(students);
        Map<Long, Integer> pendingCountsByMemberId = pendingAssignmentCountsFor(students, today);

        Map<Long, StudentAggregate> result = new HashMap<>();
        for (Member student : students) {
            StudyStats stats = studyStatsByMemberId.getOrDefault(student.getId(), StudyStats.EMPTY);
            int pendingCount = pendingCountsByMemberId.getOrDefault(student.getId(), 0);
            result.put(student.getId(),
                new StudentAggregate(stats.lastStudiedAt(), stats.totalCount(), stats.correctCount(), pendingCount));
        }
        return result;
    }

    private Map<Long, StudyStats> studyStatsFor(List<Member> students) {
        List<Long> memberIds = students.stream().map(Member::getId).toList();

        NumberExpression<Long> correctCount = new CaseBuilder()
            .when(studyRecord.correct.isTrue()).then(1L).otherwise(0L).sumAggregate();

        List<Tuple> rows = queryFactory
            .select(studyRecord.member.id, studyRecord.count(), correctCount, studyRecord.submittedAt.max())
            .from(studyRecord)
            .where(studyRecord.member.id.in(memberIds))
            .groupBy(studyRecord.member.id)
            .fetch();

        Map<Long, StudyStats> result = new HashMap<>();
        for (Tuple row : rows) {
            Long memberId = row.get(studyRecord.member.id);
            long total = row.get(studyRecord.count());
            long correct = row.get(correctCount);
            LocalDateTime lastSubmittedAt = row.get(studyRecord.submittedAt.max());

            result.put(memberId,
                new StudyStats(lastSubmittedAt.toLocalDate(), (int) total, (int) correct));
        }
        return result;
    }

    private Map<Long, Integer> pendingAssignmentCountsFor(List<Member> students, LocalDate today) {
        List<Long> studentIds = students.stream().map(Member::getId).toList();
        Set<String> studentGroups = students.stream()
            .map(Member::getStudentGroup)
            .filter(StringUtils::hasText)
            .collect(Collectors.toSet());

        BooleanExpression individualMatch = assignment.targetType.eq(AssignmentTargetType.STUDENT)
            .and(assignment.targetStudentId.in(studentIds));
        BooleanBuilder targetPredicate = new BooleanBuilder(individualMatch);
        if (!studentGroups.isEmpty()) {
            targetPredicate.or(assignment.targetType.eq(AssignmentTargetType.CLASS)
                .and(assignment.targetGroup.in(studentGroups)));
        }

        List<Assignment> candidateAssignments = queryFactory
            .selectFrom(assignment)
            .where(assignment.startDate.loe(today), targetPredicate)
            .fetch();

        Map<Long, Integer> counts = new HashMap<>();
        for (Member student : students) {
            counts.put(student.getId(), 0);
        }
        if (candidateAssignments.isEmpty()) {
            return counts;
        }

        List<Long> assignmentIds = candidateAssignments.stream().map(Assignment::getId).toList();
        List<AssignmentSubmission> submitted = queryFactory
            .selectFrom(assignmentSubmission)
            .where(assignmentSubmission.assignmentId.in(assignmentIds),
                assignmentSubmission.studentId.in(studentIds),
                assignmentSubmission.status.eq(SubmissionStatus.SUBMITTED))
            .fetch();
        Set<String> submittedPairs = new HashSet<>();
        for (AssignmentSubmission submission : submitted) {
            submittedPairs.add(pairKey(submission.getAssignmentId(), submission.getStudentId()));
        }

        for (Assignment candidate : candidateAssignments) {
            for (Member student : students) {
                if (!targets(candidate, student)) {
                    continue;
                }
                if (submittedPairs.contains(pairKey(candidate.getId(), student.getId()))) {
                    continue;
                }
                counts.merge(student.getId(), 1, Integer::sum);
            }
        }
        return counts;
    }

    private boolean targets(Assignment candidateAssignment, Member student) {
        if (candidateAssignment.getTargetType() == AssignmentTargetType.STUDENT) {
            return candidateAssignment.getTargetStudentId().equals(student.getId());
        }
        return candidateAssignment.getTargetGroup() != null
            && candidateAssignment.getTargetGroup().equals(student.getStudentGroup());
    }

    private String pairKey(Long assignmentId, Long studentId) {
        return assignmentId + ":" + studentId;
    }

    private BooleanExpression nameContains(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return null;
        }
        String escaped = escapeLikeWildcards(keyword.toLowerCase());
        return member.name.lower().like("%" + escaped + "%", LIKE_ESCAPE_CHAR);
    }

    private BooleanExpression groupEq(String studentGroup) {
        return StringUtils.hasText(studentGroup) ? member.studentGroup.eq(studentGroup) : null;
    }

    private String escapeLikeWildcards(String keyword) {
        return keyword
            .replace(String.valueOf(LIKE_ESCAPE_CHAR), "" + LIKE_ESCAPE_CHAR + LIKE_ESCAPE_CHAR)
            .replace("%", "" + LIKE_ESCAPE_CHAR + "%")
            .replace("_", "" + LIKE_ESCAPE_CHAR + "_");
    }

    private record StudyStats(LocalDate lastStudiedAt, int totalCount, int correctCount) {
        static final StudyStats EMPTY = new StudyStats(null, 0, 0);
    }
}
