package com.ewha_eng.grmr.studyrecord.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import org.junit.jupiter.api.Test;

class StudyRecordTest {

    @Test
    void createPracticeAttempt_snapshotsQuestionFields_andMarksCorrect_whenAnswerMatches() {
        Member member = student();
        Question question = grammarQuestion();

        StudyRecord record = StudyRecord.createPracticeAttempt(member, question, "since");

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
        StudyRecord record = StudyRecord.createPracticeAttempt(student(), grammarQuestion(), "for");

        assertThat(record.isCorrect()).isFalse();
        assertThat(record.getSubmittedAnswer()).isEqualTo("for");
        assertThat(record.getCorrectAnswer()).isEqualTo("since");
    }

    @Test
    void createPracticeAttempt_throws_whenMemberIsNull() {
        assertThatThrownBy(() -> StudyRecord.createPracticeAttempt(null, grammarQuestion(), "since"))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createPracticeAttempt_throws_whenQuestionIsNull() {
        assertThatThrownBy(() -> StudyRecord.createPracticeAttempt(student(), null, "since"))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createPracticeAttempt_throws_whenSubmittedAnswerIsBlank() {
        assertThatThrownBy(() -> StudyRecord.createPracticeAttempt(student(), grammarQuestion(), "   "))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createPracticeAttempt_throws_whenSubmittedAnswerIsNull() {
        assertThatThrownBy(() -> StudyRecord.createPracticeAttempt(student(), grammarQuestion(), null))
            .isInstanceOf(InvalidStudyRecordException.class);
    }

    @Test
    void createPracticeAttempt_keepsSnapshotIndependent_whenOriginalQuestionIsLaterUpdated() {
        Question question = grammarQuestion();
        StudyRecord record = StudyRecord.createPracticeAttempt(student(), question, "since");

        question.update(null, null, null, "updated text", null, null, "updated explanation");

        assertThat(record.getText()).isEqualTo("He has lived here _____ 2010.");
        assertThat(record.getExplanation()).isEqualTo("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.");
    }

    @Test
    void createPracticeAttempt_createsIndependentRecords_forRepeatedAttemptsOnSameQuestion() {
        Question question = grammarQuestion();
        Member member = student();

        StudyRecord first = StudyRecord.createPracticeAttempt(member, question, "since");
        StudyRecord second = StudyRecord.createPracticeAttempt(member, question, "for");

        assertThat(first).isNotSameAs(second);
        assertThat(first.isCorrect()).isTrue();
        assertThat(second.isCorrect()).isFalse();
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
