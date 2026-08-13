package com.ewha_eng.grmr.question.application;

import com.ewha_eng.grmr.question.domain.NoQuestionAvailableException;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRandomSelector;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PracticeQuestionService {

    private final QuestionRepository questionRepository;
    private final QuestionRandomSelector questionRandomSelector;

    @Transactional(readOnly = true)
    public Question getNext(String category, QuestionLevel level) {
        List<Question> candidates = questionRepository.findActiveMultipleChoice(category, level);
        if (candidates.isEmpty()) {
            throw new NoQuestionAvailableException("출제 가능한 문제가 없습니다.");
        }

        return questionRandomSelector.select(candidates);
    }
}
