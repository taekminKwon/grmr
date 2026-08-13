package com.ewha_eng.grmr.studyrecord.presentation;

import com.ewha_eng.grmr.studyrecord.application.StudyRecordService;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/practice/answers")
@RequiredArgsConstructor
public class StudyRecordController {

    private final StudyRecordService studyRecordService;

    @PostMapping
    public ResponseEntity<PracticeAnswerResponse> submit(
        @AuthenticationPrincipal Long memberId,
        @RequestBody PracticeAnswerRequest request
    ) {
        StudyRecord studyRecord = studyRecordService.submitPracticeAnswer(
            memberId, request.toQuestionId(), request.toAnswer());

        return ResponseEntity.ok(PracticeAnswerResponse.from(studyRecord));
    }
}
