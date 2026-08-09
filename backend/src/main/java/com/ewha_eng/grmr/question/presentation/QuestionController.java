package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.application.QuestionService;
import com.ewha_eng.grmr.question.domain.Question;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

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
}
