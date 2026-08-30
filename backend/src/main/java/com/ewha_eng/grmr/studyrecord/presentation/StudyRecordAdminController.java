package com.ewha_eng.grmr.studyrecord.presentation;

import com.ewha_eng.grmr.studyrecord.application.StudyRecordAdminService;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordRollup;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/study-records")
@RequiredArgsConstructor
public class StudyRecordAdminController {

    private final StudyRecordAdminService studyRecordAdminService;

    @GetMapping
    public ResponseEntity<PageResponse<StudyRecordRollupResponse>> search(
        @RequestParam(required = false) Long studentId,
        @RequestParam(required = false) String period,
        @RequestParam(required = false) String type,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        Page<StudyRecordRollup> rollups = studyRecordAdminService.search(studentId, period, type, page, size);

        return ResponseEntity.ok(PageResponse.from(rollups, StudyRecordRollupResponse::from));
    }
}
