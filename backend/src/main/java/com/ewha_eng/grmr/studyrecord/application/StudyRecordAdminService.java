package com.ewha_eng.grmr.studyrecord.application;

import com.ewha_eng.grmr.assignment.domain.StudentNotFoundException;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.studyrecord.domain.InvalidStudyRecordSearchException;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordReader;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordRollup;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordType;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class StudyRecordAdminService {

    private static final int DEFAULT_PERIOD_DAYS = 30;
    private static final int MIN_PAGE_SIZE = 1;
    private static final int MAX_PAGE_SIZE = 100;

    private final MemberReader memberReader;
    private final StudyRecordReader studyRecordReader;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Page<StudyRecordRollup> search(Long studentId, String period, String type, int page, int size) {
        validatePageAndSize(page, size);
        int periodDays = resolvePeriodDays(period);
        StudyRecordType parsedType = resolveType(type);
        if (studentId != null) {
            validateStudentExists(studentId);
        }

        LocalDate today = LocalDate.now(clock);
        LocalDateTime periodStartInclusive = today.minusDays(periodDays - 1L).atStartOfDay();
        LocalDateTime periodEndExclusive = today.plusDays(1).atStartOfDay();

        Pageable pageable = PageRequest.of(page, size);
        return studyRecordReader.searchRollups(studentId, periodStartInclusive, periodEndExclusive, parsedType,
            pageable);
    }

    private int resolvePeriodDays(String period) {
        if (!StringUtils.hasText(period)) {
            return DEFAULT_PERIOD_DAYS;
        }
        return switch (period) {
            case "7d" -> 7;
            case "30d" -> 30;
            default -> throw new InvalidStudyRecordSearchException("period는 7d 또는 30d만 가능합니다: " + period);
        };
    }

    private StudyRecordType resolveType(String type) {
        if (!StringUtils.hasText(type)) {
            return null;
        }
        try {
            return StudyRecordType.valueOf(type);
        } catch (IllegalArgumentException e) {
            throw new InvalidStudyRecordSearchException("type은 ASSIGNMENT 또는 PRACTICE만 가능합니다: " + type);
        }
    }

    private void validatePageAndSize(int page, int size) {
        if (page < 0) {
            throw new InvalidStudyRecordSearchException("페이지 번호는 0 이상이어야 합니다: " + page);
        }
        if (size < MIN_PAGE_SIZE || size > MAX_PAGE_SIZE) {
            throw new InvalidStudyRecordSearchException(
                "페이지 크기는 " + MIN_PAGE_SIZE + " 이상 " + MAX_PAGE_SIZE + " 이하이어야 합니다: " + size);
        }
    }

    private void validateStudentExists(Long studentId) {
        Member member = memberReader.findById(studentId)
            .orElseThrow(() -> new StudentNotFoundException("학생을 찾을 수 없습니다."));
        if (!member.isStudent()) {
            throw new StudentNotFoundException("학생을 찾을 수 없습니다.");
        }
    }
}
