package com.ewha_eng.grmr.studentassignment.infrastructure;

import static com.ewha_eng.grmr.studentassignment.domain.QAssignmentAnswerDraft.assignmentAnswerDraft;
import static com.ewha_eng.grmr.studentassignment.domain.QAssignmentSubmission.assignmentSubmission;

import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmission;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepositoryCustom;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class AssignmentSubmissionRepositoryImpl implements AssignmentSubmissionRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<AssignmentSubmission> findWithDraftsByAssignmentIdAndStudentId(Long assignmentId,
        Long studentId) {
        List<AssignmentSubmission> results = queryFactory
            .selectFrom(assignmentSubmission).distinct()
            .leftJoin(assignmentSubmission.drafts, assignmentAnswerDraft).fetchJoin()
            .where(assignmentSubmission.assignmentId.eq(assignmentId), assignmentSubmission.studentId.eq(studentId))
            .fetch();

        return results.stream().findFirst();
    }
}
