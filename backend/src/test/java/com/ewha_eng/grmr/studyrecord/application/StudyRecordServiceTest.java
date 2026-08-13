package com.ewha_eng.grmr.studyrecord.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberNotFoundException;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import com.ewha_eng.grmr.question.domain.QuestionNotInUseException;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.ewha_eng.grmr.question.domain.QuestionTypeNotSupportedException;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordStore;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StudyRecordServiceTest {

    @Mock
    private MemberReader memberReader;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private StudyRecordStore studyRecordStore;

    @Captor
    private ArgumentCaptor<StudyRecord> studyRecordCaptor;

    private StudyRecordService studyRecordService;

    @BeforeEach
    void setUp() {
        studyRecordService = new StudyRecordService(memberReader, questionRepository, studyRecordStore);
    }

    private Member student() {
        return Member.builder()
            .loginId("student01")
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .build();
    }

    private Question activeMultipleChoiceQuestion() {
        Question question = Question.builder()
            .category("가정법")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.ADVANCED)
            .text("If I _____ you, I would study harder.")
            .choices(List.of("am", "was", "were", "be"))
            .answer("were")
            .explanation("가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.")
            .build();
        question.activate();
        return question;
    }

    @Test
    void submitPracticeAnswer_createsCorrectRecord_whenAnswerMatches() {
        Member member = student();
        Question question = activeMultipleChoiceQuestion();
        when(memberReader.findById(2L)).thenReturn(Optional.of(member));
        when(questionRepository.findById(1021L)).thenReturn(Optional.of(question));
        when(studyRecordStore.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        StudyRecord result = studyRecordService.submitPracticeAnswer(2L, 1021L, "were");

        assertThat(result.isCorrect()).isTrue();
        assertThat(result.getSubmittedAnswer()).isEqualTo("were");
        assertThat(result.getCorrectAnswer()).isEqualTo("were");
        assertThat(result.getMember()).isEqualTo(member);
        assertThat(result.getQuestion()).isEqualTo(question);
    }

    @Test
    void submitPracticeAnswer_createsIncorrectRecord_whenAnswerDoesNotMatch_butExposesCorrectAnswer() {
        Member member = student();
        Question question = activeMultipleChoiceQuestion();
        when(memberReader.findById(2L)).thenReturn(Optional.of(member));
        when(questionRepository.findById(1021L)).thenReturn(Optional.of(question));
        when(studyRecordStore.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        StudyRecord result = studyRecordService.submitPracticeAnswer(2L, 1021L, "am");

        assertThat(result.isCorrect()).isFalse();
        assertThat(result.getSubmittedAnswer()).isEqualTo("am");
        assertThat(result.getCorrectAnswer()).isEqualTo("were");
    }

    @Test
    void submitPracticeAnswer_snapshotsQuestionFields_atSubmissionTime() {
        Member member = student();
        Question question = activeMultipleChoiceQuestion();
        when(memberReader.findById(2L)).thenReturn(Optional.of(member));
        when(questionRepository.findById(1021L)).thenReturn(Optional.of(question));
        when(studyRecordStore.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        StudyRecord result = studyRecordService.submitPracticeAnswer(2L, 1021L, "were");

        assertThat(result.getCategory()).isEqualTo("가정법");
        assertThat(result.getLevel()).isEqualTo(QuestionLevel.ADVANCED);
        assertThat(result.getText()).isEqualTo("If I _____ you, I would study harder.");
        assertThat(result.getChoices()).containsExactly("am", "was", "were", "be");
        assertThat(result.getExplanation())
            .isEqualTo("가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.");
    }

    @Test
    void submitPracticeAnswer_createsDistinctRecords_onRepeatedSubmission() {
        Member member = student();
        Question question = activeMultipleChoiceQuestion();
        when(memberReader.findById(2L)).thenReturn(Optional.of(member));
        when(questionRepository.findById(1021L)).thenReturn(Optional.of(question));
        when(studyRecordStore.save(studyRecordCaptor.capture())).thenAnswer(invocation -> invocation.getArgument(0));

        studyRecordService.submitPracticeAnswer(2L, 1021L, "were");
        studyRecordService.submitPracticeAnswer(2L, 1021L, "am");

        List<StudyRecord> saved = studyRecordCaptor.getAllValues();
        assertThat(saved).hasSize(2);
        assertThat(saved.get(0)).isNotSameAs(saved.get(1));
        assertThat(saved.get(0).isCorrect()).isTrue();
        assertThat(saved.get(1).isCorrect()).isFalse();
    }

    @Test
    void submitPracticeAnswer_throwsMemberNotFoundException_whenMemberIdDoesNotResolve() {
        when(memberReader.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studyRecordService.submitPracticeAnswer(999L, 1021L, "were"))
            .isInstanceOf(MemberNotFoundException.class);

        verify(questionRepository, never()).findById(any());
        verify(studyRecordStore, never()).save(any());
    }

    @Test
    void submitPracticeAnswer_throwsQuestionNotFoundException_whenQuestionDoesNotExist() {
        when(memberReader.findById(2L)).thenReturn(Optional.of(student()));
        when(questionRepository.findById(999999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> studyRecordService.submitPracticeAnswer(2L, 999999L, "were"))
            .isInstanceOf(QuestionNotFoundException.class);

        verify(studyRecordStore, never()).save(any());
    }

    @Test
    void submitPracticeAnswer_throwsQuestionNotInUseException_whenQuestionIsNotActive() {
        Question draftQuestion = Question.builder()
            .category("가정법")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.ADVANCED)
            .text("If I _____ you, I would study harder.")
            .choices(List.of("am", "was", "were", "be"))
            .answer("were")
            .explanation("해설")
            .build();
        when(memberReader.findById(2L)).thenReturn(Optional.of(student()));
        when(questionRepository.findById(1021L)).thenReturn(Optional.of(draftQuestion));

        assertThatThrownBy(() -> studyRecordService.submitPracticeAnswer(2L, 1021L, "were"))
            .isInstanceOf(QuestionNotInUseException.class);

        verify(studyRecordStore, never()).save(any());
    }

    @Test
    void submitPracticeAnswer_throwsQuestionTypeNotSupportedException_whenQuestionIsNotMultipleChoice() {
        Question fillInBlank = Question.builder()
            .category("관계대명사")
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("해설")
            .build();
        fillInBlank.activate();
        when(memberReader.findById(2L)).thenReturn(Optional.of(student()));
        when(questionRepository.findById(1024L)).thenReturn(Optional.of(fillInBlank));

        assertThatThrownBy(() -> studyRecordService.submitPracticeAnswer(2L, 1024L, "that"))
            .isInstanceOf(QuestionTypeNotSupportedException.class);

        verify(studyRecordStore, never()).save(any());
    }
}
