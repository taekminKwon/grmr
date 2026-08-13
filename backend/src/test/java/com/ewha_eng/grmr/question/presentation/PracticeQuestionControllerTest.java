package com.ewha_eng.grmr.question.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ewha_eng.grmr.auth.infrastructure.JwtAuthenticationFilter;
import com.ewha_eng.grmr.auth.infrastructure.JwtTokenProvider;
import com.ewha_eng.grmr.global.exception.GlobalExceptionHandler;
import com.ewha_eng.grmr.global.security.JsonAccessDeniedHandler;
import com.ewha_eng.grmr.global.security.JsonAuthenticationEntryPoint;
import com.ewha_eng.grmr.global.security.SecurityConfig;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.application.PracticeQuestionService;
import com.ewha_eng.grmr.question.domain.NoQuestionAvailableException;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PracticeQuestionController.class)
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JsonAuthenticationEntryPoint.class,
    JsonAccessDeniedHandler.class,
    GlobalExceptionHandler.class
})
class PracticeQuestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PracticeQuestionService practiceQuestionService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    private Question activeMultipleChoiceQuestion() {
        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.")
            .build();
        ReflectionTestUtils.setField(question, "id", 1L);
        question.activate();
        return question;
    }

    @Test
    void next_returns200_withQuestion_whenStudentAuthenticated() throws Exception {
        authenticateAsStudent();

        when(practiceQuestionService.getNext(isNull(), isNull())).thenReturn(activeMultipleChoiceQuestion());

        mockMvc.perform(get("/api/me/practice/questions/next")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.category").value("현재완료"))
            .andExpect(jsonPath("$.level").value("보통"))
            .andExpect(jsonPath("$.type").value("객관식"))
            .andExpect(jsonPath("$.text").value("He has lived here _____ 2010."))
            .andExpect(jsonPath("$.choices").isArray())
            .andExpect(jsonPath("$.choices[1]").value("since"));
    }

    @Test
    void next_neverLeaksAnswerOrExplanation() throws Exception {
        authenticateAsStudent();

        when(practiceQuestionService.getNext(isNull(), isNull())).thenReturn(activeMultipleChoiceQuestion());

        mockMvc.perform(get("/api/me/practice/questions/next")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.answer").doesNotExist())
            .andExpect(jsonPath("$.explanation").doesNotExist())
            .andExpect(jsonPath("$.status").doesNotExist());
    }

    @Test
    void next_passesConvertedFilters_whenCategoryAndLevelProvided() throws Exception {
        authenticateAsStudent();

        when(practiceQuestionService.getNext(eq("현재완료"), eq(QuestionLevel.INTERMEDIATE)))
            .thenReturn(activeMultipleChoiceQuestion());

        mockMvc.perform(get("/api/me/practice/questions/next")
                .header("Authorization", "Bearer access-token")
                .param("category", "현재완료")
                .param("level", "보통"))
            .andExpect(status().isOk());

        verify(practiceQuestionService).getNext("현재완료", QuestionLevel.INTERMEDIATE);
    }

    @Test
    void next_returns404_withNoQuestionAvailableCode_whenNoQuestionMatches() throws Exception {
        authenticateAsStudent();

        when(practiceQuestionService.getNext(isNull(), isNull()))
            .thenThrow(new NoQuestionAvailableException("출제 가능한 문제가 없습니다."));

        mockMvc.perform(get("/api/me/practice/questions/next")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("NO_QUESTION_AVAILABLE"));
    }

    @Test
    void next_returns400_withInvalidQuestionCode_whenLevelIsUnknown() throws Exception {
        authenticateAsStudent();

        mockMvc.perform(get("/api/me/practice/questions/next")
                .header("Authorization", "Bearer access-token")
                .param("level", "매우 어려움"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));

        verify(practiceQuestionService, never()).getNext(any(), any());
    }

    @Test
    void next_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/me/practice/questions/next"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void next_returns403_whenAccessTokenIsAdminRole() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/me/practice/questions/next")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(practiceQuestionService, never()).getNext(any(), any());
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
