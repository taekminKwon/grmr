package com.ewha_eng.grmr.studentassignment.application;

import com.ewha_eng.grmr.question.domain.QuestionLevel;
import java.util.List;

public record StudentAssignmentQuestion(
    Long id,
    int order,
    String category,
    QuestionLevel level,
    String text,
    List<String> choices,
    String myAnswer
) {
}
