package com.ewha_eng.grmr.question.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ewha_eng.grmr.auth.infrastructure.JwtAuthenticationFilter;
import com.ewha_eng.grmr.auth.infrastructure.JwtTokenProvider;
import com.ewha_eng.grmr.global.exception.GlobalExceptionHandler;
import com.ewha_eng.grmr.global.security.JsonAccessDeniedHandler;
import com.ewha_eng.grmr.global.security.JsonAuthenticationEntryPoint;
import com.ewha_eng.grmr.global.security.SecurityConfig;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.application.QuestionService;
import com.ewha_eng.grmr.question.domain.InvalidQuestionException;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@WebMvcTest(QuestionController.class)
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JsonAuthenticationEntryPoint.class,
    JsonAccessDeniedHandler.class,
    GlobalExceptionHandler.class
})
class QuestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private QuestionService questionService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void create_returns201_withLocationAndDraftStatus_whenPayloadIsValid() throws Exception {
        authenticateAsAdmin();

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

        when(questionService.create(anyString(), any(), any(), anyString(), anyList(), anyString(), anyString()))
            .thenReturn(question);

        QuestionCreateRequest request = new QuestionCreateRequest(
            "현재완료",
            "객관식",
            "보통",
            "He has lived here _____ 2010.",
            List.of("for", "since", "during", "from"),
            "since",
            "특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다."
        );

        mockMvc.perform(post("/api/questions")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/api/questions/1"))
            .andExpect(jsonPath("$.status").value("초안"))
            .andExpect(jsonPath("$.type").value("객관식"))
            .andExpect(jsonPath("$.level").value("보통"))
            .andExpect(jsonPath("$.answer").value("since"));
    }

    @Test
    void create_returns400_withInvalidQuestionCode_whenTypeIsMissing() throws Exception {
        authenticateAsAdmin();

        QuestionCreateRequest request = new QuestionCreateRequest(
            "현재완료",
            null,
            "보통",
            "He has lived here _____ 2010.",
            List.of("for", "since", "during", "from"),
            "since",
            "해설"
        );

        mockMvc.perform(post("/api/questions")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void create_returns400_withInvalidQuestionCode_whenLevelIsUnknown() throws Exception {
        authenticateAsAdmin();

        QuestionCreateRequest request = new QuestionCreateRequest(
            "현재완료",
            "객관식",
            "매우 어려움",
            "He has lived here _____ 2010.",
            List.of("for", "since", "during", "from"),
            "since",
            "해설"
        );

        mockMvc.perform(post("/api/questions")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void create_returns400_withInvalidQuestionCode_whenAnswerIsNotInChoices() throws Exception {
        authenticateAsAdmin();

        when(questionService.create(anyString(), any(), any(), anyString(), anyList(), anyString(), anyString()))
            .thenThrow(new InvalidQuestionException("정답은 보기 목록에 포함되어야 합니다."));

        QuestionCreateRequest request = new QuestionCreateRequest(
            "현재완료",
            "객관식",
            "보통",
            "He has lived here _____ 2010.",
            List.of("for", "during", "from"),
            "since",
            "해설"
        );

        mockMvc.perform(post("/api/questions")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void create_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        QuestionCreateRequest request = new QuestionCreateRequest(
            "현재완료", "객관식", "보통", "text", List.of("a", "b"), "a", "해설");

        mockMvc.perform(post("/api/questions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void getById_returns200_withQuestion_whenQuestionExists() throws Exception {
        authenticateAsAdmin();

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

        when(questionService.getById(1L)).thenReturn(question);

        mockMvc.perform(get("/api/questions/1")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1))
            .andExpect(jsonPath("$.status").value("초안"))
            .andExpect(jsonPath("$.answer").value("since"));
    }

    @Test
    void getById_returns404_withQuestionNotFoundCode_whenQuestionDoesNotExist() throws Exception {
        authenticateAsAdmin();

        when(questionService.getById(999L))
            .thenThrow(new QuestionNotFoundException("문제를 찾을 수 없습니다."));

        mockMvc.perform(get("/api/questions/999")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
    }

    @Test
    void getById_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/questions/1"))
            .andExpect(status().isUnauthorized());
    }

    private void authenticateAsAdmin() {
        when(jwtTokenProvider.isValid("access-token")).thenReturn(true);
        when(jwtTokenProvider.getMemberId("access-token")).thenReturn(1L);
        when(jwtTokenProvider.getMemberType("access-token")).thenReturn(MemberType.ADMIN);
    }
}
