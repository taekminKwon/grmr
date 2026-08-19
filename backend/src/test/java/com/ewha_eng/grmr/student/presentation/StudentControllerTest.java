package com.ewha_eng.grmr.student.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ewha_eng.grmr.assignment.domain.StudentNotFoundException;
import com.ewha_eng.grmr.auth.infrastructure.JwtAuthenticationFilter;
import com.ewha_eng.grmr.auth.infrastructure.JwtTokenProvider;
import com.ewha_eng.grmr.global.exception.GlobalExceptionHandler;
import com.ewha_eng.grmr.global.security.JsonAccessDeniedHandler;
import com.ewha_eng.grmr.global.security.JsonAuthenticationEntryPoint;
import com.ewha_eng.grmr.global.security.SecurityConfig;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.student.application.StudentAdminService;
import com.ewha_eng.grmr.student.application.StudentSummary;
import com.ewha_eng.grmr.student.domain.InvalidStudentSearchException;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(StudentController.class)
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JsonAuthenticationEntryPoint.class,
    JsonAccessDeniedHandler.class,
    GlobalExceptionHandler.class
})
class StudentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StudentAdminService studentAdminService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    private StudentSummary summary() {
        return new StudentSummary(501L, "김민수", "중1 A반", LocalDate.of(2026, 8, 1), 128, 74, 1);
    }

    @Test
    void search_returns200_withDefaultPaging_whenNoFiltersProvided() throws Exception {
        authenticateAsAdmin();
        when(studentAdminService.search(isNull(), isNull(), eq(0), eq(20)))
            .thenReturn(new PageImpl<>(List.of(summary()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/students")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(501))
            .andExpect(jsonPath("$.content[0].name").value("김민수"))
            .andExpect(jsonPath("$.content[0].studentGroup").value("중1 A반"))
            .andExpect(jsonPath("$.content[0].lastStudiedAt").value("2026-08-01"))
            .andExpect(jsonPath("$.content[0].totalQuestionCount").value(128))
            .andExpect(jsonPath("$.content[0].accuracy").value(74))
            .andExpect(jsonPath("$.content[0].pendingAssignmentCount").value(1))
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(20))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void search_returns200_withNullGroupAndLastStudiedAt_whenStudentHasNoHistory() throws Exception {
        authenticateAsAdmin();
        StudentSummary noHistory = new StudentSummary(502L, "이영희", null, null, 0, 0, 0);
        when(studentAdminService.search(isNull(), isNull(), eq(0), eq(20)))
            .thenReturn(new PageImpl<>(List.of(noHistory), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/students")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].studentGroup").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.content[0].lastStudiedAt").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.content[0].accuracy").value(0));
    }

    @Test
    void search_returns200_withConvertedFilters_whenAllFiltersAreValid() throws Exception {
        authenticateAsAdmin();
        when(studentAdminService.search(eq("민수"), eq("중1 A반"), eq(2), eq(10)))
            .thenReturn(new PageImpl<>(List.of(summary()), PageRequest.of(2, 10), 1));

        mockMvc.perform(get("/api/students")
                .header("Authorization", "Bearer access-token")
                .param("keyword", "민수")
                .param("group", "중1 A반")
                .param("page", "2")
                .param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(501));

        verify(studentAdminService).search("민수", "중1 A반", 2, 10);
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenPageIsNegative() throws Exception {
        authenticateAsAdmin();
        when(studentAdminService.search(isNull(), isNull(), eq(-1), eq(20)))
            .thenThrow(new InvalidStudentSearchException("페이지 번호는 0 이상이어야 합니다: -1"));

        mockMvc.perform(get("/api/students")
                .header("Authorization", "Bearer access-token")
                .param("page", "-1"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenSizeExceedsMaximum() throws Exception {
        authenticateAsAdmin();
        when(studentAdminService.search(isNull(), isNull(), eq(0), eq(101)))
            .thenThrow(new InvalidStudentSearchException("페이지 크기는 1 이상 100 이하이어야 합니다: 101"));

        mockMvc.perform(get("/api/students")
                .header("Authorization", "Bearer access-token")
                .param("size", "101"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void search_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/students"))
            .andExpect(status().isUnauthorized());

        verify(studentAdminService, never()).search(any(), any(), any(Integer.class), any(Integer.class));
    }

    @Test
    void search_returns403_whenAccessTokenIsStudentRole() throws Exception {
        authenticateAsStudent();

        mockMvc.perform(get("/api/students")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(studentAdminService, never()).search(any(), any(), any(Integer.class), any(Integer.class));
    }

    @Test
    void getById_returns200_withStudentSummary() throws Exception {
        authenticateAsAdmin();
        when(studentAdminService.getDetail(501L)).thenReturn(summary());

        mockMvc.perform(get("/api/students/501")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(501))
            .andExpect(jsonPath("$.name").value("김민수"))
            .andExpect(jsonPath("$.studentGroup").value("중1 A반"))
            .andExpect(jsonPath("$.lastStudiedAt").value("2026-08-01"))
            .andExpect(jsonPath("$.totalQuestionCount").value(128))
            .andExpect(jsonPath("$.accuracy").value(74))
            .andExpect(jsonPath("$.pendingAssignmentCount").value(1));
    }

    @Test
    void getById_returns404_withStudentNotFoundCode_whenStudentDoesNotExist() throws Exception {
        authenticateAsAdmin();
        when(studentAdminService.getDetail(999L))
            .thenThrow(new StudentNotFoundException("학생을 찾을 수 없습니다."));

        mockMvc.perform(get("/api/students/999")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("STUDENT_NOT_FOUND"));
    }

    @Test
    void getById_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/students/501"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void getById_returns403_whenAccessTokenIsStudentRole() throws Exception {
        authenticateAsStudent();

        mockMvc.perform(get("/api/students/501")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(studentAdminService, never()).getDetail(any());
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
