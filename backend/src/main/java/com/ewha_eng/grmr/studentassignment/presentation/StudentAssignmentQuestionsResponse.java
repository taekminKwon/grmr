package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentQuestions;
import java.util.List;

public record StudentAssignmentQuestionsResponse(
    Long assignmentId,
    String submissionStatus,
    List<StudentAssignmentQuestionResponse> questions
) {

    public static StudentAssignmentQuestionsResponse from(StudentAssignmentQuestions questions) {
        return new StudentAssignmentQuestionsResponse(
            questions.assignmentId(),
            questions.submissionStatus().name(),
            questions.questions().stream().map(StudentAssignmentQuestionResponse::from).toList()
        );
    }
}
