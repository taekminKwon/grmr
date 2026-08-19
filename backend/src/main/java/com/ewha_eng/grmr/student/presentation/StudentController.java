package com.ewha_eng.grmr.student.presentation;

import com.ewha_eng.grmr.student.application.StudentAdminService;
import com.ewha_eng.grmr.student.application.StudentSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {

    private final StudentAdminService studentAdminService;

    @GetMapping
    public ResponseEntity<PageResponse<StudentResponse>> search(
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String group,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        Page<StudentSummary> students = studentAdminService.search(keyword, group, page, size);

        return ResponseEntity.ok(PageResponse.from(students, StudentResponse::from));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudentResponse> getById(@PathVariable Long id) {
        StudentSummary student = studentAdminService.getDetail(id);

        return ResponseEntity.ok(StudentResponse.from(student));
    }
}
