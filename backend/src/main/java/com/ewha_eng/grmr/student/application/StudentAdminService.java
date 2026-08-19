package com.ewha_eng.grmr.student.application;

import com.ewha_eng.grmr.assignment.domain.StudentNotFoundException;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.student.domain.InvalidStudentSearchException;
import com.ewha_eng.grmr.student.domain.StudentAggregate;
import com.ewha_eng.grmr.student.domain.StudentReader;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StudentAdminService {

    private static final int MIN_PAGE_SIZE = 1;
    private static final int MAX_PAGE_SIZE = 100;

    private final StudentReader studentReader;
    private final MemberReader memberReader;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Page<StudentSummary> search(String keyword, String group, int page, int size) {
        validatePageAndSize(page, size);

        LocalDate today = LocalDate.now(clock);
        Pageable pageable = PageRequest.of(page, size);
        Page<Member> students = studentReader.search(keyword, group, pageable);
        Map<Long, StudentAggregate> aggregates = studentReader.aggregatesFor(students.getContent(), today);

        return students.map(student -> toSummary(student, aggregates.get(student.getId())));
    }

    @Transactional(readOnly = true)
    public StudentSummary getDetail(Long id) {
        Member student = memberReader.findById(id)
            .filter(Member::isStudent)
            .orElseThrow(() -> new StudentNotFoundException("학생을 찾을 수 없습니다."));

        LocalDate today = LocalDate.now(clock);
        Map<Long, StudentAggregate> aggregates = studentReader.aggregatesFor(List.of(student), today);

        return toSummary(student, aggregates.get(student.getId()));
    }

    private StudentSummary toSummary(Member student, StudentAggregate aggregate) {
        StudentAggregate resolved = aggregate != null ? aggregate : StudentAggregate.empty();
        return new StudentSummary(
            student.getId(),
            student.getName(),
            student.getStudentGroup(),
            resolved.lastStudiedAt(),
            resolved.totalQuestionCount(),
            resolved.accuracy(),
            resolved.pendingAssignmentCount()
        );
    }

    private void validatePageAndSize(int page, int size) {
        if (page < 0) {
            throw new InvalidStudentSearchException("페이지 번호는 0 이상이어야 합니다: " + page);
        }
        if (size < MIN_PAGE_SIZE || size > MAX_PAGE_SIZE) {
            throw new InvalidStudentSearchException(
                "페이지 크기는 " + MIN_PAGE_SIZE + " 이상 " + MAX_PAGE_SIZE + " 이하이어야 합니다: " + size);
        }
    }
}
