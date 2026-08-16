package com.ewha_eng.grmr.assignment.application;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentAlreadyClosedException;
import com.ewha_eng.grmr.assignment.domain.AssignmentNotFoundException;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentSearchException;
import com.ewha_eng.grmr.assignment.domain.StudentNotFoundException;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberNotFoundException;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AssignmentAdminService {

    private static final int MIN_PAGE_SIZE = 1;
    private static final int MAX_PAGE_SIZE = 100;

    private final AssignmentRepository assignmentRepository;
    private final QuestionRepository questionRepository;
    private final MemberReader memberReader;
    private final AssignmentSubmissionProgressPort submissionProgressPort;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Page<AssignmentListItem> search(AssignmentStatus status, String keyword, int page, int size) {
        validatePageAndSize(page, size);

        LocalDate today = LocalDate.now(clock);
        Pageable pageable = PageRequest.of(page, size);
        Page<Assignment> assignments = assignmentRepository.search(status, keyword, today, pageable);

        return assignments.map(assignment -> toListItem(assignment, today));
    }

    @Transactional(readOnly = true)
    public AssignmentDetail getDetail(Long id) {
        Assignment assignment = assignmentRepository.findById(id)
            .orElseThrow(() -> new AssignmentNotFoundException("과제를 찾을 수 없습니다."));
        LocalDate today = LocalDate.now(clock);

        return toDetail(assignment, today);
    }

    @Transactional
    public AssignmentListItem create(String title, AssignmentTargetType targetType, String targetGroup,
        Long targetStudentId, LocalDate startDate, LocalDate dueDate, List<Long> questionIds) {
        Assignment assignment = Assignment.builder()
            .title(title)
            .targetType(targetType)
            .targetGroup(targetGroup)
            .targetStudentId(targetStudentId)
            .startDate(startDate)
            .dueDate(dueDate)
            .questionIds(questionIds)
            .build();

        validateQuestionsExist(assignment.getQuestionIds());
        if (assignment.getTargetType() == AssignmentTargetType.STUDENT) {
            validateTargetStudentExists(assignment.getTargetStudentId());
        }

        Assignment saved = assignmentRepository.save(assignment);
        return toListItem(saved, LocalDate.now(clock));
    }

    @Transactional
    public AssignmentDetail update(Long id, AssignmentTargetType targetType, String targetGroup,
        Long targetStudentId, LocalDate startDate, LocalDate dueDate, List<Long> questionIds) {
        Assignment assignment = assignmentRepository.findById(id)
            .orElseThrow(() -> new AssignmentNotFoundException("과제를 찾을 수 없습니다."));
        LocalDate today = LocalDate.now(clock);

        if (assignment.status(today) == AssignmentStatus.CLOSED) {
            throw new AssignmentAlreadyClosedException("마감된 과제는 수정할 수 없습니다.");
        }
        if (questionIds != null) {
            validateQuestionsExist(questionIds);
        }
        if (targetStudentId != null) {
            validateTargetStudentExists(targetStudentId);
        }

        assignment.update(null, targetType, targetGroup, targetStudentId, startDate, dueDate, questionIds, today);

        return toDetail(assignment, today);
    }

    @Transactional
    public void delete(Long id) {
        Assignment assignment = assignmentRepository.findById(id)
            .orElseThrow(() -> new AssignmentNotFoundException("과제를 찾을 수 없습니다."));

        assignmentRepository.delete(assignment);
    }

    private void validateQuestionsExist(List<Long> questionIds) {
        Set<Long> distinctIds = new HashSet<>(questionIds);
        List<Question> found = questionRepository.findAllById(distinctIds);
        if (found.size() != distinctIds.size()) {
            throw new QuestionNotFoundException("문제를 찾을 수 없습니다.");
        }
    }

    private void validateTargetStudentExists(Long targetStudentId) {
        Member member = memberReader.findById(targetStudentId)
            .orElseThrow(() -> new StudentNotFoundException("학생을 찾을 수 없습니다."));
        if (!member.isStudent()) {
            throw new StudentNotFoundException("학생을 찾을 수 없습니다.");
        }
    }

    private AssignmentDetail toDetail(Assignment assignment, LocalDate today) {
        return new AssignmentDetail(
            assignment.getId(),
            assignment.getTitle(),
            assignment.getTargetType(),
            assignment.getTargetGroup(),
            assignment.getTargetStudentId(),
            resolveTargetDisplay(assignment),
            assignment.status(today),
            assignment.getStartDate(),
            assignment.getDueDate(),
            orderedQuestionSummaries(assignment),
            submissionProgressPort.progressFor(assignment.getId())
        );
    }

    private AssignmentListItem toListItem(Assignment assignment, LocalDate today) {
        return new AssignmentListItem(
            assignment.getId(),
            assignment.getTitle(),
            assignment.getTargetType(),
            assignment.getTargetGroup(),
            assignment.getTargetStudentId(),
            resolveTargetDisplay(assignment),
            assignment.status(today),
            assignment.getStartDate(),
            assignment.getDueDate(),
            assignment.getQuestionIds().size(),
            submissionProgressPort.progressFor(assignment.getId())
        );
    }

    private String resolveTargetDisplay(Assignment assignment) {
        if (assignment.getTargetType() == AssignmentTargetType.CLASS) {
            return assignment.getTargetGroup();
        }
        return memberReader.findById(assignment.getTargetStudentId())
            .orElseThrow(() -> new MemberNotFoundException("대상 학생을 찾을 수 없습니다."))
            .getName();
    }

    private List<AssignmentQuestionSummary> orderedQuestionSummaries(Assignment assignment) {
        Map<Long, Question> questionsById = questionRepository.findAllById(assignment.getQuestionIds()).stream()
            .collect(Collectors.toMap(Question::getId, Function.identity()));

        List<Long> questionIds = assignment.getQuestionIds();
        return IntStream.range(0, questionIds.size())
            .mapToObj(index -> {
                Long questionId = questionIds.get(index);
                Question question = questionsById.get(questionId);
                return new AssignmentQuestionSummary(
                    index + 1,
                    questionId,
                    question != null ? question.getCategory() : null,
                    question != null ? question.getText() : null
                );
            })
            .toList();
    }

    private void validatePageAndSize(int page, int size) {
        if (page < 0) {
            throw new InvalidAssignmentSearchException("페이지 번호는 0 이상이어야 합니다: " + page);
        }
        if (size < MIN_PAGE_SIZE || size > MAX_PAGE_SIZE) {
            throw new InvalidAssignmentSearchException(
                "페이지 크기는 " + MIN_PAGE_SIZE + " 이상 " + MAX_PAGE_SIZE + " 이하이어야 합니다: " + size);
        }
    }
}
