package com.ewha_eng.grmr.question.infrastructure;

import com.ewha_eng.grmr.question.domain.QuestionDraft;
import com.ewha_eng.grmr.question.domain.QuestionGenerationClient;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class LocalQuestionGenerationClient implements QuestionGenerationClient {

    private static final List<String> DEFAULT_CHOICES = List.of("for", "since", "during", "from");

    @Override
    public List<QuestionDraft> generate(String category, QuestionType type, QuestionLevel level, int count,
        String prompt) {
        List<QuestionDraft> drafts = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            drafts.add(buildDraft(category, type, level, i));
        }
        return drafts;
    }

    private QuestionDraft buildDraft(String category, QuestionType type, QuestionLevel level, int index) {
        String text = category + " 문법을 활용한 예문입니다. (" + index + ")";
        List<String> choices = type == QuestionType.MULTIPLE_CHOICE ? DEFAULT_CHOICES : List.of();
        String answer = type == QuestionType.MULTIPLE_CHOICE ? DEFAULT_CHOICES.get(0) : category;
        String explanation = category + " 문법 규칙에 따른 해설입니다.";

        return new QuestionDraft(category, type, level, text, choices, answer, explanation);
    }
}
