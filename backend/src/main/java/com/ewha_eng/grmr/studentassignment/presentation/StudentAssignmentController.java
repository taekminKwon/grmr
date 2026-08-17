package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.studentassignment.application.AssignmentAnswerDraftResult;
import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentListItem;
import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentQuestions;
import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/assignments")
@RequiredArgsConstructor
public class StudentAssignmentController {

    private final StudentAssignmentService studentAssignmentService;

    @GetMapping
    public ResponseEntity<PageResponse<StudentAssignmentListItemResponse>> myAssignments(
        @AuthenticationPrincipal Long memberId,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        Page<StudentAssignmentListItem> assignments = studentAssignmentService.getMyAssignments(memberId, page,
            size);

        return ResponseEntity.ok(PageResponse.from(assignments, StudentAssignmentListItemResponse::from));
    }

    @GetMapping("/{assignmentId}/questions")
    public ResponseEntity<StudentAssignmentQuestionsResponse> questions(
        @AuthenticationPrincipal Long memberId,
        @PathVariable Long assignmentId
    ) {
        StudentAssignmentQuestions questions = studentAssignmentService.getQuestions(assignmentId, memberId);

        return ResponseEntity.ok(StudentAssignmentQuestionsResponse.from(questions));
    }

    @PutMapping("/{assignmentId}/answers/{questionId}")
    public ResponseEntity<AssignmentAnswerResponse> saveAnswer(
        @AuthenticationPrincipal Long memberId,
        @PathVariable Long assignmentId,
        @PathVariable Long questionId,
        @RequestBody AssignmentAnswerRequest request
    ) {
        AssignmentAnswerDraftResult result = studentAssignmentService.saveAnswerDraft(
            assignmentId, questionId, request.toAnswer(), memberId);

        return ResponseEntity.ok(AssignmentAnswerResponse.from(result));
    }
}
