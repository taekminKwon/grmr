package com.ewha_eng.grmr.question.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import org.junit.jupiter.api.Test;

class RandomQuestionSelectorTest {

    private final RandomQuestionSelector randomQuestionSelector = new RandomQuestionSelector();

    @Test
    void select_returnsTheOnlyCandidate_whenSingleCandidateGiven() {
        Question question = question();

        Question selected = randomQuestionSelector.select(List.of(question));

        assertThat(selected).isEqualTo(question);
    }

    @Test
    void select_returnsOneOfTheCandidates_whenMultipleCandidatesGiven() {
        List<Question> candidates = List.of(question(), question(), question());

        Question selected = randomQuestionSelector.select(candidates);

        assertThat(candidates).contains(selected);
    }

    private Question question() {
        return Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("설명")
            .build();
    }
}
