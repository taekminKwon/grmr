package com.ewha_eng.grmr.studentassignment.application;

import com.ewha_eng.grmr.studentassignment.domain.SubmissionStatus;
import java.util.List;

public record StudentAssignmentQuestions(
    Long assignmentId,
    SubmissionStatus submissionStatus,
    List<StudentAssignmentQuestion> questions
) {
}
