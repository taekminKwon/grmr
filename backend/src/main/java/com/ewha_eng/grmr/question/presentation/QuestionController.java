package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.application.QuestionGenerationService;
import com.ewha_eng.grmr.question.application.QuestionService;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionDraft;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionStatus;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.net.URI;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;
    private final QuestionGenerationService questionGenerationService;

    @GetMapping
    public ResponseEntity<PageResponse<QuestionListItemResponse>> search(
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String level,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String keyword,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Question> questions = questionService.search(
            category,
            QuestionType.fromLabel(type),
            QuestionLevel.fromLabel(level),
            QuestionStatus.fromLabel(status),
            keyword,
            pageable
        );

        return ResponseEntity.ok(PageResponse.from(questions, QuestionListItemResponse::from));
    }

    @PostMapping
    public ResponseEntity<QuestionResponse> create(@RequestBody QuestionCreateRequest request) {
        Question question = questionService.create(
            request.category(),
            request.toQuestionType(),
            request.toQuestionLevel(),
            request.text(),
            request.choices(),
            request.answer(),
            request.explanation()
        );

        return ResponseEntity
            .created(URI.create("/api/questions/" + question.getId()))
            .body(QuestionResponse.from(question));
    }

    @PostMapping("/generate")
    public ResponseEntity<QuestionGenerateResponse> generate(@RequestBody QuestionGenerateRequest request) {
        List<QuestionDraft> drafts = questionGenerationService.generate(
            request.toCategory(),
            request.toQuestionType(),
            request.toQuestionLevel(),
            request.toCount(),
            request.prompt()
        );

        return ResponseEntity.ok(QuestionGenerateResponse.from(drafts));
    }

    @GetMapping("/{id}")
    public ResponseEntity<QuestionResponse> getById(@PathVariable Long id) {
        Question question = questionService.getById(id);

        return ResponseEntity.ok(QuestionResponse.from(question));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<QuestionResponse> update(@PathVariable Long id, @RequestBody QuestionUpdateRequest request) {
        Question question = questionService.update(
            id,
            request.category(),
            request.toQuestionType(),
            request.toQuestionLevel(),
            request.text(),
            request.choices(),
            request.answer(),
            request.explanation()
        );

        return ResponseEntity.ok(QuestionResponse.from(question));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<QuestionStatusResponse> changeStatus(
        @PathVariable Long id, @RequestBody QuestionStatusChangeRequest request) {
        Question question = questionService.changeStatus(id, request.status());

        return ResponseEntity.ok(QuestionStatusResponse.from(question));
    }
}
