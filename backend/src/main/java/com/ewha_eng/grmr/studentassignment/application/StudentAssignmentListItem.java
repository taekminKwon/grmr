package com.ewha_eng.grmr.studentassignment.application;

import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.studentassignment.domain.StudentAssignmentProgressStatus;
import java.time.LocalDate;

public record StudentAssignmentListItem(
    Long id,
    String title,
    LocalDate startDate,
    LocalDate dueDate,
    AssignmentStatus status,
    StudentAssignmentProgressStatus submissionStatus,
    int progress
) {
}
