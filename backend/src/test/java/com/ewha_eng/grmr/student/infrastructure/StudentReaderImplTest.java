package com.ewha_eng.grmr.student.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.member.infrastructure.MemberJpaRepository;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.ewha_eng.grmr.student.domain.StudentAggregate;
import com.ewha_eng.grmr.student.domain.StudentReader;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmission;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepository;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.infrastructure.StudyRecordJpaRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class StudentReaderImplTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 8, 19);

    @Autowired
    private StudentReader studentReader;

    @Autowired
    private MemberJpaRepository memberRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private StudyRecordJpaRepository studyRecordRepository;

    @Autowired
    private AssignmentRepository assignmentRepository;

    @Autowired
    private AssignmentSubmissionRepository assignmentSubmissionRepository;

    @Test
    void search_filtersByKeyword_caseInsensitiveContains() {
        Member matching = saveStudent("김민수", "중1 A반");
        saveStudent("이영희", "중1 A반");

        Page<Member> result = studentReader.search("민수", null, PageRequest.of(0, 20));

        assertThat(result.getContent()).extracting(Member::getId).containsExactly(matching.getId());
    }

    @Test
    void search_filtersByExactGroup_excludingOtherGroupsAndUngrouped() {
        Member targetGroup = saveStudent("김민수", "중1 A반");
        saveStudent("이영희", "중2 B반");
        saveStudent("박철수", null);

        Page<Member> result = studentReader.search(null, "중1 A반", PageRequest.of(0, 20));

        assertThat(result.getContent()).extracting(Member::getId).containsExactly(targetGroup.getId());
    }

    @Test
    void search_includesUngroupedStudents_whenGroupFilterIsAbsent() {
        Member ungrouped = saveStudent("박철수", null);

        Page<Member> result = studentReader.search(null, null, PageRequest.of(0, 20));

        assertThat(result.getContent()).extracting(Member::getId).contains(ungrouped.getId());
    }

    @Test
    void search_excludesNonStudentMembers() {
        saveStudent("김민수", "중1 A반");
        Member admin = Member.builder().loginId("admin1").password("h").name("관리자").type(MemberType.ADMIN).build();
        memberRepository.saveAndFlush(admin);

        Page<Member> result = studentReader.search(null, null, PageRequest.of(0, 20));

        assertThat(result.getContent()).extracting(Member::getId).doesNotContain(admin.getId());
    }

    @Test
    void search_ordersByNameAscending_thenIdAscending() {
        Member secondNameFirstId = saveStudent("김민수", "중1 A반");
        Member firstName = saveStudent("가나다", "중1 A반");
        Member secondNameSecondId = saveStudent("김민수", "중1 A반");

        Page<Member> result = studentReader.search(null, "중1 A반", PageRequest.of(0, 20));

        assertThat(result.getContent()).extracting(Member::getId)
            .containsExactly(firstName.getId(), secondNameFirstId.getId(), secondNameSecondId.getId());
    }

    @Test
    void aggregatesFor_returnsEmptyDefaults_whenStudentHasNoRecords() {
        Member student = saveStudent("김민수", "중1 A반");

        Map<Long, StudentAggregate> result = studentReader.aggregatesFor(List.of(student), TODAY);

        StudentAggregate aggregate = result.get(student.getId());
        assertThat(aggregate.lastStudiedAt()).isNull();
        assertThat(aggregate.totalQuestionCount()).isZero();
        assertThat(aggregate.accuracy()).isZero();
        assertThat(aggregate.pendingAssignmentCount()).isZero();
    }

    @Test
    void aggregatesFor_computesTotalCountAndAccuracy_andLatestSubmittedDate() {
        Member student = saveStudent("김민수", "중1 A반");
        Question question = saveQuestion();
        saveStudyRecord(student, question, "정답", true, LocalDateTime.of(2026, 8, 10, 10, 0));
        saveStudyRecord(student, question, "오답", false, LocalDateTime.of(2026, 8, 15, 9, 0));
        saveStudyRecord(student, question, "정답", true, LocalDateTime.of(2026, 8, 12, 9, 0));

        Map<Long, StudentAggregate> result = studentReader.aggregatesFor(List.of(student), TODAY);

        StudentAggregate aggregate = result.get(student.getId());
        assertThat(aggregate.totalQuestionCount()).isEqualTo(3);
        assertThat(aggregate.correctCount()).isEqualTo(2);
        assertThat(aggregate.accuracy()).isEqualTo(67);
        assertThat(aggregate.lastStudiedAt()).isEqualTo(LocalDate.of(2026, 8, 15));
    }

    @Test
    void aggregatesFor_countsPendingAssignment_forClassTargetedAssignment_whenNotSubmitted() {
        Member student = saveStudent("김민수", "중1 A반");
        Assignment assignment = saveClassAssignment("중1 A반", TODAY.minusDays(1), TODAY.plusDays(1));

        Map<Long, StudentAggregate> result = studentReader.aggregatesFor(List.of(student), TODAY);

        assertThat(result.get(student.getId()).pendingAssignmentCount()).isEqualTo(1);
    }

    @Test
    void aggregatesFor_countsPendingAssignment_forIndividuallyTargetedAssignment() {
        Member student = saveStudent("김민수", "중1 A반");
        saveIndividualAssignment(student.getId(), TODAY.minusDays(1), TODAY.plusDays(1));

        Map<Long, StudentAggregate> result = studentReader.aggregatesFor(List.of(student), TODAY);

        assertThat(result.get(student.getId()).pendingAssignmentCount()).isEqualTo(1);
    }

    @Test
    void aggregatesFor_excludesScheduledAssignments() {
        Member student = saveStudent("김민수", "중1 A반");
        saveClassAssignment("중1 A반", TODAY.plusDays(1), TODAY.plusDays(3));

        Map<Long, StudentAggregate> result = studentReader.aggregatesFor(List.of(student), TODAY);

        assertThat(result.get(student.getId()).pendingAssignmentCount()).isZero();
    }

    @Test
    void aggregatesFor_includesClosedAssignments() {
        Member student = saveStudent("김민수", "중1 A반");
        saveClassAssignment("중1 A반", TODAY.minusDays(5), TODAY.minusDays(1));

        Map<Long, StudentAggregate> result = studentReader.aggregatesFor(List.of(student), TODAY);

        assertThat(result.get(student.getId()).pendingAssignmentCount()).isEqualTo(1);
    }

    @Test
    void aggregatesFor_excludesSubmittedAssignments() {
        Member student = saveStudent("김민수", "중1 A반");
        Assignment assignment = saveClassAssignment("중1 A반", TODAY.minusDays(1), TODAY.plusDays(1));
        AssignmentSubmission submission = AssignmentSubmission.start(assignment.getId(), student.getId(),
            LocalDateTime.now());
        submission.submit(LocalDateTime.now());
        assignmentSubmissionRepository.save(submission);

        Map<Long, StudentAggregate> result = studentReader.aggregatesFor(List.of(student), TODAY);

        assertThat(result.get(student.getId()).pendingAssignmentCount()).isZero();
    }

    @Test
    void aggregatesFor_countsInProgressSubmission_asPending() {
        Member student = saveStudent("김민수", "중1 A반");
        Assignment assignment = saveClassAssignment("중1 A반", TODAY.minusDays(1), TODAY.plusDays(1));
        AssignmentSubmission submission = AssignmentSubmission.start(assignment.getId(), student.getId(),
            LocalDateTime.now());
        assignmentSubmissionRepository.save(submission);

        Map<Long, StudentAggregate> result = studentReader.aggregatesFor(List.of(student), TODAY);

        assertThat(result.get(student.getId()).pendingAssignmentCount()).isEqualTo(1);
    }

    @Test
    void aggregatesFor_ignoresClassAssignment_forDifferentGroupStudent() {
        Member student = saveStudent("김민수", "중2 B반");
        saveClassAssignment("중1 A반", TODAY.minusDays(1), TODAY.plusDays(1));

        Map<Long, StudentAggregate> result = studentReader.aggregatesFor(List.of(student), TODAY);

        assertThat(result.get(student.getId()).pendingAssignmentCount()).isZero();
    }

    private Member saveStudent(String name, String studentGroup) {
        Member student = Member.builder()
            .loginId("login-" + System.nanoTime())
            .password("hashed")
            .name(name)
            .type(MemberType.STUDENT)
            .studentGroup(studentGroup)
            .build();
        return memberRepository.saveAndFlush(student);
    }

    private Question saveQuestion() {
        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.BASIC)
            .text("문제")
            .choices(List.of("정답", "오답"))
            .answer("정답")
            .explanation("해설")
            .build();
        return questionRepository.save(question);
    }

    private void saveStudyRecord(Member student, Question question, String submittedAnswer, boolean correct,
        LocalDateTime submittedAt) {
        StudyRecord record = StudyRecord.createPracticeAttempt(student, question, submittedAnswer);
        ReflectionTestUtils.setField(record, "correct", correct);
        ReflectionTestUtils.setField(record, "submittedAt", submittedAt);
        studyRecordRepository.saveAndFlush(record);
    }

    private Assignment saveClassAssignment(String targetGroup, LocalDate startDate, LocalDate dueDate) {
        Assignment assignment = Assignment.builder()
            .title("과제")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup(targetGroup)
            .startDate(startDate)
            .dueDate(dueDate)
            .questionIds(List.of(1L))
            .build();
        return assignmentRepository.saveAndFlush(assignment);
    }

    private Assignment saveIndividualAssignment(Long targetStudentId, LocalDate startDate, LocalDate dueDate) {
        Assignment assignment = Assignment.builder()
            .title("과제")
            .targetType(AssignmentTargetType.STUDENT)
            .targetStudentId(targetStudentId)
            .startDate(startDate)
            .dueDate(dueDate)
            .questionIds(List.of(1L))
            .build();
        return assignmentRepository.saveAndFlush(assignment);
    }
}
