package com.ewha_eng.grmr.studentassignment.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * One row per (assignment, student). Absence of a row means NOT_STARTED; the row is created
 * only when the student first reads the assignment's questions or saves a draft answer.
 */
@Entity
@Table(name = "assignment_submission",
    uniqueConstraints = @UniqueConstraint(columnNames = {"assignment_id", "student_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AssignmentSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "assignment_id", nullable = false, updatable = false)
    private Long assignmentId;

    @Column(name = "student_id", nullable = false, updatable = false)
    private Long studentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SubmissionStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime submittedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AssignmentAnswerDraft> drafts = new ArrayList<>();

    private AssignmentSubmission(Long assignmentId, Long studentId, LocalDateTime now) {
        this.assignmentId = assignmentId;
        this.studentId = studentId;
        this.status = SubmissionStatus.IN_PROGRESS;
        this.createdAt = now;
    }

    public static AssignmentSubmission start(Long assignmentId, Long studentId, LocalDateTime now) {
        if (assignmentId == null) {
            throw new InvalidAssignmentSubmissionException("과제 ID는 필수입니다.");
        }
        if (studentId == null) {
            throw new InvalidAssignmentSubmissionException("학생 ID는 필수입니다.");
        }
        if (now == null) {
            throw new InvalidAssignmentSubmissionException("생성 시각은 필수입니다.");
        }
        return new AssignmentSubmission(assignmentId, studentId, now);
    }

    public boolean isSubmitted() {
        return status == SubmissionStatus.SUBMITTED;
    }

    public void upsertDraft(Long questionId, String answer, LocalDateTime now) {
        ensureInProgress();
        if (questionId == null) {
            throw new InvalidAssignmentSubmissionException("문제 ID는 필수입니다.");
        }
        if (answer == null || answer.isBlank()) {
            throw new InvalidAssignmentSubmissionException("답안은 필수입니다.");
        }
        Optional<AssignmentAnswerDraft> existing = findDraft(questionId);
        if (existing.isPresent()) {
            existing.get().overwrite(answer, now);
        } else {
            drafts.add(new AssignmentAnswerDraft(this, questionId, answer, now));
        }
    }

    public Optional<String> answerFor(Long questionId) {
        return findDraft(questionId).map(AssignmentAnswerDraft::getAnswer);
    }

    public int answeredQuestionCount() {
        return drafts.size();
    }

    public void submit(LocalDateTime now) {
        ensureInProgress();
        if (now == null) {
            throw new InvalidAssignmentSubmissionException("제출 시각은 필수입니다.");
        }
        this.status = SubmissionStatus.SUBMITTED;
        this.submittedAt = now;
    }

    private void ensureInProgress() {
        if (status != SubmissionStatus.IN_PROGRESS) {
            throw new AssignmentAlreadySubmittedException("이미 제출된 과제입니다.");
        }
    }

    private Optional<AssignmentAnswerDraft> findDraft(Long questionId) {
        return drafts.stream()
            .filter(draft -> draft.getQuestionId().equals(questionId))
            .findFirst();
    }
}
