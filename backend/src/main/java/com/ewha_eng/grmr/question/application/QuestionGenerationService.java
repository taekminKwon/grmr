package com.ewha_eng.grmr.question.application;

import com.ewha_eng.grmr.question.domain.GptGenerationFailedException;
import com.ewha_eng.grmr.question.domain.QuestionDraft;
import com.ewha_eng.grmr.question.domain.QuestionGenerationClient;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class QuestionGenerationService {

    private static final String GENERATION_FAILED_MESSAGE = "문제 생성에 실패했습니다. 다시 시도해주세요.";

    private final QuestionGenerationClient questionGenerationClient;

    public List<QuestionDraft> generate(String category, QuestionType type, QuestionLevel level, int count,
        String prompt) {
        try {
            return questionGenerationClient.generate(category, type, level, count, prompt);
        } catch (RuntimeException e) {
            throw new GptGenerationFailedException(GENERATION_FAILED_MESSAGE);
        }
    }
}
