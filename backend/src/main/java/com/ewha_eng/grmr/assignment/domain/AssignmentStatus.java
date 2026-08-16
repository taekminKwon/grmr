package com.ewha_eng.grmr.assignment.domain;

import org.springframework.util.StringUtils;

public enum AssignmentStatus {
    SCHEDULED,
    IN_PROGRESS,
    CLOSED;

    public static AssignmentStatus fromLabel(String label) {
        if (!StringUtils.hasText(label)) {
            return null;
        }
        return switch (label) {
            case "예정" -> SCHEDULED;
            case "진행 중" -> IN_PROGRESS;
            case "마감" -> CLOSED;
            default -> throw new InvalidAssignmentSearchException("알 수 없는 상태입니다: " + label);
        };
    }
}
