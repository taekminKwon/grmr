package com.ewha_eng.grmr.assignment.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ewha_eng.grmr.assignment.application.AssignmentAdminService;
import com.ewha_eng.grmr.assignment.application.AssignmentDetail;
import com.ewha_eng.grmr.assignment.application.AssignmentListItem;
import com.ewha_eng.grmr.assignment.application.AssignmentQuestionSummary;
import com.ewha_eng.grmr.assignment.application.AssignmentSubmissionProgress;
import com.ewha_eng.grmr.assignment.domain.AssignmentAlreadyClosedException;
import com.ewha_eng.grmr.assignment.domain.AssignmentNotFoundException;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentException;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentSearchException;
import com.ewha_eng.grmr.assignment.domain.StudentNotFoundException;
import com.ewha_eng.grmr.auth.infrastructure.JwtAuthenticationFilter;
import com.ewha_eng.grmr.auth.infrastructure.JwtTokenProvider;
import com.ewha_eng.grmr.global.exception.GlobalExceptionHandler;
import com.ewha_eng.grmr.global.security.JsonAccessDeniedHandler;
import com.ewha_eng.grmr.global.security.JsonAuthenticationEntryPoint;
import com.ewha_eng.grmr.global.security.SecurityConfig;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(AssignmentController.class)
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JsonAuthenticationEntryPoint.class,
    JsonAccessDeniedHandler.class,
    GlobalExceptionHandler.class
})
class AssignmentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AssignmentAdminService assignmentAdminService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    private AssignmentListItem classListItem() {
        return new AssignmentListItem(
            1L,
            "현재완료 시제 연습",
            AssignmentTargetType.CLASS,
            "중1 A반",
            null,
            "중1 A반",
            AssignmentStatus.IN_PROGRESS,
            LocalDate.of(2026, 8, 3),
            LocalDate.of(2026, 8, 5),
            1,
            new AssignmentSubmissionProgress(25, 21)
        );
    }

    private AssignmentListItem studentListItem() {
        return new AssignmentListItem(
            2L,
            "개별 보충 과제",
            AssignmentTargetType.STUDENT,
            null,
            501L,
            "김민수",
            AssignmentStatus.SCHEDULED,
            LocalDate.of(2026, 9, 1),
            LocalDate.of(2026, 9, 3),
            1,
            AssignmentSubmissionProgress.zero()
        );
    }

    @Test
    void search_returns200_withDefaultPaging_whenNoFiltersProvided() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.search(isNull(), isNull(), eq(0), eq(20)))
            .thenReturn(new PageImpl<>(List.of(classListItem()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/assignments")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(1))
            .andExpect(jsonPath("$.content[0].title").value("현재완료 시제 연습"))
            .andExpect(jsonPath("$.content[0].targetType").value("CLASS"))
            .andExpect(jsonPath("$.content[0].targetGroup").value("중1 A반"))
            .andExpect(jsonPath("$.content[0].targetStudentId").doesNotExist())
            .andExpect(jsonPath("$.content[0].target").value("중1 A반"))
            .andExpect(jsonPath("$.content[0].startDate").value("2026-08-03"))
            .andExpect(jsonPath("$.content[0].dueDate").value("2026-08-05"))
            .andExpect(jsonPath("$.content[0].progress").value(84))
            .andExpect(jsonPath("$.content[0].status").value("진행 중"))
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(20))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void search_returns200_withStudentTarget_omittingTargetGroup() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.search(isNull(), isNull(), eq(0), eq(20)))
            .thenReturn(new PageImpl<>(List.of(studentListItem()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/assignments")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].targetType").value("STUDENT"))
            .andExpect(jsonPath("$.content[0].targetGroup").doesNotExist())
            .andExpect(jsonPath("$.content[0].targetStudentId").value(501))
            .andExpect(jsonPath("$.content[0].target").value("김민수"))
            .andExpect(jsonPath("$.content[0].status").value("예정"))
            .andExpect(jsonPath("$.content[0].progress").value(0));
    }

    @Test
    void search_returns200_withConvertedFilters_whenAllFiltersAreValid() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.search(eq(AssignmentStatus.IN_PROGRESS), eq("복습"), eq(2), eq(10)))
            .thenReturn(new PageImpl<>(List.of(classListItem()), PageRequest.of(2, 10), 1));

        mockMvc.perform(get("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .param("status", "진행 중")
                .param("keyword", "복습")
                .param("page", "2")
                .param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(1));

        verify(assignmentAdminService).search(AssignmentStatus.IN_PROGRESS, "복습", 2, 10);
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenStatusLabelIsUnknown() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .param("status", "알 수 없음"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(assignmentAdminService, never()).search(any(), any(), any(Integer.class), any(Integer.class));
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenPageIsNegative() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.search(isNull(), isNull(), eq(-1), eq(20)))
            .thenThrow(new InvalidAssignmentSearchException("페이지 번호는 0 이상이어야 합니다: -1"));

        mockMvc.perform(get("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .param("page", "-1"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenSizeExceedsMaximum() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.search(isNull(), isNull(), eq(0), eq(101)))
            .thenThrow(new InvalidAssignmentSearchException("페이지 크기는 1 이상 100 이하이어야 합니다: 101"));

        mockMvc.perform(get("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .param("size", "101"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenPageIsNonNumeric() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .param("page", "abc"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(assignmentAdminService, never()).search(any(), any(), any(Integer.class), any(Integer.class));
    }

    @Test
    void search_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/assignments"))
            .andExpect(status().isUnauthorized());

        verify(assignmentAdminService, never()).search(any(), any(), any(Integer.class), any(Integer.class));
    }

    @Test
    void search_returns403_whenAccessTokenIsStudentRole() throws Exception {
        authenticateAsStudent();

        mockMvc.perform(get("/api/assignments")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(assignmentAdminService, never()).search(any(), any(), any(Integer.class), any(Integer.class));
    }

    @Test
    void getById_returns200_withClassTarget_andQuestionsInOrder() throws Exception {
        authenticateAsAdmin();
        AssignmentDetail detail = new AssignmentDetail(
            1L,
            "현재완료 시제 연습",
            AssignmentTargetType.CLASS,
            "중1 A반",
            null,
            "중1 A반",
            AssignmentStatus.IN_PROGRESS,
            LocalDate.of(2026, 8, 3),
            LocalDate.of(2026, 8, 5),
            List.of(
                new AssignmentQuestionSummary(1, 1024L, "현재완료", "He has lived here _____ 2010."),
                new AssignmentQuestionSummary(2, 1023L, "현재완료", "She has studied English _____ three years.")
            ),
            new AssignmentSubmissionProgress(25, 21)
        );
        when(assignmentAdminService.getDetail(1L)).thenReturn(detail);

        mockMvc.perform(get("/api/assignments/1")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.targetType").value("CLASS"))
            .andExpect(jsonPath("$.targetGroup").value("중1 A반"))
            .andExpect(jsonPath("$.targetStudentId").doesNotExist())
            .andExpect(jsonPath("$.target").value("중1 A반"))
            .andExpect(jsonPath("$.status").value("진행 중"))
            .andExpect(jsonPath("$.progress").value(84))
            .andExpect(jsonPath("$.questions[0].id").value(1024))
            .andExpect(jsonPath("$.questions[0].order").value(1))
            .andExpect(jsonPath("$.questions[0].category").value("현재완료"))
            .andExpect(jsonPath("$.questions[0].text").value("He has lived here _____ 2010."))
            .andExpect(jsonPath("$.questions[1].id").value(1023))
            .andExpect(jsonPath("$.questions[1].order").value(2))
            .andExpect(jsonPath("$.questions[0].answer").doesNotExist())
            .andExpect(jsonPath("$.questions[0].explanation").doesNotExist());
    }

    @Test
    void getById_returns200_withStudentTarget_omittingTargetGroup() throws Exception {
        authenticateAsAdmin();
        AssignmentDetail detail = new AssignmentDetail(
            2L,
            "개별 보충 과제",
            AssignmentTargetType.STUDENT,
            null,
            501L,
            "김민수",
            AssignmentStatus.SCHEDULED,
            LocalDate.of(2026, 9, 1),
            LocalDate.of(2026, 9, 3),
            List.of(new AssignmentQuestionSummary(1, 1021L, "가정법", "If I _____ you.")),
            AssignmentSubmissionProgress.zero()
        );
        when(assignmentAdminService.getDetail(2L)).thenReturn(detail);

        mockMvc.perform(get("/api/assignments/2")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.targetType").value("STUDENT"))
            .andExpect(jsonPath("$.targetGroup").doesNotExist())
            .andExpect(jsonPath("$.targetStudentId").value(501))
            .andExpect(jsonPath("$.target").value("김민수"))
            .andExpect(jsonPath("$.status").value("예정"))
            .andExpect(jsonPath("$.progress").value(0));
    }

    @Test
    void getById_returns404_withAssignmentNotFoundCode_whenAssignmentDoesNotExist() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.getDetail(999L))
            .thenThrow(new AssignmentNotFoundException("과제를 찾을 수 없습니다."));

        mockMvc.perform(get("/api/assignments/999")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("ASSIGNMENT_NOT_FOUND"));
    }

    @Test
    void getById_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/assignments/1"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void getById_returns403_whenAccessTokenIsStudentRole() throws Exception {
        authenticateAsStudent();

        mockMvc.perform(get("/api/assignments/1")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(assignmentAdminService, never()).getDetail(any());
    }

    @Test
    void create_returns201_withClassTarget() throws Exception {
        authenticateAsAdmin();
        AssignmentListItem created = new AssignmentListItem(
            4L, "현재완료 시제 연습", AssignmentTargetType.CLASS, "중1 A반", null, "중1 A반",
            AssignmentStatus.SCHEDULED, LocalDate.of(2026, 8, 18), LocalDate.of(2026, 8, 20), 3,
            AssignmentSubmissionProgress.zero());
        when(assignmentAdminService.create(eq("현재완료 시제 연습"), eq(AssignmentTargetType.CLASS), eq("중1 A반"),
            isNull(), eq(LocalDate.of(2026, 8, 18)), eq(LocalDate.of(2026, 8, 20)), eq(List.of(1024L, 1023L, 1021L))))
            .thenReturn(created);
        String body = """
            {
              "title": "현재완료 시제 연습",
              "targetType": "CLASS",
              "targetGroup": "중1 A반",
              "startDate": "2026-08-18",
              "dueDate": "2026-08-20",
              "questionIds": [1024, 1023, 1021]
            }
            """;

        mockMvc.perform(post("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/api/assignments/4"))
            .andExpect(jsonPath("$.id").value(4))
            .andExpect(jsonPath("$.targetType").value("CLASS"))
            .andExpect(jsonPath("$.target").value("중1 A반"))
            .andExpect(jsonPath("$.status").value("예정"))
            .andExpect(jsonPath("$.progress").value(0));
    }

    @Test
    void create_returns201_withStudentTarget() throws Exception {
        authenticateAsAdmin();
        AssignmentListItem created = new AssignmentListItem(
            5L, "개별 보충 과제", AssignmentTargetType.STUDENT, null, 501L, "김민수",
            AssignmentStatus.IN_PROGRESS, LocalDate.of(2026, 8, 16), LocalDate.of(2026, 8, 18), 1,
            AssignmentSubmissionProgress.zero());
        when(assignmentAdminService.create(eq("개별 보충 과제"), eq(AssignmentTargetType.STUDENT), isNull(),
            eq(501L), eq(LocalDate.of(2026, 8, 16)), eq(LocalDate.of(2026, 8, 18)), eq(List.of(1024L))))
            .thenReturn(created);
        String body = """
            {
              "title": "개별 보충 과제",
              "targetType": "STUDENT",
              "targetStudentId": 501,
              "startDate": "2026-08-16",
              "dueDate": "2026-08-18",
              "questionIds": [1024]
            }
            """;

        mockMvc.perform(post("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/api/assignments/5"))
            .andExpect(jsonPath("$.targetType").value("STUDENT"))
            .andExpect(jsonPath("$.targetGroup").doesNotExist())
            .andExpect(jsonPath("$.targetStudentId").value(501))
            .andExpect(jsonPath("$.target").value("김민수"));
    }

    @Test
    void create_returns400_withInvalidAssignmentCode_whenQuestionIdsIsEmpty() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.create(any(), any(), any(), any(), any(), any(), any()))
            .thenThrow(new InvalidAssignmentException("문제를 1개 이상 선택해야 합니다."));
        String body = """
            {
              "title": "제목",
              "targetType": "CLASS",
              "targetGroup": "중1 A반",
              "startDate": "2026-08-18",
              "dueDate": "2026-08-20",
              "questionIds": []
            }
            """;

        mockMvc.perform(post("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_ASSIGNMENT"));
    }

    @Test
    void create_returns400_withInvalidAssignmentCode_whenStartDateAfterDueDate() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.create(any(), any(), any(), any(), any(), any(), any()))
            .thenThrow(new InvalidAssignmentException("시작일은 마감일보다 늦을 수 없습니다."));
        String body = """
            {
              "title": "제목",
              "targetType": "CLASS",
              "targetGroup": "중1 A반",
              "startDate": "2026-08-20",
              "dueDate": "2026-08-18",
              "questionIds": [1024]
            }
            """;

        mockMvc.perform(post("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_ASSIGNMENT"));
    }

    @Test
    void create_returns404_withQuestionNotFoundCode_whenQuestionIdDoesNotExist() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.create(any(), any(), any(), any(), any(), any(), any()))
            .thenThrow(new QuestionNotFoundException("문제를 찾을 수 없습니다."));
        String body = """
            {
              "title": "제목",
              "targetType": "CLASS",
              "targetGroup": "중1 A반",
              "startDate": "2026-08-18",
              "dueDate": "2026-08-20",
              "questionIds": [999999]
            }
            """;

        mockMvc.perform(post("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
    }

    @Test
    void create_returns404_withStudentNotFoundCode_whenTargetStudentDoesNotExist() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.create(any(), any(), any(), any(), any(), any(), any()))
            .thenThrow(new StudentNotFoundException("학생을 찾을 수 없습니다."));
        String body = """
            {
              "title": "제목",
              "targetType": "STUDENT",
              "targetStudentId": 999999,
              "startDate": "2026-08-18",
              "dueDate": "2026-08-20",
              "questionIds": [1024]
            }
            """;

        mockMvc.perform(post("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("STUDENT_NOT_FOUND"));
    }

    @Test
    void create_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        String body = """
            { "title": "제목", "targetType": "CLASS", "targetGroup": "중1 A반",
              "startDate": "2026-08-18", "dueDate": "2026-08-20", "questionIds": [1024] }
            """;

        mockMvc.perform(post("/api/assignments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isUnauthorized());

        verify(assignmentAdminService, never()).create(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void create_returns403_whenAccessTokenIsStudentRole() throws Exception {
        authenticateAsStudent();
        String body = """
            { "title": "제목", "targetType": "CLASS", "targetGroup": "중1 A반",
              "startDate": "2026-08-18", "dueDate": "2026-08-20", "questionIds": [1024] }
            """;

        mockMvc.perform(post("/api/assignments")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(assignmentAdminService, never()).create(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void update_returns200_withMergedDueDate() throws Exception {
        authenticateAsAdmin();
        AssignmentDetail updated = new AssignmentDetail(
            1L, "현재완료 시제 연습", AssignmentTargetType.CLASS, "중1 A반", null, "중1 A반",
            AssignmentStatus.IN_PROGRESS, LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 12),
            List.of(new AssignmentQuestionSummary(1, 1024L, "현재완료", "He has lived here _____ 2010.")),
            new AssignmentSubmissionProgress(25, 21));
        when(assignmentAdminService.update(eq(1L), isNull(), isNull(), isNull(), isNull(),
            eq(LocalDate.of(2026, 8, 12)), isNull()))
            .thenReturn(updated);
        String body = """
            { "dueDate": "2026-08-12" }
            """;

        mockMvc.perform(patch("/api/assignments/1")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dueDate").value("2026-08-12"))
            .andExpect(jsonPath("$.questions[0].id").value(1024));
    }

    @Test
    void update_returns200_withTargetTypeSwitch() throws Exception {
        authenticateAsAdmin();
        AssignmentDetail updated = new AssignmentDetail(
            1L, "현재완료 시제 연습", AssignmentTargetType.STUDENT, null, 501L, "김민수",
            AssignmentStatus.IN_PROGRESS, LocalDate.of(2026, 8, 3), LocalDate.of(2026, 8, 5),
            List.of(new AssignmentQuestionSummary(1, 1024L, "현재완료", "He has lived here _____ 2010.")),
            AssignmentSubmissionProgress.zero());
        when(assignmentAdminService.update(eq(1L), eq(AssignmentTargetType.STUDENT), isNull(), eq(501L),
            isNull(), isNull(), isNull()))
            .thenReturn(updated);
        String body = """
            { "targetType": "STUDENT", "targetStudentId": 501 }
            """;

        mockMvc.perform(patch("/api/assignments/1")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.targetType").value("STUDENT"))
            .andExpect(jsonPath("$.targetGroup").doesNotExist())
            .andExpect(jsonPath("$.targetStudentId").value(501))
            .andExpect(jsonPath("$.target").value("김민수"));
    }

    @Test
    void update_returns400_withInvalidAssignmentCode_whenDatesConflict() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.update(any(), any(), any(), any(), any(), any(), any()))
            .thenThrow(new InvalidAssignmentException("시작일은 마감일보다 늦을 수 없습니다."));
        String body = """
            { "startDate": "2026-09-01" }
            """;

        mockMvc.perform(patch("/api/assignments/1")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_ASSIGNMENT"));
    }

    @Test
    void update_returns404_withAssignmentNotFoundCode_whenAssignmentDoesNotExist() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.update(any(), any(), any(), any(), any(), any(), any()))
            .thenThrow(new AssignmentNotFoundException("과제를 찾을 수 없습니다."));
        String body = """
            { "dueDate": "2026-08-12" }
            """;

        mockMvc.perform(patch("/api/assignments/999")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("ASSIGNMENT_NOT_FOUND"));
    }

    @Test
    void update_returns409_withAssignmentAlreadyClosedCode_whenAssignmentIsClosed() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.update(any(), any(), any(), any(), any(), any(), any()))
            .thenThrow(new AssignmentAlreadyClosedException("마감된 과제는 수정할 수 없습니다."));
        String body = """
            { "dueDate": "2026-08-30" }
            """;

        mockMvc.perform(patch("/api/assignments/1")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ASSIGNMENT_ALREADY_CLOSED"));
    }

    @Test
    void update_returns404_withQuestionNotFoundCode_whenNewQuestionIdDoesNotExist() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.update(any(), any(), any(), any(), any(), any(), any()))
            .thenThrow(new QuestionNotFoundException("문제를 찾을 수 없습니다."));
        String body = """
            { "questionIds": [999999] }
            """;

        mockMvc.perform(patch("/api/assignments/1")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
    }

    @Test
    void update_returns404_withStudentNotFoundCode_whenNewTargetStudentDoesNotExist() throws Exception {
        authenticateAsAdmin();
        when(assignmentAdminService.update(any(), any(), any(), any(), any(), any(), any()))
            .thenThrow(new StudentNotFoundException("학생을 찾을 수 없습니다."));
        String body = """
            { "targetType": "STUDENT", "targetStudentId": 999999 }
            """;

        mockMvc.perform(patch("/api/assignments/1")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("STUDENT_NOT_FOUND"));
    }

    @Test
    void update_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        String body = """
            { "dueDate": "2026-08-12" }
            """;

        mockMvc.perform(patch("/api/assignments/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isUnauthorized());

        verify(assignmentAdminService, never()).update(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void update_returns403_whenAccessTokenIsStudentRole() throws Exception {
        authenticateAsStudent();
        String body = """
            { "dueDate": "2026-08-12" }
            """;

        mockMvc.perform(patch("/api/assignments/1")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(assignmentAdminService, never()).update(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void delete_returns204_whenAssignmentExists() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(delete("/api/assignments/1")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isNoContent());

        verify(assignmentAdminService).delete(1L);
    }

    @Test
    void delete_returns404_withAssignmentNotFoundCode_whenAssignmentDoesNotExist() throws Exception {
        authenticateAsAdmin();
        doThrow(new AssignmentNotFoundException("과제를 찾을 수 없습니다."))
            .when(assignmentAdminService).delete(999L);

        mockMvc.perform(delete("/api/assignments/999")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("ASSIGNMENT_NOT_FOUND"));
    }

    @Test
    void delete_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(delete("/api/assignments/1"))
            .andExpect(status().isUnauthorized());

        verify(assignmentAdminService, never()).delete(any());
    }

    @Test
    void delete_returns403_whenAccessTokenIsStudentRole() throws Exception {
        authenticateAsStudent();

        mockMvc.perform(delete("/api/assignments/1")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(assignmentAdminService, never()).delete(any());
    }

    private void authenticateAsAdmin() {
        when(jwtTokenProvider.isValid("access-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("access-token")).thenReturn(1L);
        when(jwtTokenProvider.getMemberType("access-token")).thenReturn(MemberType.ADMIN);
    }

    private void authenticateAsStudent() {
        when(jwtTokenProvider.isValid("access-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("access-token")).thenReturn(2L);
        when(jwtTokenProvider.getMemberType("access-token")).thenReturn(MemberType.STUDENT);
    }
}
