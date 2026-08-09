package com.ewha_eng.grmr.question.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class QuestionTest {

    @Test
    void builder_createsDraftQuestion_whenMultipleChoiceAnswerIsInChoices() {
        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.")
            .build();

        assertThat(question.isDraft()).isTrue();
        assertThat(question.getChoices()).containsExactly("for", "since", "during", "from");
    }

    @Test
    void builder_throws_whenMultipleChoiceHasNoChoices() {
        assertThatThrownBy(() -> Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .answer("since")
            .explanation("해설")
            .build())
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void builder_throws_whenAnswerIsNotInChoices() {
        assertThatThrownBy(() -> Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "during", "from"))
            .answer("since")
            .explanation("해설")
            .build())
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void builder_allowsEmptyChoices_whenTypeIsNotMultipleChoice() {
        Question question = Question.builder()
            .category("관계대명사")
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("해설")
            .build();

        assertThat(question.getChoices()).isEmpty();
    }

    @Test
    void isCorrectAnswer_comparesSubmittedValueWithAnswer() {
        Question question = fillInBlankQuestion();

        assertThat(question.isCorrectAnswer("that")).isTrue();
        assertThat(question.isCorrectAnswer("which")).isFalse();
    }

    @Test
    void activate_changesStatusToActive_fromDraft() {
        Question question = fillInBlankQuestion();

        question.activate();

        assertThat(question.isActive()).isTrue();
    }

    @Test
    void deactivate_throws_whenStatusIsDraft() {
        Question question = fillInBlankQuestion();

        assertThatThrownBy(question::deactivate)
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void deactivate_changesStatusToInactive_afterActivation() {
        Question question = fillInBlankQuestion();
        question.activate();

        question.deactivate();

        assertThat(question.isInactive()).isTrue();
    }

    private Question fillInBlankQuestion() {
        return Question.builder()
            .category("관계대명사")
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("해설")
            .build();
    }
}
