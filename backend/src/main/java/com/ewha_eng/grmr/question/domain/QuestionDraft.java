package com.ewha_eng.grmr.question.domain;

import java.util.List;

public record QuestionDraft(
    String category,
    QuestionType type,
    QuestionLevel level,
    String text,
    List<String> choices,
    String answer,
    String explanation
) {
}
