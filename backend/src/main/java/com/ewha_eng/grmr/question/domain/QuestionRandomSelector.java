package com.ewha_eng.grmr.question.domain;

import java.util.List;

public interface QuestionRandomSelector {

    Question select(List<Question> candidates);
}
