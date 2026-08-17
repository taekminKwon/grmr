package com.ewha_eng.grmr.assignment.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class AssignmentRepositoryImplTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 8, 16);

    @Autowired
    private AssignmentRepository assignmentRepository;

    @Test
    void search_returnsScheduledAssignments_whenStatusIsScheduled() {
        Assignment scheduled = save("예정 과제", TODAY.plusDays(1), TODAY.plusDays(3));
        save("진행중 과제", TODAY, TODAY);
        save("마감 과제", TODAY.minusDays(3), TODAY.minusDays(1));

        Page<Assignment> result = assignmentRepository.search(AssignmentStatus.SCHEDULED, null, TODAY,
            PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(scheduled.getId());
    }

    @Test
    void search_includesStartDateBoundary_asInProgress() {
        Assignment startsToday = save("오늘 시작", TODAY, TODAY.plusDays(2));

        Page<Assignment> result = assignmentRepository.search(AssignmentStatus.IN_PROGRESS, null, TODAY,
            PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(startsToday.getId());
    }

    @Test
    void search_includesDueDateBoundary_asInProgress() {
        Assignment dueToday = save("오늘 마감", TODAY.minusDays(2), TODAY);

        Page<Assignment> result = assignmentRepository.search(AssignmentStatus.IN_PROGRESS, null, TODAY,
            PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(dueToday.getId());
    }

    @Test
    void search_returnsClosedAssignments_whenDueDateIsBeforeToday() {
        Assignment closed = save("마감된 과제", TODAY.minusDays(5), TODAY.minusDays(1));
        save("진행중 과제", TODAY, TODAY);

        Page<Assignment> result = assignmentRepository.search(AssignmentStatus.CLOSED, null, TODAY,
            PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(closed.getId());
    }

    @Test
    void search_filtersByTitleKeyword() {
        Assignment matching = save("현재완료 복습 과제", TODAY, TODAY.plusDays(1));
        save("관계대명사 복습 과제", TODAY, TODAY.plusDays(1));

        Page<Assignment> result = assignmentRepository.search(null, "현재완료", TODAY, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(matching.getId());
    }

    @Test
    void search_treatsPercentInKeyword_asLiteral() {
        Assignment matching = save("정답률 100%할인 과제", TODAY, TODAY.plusDays(1));
        save("정답률 100원 할인 과제", TODAY, TODAY.plusDays(1));

        Page<Assignment> result = assignmentRepository.search(null, "100%", TODAY, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(matching.getId());
    }

    @Test
    void search_returnsAllAssignments_whenNoFilterProvided() {
        save("과제 1", TODAY, TODAY.plusDays(1));
        save("과제 2", TODAY, TODAY.plusDays(1));

        Page<Assignment> result = assignmentRepository.search(null, null, TODAY, PageRequest.of(0, 10));

        assertThat(result.getTotalElements()).isEqualTo(2);
    }

    @Test
    void search_ordersByCreatedAtDescending_andBreaksTiesById() {
        LocalDateTime sameInstant = LocalDateTime.now();
        Assignment older = save("가장 오래된 과제", TODAY, TODAY.plusDays(1), sameInstant.minusDays(1));
        Assignment tieFirst = save("동시각 첫번째 과제", TODAY, TODAY.plusDays(1), sameInstant);
        Assignment tieSecond = save("동시각 두번째 과제", TODAY, TODAY.plusDays(1), sameInstant);
        Assignment newest = save("가장 최근 과제", TODAY, TODAY.plusDays(1), sameInstant.plusDays(1));

        Page<Assignment> result = assignmentRepository.search(null, null, TODAY, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId)
            .containsExactly(newest.getId(), tieSecond.getId(), tieFirst.getId(), older.getId());
    }

    @Test
    void findForStudent_returnsIndividuallyTargetedAssignment() {
        Assignment targeted = saveIndividual(501L, TODAY, TODAY.plusDays(1));
        saveIndividual(999L, TODAY, TODAY.plusDays(1));

        Page<Assignment> result = assignmentRepository.findForStudent(501L, "중1 A반", TODAY, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(targeted.getId());
    }

    @Test
    void findForStudent_returnsClassTargetedAssignment_whenStudentGroupMatches() {
        Assignment targeted = save("현재완료 시제 연습", TODAY, TODAY.plusDays(1));
        saveWithGroup("다른 반 과제", "중2 B반", TODAY, TODAY.plusDays(1));

        Page<Assignment> result = assignmentRepository.findForStudent(501L, "중1 A반", TODAY, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(targeted.getId());
    }

    @Test
    void findForStudent_excludesScheduledAssignments() {
        save("아직 시작 안함", TODAY.plusDays(1), TODAY.plusDays(3));
        Assignment inProgress = save("진행 중", TODAY, TODAY.plusDays(1));

        Page<Assignment> result = assignmentRepository.findForStudent(501L, "중1 A반", TODAY, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(inProgress.getId());
    }

    @Test
    void findForStudent_includesClosedAssignments() {
        Assignment closed = save("마감된 과제", TODAY.minusDays(5), TODAY.minusDays(1));

        Page<Assignment> result = assignmentRepository.findForStudent(501L, "중1 A반", TODAY, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId).containsExactly(closed.getId());
    }

    @Test
    void findForStudent_ignoresClassAssignments_whenStudentHasNoGroup() {
        save("반 과제", TODAY, TODAY.plusDays(1));

        Page<Assignment> result = assignmentRepository.findForStudent(501L, null, TODAY, PageRequest.of(0, 10));

        assertThat(result.getContent()).isEmpty();
    }

    @Test
    void findForStudent_ordersByDueDateAscending() {
        Assignment later = save("나중 마감", TODAY, TODAY.plusDays(5));
        Assignment sooner = save("빠른 마감", TODAY, TODAY.plusDays(1));

        Page<Assignment> result = assignmentRepository.findForStudent(501L, "중1 A반", TODAY, PageRequest.of(0, 10));

        assertThat(result.getContent()).extracting(Assignment::getId)
            .containsExactly(sooner.getId(), later.getId());
    }

    private Assignment saveIndividual(Long targetStudentId, LocalDate startDate, LocalDate dueDate) {
        Assignment assignment = Assignment.builder()
            .title("개별 과제")
            .targetType(AssignmentTargetType.STUDENT)
            .targetStudentId(targetStudentId)
            .startDate(startDate)
            .dueDate(dueDate)
            .questionIds(List.of(1L))
            .build();
        return assignmentRepository.saveAndFlush(assignment);
    }

    private Assignment saveWithGroup(String title, String targetGroup, LocalDate startDate, LocalDate dueDate) {
        Assignment assignment = Assignment.builder()
            .title(title)
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup(targetGroup)
            .startDate(startDate)
            .dueDate(dueDate)
            .questionIds(List.of(1L))
            .build();
        return assignmentRepository.saveAndFlush(assignment);
    }

    @Test
    void search_returnsExactPageSizeAndTotals_atBoundary() {
        for (int i = 0; i < 5; i++) {
            save("과제 " + i, TODAY, TODAY.plusDays(1), LocalDateTime.now().plusSeconds(i));
        }

        Page<Assignment> firstPage = assignmentRepository.search(null, null, TODAY, PageRequest.of(0, 2));
        Page<Assignment> lastPage = assignmentRepository.search(null, null, TODAY, PageRequest.of(2, 2));

        assertThat(firstPage.getContent()).hasSize(2);
        assertThat(firstPage.getTotalElements()).isEqualTo(5);
        assertThat(firstPage.getTotalPages()).isEqualTo(3);

        assertThat(lastPage.getContent()).hasSize(1);
        assertThat(lastPage.isLast()).isTrue();
    }

    private Assignment save(String title, LocalDate startDate, LocalDate dueDate) {
        return save(title, startDate, dueDate, LocalDateTime.now());
    }

    private Assignment save(String title, LocalDate startDate, LocalDate dueDate, LocalDateTime createdAt) {
        Assignment assignment = Assignment.builder()
            .title(title)
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(startDate)
            .dueDate(dueDate)
            .questionIds(List.of(1L))
            .build();
        ReflectionTestUtils.setField(assignment, "createdAt", createdAt);
        return assignmentRepository.saveAndFlush(assignment);
    }
}
