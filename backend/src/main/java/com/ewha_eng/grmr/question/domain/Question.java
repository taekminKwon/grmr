package com.ewha_eng.grmr.question.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Question {

    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuestionType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuestionLevel level;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuestionStatus status;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String text;

    @ElementCollection
    @CollectionTable(name = "question_choice", joinColumns = @JoinColumn(name = "question_id"))
    @OrderColumn(name = "choice_order")
    @Column(name = "choice", nullable = false)
    private List<String> choices = new ArrayList<>();

    @Column(nullable = false)
    private String answer;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String explanation;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Builder
    private Question(String category, QuestionType type, QuestionLevel level, String text,
        List<String> choices, String answer, String explanation) {
        validate(category, type, level, text, choices, answer, explanation);
        this.category = category;
        this.type = type;
        this.level = level;
        this.status = QuestionStatus.DRAFT;
        this.text = text;
        this.choices = type == QuestionType.MULTIPLE_CHOICE ? new ArrayList<>(choices) : List.of();
        this.answer = answer;
        this.explanation = explanation;
        this.createdAt = LocalDateTime.now();
    }

    public void update(String category, QuestionType type, QuestionLevel level, String text,
        List<String> choices, String answer, String explanation) {
        String newCategory = category != null ? category : this.category;
        QuestionType newType = type != null ? type : this.type;
        QuestionLevel newLevel = level != null ? level : this.level;
        String newText = text != null ? text : this.text;
        List<String> newChoices = choices != null ? choices : this.choices;
        String newAnswer = answer != null ? answer : this.answer;
        String newExplanation = explanation != null ? explanation : this.explanation;

        validate(newCategory, newType, newLevel, newText, newChoices, newAnswer, newExplanation);

        this.category = newCategory;
        this.type = newType;
        this.level = newLevel;
        this.text = newText;
        this.choices = newType == QuestionType.MULTIPLE_CHOICE ? new ArrayList<>(newChoices) : List.of();
        this.answer = newAnswer;
        this.explanation = newExplanation;
    }

    private static void validate(String category, QuestionType type, QuestionLevel level, String text,
        List<String> choices, String answer, String explanation) {
        if (category == null || category.isBlank()) {
            throw new InvalidQuestionException("문법 항목은 필수입니다.");
        }
        if (type == null) {
            throw new InvalidQuestionException("문제 유형은 필수입니다.");
        }
        if (level == null) {
            throw new InvalidQuestionException("난이도는 필수입니다.");
        }
        if (text == null || text.isBlank()) {
            throw new InvalidQuestionException("본문은 필수입니다.");
        }
        if (answer == null || answer.isBlank()) {
            throw new InvalidQuestionException("정답은 필수입니다.");
        }
        if (explanation == null || explanation.isBlank()) {
            throw new InvalidQuestionException("해설은 필수입니다.");
        }
        if (type == QuestionType.MULTIPLE_CHOICE) {
            if (choices == null || choices.isEmpty()) {
                throw new InvalidQuestionException("객관식 문제는 보기 목록이 필요합니다.");
            }
            if (!choices.contains(answer)) {
                throw new InvalidQuestionException("정답은 보기 목록에 포함되어야 합니다.");
            }
        }
    }

    public boolean isCorrectAnswer(String submitted) {
        return this.answer.equals(submitted);
    }

    public void activate() {
        this.status = QuestionStatus.ACTIVE;
    }

    public void deactivate() {
        if (this.status == QuestionStatus.DRAFT) {
            throw new InvalidStatusTransitionException("초안 상태에서는 사용 중지로 변경할 수 없습니다.");
        }
        this.status = QuestionStatus.INACTIVE;
    }

    public boolean isDraft() {
        return this.status == QuestionStatus.DRAFT;
    }

    public boolean isActive() {
        return this.status == QuestionStatus.ACTIVE;
    }

    public boolean isInactive() {
        return this.status == QuestionStatus.INACTIVE;
    }
}
