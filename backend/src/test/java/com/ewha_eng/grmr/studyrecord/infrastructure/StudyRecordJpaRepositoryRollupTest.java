package com.ewha_eng.grmr.studyrecord.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.member.infrastructure.MemberJpaRepository;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordReader;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordRollup;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class StudyRecordJpaRepositoryRollupTest {

    private static final LocalDateTime PERIOD_START = LocalDateTime.of(2026, 8, 12, 0, 0);
    private static final LocalDateTime PERIOD_END_EXCLUSIVE = LocalDateTime.of(2026, 8, 19, 0, 0);

    @Autowired
    private StudyRecordReader studyRecordReader;

    @Autowired
    private StudyRecordJpaRepository studyRecordRepository;

    @Autowired
    private MemberJpaRepository memberRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Test
    void searchRollups_groupsByStudentDateAndType_summingCounts() {
        Member student = saveStudent("student01", "김민수");
        Question question = saveQuestion();
        savePractice(student, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));
        savePractice(student, question, false, LocalDateTime.of(2026, 8, 15, 10, 0));
        savePractice(student, question, true, LocalDateTime.of(2026, 8, 15, 11, 0));

        Page<StudyRecordRollup> page = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(1);
        StudyRecordRollup rollup = page.getContent().get(0);
        assertThat(rollup.studentId()).isEqualTo(student.getId());
        assertThat(rollup.studentName()).isEqualTo("김민수");
        assertThat(rollup.date()).isEqualTo(LocalDate.of(2026, 8, 15));
        assertThat(rollup.type()).isEqualTo(StudyRecordType.PRACTICE);
        assertThat(rollup.questionCount()).isEqualTo(3);
        assertThat(rollup.correctCount()).isEqualTo(2);
        assertThat(rollup.accuracy()).isEqualTo(67);
        assertThat(page.getTotalElements()).isEqualTo(1);
    }

    @Test
    void searchRollups_createsSeparateGroups_forDifferentTypes_sameStudentAndDate() {
        Member student = saveStudent("student02", "이영희");
        Question question = saveQuestion();
        savePractice(student, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));
        saveAssignment(student, question, true, LocalDateTime.of(2026, 8, 15, 10, 0), 1L);

        Page<StudyRecordRollup> page = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getContent()).extracting(StudyRecordRollup::type)
            .containsExactlyInAnyOrder(StudyRecordType.PRACTICE, StudyRecordType.ASSIGNMENT);
    }

    @Test
    void searchRollups_doesNotCreateEmptyGroup_forDateWithNoRecords() {
        Member student = saveStudent("student03", "박철수");
        Question question = saveQuestion();
        savePractice(student, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));

        Page<StudyRecordRollup> page = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(StudyRecordRollup::date)
            .containsExactly(LocalDate.of(2026, 8, 15));
    }

    @Test
    void searchRollups_placesSameDayRecords_intoAdjacentKstDates_atMidnightBoundary() {
        Member student = saveStudent("student04", "최지우");
        Question question = saveQuestion();
        savePractice(student, question, true, LocalDateTime.of(2026, 8, 14, 23, 59, 59));
        savePractice(student, question, true, LocalDateTime.of(2026, 8, 15, 0, 0, 0));

        Page<StudyRecordRollup> page = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(StudyRecordRollup::date)
            .containsExactlyInAnyOrder(LocalDate.of(2026, 8, 14), LocalDate.of(2026, 8, 15));
        assertThat(page.getContent()).allSatisfy(rollup -> assertThat(rollup.questionCount()).isEqualTo(1));
    }

    @Test
    void searchRollups_excludesRecords_outsidePeriod() {
        Member student = saveStudent("student05", "정하윤");
        Question question = saveQuestion();
        savePractice(student, question, true, PERIOD_START.minusSeconds(1));
        savePractice(student, question, true, PERIOD_END_EXCLUSIVE);
        savePractice(student, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));

        Page<StudyRecordRollup> page = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(0, 20));

        assertThat(page.getContent()).hasSize(1);
        assertThat(page.getContent().get(0).date()).isEqualTo(LocalDate.of(2026, 8, 15));
    }

    @Test
    void searchRollups_filtersByStudentId_whenGiven() {
        Member target = saveStudent("student06", "김민수");
        Member other = saveStudent("student07", "이영희");
        Question question = saveQuestion();
        savePractice(target, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));
        savePractice(other, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));

        Page<StudyRecordRollup> page = studyRecordReader.searchRollups(
            target.getId(), PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(StudyRecordRollup::studentId)
            .containsExactly(target.getId());
    }

    @Test
    void searchRollups_filtersByType_whenGiven() {
        Member student = saveStudent("student08", "김민수");
        Question question = saveQuestion();
        savePractice(student, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));
        saveAssignment(student, question, true, LocalDateTime.of(2026, 8, 15, 10, 0), 1L);

        Page<StudyRecordRollup> page = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, StudyRecordType.ASSIGNMENT, PageRequest.of(0, 20));

        assertThat(page.getContent()).extracting(StudyRecordRollup::type)
            .containsExactly(StudyRecordType.ASSIGNMENT);
    }

    @Test
    void searchRollups_paginatesGroups_inSql_withCorrectTotal() {
        Member studentA = saveStudent("student09", "가나다");
        Member studentB = saveStudent("student10", "라마바");
        Question question = saveQuestion();
        savePractice(studentA, question, true, LocalDateTime.of(2026, 8, 13, 9, 0));
        savePractice(studentA, question, true, LocalDateTime.of(2026, 8, 14, 9, 0));
        savePractice(studentB, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));

        Page<StudyRecordRollup> firstPage = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(0, 2));
        Page<StudyRecordRollup> secondPage = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(1, 2));

        assertThat(firstPage.getContent()).hasSize(2);
        assertThat(firstPage.getTotalElements()).isEqualTo(3);
        assertThat(firstPage.getTotalPages()).isEqualTo(2);
        assertThat(secondPage.getContent()).hasSize(1);
    }

    @Test
    void searchRollups_ordersByDateDesc_thenStudentIdAsc_thenTypeAsc() {
        Member earlierId = saveStudent("student11", "가나다");
        Member laterId = saveStudent("student12", "가나다");
        Question question = saveQuestion();
        // Same date/student, different types -> ASSIGNMENT before PRACTICE.
        savePractice(earlierId, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));
        saveAssignment(earlierId, question, true, LocalDateTime.of(2026, 8, 15, 10, 0), 1L);
        // Same date, different student -> lower id first.
        savePractice(laterId, question, true, LocalDateTime.of(2026, 8, 15, 9, 0));
        // Earlier date -> should sort after the 8/15 rows.
        savePractice(earlierId, question, true, LocalDateTime.of(2026, 8, 13, 9, 0));

        Page<StudyRecordRollup> page = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(0, 20));

        assertThat(page.getContent())
            .extracting(StudyRecordRollup::date, StudyRecordRollup::studentId, StudyRecordRollup::type)
            .containsExactly(
                tuple(LocalDate.of(2026, 8, 15), earlierId.getId(), StudyRecordType.ASSIGNMENT),
                tuple(LocalDate.of(2026, 8, 15), earlierId.getId(), StudyRecordType.PRACTICE),
                tuple(LocalDate.of(2026, 8, 15), laterId.getId(), StudyRecordType.PRACTICE),
                tuple(LocalDate.of(2026, 8, 13), earlierId.getId(), StudyRecordType.PRACTICE)
            );
    }

    @Test
    void searchRollups_returnsEmptyPage_whenNoRecordsMatch() {
        Page<StudyRecordRollup> page = studyRecordReader.searchRollups(
            null, PERIOD_START, PERIOD_END_EXCLUSIVE, null, PageRequest.of(0, 20));

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isZero();
    }

    private Member saveStudent(String loginId, String name) {
        return memberRepository.saveAndFlush(Member.builder()
            .loginId(loginId)
            .password("hashed-password")
            .name(name)
            .type(MemberType.STUDENT)
            .build());
    }

    private Question saveQuestion() {
        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("해설")
            .build();
        return questionRepository.saveAndFlush(question);
    }

    private void savePractice(Member member, Question question, boolean correct, LocalDateTime submittedAt) {
        StudyRecord record = StudyRecord.createPracticeAttempt(member, question, correct ? "since" : "for",
            submittedAt);
        ReflectionTestUtils.setField(record, "correct", correct);
        studyRecordRepository.saveAndFlush(record);
    }

    private void saveAssignment(Member member, Question question, boolean correct, LocalDateTime submittedAt,
        Long assignmentId) {
        StudyRecord record = StudyRecord.createAssignmentAttempt(member, question, correct ? "since" : "for",
            assignmentId, submittedAt);
        ReflectionTestUtils.setField(record, "correct", correct);
        studyRecordRepository.saveAndFlush(record);
    }
}
