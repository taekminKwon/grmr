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
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordNotFoundException;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordReader;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
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
    private StudyRecordReader studyRecordReader;

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

        StudyRecord reloaded = studyRecordReader.findByIdAndMemberId(saved.getId(), member.getId()).orElseThrow();
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
        assertThat(studyRecordReader.search(member.getId(), null, PageRequest.of(0, 10))
            .getTotalElements()).isEqualTo(2);
    }

    @Test
    void submitPracticeAnswer_snapshotRemainsUnchanged_afterQuestionIsLaterUpdated() {
        Member member = saveStudent("owner04");
        Question question = saveActiveMultipleChoiceQuestion();

        StudyRecord saved = studyRecordService.submitPracticeAnswer(member.getId(), question.getId(), "were");

        question.update(null, null, null, null, null, null, "수정된 해설");
        questionRepository.saveAndFlush(question);

        StudyRecord reloaded = studyRecordReader.findByIdAndMemberId(saved.getId(), member.getId()).orElseThrow();
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

        assertThat(studyRecordReader.search(member.getId(), null, PageRequest.of(0, 10))
            .getTotalElements()).isZero();
    }

    @Test
    void getMyPracticeRecords_returnsSnapshotText_evenAfterQuestionTextIsLaterUpdated() {
        Member member = saveStudent("owner09");
        Question question = saveActiveMultipleChoiceQuestion();
        StudyRecord saved = studyRecordService.submitPracticeAnswer(member.getId(), question.getId(), "were");

        question.update(null, null, null, "If I _____ you, I would call you.", null, null, null);
        questionRepository.saveAndFlush(question);

        Page<StudyRecord> page = studyRecordService.getMyPracticeRecords(member.getId(), null,
            PageRequest.of(0, 10));

        assertThat(page.getContent()).filteredOn(record -> record.getId().equals(saved.getId()))
            .extracting(StudyRecord::getText)
            .containsExactly("If I _____ you, I would study harder.");
    }

    @Test
    void getMyPracticeRecords_filtersByCategory_andReturnsNewestFirst() {
        Member member = saveStudent("owner06");
        Question sinceQuestion = saveQuestionWithCategory("현재완료");
        Question subjunctiveQuestion = saveActiveMultipleChoiceQuestion();

        StudyRecord olderSince = studyRecordService.submitPracticeAnswer(member.getId(), sinceQuestion.getId(),
            "since");
        studyRecordService.submitPracticeAnswer(member.getId(), subjunctiveQuestion.getId(), "were");
        StudyRecord newerSince = studyRecordService.submitPracticeAnswer(member.getId(), sinceQuestion.getId(),
            "for");

        Page<StudyRecord> page = studyRecordService.getMyPracticeRecords(member.getId(), "현재완료",
            PageRequest.of(0, 10));

        assertThat(page.getContent()).extracting(StudyRecord::getId)
            .containsExactly(newerSince.getId(), olderSince.getId());
    }

    @Test
    void getMyPracticeRecord_returnsFullSnapshot_forOwnedRecord() {
        Member member = saveStudent("owner07");
        Question question = saveActiveMultipleChoiceQuestion();
        StudyRecord saved = studyRecordService.submitPracticeAnswer(member.getId(), question.getId(), "were");

        StudyRecord found = studyRecordService.getMyPracticeRecord(member.getId(), saved.getId());

        assertThat(found.getId()).isEqualTo(saved.getId());
        assertThat(found.getCategory()).isEqualTo("가정법");
        assertThat(found.getChoices()).containsExactly("am", "was", "were", "be");
    }

    @Test
    void getMyPracticeRecord_throwsStudyRecordNotFoundException_whenAccessedByAnotherMember() {
        Member owner = saveStudent("owner08");
        Member other = saveStudent("other08");
        Question question = saveActiveMultipleChoiceQuestion();
        StudyRecord saved = studyRecordService.submitPracticeAnswer(owner.getId(), question.getId(), "were");

        assertThatThrownBy(() -> studyRecordService.getMyPracticeRecord(other.getId(), saved.getId()))
            .isInstanceOf(StudyRecordNotFoundException.class);
    }

    private Question saveQuestionWithCategory(String category) {
        Question question = questionRepository.saveAndFlush(Question.builder()
            .category(category)
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.")
            .build());
        question.activate();
        return questionRepository.saveAndFlush(question);
    }
}
