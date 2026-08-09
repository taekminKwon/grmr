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
            .isInstanceOf(InvalidQuestionException.class);
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
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void builder_throws_whenCategoryIsBlank() {
        assertThatThrownBy(() -> Question.builder()
            .category("   ")
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("해설")
            .build())
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void builder_createsDraftQuestion_whenCategoryLengthIsExactlyMax() {
        Question question = Question.builder()
            .category("가".repeat(100))
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("해설")
            .build();

        assertThat(question.getCategory()).hasSize(100);
    }

    @Test
    void builder_throws_whenCategoryExceedsMaxLength() {
        assertThatThrownBy(() -> Question.builder()
            .category("가".repeat(101))
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("해설")
            .build())
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void builder_throws_whenCategoryIsNull() {
        assertThatThrownBy(() -> Question.builder()
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("해설")
            .build())
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void builder_throws_whenTypeIsNull() {
        assertThatThrownBy(() -> Question.builder()
            .category("관계대명사")
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("해설")
            .build())
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void builder_throws_whenLevelIsNull() {
        assertThatThrownBy(() -> Question.builder()
            .category("관계대명사")
            .type(QuestionType.FILL_IN_BLANK)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("해설")
            .build())
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void builder_throws_whenTextIsBlank() {
        assertThatThrownBy(() -> Question.builder()
            .category("관계대명사")
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("   ")
            .answer("that")
            .explanation("해설")
            .build())
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void builder_throws_whenAnswerIsBlank() {
        assertThatThrownBy(() -> Question.builder()
            .category("관계대명사")
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("   ")
            .explanation("해설")
            .build())
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void builder_throws_whenExplanationIsBlank() {
        assertThatThrownBy(() -> Question.builder()
            .category("관계대명사")
            .type(QuestionType.FILL_IN_BLANK)
            .level(QuestionLevel.BASIC)
            .text("This is the book _____ I bought yesterday.")
            .answer("that")
            .explanation("   ")
            .build())
            .isInstanceOf(InvalidQuestionException.class);
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
            .isInstanceOf(InvalidStatusTransitionException.class);
    }

    @Test
    void deactivate_changesStatusToInactive_afterActivation() {
        Question question = fillInBlankQuestion();
        question.activate();

        question.deactivate();

        assertThat(question.isInactive()).isTrue();
    }

    @Test
    void update_changesOnlyProvidedFields_andPreservesIdStatusAndCreatedAt() {
        Question question = fillInBlankQuestion();
        question.activate();

        question.update(null, null, null, "This is the book _____ I bought yesterday, updated.", null, null,
            "수정된 해설");

        assertThat(question.getText()).isEqualTo("This is the book _____ I bought yesterday, updated.");
        assertThat(question.getExplanation()).isEqualTo("수정된 해설");
        assertThat(question.getCategory()).isEqualTo("관계대명사");
        assertThat(question.getAnswer()).isEqualTo("that");
        assertThat(question.isActive()).isTrue();
    }

    @Test
    void update_throws_whenTextIsUpdatedToBlank() {
        Question question = fillInBlankQuestion();

        assertThatThrownBy(() -> question.update(null, null, null, "   ", null, null, null))
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void update_throws_whenAnswerIsUpdatedToBlank() {
        Question question = fillInBlankQuestion();

        assertThatThrownBy(() -> question.update(null, null, null, null, null, "   ", null))
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void update_throws_whenExplanationIsUpdatedToBlank() {
        Question question = fillInBlankQuestion();

        assertThatThrownBy(() -> question.update(null, null, null, null, null, null, "   "))
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void update_preservesExistingRequiredValues_whenOnlyOneFieldIsProvided() {
        Question question = fillInBlankQuestion();

        question.update(null, null, null, "updated text", null, null, null);

        assertThat(question.getCategory()).isEqualTo("관계대명사");
        assertThat(question.getType()).isEqualTo(QuestionType.FILL_IN_BLANK);
        assertThat(question.getLevel()).isEqualTo(QuestionLevel.BASIC);
        assertThat(question.getAnswer()).isEqualTo("that");
        assertThat(question.getExplanation()).isEqualTo("해설");
        assertThat(question.getText()).isEqualTo("updated text");
    }

    @Test
    void update_throws_whenCategoryIsUpdatedToExceedMaxLength() {
        Question question = fillInBlankQuestion();

        assertThatThrownBy(() -> question.update("가".repeat(101), null, null, null, null, null, null))
            .isInstanceOf(InvalidQuestionException.class);
    }

    @Test
    void update_throws_whenUpdatedAnswerIsNotInExistingChoices() {
        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("해설")
            .build();

        assertThatThrownBy(() -> question.update(null, null, null, null, null, "because", null))
            .isInstanceOf(InvalidQuestionException.class);
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
