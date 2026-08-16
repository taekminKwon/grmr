package com.ewha_eng.grmr.assignment.domain;

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
import jakarta.persistence.OrderColumn;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Assignment {

    private static final int TITLE_MAX_LENGTH = 200;
    private static final int TARGET_GROUP_MAX_LENGTH = 100;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = TITLE_MAX_LENGTH)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AssignmentTargetType targetType;

    @Column(length = TARGET_GROUP_MAX_LENGTH)
    private String targetGroup;

    private Long targetStudentId;

    @Column(nullable = false)
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate dueDate;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "assignment_question", joinColumns = @JoinColumn(name = "assignment_id"))
    @OrderColumn(name = "question_order")
    @Column(name = "question_id", nullable = false)
    private List<Long> questionIds = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Builder
    private Assignment(String title, AssignmentTargetType targetType, String targetGroup, Long targetStudentId,
        LocalDate startDate, LocalDate dueDate, List<Long> questionIds) {
        String normalizedGroup = normalizeTargetGroup(targetType, targetGroup);
        Long normalizedStudentId = normalizeTargetStudentId(targetType, targetStudentId);
        validate(title, targetType, normalizedGroup, normalizedStudentId, startDate, dueDate, questionIds);
        this.title = title;
        this.targetType = targetType;
        this.targetGroup = normalizedGroup;
        this.targetStudentId = normalizedStudentId;
        this.startDate = startDate;
        this.dueDate = dueDate;
        this.questionIds = new ArrayList<>(questionIds);
        this.createdAt = LocalDateTime.now();
    }

    public void update(String title, AssignmentTargetType targetType, String targetGroup, Long targetStudentId,
        LocalDate startDate, LocalDate dueDate, List<Long> questionIds, LocalDate today) {
        if (status(today) == AssignmentStatus.CLOSED) {
            throw new AssignmentAlreadyClosedException("마감된 과제는 수정할 수 없습니다.");
        }

        String newTitle = title != null ? title : this.title;
        AssignmentTargetType newTargetType = targetType != null ? targetType : this.targetType;
        boolean targetTypeChanged = newTargetType != this.targetType;
        String newTargetGroup = targetGroup != null ? targetGroup
            : (!targetTypeChanged ? this.targetGroup : null);
        Long newTargetStudentId = targetStudentId != null ? targetStudentId
            : (!targetTypeChanged ? this.targetStudentId : null);
        newTargetGroup = normalizeTargetGroup(newTargetType, newTargetGroup);
        newTargetStudentId = normalizeTargetStudentId(newTargetType, newTargetStudentId);
        LocalDate newStartDate = startDate != null ? startDate : this.startDate;
        LocalDate newDueDate = dueDate != null ? dueDate : this.dueDate;
        List<Long> newQuestionIds = questionIds != null ? questionIds : this.questionIds;

        validate(newTitle, newTargetType, newTargetGroup, newTargetStudentId, newStartDate, newDueDate,
            newQuestionIds);

        this.title = newTitle;
        this.targetType = newTargetType;
        this.targetGroup = newTargetGroup;
        this.targetStudentId = newTargetStudentId;
        this.startDate = newStartDate;
        this.dueDate = newDueDate;
        this.questionIds = new ArrayList<>(newQuestionIds);
    }

    public AssignmentStatus status(LocalDate today) {
        if (today.isBefore(startDate)) {
            return AssignmentStatus.SCHEDULED;
        }
        if (today.isAfter(dueDate)) {
            return AssignmentStatus.CLOSED;
        }
        return AssignmentStatus.IN_PROGRESS;
    }

    private static String normalizeTargetGroup(AssignmentTargetType targetType, String targetGroup) {
        return targetType == AssignmentTargetType.CLASS ? targetGroup : null;
    }

    private static Long normalizeTargetStudentId(AssignmentTargetType targetType, Long targetStudentId) {
        return targetType == AssignmentTargetType.STUDENT ? targetStudentId : null;
    }

    private static void validate(String title, AssignmentTargetType targetType, String targetGroup,
        Long targetStudentId, LocalDate startDate, LocalDate dueDate, List<Long> questionIds) {
        if (title == null || title.isBlank()) {
            throw new InvalidAssignmentException("과제명은 필수입니다.");
        }
        if (title.length() > TITLE_MAX_LENGTH) {
            throw new InvalidAssignmentException("과제명은 " + TITLE_MAX_LENGTH + "자를 초과할 수 없습니다.");
        }
        if (targetType == null) {
            throw new InvalidAssignmentException("대상 유형은 필수입니다.");
        }
        if (targetType == AssignmentTargetType.CLASS) {
            if (targetGroup == null || targetGroup.isBlank()) {
                throw new InvalidAssignmentException("targetType이 CLASS이면 targetGroup이 필수입니다.");
            }
            if (targetGroup.length() > TARGET_GROUP_MAX_LENGTH) {
                throw new InvalidAssignmentException("대상 그룹명은 " + TARGET_GROUP_MAX_LENGTH + "자를 초과할 수 없습니다.");
            }
        }
        if (targetType == AssignmentTargetType.STUDENT && targetStudentId == null) {
            throw new InvalidAssignmentException("targetType이 STUDENT이면 targetStudentId가 필수입니다.");
        }
        if (startDate == null || dueDate == null) {
            throw new InvalidAssignmentException("시작일과 마감일은 필수입니다.");
        }
        if (startDate.isAfter(dueDate)) {
            throw new InvalidAssignmentException("시작일은 마감일보다 늦을 수 없습니다.");
        }
        if (questionIds == null || questionIds.isEmpty()) {
            throw new InvalidAssignmentException("문제를 1개 이상 선택해야 합니다.");
        }
        if (new HashSet<>(questionIds).size() != questionIds.size()) {
            throw new InvalidAssignmentException("문제 목록에 중복된 문제가 있습니다.");
        }
    }
}
