package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.application.PracticeQuestionService;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/practice/questions")
@RequiredArgsConstructor
public class PracticeQuestionController {

    private final PracticeQuestionService practiceQuestionService;

    @GetMapping("/next")
    public ResponseEntity<PracticeQuestionResponse> next(
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String level
    ) {
        Question question = practiceQuestionService.getNext(category, QuestionLevel.fromLabel(level));

        return ResponseEntity.ok(PracticeQuestionResponse.from(question));
    }
}
