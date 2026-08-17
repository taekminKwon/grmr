package com.ewha_eng.grmr.studentassignment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "assignment_answer_draft",
    uniqueConstraints = @UniqueConstraint(columnNames = {"submission_id", "question_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AssignmentAnswerDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false, updatable = false)
    private AssignmentSubmission submission;

    @Column(name = "question_id", nullable = false, updatable = false)
    private Long questionId;

    @Column(nullable = false)
    private String answer;

    @Column(name = "saved_at", nullable = false)
    private LocalDateTime savedAt;

    AssignmentAnswerDraft(AssignmentSubmission submission, Long questionId, String answer, LocalDateTime savedAt) {
        this.submission = submission;
        this.questionId = questionId;
        this.answer = answer;
        this.savedAt = savedAt;
    }

    void overwrite(String answer, LocalDateTime savedAt) {
        this.answer = answer;
        this.savedAt = savedAt;
    }
}
