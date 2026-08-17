package com.ewha_eng.grmr.studentassignment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.member.infrastructure.MemberJpaRepository;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmission;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepository;
import com.ewha_eng.grmr.studentassignment.domain.SubmissionStatus;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * No {@code @Transactional} here: startNew() commits in its own REQUIRES_NEW transaction, so the
 * test needs real commits visible to verify the unique-constraint race handling end to end. Since
 * commits are real (and this shares the JVM-wide H2 instance with every other non-integration
 * test), each test tracks and deletes exactly the rows it created in {@link #cleanUp()}.
 */
@SpringBootTest
class AssignmentSubmissionStarterTest {

    @Autowired
    private AssignmentSubmissionStarter submissionStarter;

    @Autowired
    private AssignmentSubmissionRepository submissionRepository;

    @Autowired
    private MemberJpaRepository memberRepository;

    @Autowired
    private AssignmentRepository assignmentRepository;

    private final List<Long> createdMemberIds = new ArrayList<>();
    private final List<Long> createdAssignmentIds = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        for (Long assignmentId : createdAssignmentIds) {
            submissionRepository.findAll().stream()
                .filter(submission -> submission.getAssignmentId().equals(assignmentId))
                .forEach(submissionRepository::delete);
        }
        assignmentRepository.deleteAllById(createdAssignmentIds);
        memberRepository.deleteAllById(createdMemberIds);
    }

    @Test
    void startNew_createsInProgressSubmission_onFirstCall() {
        Member student = saveStudent("starter-student-01");
        Assignment assignment = saveAssignment();

        AssignmentSubmission created = submissionStarter.startNew(assignment.getId(), student.getId());

        assertThat(created).isNotNull();
        assertThat(created.getId()).isNotNull();
        assertThat(created.getStatus()).isEqualTo(SubmissionStatus.IN_PROGRESS);
    }

    @Test
    void startNew_throwsDataIntegrityViolation_whenAnotherRequestAlreadyCreatedTheRow() {
        Member student = saveStudent("starter-student-02");
        Assignment assignment = saveAssignment();
        submissionStarter.startNew(assignment.getId(), student.getId());

        assertThatThrownBy(() -> submissionStarter.startNew(assignment.getId(), student.getId()))
            .isInstanceOf(DataIntegrityViolationException.class);

        long count = submissionRepository.findByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .stream().count();
        assertThat(count).isEqualTo(1);
    }

    @Test
    void startNew_leavesExactlyOneRow_afterRaceLoserTransactionRollsBackCleanly() {
        Member student = saveStudent("starter-student-03");
        Assignment assignment = saveAssignment();

        AssignmentSubmission winner = submissionStarter.startNew(assignment.getId(), student.getId());
        assertThatThrownBy(() -> submissionStarter.startNew(assignment.getId(), student.getId()))
            .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(winner).isNotNull();
        long submissionsForAssignment = submissionRepository.findAll().stream()
            .filter(submission -> submission.getAssignmentId().equals(assignment.getId()))
            .count();
        assertThat(submissionsForAssignment).isEqualTo(1);
    }

    private Member saveStudent(String loginId) {
        Member student = memberRepository.saveAndFlush(Member.builder()
            .loginId(loginId)
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .studentGroup("중1 A반")
            .build());
        createdMemberIds.add(student.getId());
        return student;
    }

    private Assignment saveAssignment() {
        Assignment assignment = assignmentRepository.saveAndFlush(Assignment.builder()
            .title("현재완료 시제 연습")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(LocalDate.of(2026, 8, 1))
            .dueDate(LocalDate.of(2026, 8, 31))
            .questionIds(List.of(1L))
            .build());
        createdAssignmentIds.add(assignment.getId());
        return assignment;
    }
}
