package com.ewha_eng.grmr.studyrecord.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ewha_eng.grmr.auth.infrastructure.JwtAuthenticationFilter;
import com.ewha_eng.grmr.auth.infrastructure.JwtTokenProvider;
import com.ewha_eng.grmr.global.exception.GlobalExceptionHandler;
import com.ewha_eng.grmr.global.security.JsonAccessDeniedHandler;
import com.ewha_eng.grmr.global.security.JsonAuthenticationEntryPoint;
import com.ewha_eng.grmr.global.security.SecurityConfig;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.ewha_eng.grmr.studyrecord.application.StudyRecordService;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordNotFoundException;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PracticeRecordController.class)
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JsonAuthenticationEntryPoint.class,
    JsonAccessDeniedHandler.class,
    GlobalExceptionHandler.class
})
class PracticeRecordControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private StudyRecordService studyRecordService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    private Member student(Long id) {
        Member member = Member.builder()
            .loginId("student01")
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .build();
        ReflectionTestUtils.setField(member, "id", id);
        return member;
    }

    private Question activeMultipleChoiceQuestion() {
        Question question = Question.builder()
            .category("가정법")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.ADVANCED)
            .text("If I _____ you, I would study harder.")
            .choices(List.of("am", "was", "were", "be"))
            .answer("were")
            .explanation("가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.")
            .build();
        ReflectionTestUtils.setField(question, "id", 1021L);
        question.activate();
        return question;
    }

    private StudyRecord practiceAttempt(Member member, Question question, String answer, Long id) {
        StudyRecord record = StudyRecord.createPracticeAttempt(member, question, answer,
            LocalDateTime.of(2026, 8, 15, 10, 0));
        ReflectionTestUtils.setField(record, "id", id);
        return record;
    }

    @Test
    void getMyRecords_returns200_withListOfSummaries() throws Exception {
        authenticateAsStudent(2L);
        Member member = student(2L);
        Question question = activeMultipleChoiceQuestion();
        StudyRecord record = practiceAttempt(member, question, "were", 501L);
        Page<StudyRecord> page = new PageImpl<>(List.of(record), PageRequest.of(0, 20), 1);
        when(studyRecordService.getMyPracticeRecords(eq(2L), isNull(), any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(501))
            .andExpect(jsonPath("$.content[0].questionId").value(1021))
            .andExpect(jsonPath("$.content[0].type").value("PRACTICE"))
            .andExpect(jsonPath("$.content[0].category").value("가정법"))
            .andExpect(jsonPath("$.content[0].level").value("심화"))
            .andExpect(jsonPath("$.content[0].correct").value(true))
            .andExpect(jsonPath("$.content[0].submittedAt").exists())
            .andExpect(jsonPath("$.content[0].text").value("If I _____ you, I would study harder."))
            .andExpect(jsonPath("$.content[0].choices").doesNotExist())
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(20))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void getMyRecords_returnsSnapshotText_evenAfterQuestionTextChanges() throws Exception {
        authenticateAsStudent(2L);
        Member member = student(2L);
        Question question = activeMultipleChoiceQuestion();
        StudyRecord record = practiceAttempt(member, question, "were", 501L);
        question.update(null, null, null, "If I _____ you, I would call you.", null, null, null);
        Page<StudyRecord> page = new PageImpl<>(List.of(record), PageRequest.of(0, 20), 1);
        when(studyRecordService.getMyPracticeRecords(eq(2L), isNull(), any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].text").value("If I _____ you, I would study harder."));
    }

    @Test
    void getMyRecords_returns200_withEmptyContent_whenMemberHasNoRecords() throws Exception {
        authenticateAsStudent(2L);
        when(studyRecordService.getMyPracticeRecords(eq(2L), isNull(), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content").isEmpty())
            .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void getMyRecords_passesCategoryFilter_toService() throws Exception {
        authenticateAsStudent(2L);
        when(studyRecordService.getMyPracticeRecords(eq(2L), eq("가정법"), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token")
                .param("category", "가정법"))
            .andExpect(status().isOk());

        verify(studyRecordService).getMyPracticeRecords(eq(2L), eq("가정법"), any(Pageable.class));
    }

    @Test
    void getMyRecords_passesPageAndSize_toService() throws Exception {
        authenticateAsStudent(2L);
        when(studyRecordService.getMyPracticeRecords(eq(2L), isNull(), eq(PageRequest.of(1, 5))))
            .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token")
                .param("page", "1")
                .param("size", "5"))
            .andExpect(status().isOk());

        verify(studyRecordService).getMyPracticeRecords(2L, null, PageRequest.of(1, 5));
    }

    @Test
    void getMyRecords_usesMemberIdFromJwt_notFromQuery() throws Exception {
        authenticateAsStudent(2L);
        when(studyRecordService.getMyPracticeRecords(eq(2L), isNull(), any(Pageable.class)))
            .thenReturn(new PageImpl<>(List.of()));

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token")
                .param("memberId", "999")
                .param("studentId", "999"))
            .andExpect(status().isOk());

        verify(studyRecordService).getMyPracticeRecords(eq(2L), isNull(), any(Pageable.class));
    }

    @Test
    void getMyRecords_returns400_withInvalidRequestCode_whenPageIsNegative() throws Exception {
        authenticateAsStudent(2L);

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token")
                .param("page", "-1"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(studyRecordService, never()).getMyPracticeRecords(any(), any(), any());
    }

    @Test
    void getMyRecords_returns400_withInvalidRequestCode_whenSizeIsZero() throws Exception {
        authenticateAsStudent(2L);

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token")
                .param("size", "0"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(studyRecordService, never()).getMyPracticeRecords(any(), any(), any());
    }

    @Test
    void getMyRecords_returns400_withInvalidRequestCode_whenSizeExceedsMax() throws Exception {
        authenticateAsStudent(2L);

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token")
                .param("size", "101"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(studyRecordService, never()).getMyPracticeRecords(any(), any(), any());
    }

    @Test
    void getMyRecords_returns400_withInvalidRequestCode_whenPageIsNonNumeric() throws Exception {
        authenticateAsStudent(2L);

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token")
                .param("page", "abc"))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
            .andExpect(jsonPath("$.message").isNotEmpty());

        verify(studyRecordService, never()).getMyPracticeRecords(any(), any(), any());
    }

    @Test
    void getMyRecords_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/me/practice/records"))
            .andExpect(status().isUnauthorized());

        verify(studyRecordService, never()).getMyPracticeRecords(any(), any(), any());
    }

    @Test
    void getMyRecords_returns403_whenAccessTokenIsAdminRole() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/me/practice/records")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(studyRecordService, never()).getMyPracticeRecords(any(), any(), any());
    }

    @Test
    void getMyRecord_returns200_withFullSnapshot() throws Exception {
        authenticateAsStudent(2L);
        Member member = student(2L);
        Question question = activeMultipleChoiceQuestion();
        StudyRecord record = practiceAttempt(member, question, "were", 501L);
        when(studyRecordService.getMyPracticeRecord(2L, 501L)).thenReturn(record);

        mockMvc.perform(get("/api/me/practice/records/501")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(501))
            .andExpect(jsonPath("$.questionId").value(1021))
            .andExpect(jsonPath("$.type").value("PRACTICE"))
            .andExpect(jsonPath("$.question.category").value("가정법"))
            .andExpect(jsonPath("$.question.level").value("심화"))
            .andExpect(jsonPath("$.question.text").value("If I _____ you, I would study harder."))
            .andExpect(jsonPath("$.question.choices[0]").value("am"))
            .andExpect(jsonPath("$.question.choices[2]").value("were"))
            .andExpect(jsonPath("$.question.correctAnswer").value("were"))
            .andExpect(jsonPath("$.question.explanation")
                .value("가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다."))
            .andExpect(jsonPath("$.submittedAnswer").value("were"))
            .andExpect(jsonPath("$.correct").value(true))
            .andExpect(jsonPath("$.submittedAt").exists());
    }

    @Test
    void getMyRecord_usesMemberIdFromJwt_notFromQueryOrBody() throws Exception {
        authenticateAsStudent(2L);
        Member member = student(2L);
        Question question = activeMultipleChoiceQuestion();
        StudyRecord record = practiceAttempt(member, question, "were", 501L);
        when(studyRecordService.getMyPracticeRecord(2L, 501L)).thenReturn(record);

        mockMvc.perform(get("/api/me/practice/records/501")
                .header("Authorization", "Bearer access-token")
                .param("memberId", "999"))
            .andExpect(status().isOk());

        verify(studyRecordService).getMyPracticeRecord(2L, 501L);
    }

    @Test
    void getMyRecord_returns400_withInvalidRequestCode_whenIdIsNonNumeric() throws Exception {
        authenticateAsStudent(2L);

        mockMvc.perform(get("/api/me/practice/records/abc")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
            .andExpect(jsonPath("$.message").isNotEmpty());

        verify(studyRecordService, never()).getMyPracticeRecord(any(), any());
    }

    @Test
    void getMyRecord_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/me/practice/records/501"))
            .andExpect(status().isUnauthorized());

        verify(studyRecordService, never()).getMyPracticeRecord(any(), any());
    }

    @Test
    void getMyRecord_returns403_whenAccessTokenIsAdminRole() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/me/practice/records/501")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(studyRecordService, never()).getMyPracticeRecord(any(), any());
    }

    @Test
    void getMyRecord_returns404_withStudyRecordNotFoundCode_whenRecordDoesNotExist() throws Exception {
        authenticateAsStudent(2L);
        when(studyRecordService.getMyPracticeRecord(2L, 999L))
            .thenThrow(new StudyRecordNotFoundException("학습 기록을 찾을 수 없습니다."));

        mockMvc.perform(get("/api/me/practice/records/999")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("STUDY_RECORD_NOT_FOUND"));
    }

    @Test
    void getMyRecord_returns404_withStudyRecordNotFoundCode_whenRecordIsOwnedByAnotherStudent() throws Exception {
        authenticateAsStudent(3L);
        when(studyRecordService.getMyPracticeRecord(3L, 501L))
            .thenThrow(new StudyRecordNotFoundException("학습 기록을 찾을 수 없습니다."));

        mockMvc.perform(get("/api/me/practice/records/501")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("STUDY_RECORD_NOT_FOUND"));
    }

    private void authenticateAsAdmin() {
        when(jwtTokenProvider.isValid("access-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("access-token")).thenReturn(1L);
        when(jwtTokenProvider.getMemberType("access-token")).thenReturn(MemberType.ADMIN);
    }

    private void authenticateAsStudent(Long memberId) {
        when(jwtTokenProvider.isValid("access-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("access-token")).thenReturn(memberId);
        when(jwtTokenProvider.getMemberType("access-token")).thenReturn(MemberType.STUDENT);
    }
}
