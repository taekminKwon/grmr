package com.ewha_eng.grmr.studentassignment.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ewha_eng.grmr.assignment.domain.AssignmentNotFoundException;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentSearchException;
import com.ewha_eng.grmr.auth.infrastructure.JwtAuthenticationFilter;
import com.ewha_eng.grmr.auth.infrastructure.JwtTokenProvider;
import com.ewha_eng.grmr.global.exception.GlobalExceptionHandler;
import com.ewha_eng.grmr.global.security.JsonAccessDeniedHandler;
import com.ewha_eng.grmr.global.security.JsonAuthenticationEntryPoint;
import com.ewha_eng.grmr.global.security.SecurityConfig;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentListItem;
import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentQuestion;
import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentQuestions;
import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentService;
import com.ewha_eng.grmr.studentassignment.domain.StudentAssignmentProgressStatus;
import com.ewha_eng.grmr.studentassignment.domain.SubmissionStatus;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(StudentAssignmentController.class)
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JsonAuthenticationEntryPoint.class,
    JsonAccessDeniedHandler.class,
    GlobalExceptionHandler.class
})
class StudentAssignmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StudentAssignmentService studentAssignmentService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    private StudentAssignmentListItem listItem() {
        return new StudentAssignmentListItem(
            10L,
            "현재완료 시제 연습",
            LocalDate.of(2026, 8, 3),
            LocalDate.of(2026, 8, 20),
            AssignmentStatus.IN_PROGRESS,
            StudentAssignmentProgressStatus.IN_PROGRESS,
            50
        );
    }

    @Test
    void myAssignments_returns200_withDefaultPaging() throws Exception {
        authenticateAsStudent();
        when(studentAssignmentService.getMyAssignments(2L, 0, 20))
            .thenReturn(new PageImpl<>(List.of(listItem()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/me/assignments")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(10))
            .andExpect(jsonPath("$.content[0].title").value("현재완료 시제 연습"))
            .andExpect(jsonPath("$.content[0].startDate").value("2026-08-03"))
            .andExpect(jsonPath("$.content[0].dueDate").value("2026-08-20"))
            .andExpect(jsonPath("$.content[0].status").value("진행 중"))
            .andExpect(jsonPath("$.content[0].submissionStatus").value("IN_PROGRESS"))
            .andExpect(jsonPath("$.content[0].progress").value(50))
            .andExpect(jsonPath("$.content[0].progressStatus").doesNotExist())
            .andExpect(jsonPath("$.content[0].answeredQuestionCount").doesNotExist())
            .andExpect(jsonPath("$.content[0].questionCount").doesNotExist())
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(20))
            .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void myAssignments_returns200_withCustomPaging() throws Exception {
        authenticateAsStudent();
        when(studentAssignmentService.getMyAssignments(2L, 1, 5))
            .thenReturn(new PageImpl<>(List.of(), PageRequest.of(1, 5), 0));

        mockMvc.perform(get("/api/me/assignments")
                .header("Authorization", "Bearer access-token")
                .param("page", "1")
                .param("size", "5"))
            .andExpect(status().isOk());

        verify(studentAssignmentService).getMyAssignments(2L, 1, 5);
    }

    @Test
    void myAssignments_returns400_withInvalidRequestCode_whenPageIsNegative() throws Exception {
        authenticateAsStudent();
        when(studentAssignmentService.getMyAssignments(2L, -1, 20))
            .thenThrow(new InvalidAssignmentSearchException("페이지 번호는 0 이상이어야 합니다: -1"));

        mockMvc.perform(get("/api/me/assignments")
                .header("Authorization", "Bearer access-token")
                .param("page", "-1"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void myAssignments_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/me/assignments"))
            .andExpect(status().isUnauthorized());

        verify(studentAssignmentService, never()).getMyAssignments(any(), any(Integer.class), any(Integer.class));
    }

    @Test
    void myAssignments_returns403_whenAccessTokenIsAdminRole() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/me/assignments")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(studentAssignmentService, never()).getMyAssignments(any(), any(Integer.class), any(Integer.class));
    }

    @Test
    void questions_returns200_withWrapperAndMyAnswer_andWithoutGradingFields() throws Exception {
        authenticateAsStudent();
        StudentAssignmentQuestion question = new StudentAssignmentQuestion(
            1024L, 1, "현재완료", QuestionLevel.INTERMEDIATE, "He has lived here _____ 2010.",
            List.of("since", "for", "during", "from"), "since");
        when(studentAssignmentService.getQuestions(10L, 2L))
            .thenReturn(new StudentAssignmentQuestions(10L, SubmissionStatus.IN_PROGRESS, List.of(question)));

        mockMvc.perform(get("/api/me/assignments/10/questions")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assignmentId").value(10))
            .andExpect(jsonPath("$.submissionStatus").value("IN_PROGRESS"))
            .andExpect(jsonPath("$.questions[0].id").value(1024))
            .andExpect(jsonPath("$.questions[0].order").value(1))
            .andExpect(jsonPath("$.questions[0].category").value("현재완료"))
            .andExpect(jsonPath("$.questions[0].level").value("보통"))
            .andExpect(jsonPath("$.questions[0].text").value("He has lived here _____ 2010."))
            .andExpect(jsonPath("$.questions[0].choices[0]").value("since"))
            .andExpect(jsonPath("$.questions[0].myAnswer").value("since"))
            .andExpect(jsonPath("$.questions[0].answer").doesNotExist())
            .andExpect(jsonPath("$.questions[0].correct").doesNotExist())
            .andExpect(jsonPath("$.questions[0].score").doesNotExist())
            .andExpect(jsonPath("$.questions[0].explanation").doesNotExist());
    }

    @Test
    void questions_returns200_withNullMyAnswer_whenNotYetAnswered() throws Exception {
        authenticateAsStudent();
        StudentAssignmentQuestion question = new StudentAssignmentQuestion(
            1024L, 1, "현재완료", QuestionLevel.INTERMEDIATE, "He has lived here _____ 2010.",
            List.of("since", "for", "during", "from"), null);
        when(studentAssignmentService.getQuestions(10L, 2L))
            .thenReturn(new StudentAssignmentQuestions(10L, SubmissionStatus.IN_PROGRESS, List.of(question)));

        mockMvc.perform(get("/api/me/assignments/10/questions")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.questions[0].myAnswer").doesNotExist());
    }

    @Test
    void questions_returns200_withSubmittedStatus_whenReviewingASubmittedAssignment() throws Exception {
        authenticateAsStudent();
        StudentAssignmentQuestion question = new StudentAssignmentQuestion(
            1024L, 1, "현재완료", QuestionLevel.INTERMEDIATE, "He has lived here _____ 2010.",
            List.of("since", "for", "during", "from"), "since");
        when(studentAssignmentService.getQuestions(10L, 2L))
            .thenReturn(new StudentAssignmentQuestions(10L, SubmissionStatus.SUBMITTED, List.of(question)));

        mockMvc.perform(get("/api/me/assignments/10/questions")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assignmentId").value(10))
            .andExpect(jsonPath("$.submissionStatus").value("SUBMITTED"));
    }

    @Test
    void questions_returns404_withAssignmentNotFoundCode_whenNotTargeted() throws Exception {
        authenticateAsStudent();
        when(studentAssignmentService.getQuestions(999L, 2L))
            .thenThrow(new AssignmentNotFoundException("과제를 찾을 수 없습니다."));

        mockMvc.perform(get("/api/me/assignments/999/questions")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("ASSIGNMENT_NOT_FOUND"));
    }

    @Test
    void questions_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/me/assignments/10/questions"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void questions_returns403_whenAccessTokenIsAdminRole() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/me/assignments/10/questions")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(studentAssignmentService, never()).getQuestions(any(), any());
    }

    private void authenticateAsStudent() {
        when(jwtTokenProvider.isValid("access-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("access-token")).thenReturn(2L);
        when(jwtTokenProvider.getMemberType("access-token")).thenReturn(MemberType.STUDENT);
    }

    private void authenticateAsAdmin() {
        when(jwtTokenProvider.isValid("access-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("access-token")).thenReturn(1L);
        when(jwtTokenProvider.getMemberType("access-token")).thenReturn(MemberType.ADMIN);
    }
}
