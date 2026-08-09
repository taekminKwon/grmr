package com.ewha_eng.grmr.question.application;

import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionSpecifications;
import com.ewha_eng.grmr.question.domain.QuestionStatus;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;

    @Transactional
    public Question create(String category, QuestionType type, QuestionLevel level, String text,
        List<String> choices, String answer, String explanation) {
        Question question = Question.builder()
            .category(category)
            .type(type)
            .level(level)
            .text(text)
            .choices(choices)
            .answer(answer)
            .explanation(explanation)
            .build();

        return questionRepository.save(question);
    }

    @Transactional(readOnly = true)
    public Question getById(Long id) {
        return questionRepository.findById(id)
            .orElseThrow(() -> new QuestionNotFoundException("문제를 찾을 수 없습니다."));
    }

    @Transactional
    public Question update(Long id, String category, QuestionType type, QuestionLevel level, String text,
        List<String> choices, String answer, String explanation) {
        Question question = questionRepository.findById(id)
            .orElseThrow(() -> new QuestionNotFoundException("문제를 찾을 수 없습니다."));
        question.update(category, type, level, text, choices, answer, explanation);
        return question;
    }

    @Transactional(readOnly = true)
    public Page<Question> search(String category, QuestionType type, QuestionLevel level, QuestionStatus status,
        String keyword, Pageable pageable) {
        return questionRepository.findAll(
            QuestionSpecifications.search(category, type, level, status, keyword), pageable);
    }
}
