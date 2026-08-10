package com.ewha_eng.grmr.question.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import com.ewha_eng.grmr.question.application.QuestionGenerationService;
import com.ewha_eng.grmr.question.application.QuestionService;
import com.ewha_eng.grmr.question.domain.GptGenerationFailedException;
import com.ewha_eng.grmr.question.domain.InvalidQuestionException;
import com.ewha_eng.grmr.question.domain.InvalidStatusTransitionException;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionDraft;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import com.ewha_eng.grmr.question.domain.QuestionStatus;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
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
    private QuestionGenerationService questionGenerationService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void search_returns200_withPagedContent_whenQueryHasNoFilters() throws Exception {
        authenticateAsAdmin();

        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("설명")
            .build();
        ReflectionTestUtils.setField(question, "id", 1L);

        when(questionService.search(isNull(), isNull(), isNull(), isNull(), isNull(), eq(PageRequest.of(0, 20))))
            .thenReturn(new PageImpl<>(List.of(question), PageRequest.of(0, 20), 1));

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(1))
            .andExpect(jsonPath("$.content[0].status").value("초안"))
            .andExpect(jsonPath("$.page").value(0))
            .andExpect(jsonPath("$.size").value(20))
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.totalPages").value(1));
    }

    @Test
    void search_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        mockMvc.perform(get("/api/questions"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void search_returns403_whenAccessTokenIsStudentRole() throws Exception {
        authenticateAsStudent();

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        verify(questionService, never()).search(any(), any(), any(), any(), any(), any());
    }

    @Test
    void search_returns200_withConvertedFilters_whenAllFiltersAreValid() throws Exception {
        authenticateAsAdmin();

        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("설명")
            .build();
        ReflectionTestUtils.setField(question, "id", 1L);

        when(questionService.search(eq("현재완료"), eq(QuestionType.MULTIPLE_CHOICE), eq(QuestionLevel.INTERMEDIATE),
            eq(QuestionStatus.ACTIVE), eq("since"), eq(PageRequest.of(2, 10))))
            .thenReturn(new PageImpl<>(List.of(question), PageRequest.of(2, 10), 1));

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("category", "현재완료")
                .param("type", "객관식")
                .param("level", "보통")
                .param("status", "사용 중")
                .param("keyword", "since")
                .param("page", "2")
                .param("size", "10"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].id").value(1));

        verify(questionService).search("현재완료", QuestionType.MULTIPLE_CHOICE, QuestionLevel.INTERMEDIATE,
            QuestionStatus.ACTIVE, "since", PageRequest.of(2, 10));
    }

    @Test
    void search_returns400_withInvalidQuestionCode_whenTypeIsUnknown() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("type", "알 수 없음"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));

        verify(questionService, never()).search(any(), any(), any(), any(), any(), any());
    }

    @Test
    void search_returns400_withInvalidQuestionCode_whenLevelIsUnknown() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("level", "매우 어려움"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));

        verify(questionService, never()).search(any(), any(), any(), any(), any(), any());
    }

    @Test
    void search_returns400_withInvalidQuestionCode_whenStatusIsUnknown() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("status", "알 수 없음"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));

        verify(questionService, never()).search(any(), any(), any(), any(), any(), any());
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenPageIsNegative() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("page", "-1"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(questionService, never()).search(any(), any(), any(), any(), any(), any());
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenSizeIsZero() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("size", "0"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(questionService, never()).search(any(), any(), any(), any(), any(), any());
    }

    @Test
    void search_returns400_withInvalidRequestCode_whenSizeExceedsMaximum() throws Exception {
        authenticateAsAdmin();

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("size", "101"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));

        verify(questionService, never()).search(any(), any(), any(), any(), any(), any());
    }

    @Test
    void search_returns200_whenPageIsZeroBoundary() throws Exception {
        authenticateAsAdmin();

        when(questionService.search(isNull(), isNull(), isNull(), isNull(), isNull(), eq(PageRequest.of(0, 20))))
            .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("page", "0"))
            .andExpect(status().isOk());
    }

    @Test
    void search_returns200_whenSizeIsOneBoundary() throws Exception {
        authenticateAsAdmin();

        when(questionService.search(isNull(), isNull(), isNull(), isNull(), isNull(), eq(PageRequest.of(0, 1))))
            .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 1), 0));

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("size", "1"))
            .andExpect(status().isOk());
    }

    @Test
    void search_returns200_whenSizeIsOneHundredBoundary() throws Exception {
        authenticateAsAdmin();

        when(questionService.search(isNull(), isNull(), isNull(), isNull(), isNull(), eq(PageRequest.of(0, 100))))
            .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 100), 0));

        mockMvc.perform(get("/api/questions")
                .header("Authorization", "Bearer access-token")
                .param("size", "100"))
            .andExpect(status().isOk());
    }

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
    void create_returns400_withInvalidQuestionCode_whenCategoryIsBlank() throws Exception {
        authenticateAsAdmin();

        when(questionService.create(anyString(), any(), any(), anyString(), anyList(), anyString(), anyString()))
            .thenThrow(new InvalidQuestionException("문법 항목은 필수입니다."));

        QuestionCreateRequest request = new QuestionCreateRequest(
            "   ",
            "객관식",
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
    void generate_returns200_withDrafts_whenPayloadIsValid() throws Exception {
        authenticateAsAdmin();

        QuestionDraft draft = new QuestionDraft(
            "현재완료",
            QuestionType.MULTIPLE_CHOICE,
            QuestionLevel.INTERMEDIATE,
            "She has studied English _____ three years.",
            List.of("for", "since", "during", "from"),
            "for",
            "기간을 나타낼 때 for를 사용합니다."
        );

        when(questionGenerationService.generate(eq("현재완료"), eq(QuestionType.MULTIPLE_CHOICE),
            eq(QuestionLevel.INTERMEDIATE), eq(3), eq("쉬운 어휘를 사용해 주세요.")))
            .thenReturn(List.of(draft));

        QuestionGenerateRequest request = new QuestionGenerateRequest(
            "현재완료", "보통", "객관식", 3, "쉬운 어휘를 사용해 주세요.");

        mockMvc.perform(post("/api/questions/generate")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.drafts[0].category").value("현재완료"))
            .andExpect(jsonPath("$.drafts[0].type").value("객관식"))
            .andExpect(jsonPath("$.drafts[0].level").value("보통"))
            .andExpect(jsonPath("$.drafts[0].answer").value("for"))
            .andExpect(jsonPath("$.drafts[0].id").doesNotExist())
            .andExpect(jsonPath("$.drafts[0].status").doesNotExist())
            .andExpect(jsonPath("$.drafts[0].createdAt").doesNotExist());
    }

    @Test
    void generate_returns400_withInvalidQuestionCode_whenTypeIsUnknown() throws Exception {
        authenticateAsAdmin();

        QuestionGenerateRequest request = new QuestionGenerateRequest(
            "현재완료", "보통", "알 수 없음", 3, null);

        mockMvc.perform(post("/api/questions/generate")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void generate_returns400_withInvalidQuestionCode_whenCountIsOutOfRange() throws Exception {
        authenticateAsAdmin();

        QuestionGenerateRequest request = new QuestionGenerateRequest(
            "현재완료", "보통", "객관식", 11, null);

        mockMvc.perform(post("/api/questions/generate")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void generate_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        QuestionGenerateRequest request = new QuestionGenerateRequest(
            "현재완료", "보통", "객관식", 3, null);

        mockMvc.perform(post("/api/questions/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void generate_returns502_withGptGenerationFailedCode_whenGenerationClientFails() throws Exception {
        authenticateAsAdmin();

        when(questionGenerationService.generate(eq("현재완료"), eq(QuestionType.MULTIPLE_CHOICE),
            eq(QuestionLevel.INTERMEDIATE), eq(3), isNull()))
            .thenThrow(new GptGenerationFailedException("문제 생성에 실패했습니다. 다시 시도해주세요."));

        QuestionGenerateRequest request = new QuestionGenerateRequest(
            "현재완료", "보통", "객관식", 3, null);

        mockMvc.perform(post("/api/questions/generate")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadGateway())
            .andExpect(jsonPath("$.code").value("GPT_GENERATION_FAILED"))
            .andExpect(jsonPath("$.message").value("문제 생성에 실패했습니다. 다시 시도해주세요."));
    }

    @Test
    void saveGenerated_returns201_withSavedDraftQuestions_whenPayloadIsValid() throws Exception {
        authenticateAsAdmin();

        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("She has studied English _____ three years.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("for")
            .explanation("기간을 나타낼 때 for를 사용합니다.")
            .build();
        ReflectionTestUtils.setField(question, "id", 1031L);

        when(questionService.saveDrafts(anyList())).thenReturn(List.of(question));

        QuestionDraftItemRequest draft = new QuestionDraftItemRequest(
            "현재완료",
            "객관식",
            "보통",
            "She has studied English _____ three years.",
            List.of("for", "since", "during", "from"),
            "for",
            "기간을 나타낼 때 for를 사용합니다."
        );
        QuestionSaveRequest request = new QuestionSaveRequest(List.of(draft));

        mockMvc.perform(post("/api/questions/generate/save")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.saved[0].id").value(1031))
            .andExpect(jsonPath("$.saved[0].category").value("현재완료"))
            .andExpect(jsonPath("$.saved[0].type").value("객관식"))
            .andExpect(jsonPath("$.saved[0].level").value("보통"))
            .andExpect(jsonPath("$.saved[0].status").value("초안"))
            .andExpect(jsonPath("$.saved[0].text").value("She has studied English _____ three years."));
    }

    @Test
    void saveGenerated_returns400_withInvalidQuestionCode_whenDraftsIsEmpty() throws Exception {
        authenticateAsAdmin();

        QuestionSaveRequest request = new QuestionSaveRequest(List.of());

        mockMvc.perform(post("/api/questions/generate/save")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void saveGenerated_returns400_withInvalidQuestionCode_whenDraftTypeIsUnknown() throws Exception {
        authenticateAsAdmin();

        QuestionDraftItemRequest draft = new QuestionDraftItemRequest(
            "현재완료", "알 수 없음", "보통", "text", List.of("a", "b"), "a", "해설");
        QuestionSaveRequest request = new QuestionSaveRequest(List.of(draft));

        mockMvc.perform(post("/api/questions/generate/save")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void saveGenerated_returns400_withInvalidQuestionCode_whenDraftLevelIsUnknown() throws Exception {
        authenticateAsAdmin();

        QuestionDraftItemRequest draft = new QuestionDraftItemRequest(
            "현재완료", "객관식", "매우 어려움", "text", List.of("a", "b"), "a", "해설");
        QuestionSaveRequest request = new QuestionSaveRequest(List.of(draft));

        mockMvc.perform(post("/api/questions/generate/save")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void saveGenerated_returns400_withInvalidQuestionCode_whenAnswerIsNotInChoices() throws Exception {
        authenticateAsAdmin();

        when(questionService.saveDrafts(anyList()))
            .thenThrow(new InvalidQuestionException("정답은 보기 목록에 포함되어야 합니다."));

        QuestionDraftItemRequest draft = new QuestionDraftItemRequest(
            "현재완료", "객관식", "보통", "text", List.of("a", "b"), "since", "해설");
        QuestionSaveRequest request = new QuestionSaveRequest(List.of(draft));

        mockMvc.perform(post("/api/questions/generate/save")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void saveGenerated_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        QuestionDraftItemRequest draft = new QuestionDraftItemRequest(
            "현재완료", "객관식", "보통", "text", List.of("a", "b"), "a", "해설");
        QuestionSaveRequest request = new QuestionSaveRequest(List.of(draft));

        mockMvc.perform(post("/api/questions/generate/save")
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

    @Test
    void update_returns200_withUpdatedQuestion_whenPayloadIsValid() throws Exception {
        authenticateAsAdmin();

        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2015.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("수정된 해설")
            .build();
        ReflectionTestUtils.setField(question, "id", 1L);

        when(questionService.update(eq(1L), isNull(), isNull(), isNull(), anyString(), isNull(), isNull(),
            anyString()))
            .thenReturn(question);

        QuestionUpdateRequest request = new QuestionUpdateRequest(
            null, null, null, "He has lived here _____ 2015.", null, null, "수정된 해설");

        mockMvc.perform(patch("/api/questions/1")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.text").value("He has lived here _____ 2015."))
            .andExpect(jsonPath("$.explanation").value("수정된 해설"));
    }

    @Test
    void update_returns400_withInvalidQuestionCode_whenAnswerIsNotInChoices() throws Exception {
        authenticateAsAdmin();

        when(questionService.update(eq(1L), isNull(), isNull(), isNull(), isNull(), isNull(), anyString(),
            isNull()))
            .thenThrow(new InvalidQuestionException("정답은 보기 목록에 포함되어야 합니다."));

        QuestionUpdateRequest request = new QuestionUpdateRequest(
            null, null, null, null, null, "because", null);

        mockMvc.perform(patch("/api/questions/1")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void update_returns404_withQuestionNotFoundCode_whenQuestionDoesNotExist() throws Exception {
        authenticateAsAdmin();

        when(questionService.update(eq(999L), isNull(), isNull(), isNull(), anyString(), isNull(), isNull(),
            isNull()))
            .thenThrow(new QuestionNotFoundException("문제를 찾을 수 없습니다."));

        QuestionUpdateRequest request = new QuestionUpdateRequest(
            null, null, null, "수정된 본문", null, null, null);

        mockMvc.perform(patch("/api/questions/999")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
    }

    @Test
    void update_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        QuestionUpdateRequest request = new QuestionUpdateRequest(
            null, null, null, "수정된 본문", null, null, null);

        mockMvc.perform(patch("/api/questions/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void changeStatus_returns200_withUpdatedStatus_whenTransitionIsValid() throws Exception {
        authenticateAsAdmin();

        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("해설")
            .build();
        question.activate();
        question.deactivate();
        ReflectionTestUtils.setField(question, "id", 1024L);

        when(questionService.changeStatus(1024L, "사용 중지")).thenReturn(question);

        QuestionStatusChangeRequest request = new QuestionStatusChangeRequest("사용 중지");

        mockMvc.perform(patch("/api/questions/1024/status")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(1024))
            .andExpect(jsonPath("$.status").value("사용 중지"));
    }

    @Test
    void changeStatus_returns404_withQuestionNotFoundCode_whenQuestionDoesNotExist() throws Exception {
        authenticateAsAdmin();

        when(questionService.changeStatus(999L, "사용 중"))
            .thenThrow(new QuestionNotFoundException("문제를 찾을 수 없습니다."));

        QuestionStatusChangeRequest request = new QuestionStatusChangeRequest("사용 중");

        mockMvc.perform(patch("/api/questions/999/status")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("QUESTION_NOT_FOUND"));
    }

    @Test
    void changeStatus_returns409_withInvalidStatusTransitionCode_whenDraftChangesToInactive() throws Exception {
        authenticateAsAdmin();

        when(questionService.changeStatus(1L, "사용 중지"))
            .thenThrow(new InvalidStatusTransitionException("초안 상태에서는 사용 중지로 변경할 수 없습니다."));

        QuestionStatusChangeRequest request = new QuestionStatusChangeRequest("사용 중지");

        mockMvc.perform(patch("/api/questions/1/status")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("INVALID_STATUS_TRANSITION"))
            .andExpect(jsonPath("$.message").value("초안 상태에서는 사용 중지로 변경할 수 없습니다."));
    }

    @Test
    void changeStatus_returns400_withInvalidQuestionCode_whenStatusIsUnknown() throws Exception {
        authenticateAsAdmin();

        when(questionService.changeStatus(1L, "알 수 없음"))
            .thenThrow(new InvalidQuestionException("알 수 없는 상태입니다: 알 수 없음"));

        QuestionStatusChangeRequest request = new QuestionStatusChangeRequest("알 수 없음");

        mockMvc.perform(patch("/api/questions/1/status")
                .header("Authorization", "Bearer access-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_QUESTION"));
    }

    @Test
    void changeStatus_returns401_whenNoAuthorizationHeaderIsPresent() throws Exception {
        QuestionStatusChangeRequest request = new QuestionStatusChangeRequest("사용 중");

        mockMvc.perform(patch("/api/questions/1/status")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isUnauthorized());
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
