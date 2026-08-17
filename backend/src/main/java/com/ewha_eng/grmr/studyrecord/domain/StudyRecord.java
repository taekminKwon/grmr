package com.ewha_eng.grmr.studyrecord.domain;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StudyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StudyRecordType type;

    @Column(nullable = false, length = 100)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuestionLevel level;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String text;

    @ElementCollection
    @CollectionTable(name = "study_record_choice", joinColumns = @JoinColumn(name = "study_record_id"))
    @OrderColumn(name = "choice_order")
    @Column(name = "choice", nullable = false)
    private List<String> choices = new ArrayList<>();

    @Column(nullable = false)
    private String correctAnswer;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String explanation;

    private String submittedAnswer;

    @Column(nullable = false)
    private boolean correct;

    @Column(nullable = false)
    private LocalDateTime submittedAt;

    /**
     * Set only for {@link StudyRecordType#ASSIGNMENT} records: the assignment this snapshot was
     * graded as part of, used for progress/history aggregation. Not exposed as a response field.
     */
    @Column(name = "assignment_id")
    private Long assignmentId;

    private StudyRecord(Member member, Question question, StudyRecordType type, String submittedAnswer,
        Long assignmentId, LocalDateTime submittedAt) {
        this.member = member;
        this.question = question;
        this.type = type;
        this.category = question.getCategory();
        this.level = question.getLevel();
        this.text = question.getText();
        this.choices = new ArrayList<>(question.getChoices());
        this.correctAnswer = question.getAnswer();
        this.explanation = question.getExplanation();
        this.submittedAnswer = submittedAnswer;
        this.correct = question.isCorrectAnswer(submittedAnswer);
        this.assignmentId = assignmentId;
        this.submittedAt = submittedAt;
    }

    public static StudyRecord createPracticeAttempt(Member member, Question question, String submittedAnswer) {
        validate(member, question, StudyRecordType.PRACTICE, submittedAnswer, null);
        return new StudyRecord(member, question, StudyRecordType.PRACTICE, submittedAnswer, null,
            LocalDateTime.now());
    }

    /**
     * Grades one question of an assignment final-submit snapshot. {@code submittedAnswer} may be
     * {@code null} when the student never saved a draft for this question — unlike practice
     * attempts, a null/blank answer is still a valid (incorrect) assignment result.
     */
    public static StudyRecord createAssignmentAttempt(Member member, Question question, String submittedAnswer,
        Long assignmentId, LocalDateTime submittedAt) {
        validate(member, question, StudyRecordType.ASSIGNMENT, submittedAnswer, assignmentId);
        if (submittedAt == null) {
            throw new InvalidStudyRecordException("제출 시각은 필수입니다.");
        }
        return new StudyRecord(member, question, StudyRecordType.ASSIGNMENT, submittedAnswer, assignmentId,
            submittedAt);
    }

    private static void validate(Member member, Question question, StudyRecordType type, String submittedAnswer,
        Long assignmentId) {
        if (member == null) {
            throw new InvalidStudyRecordException("학습자는 필수입니다.");
        }
        if (question == null) {
            throw new InvalidStudyRecordException("문제는 필수입니다.");
        }
        if (type == StudyRecordType.PRACTICE && (submittedAnswer == null || submittedAnswer.isBlank())) {
            throw new InvalidStudyRecordException("제출한 답안은 필수입니다.");
        }
        if (type == StudyRecordType.ASSIGNMENT && assignmentId == null) {
            throw new InvalidStudyRecordException("과제 ID는 필수입니다.");
        }
    }
}
