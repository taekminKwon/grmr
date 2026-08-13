package com.ewha_eng.grmr.studyrecord.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.member.infrastructure.MemberJpaRepository;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionNotInUseException;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.infrastructure.StudyRecordJpaRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class StudyRecordServiceIntegrationTest {

    @Autowired
    private StudyRecordService studyRecordService;

    @Autowired
    private MemberJpaRepository memberRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private StudyRecordJpaRepository studyRecordRepository;

    private Member saveStudent(String loginId) {
        return memberRepository.saveAndFlush(Member.builder()
            .loginId(loginId)
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .build());
    }

    private Question saveActiveMultipleChoiceQuestion() {
        Question question = questionRepository.saveAndFlush(Question.builder()
            .category("가정법")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.ADVANCED)
            .text("If I _____ you, I would study harder.")
            .choices(List.of("am", "was", "were", "be"))
            .answer("were")
            .explanation("가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.")
            .build());
        question.activate();
        return questionRepository.saveAndFlush(question);
    }

    @Test
    void submitPracticeAnswer_persistsOwnedByAuthenticatedMember_andGradesCorrectly() {
        Member member = saveStudent("owner01");
        Question question = saveActiveMultipleChoiceQuestion();

        StudyRecord saved = studyRecordService.submitPracticeAnswer(member.getId(), question.getId(), "were");

        StudyRecord reloaded = studyRecordRepository.findByIdAndMemberId(saved.getId(), member.getId()).orElseThrow();
        assertThat(reloaded.isCorrect()).isTrue();
        assertThat(reloaded.getSubmittedAnswer()).isEqualTo("were");
    }

    @Test
    void submitPracticeAnswer_persistsIncorrectRecord_whenAnswerIsWrong() {
        Member member = saveStudent("owner02");
        Question question = saveActiveMultipleChoiceQuestion();

        StudyRecord saved = studyRecordService.submitPracticeAnswer(member.getId(), question.getId(), "am");

        assertThat(saved.isCorrect()).isFalse();
        assertThat(saved.getCorrectAnswer()).isEqualTo("were");
    }

    @Test
    void submitPracticeAnswer_createsSeparateRecords_onRepeatedSubmission() {
        Member member = saveStudent("owner03");
        Question question = saveActiveMultipleChoiceQuestion();

        StudyRecord first = studyRecordService.submitPracticeAnswer(member.getId(), question.getId(), "were");
        StudyRecord second = studyRecordService.submitPracticeAnswer(member.getId(), question.getId(), "am");

        assertThat(first.getId()).isNotEqualTo(second.getId());
        assertThat(studyRecordRepository.findByMemberIdOrderBySubmittedAtDesc(member.getId(),
            org.springframework.data.domain.PageRequest.of(0, 10)).getTotalElements()).isEqualTo(2);
    }

    @Test
    void submitPracticeAnswer_snapshotRemainsUnchanged_afterQuestionIsLaterUpdated() {
        Member member = saveStudent("owner04");
        Question question = saveActiveMultipleChoiceQuestion();

        StudyRecord saved = studyRecordService.submitPracticeAnswer(member.getId(), question.getId(), "were");

        question.update(null, null, null, null, null, null, "수정된 해설");
        questionRepository.saveAndFlush(question);

        StudyRecord reloaded = studyRecordRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getExplanation())
            .isEqualTo("가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.");
    }

    @Test
    void submitPracticeAnswer_throwsQuestionNotInUseException_andPersistsNoRecord_whenQuestionIsDraft() {
        Member member = saveStudent("owner05");
        Question draftQuestion = questionRepository.saveAndFlush(Question.builder()
            .category("가정법")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.ADVANCED)
            .text("If I _____ you, I would study harder.")
            .choices(List.of("am", "was", "were", "be"))
            .answer("were")
            .explanation("해설")
            .build());

        assertThatThrownBy(() -> studyRecordService.submitPracticeAnswer(member.getId(), draftQuestion.getId(), "were"))
            .isInstanceOf(QuestionNotInUseException.class);

        assertThat(studyRecordRepository.findByMemberIdOrderBySubmittedAtDesc(member.getId(),
            org.springframework.data.domain.PageRequest.of(0, 10)).getTotalElements()).isZero();
    }
}
