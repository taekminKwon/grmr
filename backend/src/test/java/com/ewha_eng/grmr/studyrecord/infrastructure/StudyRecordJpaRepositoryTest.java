package com.ewha_eng.grmr.studyrecord.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.member.infrastructure.MemberJpaRepository;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class StudyRecordJpaRepositoryTest {

    @Autowired
    private StudyRecordJpaRepository studyRecordRepository;

    @Autowired
    private MemberJpaRepository memberRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Test
    void save_persistsPracticeAttempt_andGeneratesId() {
        Member member = saveStudent("student01");
        Question question = saveQuestion();

        StudyRecord saved = studyRecordRepository.saveAndFlush(
            StudyRecord.createPracticeAttempt(member, question, "since"));

        assertThat(saved.getId()).isNotNull();
    }

    @Test
    void findByIdAndMemberId_returnsRecord_whenOwnedByGivenMember() {
        Member owner = saveStudent("owner01");
        Question question = saveQuestion();
        StudyRecord saved = studyRecordRepository.saveAndFlush(
            StudyRecord.createPracticeAttempt(owner, question, "since"));

        Optional<StudyRecord> found = studyRecordRepository.findByIdAndMemberId(saved.getId(), owner.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getSubmittedAnswer()).isEqualTo("since");
    }

    @Test
    void findByIdAndMemberId_returnsEmpty_whenOwnedByDifferentMember() {
        Member owner = saveStudent("owner02");
        Member other = saveStudent("other02");
        Question question = saveQuestion();
        StudyRecord saved = studyRecordRepository.saveAndFlush(
            StudyRecord.createPracticeAttempt(owner, question, "since"));

        Optional<StudyRecord> found = studyRecordRepository.findByIdAndMemberId(saved.getId(), other.getId());

        assertThat(found).isEmpty();
    }

    @Test
    void findByMemberIdOrderBySubmittedAtDesc_returnsOnlyOwnRecords_mostRecentFirst() {
        Member owner = saveStudent("owner03");
        Member other = saveStudent("other03");
        Question question = saveQuestion();
        LocalDateTime now = LocalDateTime.now();

        StudyRecord older = save(owner, question, "since", now.minusMinutes(2));
        StudyRecord newer = save(owner, question, "for", now.minusMinutes(1));
        save(other, question, "since", now);

        Page<StudyRecord> page = studyRecordRepository.findByMemberIdOrderBySubmittedAtDesc(owner.getId(),
            PageRequest.of(0, 10));

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).extracting(StudyRecord::getId)
            .containsExactly(newer.getId(), older.getId());
    }

    @Test
    void repeatedAttempts_onSameQuestion_createSeparateImmutableRecords() {
        Member owner = saveStudent("owner04");
        Question question = saveQuestion();

        StudyRecord first = studyRecordRepository.saveAndFlush(
            StudyRecord.createPracticeAttempt(owner, question, "since"));
        StudyRecord second = studyRecordRepository.saveAndFlush(
            StudyRecord.createPracticeAttempt(owner, question, "for"));

        assertThat(first.getId()).isNotEqualTo(second.getId());
        assertThat(first.isCorrect()).isTrue();
        assertThat(second.isCorrect()).isFalse();
        assertThat(studyRecordRepository.findAll()).hasSize(2);
    }

    @Test
    void snapshot_remainsUnchanged_afterOriginalQuestionIsLaterUpdated() {
        Member owner = saveStudent("owner05");
        Question question = saveQuestion();
        StudyRecord saved = studyRecordRepository.saveAndFlush(
            StudyRecord.createPracticeAttempt(owner, question, "since"));

        question.update(null, null, null, "updated text", null, null, "updated explanation");
        questionRepository.saveAndFlush(question);

        StudyRecord reloaded = studyRecordRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getText()).isEqualTo("He has lived here _____ 2010.");
        assertThat(reloaded.getExplanation())
            .isEqualTo("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.");
    }

    private StudyRecord save(Member member, Question question, String answer, LocalDateTime submittedAt) {
        StudyRecord record = StudyRecord.createPracticeAttempt(member, question, answer);
        ReflectionTestUtils.setField(record, "submittedAt", submittedAt);
        return studyRecordRepository.saveAndFlush(record);
    }

    private Member saveStudent(String loginId) {
        return memberRepository.saveAndFlush(Member.builder()
            .loginId(loginId)
            .password("hashed-password")
            .name("김민수")
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
            .explanation("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.")
            .build();
        return questionRepository.saveAndFlush(question);
    }
}
