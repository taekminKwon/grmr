package com.ewha_eng.grmr.question.infrastructure;

import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionRandomSelector;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Component;

@Component
public class RandomQuestionSelector implements QuestionRandomSelector {

    @Override
    public Question select(List<Question> candidates) {
        int index = ThreadLocalRandom.current().nextInt(candidates.size());
        return candidates.get(index);
    }
}
