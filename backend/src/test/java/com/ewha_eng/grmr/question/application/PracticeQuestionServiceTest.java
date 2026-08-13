package com.ewha_eng.grmr.question.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.question.domain.NoQuestionAvailableException;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRandomSelector;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PracticeQuestionServiceTest {

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private QuestionRandomSelector questionRandomSelector;

    private PracticeQuestionService practiceQuestionService;

    @BeforeEach
    void setUp() {
        practiceQuestionService = new PracticeQuestionService(questionRepository, questionRandomSelector);
    }

    private Question activeMultipleChoiceQuestion() {
        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.")
            .build();
        question.activate();
        return question;
    }

    @Test
    void getNext_returnsQuestionSelectedByRandomSelector_whenCandidatesExist() {
        Question candidate = activeMultipleChoiceQuestion();
        List<Question> candidates = List.of(candidate);
        when(questionRepository.findActiveMultipleChoice("현재완료", QuestionLevel.INTERMEDIATE))
            .thenReturn(candidates);
        when(questionRandomSelector.select(candidates)).thenReturn(candidate);

        Question result = practiceQuestionService.getNext("현재완료", QuestionLevel.INTERMEDIATE);

        assertThat(result).isEqualTo(candidate);
        verify(questionRandomSelector).select(candidates);
    }

    @Test
    void getNext_passesNullFilters_whenNoFiltersProvided() {
        Question candidate = activeMultipleChoiceQuestion();
        List<Question> candidates = List.of(candidate);
        when(questionRepository.findActiveMultipleChoice(null, null)).thenReturn(candidates);
        when(questionRandomSelector.select(candidates)).thenReturn(candidate);

        practiceQuestionService.getNext(null, null);

        verify(questionRepository).findActiveMultipleChoice(null, null);
    }

    @Test
    void getNext_throwsNoQuestionAvailableException_whenNoCandidatesMatch() {
        when(questionRepository.findActiveMultipleChoice(null, null)).thenReturn(List.of());

        assertThatThrownBy(() -> practiceQuestionService.getNext(null, null))
            .isInstanceOf(NoQuestionAvailableException.class)
            .hasMessage("출제 가능한 문제가 없습니다.");
    }
}
