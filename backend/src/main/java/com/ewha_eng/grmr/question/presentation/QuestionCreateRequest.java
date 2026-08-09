package com.ewha_eng.grmr.question.presentation;

import com.ewha_eng.grmr.question.domain.InvalidQuestionException;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;

public record QuestionCreateRequest(
    String category,
    String type,
    String level,
    String text,
    List<String> choices,
    String answer,
    String explanation
) {

    public QuestionType toQuestionType() {
        if (type == null || type.isBlank()) {
            throw new InvalidQuestionException("문제 유형은 필수입니다.");
        }
        return switch (type) {
            case "객관식" -> QuestionType.MULTIPLE_CHOICE;
            case "빈칸" -> QuestionType.FILL_IN_BLANK;
            case "오류 찾기" -> QuestionType.ERROR_FINDING;
            default -> throw new InvalidQuestionException("알 수 없는 문제 유형입니다: " + type);
        };
    }

    public QuestionLevel toQuestionLevel() {
        if (level == null || level.isBlank()) {
            throw new InvalidQuestionException("난이도는 필수입니다.");
        }
        return switch (level) {
            case "기초" -> QuestionLevel.BASIC;
            case "보통" -> QuestionLevel.INTERMEDIATE;
            case "심화" -> QuestionLevel.ADVANCED;
            default -> throw new InvalidQuestionException("알 수 없는 난이도입니다: " + level);
        };
    }
}
