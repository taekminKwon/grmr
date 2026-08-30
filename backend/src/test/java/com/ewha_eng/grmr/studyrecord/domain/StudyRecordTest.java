package com.ewha_eng.grmr.studyrecord.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class StudyRecordTest {

    private static final LocalDateTime SUBMITTED_AT = LocalDateTime.of(2026, 8, 15, 10, 0);

    @Test
    void createPracticeAttempt_snapshotsQuestionFields_andMarksCorrect_whenAnswerMatches() {
        Member member = student();
        Question question = grammarQuestion();

        StudyRecord record = StudyRecord.createPracticeAttempt(member, question, "since", SUBMITTED_AT);

        assertThat(record.getType()).isEqualTo(StudyRecordType.PRACTICE);
        assertThat(record.getMember()).isEqualTo(member);
        assertThat(record.getQuestion()).isEqualTo(question);
        assertThat(record.getCategory()).isEqualTo("현재완료");
        assertThat(record.getLevel()).isEqualTo(QuestionLevel.INTERMEDIATE);
        assertThat(record.getText()).isEqualTo(question.getText());
        assertThat(record.getChoices()).containsExactly("for", "since", "during", "from");
        assertThat(record.getChoices()).isNotSameAs(question.getChoices());
        assertThat(record.getCorrectAnswer()).isEqualTo("since");
        assertThat(record.getExplanation()).isEqualTo(question.getExplanation());
        assertThat(record.getSubmittedAnswer()).isEqualTo("since");
        assertThat(record.isCorrect()).isTrue();
        assertThat(record.getSubmittedAt()).isNotNull();
    }

    @Test
    void createPracticeAttempt_marksIncorrect_whenSubmittedAnswerDiffersFromCorrectAnswer() {
        StudyRecord record = StudyRecord.createPracticeAttempt(student(), grammarQuestion(), "for", SUBMITTED_AT);

        assertThat(record.isCorrect()).isFalse();
        assertThat(record.getSubmittedAnswer()).isEqualTo("for");
        assertThat(record.getCorrectAnswer()).isEqualTo("since");
    }

    @Test
    void createPracticeAttempt_throws_whenMemberIsNull() {
        assertThatThrownBy(() -> StudyRecord.createPracticeAttempt(null, grammarQuestion(), "since", SUBMITTED_AT))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createPracticeAttempt_throws_whenQuestionIsNull() {
        assertThatThrownBy(() -> StudyRecord.createPracticeAttempt(student(), null, "since", SUBMITTED_AT))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createPracticeAttempt_throws_whenSubmittedAnswerIsBlank() {
        assertThatThrownBy(() -> StudyRecord.createPracticeAttempt(student(), grammarQuestion(), "   ", SUBMITTED_AT))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createPracticeAttempt_throws_whenSubmittedAnswerIsNull() {
        assertThatThrownBy(() -> StudyRecord.createPracticeAttempt(student(), grammarQuestion(), null, SUBMITTED_AT))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createPracticeAttempt_throws_whenSubmittedAtIsNull() {
        assertThatThrownBy(() -> StudyRecord.createPracticeAttempt(student(), grammarQuestion(), "since", null))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createPracticeAttempt_keepsSnapshotIndependent_whenOriginalQuestionIsLaterUpdated() {
        Question question = grammarQuestion();
        StudyRecord record = StudyRecord.createPracticeAttempt(student(), question, "since", SUBMITTED_AT);

        question.update(null, null, null, "updated text", null, null, "updated explanation");

        assertThat(record.getText()).isEqualTo("He has lived here _____ 2010.");
        assertThat(record.getExplanation()).isEqualTo("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.");
    }

    @Test
    void createPracticeAttempt_createsIndependentRecords_forRepeatedAttemptsOnSameQuestion() {
        Question question = grammarQuestion();
        Member member = student();

        StudyRecord first = StudyRecord.createPracticeAttempt(member, question, "since", SUBMITTED_AT);
        StudyRecord second = StudyRecord.createPracticeAttempt(member, question, "for", SUBMITTED_AT);

        assertThat(first).isNotSameAs(second);
        assertThat(first.isCorrect()).isTrue();
        assertThat(second.isCorrect()).isFalse();
    }

    @Test
    void createAssignmentAttempt_snapshotsQuestionFields_andMarksCorrect_whenAnswerMatches() {
        Member member = student();
        Question question = grammarQuestion();
        LocalDateTime submittedAt = LocalDateTime.of(2026, 8, 15, 10, 0);

        StudyRecord record = StudyRecord.createAssignmentAttempt(member, question, "since", 7L, submittedAt);

        assertThat(record.getType()).isEqualTo(StudyRecordType.ASSIGNMENT);
        assertThat(record.getAssignmentId()).isEqualTo(7L);
        assertThat(record.getCategory()).isEqualTo("현재완료");
        assertThat(record.getCorrectAnswer()).isEqualTo("since");
        assertThat(record.getExplanation()).isEqualTo(question.getExplanation());
        assertThat(record.getSubmittedAnswer()).isEqualTo("since");
        assertThat(record.isCorrect()).isTrue();
        assertThat(record.getSubmittedAt()).isEqualTo(submittedAt);
    }

    @Test
    void createAssignmentAttempt_allowsNullSubmittedAnswer_andMarksIncorrect_forUnansweredQuestions() {
        StudyRecord record = StudyRecord.createAssignmentAttempt(
            student(), grammarQuestion(), null, 7L, LocalDateTime.now());

        assertThat(record.getSubmittedAnswer()).isNull();
        assertThat(record.isCorrect()).isFalse();
        assertThat(record.getCorrectAnswer()).isEqualTo("since");
    }

    @Test
    void createAssignmentAttempt_marksIncorrect_whenSubmittedAnswerDiffersFromCorrectAnswer() {
        StudyRecord record = StudyRecord.createAssignmentAttempt(
            student(), grammarQuestion(), "for", 7L, LocalDateTime.now());

        assertThat(record.isCorrect()).isFalse();
        assertThat(record.getSubmittedAnswer()).isEqualTo("for");
    }

    @Test
    void createAssignmentAttempt_throws_whenMemberIsNull() {
        assertThatThrownBy(
            () -> StudyRecord.createAssignmentAttempt(null, grammarQuestion(), "since", 7L, LocalDateTime.now()))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createAssignmentAttempt_throws_whenQuestionIsNull() {
        assertThatThrownBy(
            () -> StudyRecord.createAssignmentAttempt(student(), null, "since", 7L, LocalDateTime.now()))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createAssignmentAttempt_throws_whenAssignmentIdIsNull() {
        assertThatThrownBy(
            () -> StudyRecord.createAssignmentAttempt(student(), grammarQuestion(), "since", null,
                LocalDateTime.now()))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createAssignmentAttempt_throws_whenSubmittedAtIsNull() {
        assertThatThrownBy(
            () -> StudyRecord.createAssignmentAttempt(student(), grammarQuestion(), "since", 7L, null))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createAssignmentAttempt_keepsSnapshotIndependent_whenOriginalQuestionIsLaterUpdated() {
        Question question = grammarQuestion();
        StudyRecord record = StudyRecord.createAssignmentAttempt(
            student(), question, null, 7L, LocalDateTime.now());

        question.update(null, null, null, "updated text", null, "for", "updated explanation");

        assertThat(record.getText()).isEqualTo("He has lived here _____ 2010.");
        assertThat(record.getCorrectAnswer()).isEqualTo("since");
        assertThat(record.getExplanation()).isEqualTo("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.");
    }

    private Member student() {
        return Member.builder()
            .loginId("student01")
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .build();
    }

    private Question grammarQuestion() {
        return Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.")
            .build();
    }
}
