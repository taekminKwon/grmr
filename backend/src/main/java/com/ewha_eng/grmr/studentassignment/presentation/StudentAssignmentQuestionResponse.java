package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentQuestion;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record StudentAssignmentQuestionResponse(
    Long id,
    int order,
    String category,
    String level,
    String text,
    List<String> choices,
    String myAnswer
) {

    public static StudentAssignmentQuestionResponse from(StudentAssignmentQuestion question) {
        return new StudentAssignmentQuestionResponse(
            question.id(),
            question.order(),
            question.category(),
            label(question.level()),
            question.text(),
            question.choices(),
            question.myAnswer()
        );
    }

    private static String label(QuestionLevel level) {
        if (level == null) {
            return null;
        }
        return switch (level) {
            case BASIC -> "기초";
            case INTERMEDIATE -> "보통";
            case ADVANCED -> "심화";
        };
    }
}
