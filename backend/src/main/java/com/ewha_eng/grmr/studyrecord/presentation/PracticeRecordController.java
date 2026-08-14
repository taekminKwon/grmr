package com.ewha_eng.grmr.studyrecord.presentation;

import com.ewha_eng.grmr.global.exception.InvalidRequestException;
import com.ewha_eng.grmr.studyrecord.application.StudyRecordService;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/practice/records")
@RequiredArgsConstructor
public class PracticeRecordController {

    private final StudyRecordService studyRecordService;

    @GetMapping
    public ResponseEntity<PageResponse<StudyRecordListItemResponse>> getMyRecords(
        @AuthenticationPrincipal Long memberId,
        @RequestParam(required = false) String category,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        if (page < 0) {
            throw new InvalidRequestException("페이지 번호는 0 이상이어야 합니다: " + page);
        }
        if (size < 1 || size > 100) {
            throw new InvalidRequestException("페이지 크기는 1 이상 100 이하이어야 합니다: " + size);
        }

        Pageable pageable = PageRequest.of(page, size);
        Page<StudyRecord> records = studyRecordService.getMyPracticeRecords(memberId, category, pageable);

        return ResponseEntity.ok(PageResponse.from(records, StudyRecordListItemResponse::from));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudyRecordDetailResponse> getMyRecord(
        @AuthenticationPrincipal Long memberId,
        @PathVariable Long id
    ) {
        StudyRecord record = studyRecordService.getMyPracticeRecord(memberId, id);

        return ResponseEntity.ok(StudyRecordDetailResponse.from(record));
    }
}
