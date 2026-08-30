package com.ewha_eng.grmr.studyrecord.presentation;

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
import com.ewha_eng.grmr.studyrecord.application.StudyRecordAdminService;
import com.ewha_eng.grmr.studyrecord.domain.InvalidStudyRecordSearchException;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordRollup;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordType;
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

@WebMvcTest(StudyRecordAdminController.class)
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JsonAuthenticationEntryPoint.class,
    JsonAccessDeniedHandler.class,
    GlobalExceptionHandler.class
})
class StudyRecordAdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StudyRecordAdminService studyRecordAdminService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    private StudyRecordRollup rollup() {
        return new StudyRecordRollup(501L, "김민수", LocalDate.of(2026, 8, 1), StudyRecordType.ASSIGNMENT, 20, 16);
    }

    @Test
    void search_returns200_withRollupFields_andPageEnvelope() throws Exception {
        authenticateAsAdmin();
        when(studyRecordAdminService.search(isNull(), isNull(), isNull(), eq(0), eq(20)))
            .thenReturn(new PageImpl<>(List.of(rollup()), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/study-records")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].studentId").value(501))
            .andExpect(jsonPath("$.content[0].studentName").value("김민수"))
            .andExpect(jsonPath("$.content[0].date").value("2026-08-01"))
            .andExpect(jsonPath("$.content[0].type").value("ASSIGNMENT"))
            .andExpect(jsonPath("$.content[0].questionCount").value(20))
            .andExpect(jsonPath("$.content[0].correctCount").value(16))
            .andExpect(jsonPath("$.content[0].accuracy").value(80))
            .andExpect(jsonPath("$.content[0].durationMinutes").value(0))
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(20))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void search_passesAllFilters_toService() throws Exception {
        authenticateAsAdmin();
        when(studyRecordAdminService.search(eq(501L), eq("7d"), eq("PRACTICE"), eq(1), eq(10)))
            .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/study-records")
                .header("Authorization", "Bearer access-token")
                .param("studentId", "501")
                .param("period", "7d")
                .param("type", "PRACTICE")
                .param("page", "1")
                .param("size", "10"))
            .andExpect(status().isOk());

        verify(studyRecordAdminService).search(501L, "7d", "PRACTICE", 1, 10);
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenPeriodIsInvalid() throws Exception {
        authenticateAsAdmin();
        when(studyRecordAdminService.search(isNull(), eq("14d"), isNull(), eq(0), eq(20)))
            .thenThrow(new InvalidStudyRecordSearchException("period는 7d 또는 30d만 가능합니다: 14d"));

        mockMvc.perform(get("/api/study-records")
                .header("Authorization", "Bearer access-token")
                .param("period", "14d"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenTypeIsInvalid() throws Exception {
        authenticateAsAdmin();
        when(studyRecordAdminService.search(isNull(), isNull(), eq("QUIZ"), eq(0), eq(20)))
            .thenThrow(new InvalidStudyRecordSearchException("type은 ASSIGNMENT 또는 PRACTICE만 가능합니다: QUIZ"));

        mockMvc.perform(get("/api/study-records")
                .header("Authorization", "Bearer access-token")
                .param("type", "QUIZ"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenPageIsNegative() throws Exception {
        authenticateAsAdmin();
        when(studyRecordAdminService.search(isNull(), isNull(), isNull(), eq(-1), eq(20)))
            .thenThrow(new InvalidStudyRecordSearchException("페이지 번호는 0 이상이어야 합니다: -1"));

        mockMvc.perform(get("/api/study-records")
                .header("Authorization", "Bearer access-token")
                .param("page", "-1"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenSizeExceedsMaximum() throws Exception {
        authenticateAsAdmin();
        when(studyRecordAdminService.search(isNull(), isNull(), isNull(), eq(0), eq(101)))
            .thenThrow(new InvalidStudyRecordSearchException("페이지 크기는 1 이상 100 이하이어야 합니다: 101"));

        mockMvc.perform(get("/api/study-records")
                .header("Authorization", "Bearer access-token")
                .param("size", "101"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    }

    @Test
    void search_returns404_withStudentNotFoundCode_whenStudentIdDoesNotResolve() throws Exception {
        authenticateAsAdmin();
        when(studyRecordAdminService.search(eq(999L), isNull(), isNull(), eq(0), eq(20)))
            .thenThrow(new StudentNotFoundException("학생을 찾을 수 없습니다."));

        mockMvc.perform(get("/api/study-records")
                .header("Authorization", "Bearer access-token")
                .param("studentId", "999"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("STUDENT_NOT_FOUND"));
    }

    @Test
    void search_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/study-records"))
            .andExpect(status().isUnauthorized());

        verify(studyRecordAdminService, never()).search(any(), any(), any(), any(Integer.class), any(Integer.class));
    }

    @Test
    void search_returns403_whenAccessTokenIsStudentRole() throws Exception {
        authenticateAsStudent();

        mockMvc.perform(get("/api/study-records")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(studyRecordAdminService, never()).search(any(), any(), any(), any(Integer.class), any(Integer.class));
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
