package com.ewha_eng.grmr.question.domain;

import java.util.List;

public interface QuestionGenerationClient {

    List<QuestionDraft> generate(String category, QuestionType type, QuestionLevel level, int count, String prompt);
}
