package com.ewha_eng.grmr.studentassignment.application;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentNotFoundException;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentSearchException;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberNotFoundException;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentClosedException;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmission;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepository;
import com.ewha_eng.grmr.studentassignment.domain.QuestionNotInAssignmentException;
import com.ewha_eng.grmr.studentassignment.domain.StudentAssignmentProgressStatus;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class StudentAssignmentService {

    private static final int MIN_PAGE_SIZE = 1;
    private static final int MAX_PAGE_SIZE = 100;

    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository submissionRepository;
    private final AssignmentSubmissionStarter submissionStarter;
    private final QuestionRepository questionRepository;
    private final MemberReader memberReader;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Page<StudentAssignmentListItem> getMyAssignments(Long studentId, int page, int size) {
        validatePageAndSize(page, size);
        Member student = requireMember(studentId);
        LocalDate today = LocalDate.now(clock);
        Pageable pageable = PageRequest.of(page, size);

        Page<Assignment> assignments = assignmentRepository.findForStudent(
            studentId, student.getStudentGroup(), today, pageable);

        List<Long> assignmentIds = assignments.getContent().stream().map(Assignment::getId).toList();
        Map<Long, AssignmentSubmission> submissionsByAssignmentId = submissionRepository
            .findAllWithDraftsByStudentIdAndAssignmentIdIn(studentId, assignmentIds).stream()
            .collect(Collectors.toMap(AssignmentSubmission::getAssignmentId, Function.identity()));

        return assignments.map(
            assignment -> toListItem(assignment, today, submissionsByAssignmentId.get(assignment.getId())));
    }

    @Transactional
    public StudentAssignmentQuestions getQuestions(Long assignmentId, Long studentId) {
        Member student = requireMember(studentId);
        Assignment assignment = requireAccessibleAssignment(assignmentId, studentId, student.getStudentGroup());

        AssignmentSubmission submission = openSubmission(assignmentId, studentId);

        return new StudentAssignmentQuestions(assignmentId, submission.getStatus(),
            orderedQuestions(assignment, submission));
    }

    @Transactional
    public AssignmentAnswerDraftResult saveAnswerDraft(Long assignmentId, Long questionId, String answer,
        Long studentId) {
        Member student = requireMember(studentId);
        Assignment assignment = requireAccessibleAssignment(assignmentId, studentId, student.getStudentGroup());
        if (!assignment.getQuestionIds().contains(questionId)) {
            throw new QuestionNotInAssignmentException("과제에 포함되지 않은 문제입니다.");
        }
        if (assignment.status(LocalDate.now(clock)) == AssignmentStatus.CLOSED) {
            throw new AssignmentClosedException("마감된 과제에는 답안을 저장할 수 없습니다.");
        }

        AssignmentSubmission submission = openSubmission(assignmentId, studentId);
        LocalDateTime now = LocalDateTime.now(clock);
        submission.upsertDraft(questionId, answer, now);
        submissionRepository.save(submission);

        return new AssignmentAnswerDraftResult(questionId, submission.answerFor(questionId).orElseThrow(), now);
    }

    private Assignment requireAccessibleAssignment(Long assignmentId, Long studentId, String studentGroup) {
        return assignmentRepository.findById(assignmentId)
            .filter(candidate -> isTargeted(candidate, studentId, studentGroup))
            .filter(candidate -> candidate.status(LocalDate.now(clock)) != AssignmentStatus.SCHEDULED)
            .orElseThrow(() -> new AssignmentNotFoundException("과제를 찾을 수 없습니다."));
    }

    private AssignmentSubmission openSubmission(Long assignmentId, Long studentId) {
        return submissionRepository.findWithDraftsByAssignmentIdAndStudentId(assignmentId, studentId)
            .orElseGet(() -> createOrFetch(assignmentId, studentId));
    }

    private AssignmentSubmission createOrFetch(Long assignmentId, Long studentId) {
        try {
            return submissionStarter.startNew(assignmentId, studentId);
        } catch (DataIntegrityViolationException e) {
            return submissionRepository.findWithDraftsByAssignmentIdAndStudentId(assignmentId, studentId)
                .orElseThrow(() -> e);
        }
    }

    private boolean isTargeted(Assignment assignment, Long studentId, String studentGroup) {
        if (assignment.getTargetType() == AssignmentTargetType.STUDENT) {
            return assignment.getTargetStudentId().equals(studentId);
        }
        return studentGroup != null && studentGroup.equals(assignment.getTargetGroup());
    }

    private Member requireMember(Long studentId) {
        return memberReader.findById(studentId)
            .orElseThrow(() -> new MemberNotFoundException("학생을 찾을 수 없습니다."));
    }

    private List<StudentAssignmentQuestion> orderedQuestions(Assignment assignment, AssignmentSubmission submission) {
        Map<Long, Question> questionsById = questionRepository.findAllById(assignment.getQuestionIds()).stream()
            .collect(Collectors.toMap(Question::getId, Function.identity()));

        List<Long> questionIds = assignment.getQuestionIds();
        return IntStream.range(0, questionIds.size())
            .mapToObj(index -> {
                Long questionId = questionIds.get(index);
                Question question = questionsById.get(questionId);
                return new StudentAssignmentQuestion(
                    questionId,
                    index + 1,
                    question != null ? question.getCategory() : null,
                    question != null ? question.getLevel() : null,
                    question != null ? question.getText() : null,
                    question != null ? question.getChoices() : List.of(),
                    submission.answerFor(questionId).orElse(null)
                );
            })
            .toList();
    }

    private StudentAssignmentListItem toListItem(Assignment assignment, LocalDate today,
        AssignmentSubmission submission) {
        int questionCount = assignment.getQuestionIds().size();
        return new StudentAssignmentListItem(
            assignment.getId(),
            assignment.getTitle(),
            assignment.getStartDate(),
            assignment.getDueDate(),
            assignment.status(today),
            submissionStatus(submission),
            progress(submission, questionCount)
        );
    }

    private StudentAssignmentProgressStatus submissionStatus(AssignmentSubmission submission) {
        if (submission == null) {
            return StudentAssignmentProgressStatus.NOT_STARTED;
        }
        return submission.isSubmitted()
            ? StudentAssignmentProgressStatus.SUBMITTED
            : StudentAssignmentProgressStatus.IN_PROGRESS;
    }

    private int progress(AssignmentSubmission submission, int questionCount) {
        if (submission == null || questionCount == 0) {
            return 0;
        }
        return (int) Math.round(submission.answeredQuestionCount() * 100.0 / questionCount);
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
