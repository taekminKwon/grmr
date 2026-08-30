package com.ewha_eng.grmr.studyrecord.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import com.ewha_eng.grmr.question.domain.QuestionNotInUseException;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.ewha_eng.grmr.question.domain.QuestionTypeNotSupportedException;
import com.ewha_eng.grmr.studyrecord.application.StudyRecordService;
import com.ewha_eng.grmr.studyrecord.domain.InvalidStudyRecordException;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(StudyRecordController.class)
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JsonAuthenticationEntryPoint.class,
    JsonAccessDeniedHandler.class,
    GlobalExceptionHandler.class
})
class StudyRecordControllerTest {

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
    void submit_returns200_withCorrectResult_whenAnswerMatches() throws Exception {
        authenticateAsStudent(2L);
        Member member = student(2L);
        Question question = activeMultipleChoiceQuestion();
        StudyRecord record = practiceAttempt(member, question, "were", 501L);
        when(studyRecordService.submitPracticeAnswer(2L, 1021L, "were")).thenReturn(record);

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 1021, \"answer\": \"were\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(501))
            .andExpect(jsonPath("$.questionId").value(1021))
            .andExpect(jsonPath("$.correct").value(true))
            .andExpect(jsonPath("$.submittedAnswer").value("were"))
            .andExpect(jsonPath("$.correctAnswer").value("were"))
            .andExpect(jsonPath("$.explanation").value("가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다."))
            .andExpect(jsonPath("$.submittedAt").exists());
    }

    @Test
    void submit_returns200_withIncorrectResult_whenAnswerDoesNotMatch() throws Exception {
        authenticateAsStudent(2L);
        Member member = student(2L);
        Question question = activeMultipleChoiceQuestion();
        StudyRecord record = practiceAttempt(member, question, "am", 502L);
        when(studyRecordService.submitPracticeAnswer(2L, 1021L, "am")).thenReturn(record);

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 1021, \"answer\": \"am\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.correct").value(false))
            .andExpect(jsonPath("$.submittedAnswer").value("am"))
            .andExpect(jsonPath("$.correctAnswer").value("were"));
    }

    @Test
    void submit_usesMemberIdFromJwt_notFromRequestBody() throws Exception {
        authenticateAsStudent(2L);
        Member member = student(2L);
        Question question = activeMultipleChoiceQuestion();
        StudyRecord record = practiceAttempt(member, question, "were", 501L);
        when(studyRecordService.submitPracticeAnswer(eq(2L), eq(1021L), eq("were"))).thenReturn(record);

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 1021, \"answer\": \"were\"}"))
            .andExpect(status().isOk());

        verify(studyRecordService).submitPracticeAnswer(2L, 1021L, "were");
    }

    @Test
    void submit_returns400_withInvalidRequestCode_whenAnswerIsMissing() throws Exception {
        authenticateAsStudent(2L);

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 1021}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
            .andExpect(jsonPath("$.message").value("답안 입력은 필수입니다."));

        verify(studyRecordService, never()).submitPracticeAnswer(any(), any(), any());
    }

    @Test
    void submit_returns400_withInvalidRequestCode_whenAnswerIsBlank() throws Exception {
        authenticateAsStudent(2L);

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 1021, \"answer\": \"   \"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
            .andExpect(jsonPath("$.message").value("답안 입력은 필수입니다."));

        verify(studyRecordService, never()).submitPracticeAnswer(any(), any(), any());
    }

    @Test
    void submit_returns400_withInvalidRequestCode_whenQuestionIdIsMissing() throws Exception {
        authenticateAsStudent(2L);

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"answer\": \"were\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(studyRecordService, never()).submitPracticeAnswer(any(), any(), any());
    }

    @Test
    void submit_returns400_withInvalidRequestCode_whenQuestionIdIsNonNumeric() throws Exception {
        authenticateAsStudent(2L);

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": \"abc\", \"answer\": \"were\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
            .andExpect(jsonPath("$.message").isNotEmpty());

        verify(studyRecordService, never()).submitPracticeAnswer(any(), any(), any());
    }

    @Test
    void submit_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(post("/api/me/practice/answers")
                .contentType("application/json")
                .content("{\"questionId\": 1021, \"answer\": \"were\"}"))
            .andExpect(status().isUnauthorized());

        verify(studyRecordService, never()).submitPracticeAnswer(any(), any(), any());
    }

    @Test
    void submit_returns403_whenAccessTokenIsAdminRole() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 1021, \"answer\": \"were\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(studyRecordService, never()).submitPracticeAnswer(any(), any(), any());
    }

    @Test
    void submit_returns404_withQuestionNotFoundCode_whenQuestionDoesNotExist() throws Exception {
        authenticateAsStudent(2L);
        when(studyRecordService.submitPracticeAnswer(2L, 999999L, "were"))
            .thenThrow(new QuestionNotFoundException("문제를 찾을 수 없습니다."));

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 999999, \"answer\": \"were\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
    }

    @Test
    void submit_returns409_withQuestionNotInUseCode_whenQuestionIsNotActive() throws Exception {
        authenticateAsStudent(2L);
        when(studyRecordService.submitPracticeAnswer(2L, 1021L, "were"))
            .thenThrow(new QuestionNotInUseException("사용 중인 문제만 풀 수 있습니다."));

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 1021, \"answer\": \"were\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("QUESTION_NOT_IN_USE"));
    }

    @Test
    void submit_returns409_withQuestionTypeNotSupportedCode_whenQuestionIsNotMultipleChoice() throws Exception {
        authenticateAsStudent(2L);
        when(studyRecordService.submitPracticeAnswer(2L, 1024L, "that"))
            .thenThrow(new QuestionTypeNotSupportedException("객관식 문제만 풀 수 있습니다."));

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 1024, \"answer\": \"that\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("QUESTION_TYPE_NOT_SUPPORTED"));
    }

    @Test
    void submit_returns400_withInvalidRequestCode_whenStudyRecordIsInvalid() throws Exception {
        authenticateAsStudent(2L);
        when(studyRecordService.submitPracticeAnswer(2L, 1021L, "were"))
            .thenThrow(new InvalidStudyRecordException("학습 기록이 올바르지 않습니다."));

        mockMvc.perform(post("/api/me/practice/answers")
                .header("Authorization", "Bearer access-token")
                .contentType("application/json")
                .content("{\"questionId\": 1021, \"answer\": \"were\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
            .andExpect(jsonPath("$.message").value("학습 기록이 올바르지 않습니다."));
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
