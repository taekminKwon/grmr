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

    private String category;

    @Enumerated(EnumType.STRING)
    private QuestionType type;

    @Enumerated(EnumType.STRING)
    private QuestionLevel level;

    @Enumerated(EnumType.STRING)
    private QuestionStatus status;

    @Column(columnDefinition = "TEXT")
    private String text;

    @ElementCollection
    @CollectionTable(name = "question_choice", joinColumns = @JoinColumn(name = "question_id"))
    @OrderColumn(name = "choice_order")
    @Column(name = "choice")
    private List<String> choices = new ArrayList<>();

    private String answer;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    private LocalDateTime createdAt;

    @Builder
    private Question(String category, QuestionType type, QuestionLevel level, String text,
        List<String> choices, String answer, String explanation) {
        validate(type, choices, answer);
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

    private static void validate(QuestionType type, List<String> choices, String answer) {
        if (type == QuestionType.MULTIPLE_CHOICE) {
            if (choices == null || choices.isEmpty()) {
                throw new IllegalArgumentException("객관식 문제는 보기 목록이 필요합니다.");
            }
            if (!choices.contains(answer)) {
                throw new IllegalArgumentException("정답은 보기 목록에 포함되어야 합니다.");
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
            throw new IllegalStateException("초안 상태에서는 사용 중지로 변경할 수 없습니다.");
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
