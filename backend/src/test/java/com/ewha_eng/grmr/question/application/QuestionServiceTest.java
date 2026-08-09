package com.ewha_eng.grmr.question.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.question.domain.InvalidQuestionException;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class QuestionServiceTest {

    @Mock
    private QuestionRepository questionRepository;

    private QuestionService questionService;

    @BeforeEach
    void setUp() {
        questionService = new QuestionService(questionRepository);
    }

    private Question draftQuestion() {
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

    @Test
    void changeStatus_throwsInvalidQuestionExceptionWithDraftMessage_whenTargetStatusIsDraft() {
        Question question = draftQuestion();
        when(questionRepository.findById(1L)).thenReturn(Optional.of(question));

        assertThatThrownBy(() -> questionService.changeStatus(1L, "초안"))
            .isInstanceOf(InvalidQuestionException.class)
            .hasMessage("초안 상태로는 변경할 수 없습니다: 초안");
    }

    @Test
    void changeStatus_throwsInvalidQuestionExceptionWithUnknownMessage_whenStatusIsUnrecognized() {
        Question question = draftQuestion();
        when(questionRepository.findById(1L)).thenReturn(Optional.of(question));

        assertThatThrownBy(() -> questionService.changeStatus(1L, "알 수 없음"))
            .isInstanceOf(InvalidQuestionException.class)
            .hasMessage("알 수 없는 상태입니다: 알 수 없음");
    }

    @Test
    void changeStatus_activatesQuestion_whenTargetStatusIsActive() {
        Question question = draftQuestion();
        when(questionRepository.findById(1L)).thenReturn(Optional.of(question));

        Question result = questionService.changeStatus(1L, "사용 중");

        assertThat(result.isActive()).isTrue();
    }
}
