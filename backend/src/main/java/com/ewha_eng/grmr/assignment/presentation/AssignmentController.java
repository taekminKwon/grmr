package com.ewha_eng.grmr.assignment.presentation;

import com.ewha_eng.grmr.assignment.application.AssignmentAdminService;
import com.ewha_eng.grmr.assignment.application.AssignmentDetail;
import com.ewha_eng.grmr.assignment.application.AssignmentListItem;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assignments")
@RequiredArgsConstructor
public class AssignmentController {

    private final AssignmentAdminService assignmentAdminService;

    @GetMapping
    public ResponseEntity<PageResponse<AssignmentListItemResponse>> search(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String keyword,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        Page<AssignmentListItem> assignments = assignmentAdminService.search(
            AssignmentStatus.fromLabel(status), keyword, page, size);

        return ResponseEntity.ok(PageResponse.from(assignments, AssignmentListItemResponse::from));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AssignmentDetailResponse> getById(@PathVariable Long id) {
        AssignmentDetail detail = assignmentAdminService.getDetail(id);

        return ResponseEntity.ok(AssignmentDetailResponse.from(detail));
    }
}
